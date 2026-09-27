import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WS_URL } from "./api.js";
import { expireSession, getAccessToken, getSessionEpoch, refreshSession } from "./auth/session.js";
import { markAllNotificationsRead, markNotificationRead, deleteNotification as deleteNotificationApi } from "./apiExtra.js";
import { useT } from "./i18n/index.js";
import { fullJitter, isPageVisible, isSocketLive, onPageActive, socketOpened, staggerDelay } from "./messages/live.js";
import {
  isNotificationRow,
  mapNotificationRows,
  notificationRowId,
  type NotificationRow,
  type NotificationView,
} from "./notifications/adapter.js";
import { fetchNotificationCenter } from "./notifications/api.js";
import { NOTIFICATIONS_CHANGED, emitNotificationReceived } from "./notifications/events.js";

/** Server yopish kodlari (chat.routes.ts) — `useChatSocket` bilan bir xil (audit PHASE 6, U23). */
const CLOSE_UNAUTHORIZED = 4401;
const CLOSE_FORBIDDEN = 4403;
/** Ketma-ket 4401 da darrov refresh + qayta ulanish chegarasi; undan keyin odatiy kechikish. */
const MAX_AUTH_RETRIES = 2;
/** Hisoblagichlar ulanish shuncha vaqt ochiq turgach nolga qaytadi — server 4401/1011 ni `open`dan keyin yuboradi (audit PHASE 6, U23). */
const STABLE_OPEN_MS = 10_000;
/** Davriy so'rov: socket yopiq bo'lsa tez-tez, ochiq bo'lsa kamdan-kam (audit R3, realtime-9). */
const POLL_MS = 45_000;
const POLL_LIVE_MS = 180_000;

/**
 * Header qo'ng'irog'i uchun (to'liq markaz — `/notifications`, `useNotificationCenter`).
 *
 * Ikki manba: WebSocket (darrov keladi, sayt ochiq bo'lsa) va davriy so'rov
 * (socket uzilib qolsa ham son to'g'ri qoladi). Ikkalasi bir-birini to'ldiradi —
 * WS xabari kelganda ro'yxat boshiga qo'shiladi, so'rov esa to'liq holatni tiklaydi.
 * Kelgan xabar sahifaga ham uzatiladi; sahifada o'zgarish bo'lsa son qayta so'raladi.
 *
 * Audit ISSUE-067: so'rov xato bersa oldingi son saqlanadi (0 ga tushmaydi), kechikkan eski javob
 * yangisini yozmaydi, WebSocket uzilsa qayta ulanadi va qayta ulangach holat so'raladi.
 *
 * Audit R3:
 * - D-059: matn joriy tilda chiziladi (`payload.i18n`), noma'lum kalitda bazadagi matn qoladi;
 * - realtime-7: qayta ulanish kechikishi tasodifiy, qayta ulangach so'rov 0..3 s ga tarqatiladi;
 * - realtime-9: yashirin tabda so'rov yuborilmaydi, socket ochiq bo'lsa oraliq uzayadi;
 * - api-errors-4: o'qildi/hammasi o'qildi/o'chirish server rad etsa orqaga qaytariladi va `false` qaytaradi.
 */
