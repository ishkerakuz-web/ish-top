import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "./api.js";
import { expireSession, getAccessToken, getSessionEpoch, refreshSession } from "./auth/session.js";
import { fullJitter, isPageVisible, socketOpened } from "./messages/live.js";
import type { ChatMessage } from "./types.js";

/** Server qaytargan xabar — yuborgan oynaga `clientId` ham qaytadi (tasdiq uchun). */
export type SocketMessage = ChatMessage & { clientId?: string };

interface Handlers {
  onMessage: (m: SocketMessage) => void;
  onRead?: (conversationId: string) => void;
  /** Ulanish o'rnatildi; `reconnected` — uzilishdan keyin qayta ulanish (o'tkazib yuborilganlarni yuklash uchun). */
  onOpen?: (reconnected: boolean) => void;
}

/** Server yopish kodlari (chat.routes.ts): token yaroqsiz/eskirgan va seans bekor qilingan (bloklangan). */
const CLOSE_UNAUTHORIZED = 4401;
const CLOSE_FORBIDDEN = 4403;
/** Ketma-ket 4401 da darrov refresh + qayta ulanish chegarasi; undan keyin odatiy kechikish (audit PHASE 6, U23). */
const MAX_AUTH_RETRIES = 2;
/**
 * Server tokenni ulanish OCHILGACH tekshiradi va 4401/1011 ni `open`dan keyin yuboradi. Shuning uchun hisoblagichlar
 * `open`da emas, ulanish shuncha vaqt ochiq turgach nolga qaytadi — aks holda 4401 chegarasi ham, 1011 dagi
 * kechikish o'sishi ham ishlamasdi (audit PHASE 6, U23).
 */
const STABLE_OPEN_MS = 10_000;

/**
 * Foydalanuvchi uchun bitta WebSocket ulanish (real-time chat).
 * `onMessage` — yangi xabar; `onRead` — suhbat qarshi tomonda o'qilganda.
 * Ulanish uzilsa (server qayta ishga tushdi, tarmoq) — tasodifiy kechikish bilan qayta ulanadi.
 * Har ulanishda eng yangi token olinadi; server token eskirgani uchun yopsa (4401) — avval yangilanadi.
 * `token` — seans identifikatori (faqat kirish/chiqishda o'zgaradi), fondagi yangilanish ulanishni uzmaydi.
 *
 * audit R3, realtime-7: kechikish to'liq tasodifiy (0..2^n s, eng ko'pi 30 s) — deploydan keyin
 * barcha klientlar bir vaqtda qayta ulanib serverni urmaydi.
 * audit R3, realtime-16: tarmoq qaytganda (`online`) va tab ko'ringanda darhol qayta ulanadi;
 * `reset()` yarim ochiq ulanishni yopadi (xabar tasdig'i kelmaganda chaqiriladi).
 */