export function useNotifications(token: string | null, options?: { limit?: number }) {
  const t = useT();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const limit = options?.limit ?? 30;
  const seq = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const refresh = useCallback(async () => {
    if (!token) {
      setRows([]);
      setUnreadCount(0);
      return;
    }
    const mine = ++seq.current;
    try {
      const data = await fetchNotificationCenter(token, { limit });
      if (mine !== seq.current) return;
      setRows(data.rows);
      setUnreadCount(data.unreadCount);
      setFailed(false);
    } catch {
      if (mine === seq.current) setFailed(true);
    }
  }, [token, limit]);

  // Birinchi yuklash + davriy yangilash + boshqa sahifadan qaytganda
  useEffect(() => {
    if (!token || typeof window === "undefined") {
      setRows([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    void refresh().finally(() => setLoading(false));

    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, isSocketLive() ? POLL_LIVE_MS : POLL_MS);
    };
    function tick() {
      // Yashirin tab so'rov yubormaydi (audit R3, realtime-9) — ko'ringanda darhol yangilanadi
      if (isPageVisible()) void refresh();
      schedule();
    }
    schedule();

    const onChanged = () => void refresh();
    const stopActive = onPageActive(() => {
      void refresh();
      schedule();
    });
    // `/notifications` sahifasida o'qildi/o'chirildi — son va ro'yxat yangilansin
    window.addEventListener(NOTIFICATIONS_CHANGED, onChanged);
    return () => {
      window.clearTimeout(timer);
      stopActive();
      window.removeEventListener(NOTIFICATIONS_CHANGED, onChanged);
    };
  }, [token, refresh]);

  // Real-time: server `notification` turidagi xabar yuboradi
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!token || typeof window === "undefined") return;
    let ws: WebSocket | null = null;
    let timer = 0;
    let reloadTimer = 0;
    let attempt = 0;
    let disposed = false;
    let everOpened = false;
    let releaseLive: (() => void) | null = null;
    /** Ketma-ket 4401 yopilishlarda bajarilgan refresh soni — barqaror ulanishdan keyin nolga qaytadi (audit PHASE 6, U23). */
    let authFailures = 0;

    // audit R3, realtime-7: to'liq tasodifiy kechikish — deploydan keyin hamma bir vaqtda urilmaydi
    const schedule = (delay = fullJitter(Math.min(30_000, 1000 * 2 ** attempt))) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(connect, delay);
      attempt += 1;
    };

    function connect() {
      const current = getAccessToken() ?? token;
      if (!current) return;
      const socket = new WebSocket(`${WS_URL}/ws/chat?token=${encodeURIComponent(current)}`);
      ws = socket;
      /** Shu ulanish ochilgan vaqt (0 — ochilmagan). */
      let openedAt = 0;
      let releaseThis: (() => void) | null = null;
      socket.onopen = () => {
        // Hisoblagichlar bu yerda nolga qaytmaydi — qarang: STABLE_OPEN_MS
        openedAt = Date.now();
        releaseThis = socketOpened();
        releaseLive = releaseThis;
        // Uzilish vaqtida kelgan bildirishnomalar o'tkazib yuborilmasin (so'rov 0..3 s ga tarqatiladi)
        if (everOpened) {
          window.clearTimeout(reloadTimer);
          reloadTimer = window.setTimeout(() => void refreshRef.current(), staggerDelay());
        }
        everOpened = true;
      };
      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type !== "notification" || !isNotificationRow(data.notification)) return;
          const incoming = data.notification as NotificationRow;
          const id = notificationRowId(incoming);
          let added = false;
          setRows((prev) => {
            if (prev.some((row) => notificationRowId(row) === id)) return prev;
            added = true;
            return [incoming, ...prev].slice(0, limit);
          });
          if (added && incoming.isRead === false) setUnreadCount((c) => c + 1);
          emitNotificationReceived(incoming);
        } catch {
          /* noto'g'ri JSON — e'tiborsiz qoldiramiz */
        }
      };
      socket.onclose = (event) => {
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
        if (event.code === CLOSE_FORBIDDEN) return;
        // 4401 — token eskirgan: yangilab darrov ulanamiz, lekin cheksiz aylanmaydi (audit PHASE 6, U23)
        if (event.code === CLOSE_UNAUTHORIZED && authFailures < MAX_AUTH_RETRIES) {
          authFailures += 1;
          const since = getSessionEpoch();
          void refreshSession().then((fresh) => {
            if (disposed) return;
            if (fresh) schedule(0);
            else if (fresh === undefined) schedule();
            // null — seans yo'q: AuthProvider mehmon holatiga o'tkaziladi, ulanish kerak emas
            else expireSession(since);
          });
          return;
        }
        // Chegaradan oshgan 4401, 1011 (server/DB vaqtinchalik xatosi) va tarmoq uzilishi — kechikish bilan qayta ulanish
        schedule();
      };
    }
    connect();

    /** Tarmoq qaytdi yoki tab ko'rindi — kutmasdan ulanamiz (audit R3, realtime-16). */
    const reconnectNow = () => {
      if (disposed) return;
      const socket = ws;
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
      window.clearTimeout(timer);
      attempt = 0;
      connect();
    };
    const onOnline = () => reconnectNow();
    const onVisible = () => {
      if (isPageVisible()) reconnectNow();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.clearTimeout(reloadTimer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      releaseLive?.();
      releaseLive = null;
      const socket = ws;
      if (!socket) return;
      socket.onmessage = socket.onerror = socket.onclose = socket.onopen = null;
      if (socket.readyState === WebSocket.CONNECTING) {
        socket.addEventListener("open", () => socket.close(), { once: true });
      } else if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [token, limit]);

  /**
   * Optimistik amal: UI darhol o'zgaradi, server rad etsa aynan o'sha o'zgarish qaytariladi
   * va `false` qaytadi — qo'ng'iroq xato xabarini ko'rsatadi (audit R3, api-errors-4).
   */
  const markRead = useCallback(
    async (id: string): Promise<boolean> => {
      if (!token) return false;
      const target = rowsRef.current.find((row) => notificationRowId(row) === id);
      if (!target || target.isRead !== false) return true;
      setRows((prev) => prev.map((row) => (notificationRowId(row) === id ? { ...row, isRead: true } : row)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await markNotificationRead(token, id);
        return true;
      } catch {
        setRows((prev) => prev.map((row) => (notificationRowId(row) === id ? { ...row, isRead: false } : row)));
        setUnreadCount((c) => c + 1);
        return false;
      }
    },
    [token]
  );

  const markAllRead = useCallback(async (): Promise<boolean> => {
    if (!token) return false;
    const unreadIds = new Set(rowsRef.current.filter((row) => row.isRead === false).map((row) => notificationRowId(row)));
    const previousCount = unreadCount;
    setRows((prev) => prev.map((row) => (row.isRead === false ? { ...row, isRead: true } : row)));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead(token);
      return true;
    } catch {
      setRows((prev) => prev.map((row) => (unreadIds.has(notificationRowId(row)) ? { ...row, isRead: false } : row)));
      setUnreadCount(previousCount);
      return false;
    }
  }, [token, unreadCount]);

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (!token) return false;
      const index = rowsRef.current.findIndex((row) => notificationRowId(row) === id);
      if (index < 0) return true;
      const removed = rowsRef.current[index];
      setRows((prev) => prev.filter((row) => notificationRowId(row) !== id));
      if (removed.isRead === false) setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await deleteNotificationApi(token, id);
        return true;
      } catch {
        setRows((prev) => {
          if (prev.some((row) => notificationRowId(row) === id)) return prev;
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        });
        if (removed.isRead === false) setUnreadCount((c) => c + 1);
        return false;
      }
    },
    [token]
  );

  // Til almashtirilganda matn ham almashadi (audit R3, D-059)
  const items: NotificationView[] = useMemo(() => mapNotificationRows(rows, t), [rows, t]);

  return { items, unreadCount, loading, failed, refresh, markRead, markAllRead, remove };
}