export function useChatSocket(token: string | null, handlers: Handlers) {
  const wsRef = useRef<WebSocket | null>(null);
  const ref = useRef(handlers);
  ref.current = handlers;
  const [connected, setConnected] = useState(false);
  /** Yarim ochiq ulanishni majburan yopish — effekt ichida to'ldiriladi. */
  const resetRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!token || typeof window === "undefined") return;
    let socket: WebSocket | null = null;
    let timer = 0;
    let attempt = 0;
    let authFailures = 0;
    let everOpened = false;
    let disposed = false;
    /** Ulanish "jonli" deb hisoblanganda — hisobdan chiqarish funksiyasi (live.ts). */
    let releaseLive: (() => void) | null = null;

    // audit R3, realtime-7: to'liq tasodifiy kechikish (0..cap) — sinxron "gurra" qayta ulanish yo'q
    const schedule = (delay = fullJitter(Math.min(30_000, 1000 * 2 ** attempt))) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(connect, delay);
      attempt += 1;
    };

    /** Tarmoq qaytdi yoki tab ko'rindi — kutmasdan qayta ulanamiz (audit R3, realtime-16). */
    const reconnectNow = () => {
      if (disposed) return;
      const current = socket;
      if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) return;
      window.clearTimeout(timer);
      attempt = 0;
      connect();
    };

    resetRef.current = () => {
      if (disposed) return;
      const current = socket;
      // Yarim ochiq ulanish: yopamiz — `onclose` qisqa kechikish bilan qayta ulanadi
      if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) {
        attempt = 0;
        try {
          current.close();
        } catch {
          /* yopib bo'lmadi — `onclose` baribir keladi */
        }
        return;
      }
      reconnectNow();
    };

    function connect() {
      const current = getAccessToken() ?? token;
      if (!current) return;
      const ws = new WebSocket(`${WS_URL}/ws/chat?token=${encodeURIComponent(current)}`);
      socket = ws;
      wsRef.current = ws;
      /** Shu ulanish ochilgan vaqt (0 — ochilmagan). */
      let openedAt = 0;
      /** Aynan shu ulanishning "jonli" hisobi (boshqa ulanishniki chalkashmasin). */
      let releaseThis: (() => void) | null = null;
      ws.onopen = () => {
        openedAt = Date.now();
        setConnected(true);
        releaseThis = socketOpened();
        releaseLive = releaseThis;
        ref.current.onOpen?.(everOpened);
        everOpened = true;
      };
      ws.onclose = (event) => {
        if (wsRef.current === ws) wsRef.current = null;
        setConnected(false);
        if (releaseThis) {
          releaseThis();
          if (releaseLive === releaseThis) releaseLive = null;
          releaseThis = null;
        }
        if (disposed) return;
        // Barqaror ulanish uzildi (masalan, token muddati tugadi) — urinishlar hisobi yangidan (audit PHASE 6, U23)
        if (openedAt && Date.now() - openedAt >= STABLE_OPEN_MS) {
          attempt = 0;
          authFailures = 0;
        }
        // Seans bekor qilingan (bloklangan/rol o'zgargan) — qayta ulanish befoyda
        if (event.code === CLOSE_FORBIDDEN) return;
        if (event.code === CLOSE_UNAUTHORIZED && authFailures < MAX_AUTH_RETRIES) {
          authFailures += 1;
          const since = getSessionEpoch();
          void refreshSession().then((fresh) => {
            if (disposed) return;
            if (fresh) schedule(0);
            else if (fresh === undefined) schedule();
            // null — seans yo'q: AuthProvider mehmon holatiga o'tkaziladi, ulanish kerak emas (audit PHASE 6, U23)
            else expireSession(since);
          });
          return;
        }
        // Chegaradan oshgan 4401, 1011 (server/DB vaqtinchalik xatosi) va tarmoq uzilishi — kechikish bilan qayta ulanish
        schedule();
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "message" && data.message) {
            const clientId = typeof data.clientId === "string" ? data.clientId : undefined;
            ref.current.onMessage({ ...(data.message as ChatMessage), clientId });
          } else if (data.type === "read" && data.conversationId) ref.current.onRead?.(data.conversationId);
        } catch {
          /* noop */
        }
      };
    }
    connect();

    // Uyqudan yoki tarmoq uzilishidan keyin TCP timeout kutilmaydi (audit R3, realtime-16)
    const onOnline = () => reconnectNow();
    const onVisible = () => {
      if (isPageVisible()) reconnectNow();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      wsRef.current = null;
      releaseLive?.();
      releaseLive = null;
      const ws = socket;
      if (!ws) return;
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      // Hali ulanish o'rnatilmagan bo'lsa — "closed before established" ogohlantirishining
      // oldini olib, ulangach yopamiz.
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener("open", () => ws.close(), { once: true });
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [token]);

  const send = useCallback((conversationId: string, body: string, clientId?: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "message", conversationId, body, ...(clientId ? { clientId } : {}) }));
      return true;
    }
    return false;
  }, []);

  const markRead = useCallback((conversationId: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "read", conversationId }));
    }
  }, []);

  /** Ulanish "ochiq" ko'rinsa ham javob bermayapti — yopib qayta ulanamiz (audit R3, realtime-16). */
  const reset = useCallback(() => resetRef.current(), []);

  return { send, markRead, connected, reset };
}
