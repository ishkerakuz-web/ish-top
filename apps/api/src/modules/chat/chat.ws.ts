import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import type { SocketStream } from "@fastify/websocket";
import { isObjectId } from "../../common/validation.js";
import { prisma } from "../../common/prisma.js";
import { requirePhoneVerified } from "../../common/auth-guard.js";
import { verifyAccessToken, type AccessTokenPayload } from "../../common/jwt.js";
import { addSocket, removeSocket, sendToUser } from "../../common/realtime.js";
import { consumeQuota, MINUTE_MS } from "../../common/quota.js";
import {
  WS_BUCKET_CAPACITY,
  WS_MESSAGES_PER_MINUTE,
  WS_READS_PER_MINUTE,
  WS_REFILL_PER_MS,
  deliverMessage,
  participantsOf,
} from "./chat.service.js";

/**
 * Chat WebSocket ishlovchisi (`/ws/chat`).
 *
 * Bu yerda faqat real vaqt qismi: ulanish, token tekshiruvi, token bucket, xabar
 * yuborish va "o'qildi" belgisi. REST marshrutlar `chat.routes.ts` da, mantiq esa
 * `chat.service.ts` da.
 */
export function chatSocketRoutes(app: FastifyInstance) {
  // Real-time chat — WebSocket. Brauzer header yubora olmagani uchun token query'da
  // (loglarda URL'dagi token yashiriladi — server.ts `redactUrl`).
  app.get("/ws/chat", { websocket: true }, (connection: SocketStream, req) => {
    const ws = connection.socket;
    let auth: AccessTokenPayload;
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      auth = verifyAccessToken(url.searchParams.get("token") ?? "");
    } catch {
      // 4401 — klient buni tarmoq uzilishidan ajratadi va yangi token bilan ulanadi
      ws.close(4401, "unauthorized");
      return;
    }
    const userId = auth.sub;
    let closed = false;
    /**
     * Telefon tasdig'i (audit R3, realtime-2 / gap2-6): REST `POST /api/conversations/start`
     * `requirePhoneVerified` bilan himoyalangan, WS esa umuman tekshirmasdi — tasdiqlanmagan hisob
     * mavjud suhbatda cheksiz yozishi mumkin edi.
     */
    let phoneVerified = false;

    /** Klientga xato kadri (audit R3, api-errors-6): ilgari rad etilgan yuborish jimgina yo'qolardi. */
    const sendError = (code: string, clientId?: string) => {
      if (ws.readyState !== 1) return;
      try {
        ws.send(JSON.stringify({ type: "error", code, ...(clientId ? { clientId } : {}) }));
      } catch {
        /* ulanish yopilayapti */
      }
    };

    // Uch xil natija (audit PHASE 6, U2/U12): baza xatosi — 1011 (vaqtinchalik, klient backoff bilan qayta
    // ulanadi); hisob yo'q yoki bloklangan — 4403; token versiyasi eskirgan — 4401 (klient seansni yangilaydi).
    // Ilgari baza xatosi ham 4403 edi va klient sahifa yangilanguncha qayta ulanmasdi.
    const tokenVersion = (auth as { v?: unknown }).v;
    const ready: Promise<boolean> = prisma.user
      .findUnique({
        where: { id: userId },
        select: { isBlocked: true, tokenVersion: true, isPhoneVerified: true },
      })
      .then(
        (u) => {
          if (!u || u.isBlocked) {
            ws.close(4403, "forbidden");
            return false;
          }
          // `v` siz eski tokenlar muddati tugaguncha qabul qilinadi
          if (typeof tokenVersion === "number" && tokenVersion !== (u.tokenVersion ?? 0)) {
            ws.close(4401, "session revoked");
            return false;
          }
          phoneVerified = u.isPhoneVerified === true;
          // Ulanish faqat tekshiruvdan SO'NG ro'yxatga olinadi (audit R3, realtime-14): ilgari
          // bloklangan yoki seansi bekor qilingan hisob ham tekshiruv tugaguncha jonli xabar olardi.
          if (!closed && ws.readyState === 1) addSocket(userId, ws);
          return true;
        },
        (err: unknown) => {
          req.log.warn({ err }, "WS ulanishida foydalanuvchini tekshirib bo'lmadi");
          ws.close(1011, "try again");
          return false;
        }
      );

    // Token muddati tugaganda ulanish yopiladi — klient yangi token bilan qayta ulanadi va blok holati qayta tekshiriladi
    let expiryTimer: NodeJS.Timeout | undefined;
    const scheduleExpiry = (exp?: number) => {
      if (expiryTimer) clearTimeout(expiryTimer);
      expiryTimer = undefined;
      if (!exp) return;
      expiryTimer = setTimeout(() => ws.close(4401, "token expired"), Math.max(0, exp * 1000 - Date.now()));
      expiryTimer.unref?.();
    };
    scheduleExpiry(auth.exp);

    /**
     * `{ type: "auth", token }` kadri (audit R3, realtime-15): klient ulanishni uzmasdan yangi
     * token yuboradi va muddat qaytadan hisoblanadi. Eski klient bu kadrni yubormaydi —
     * u avvalgidek 4401 dan keyin qayta ulanadi.
     */
    const handleAuthFrame = (token: unknown) => {
      if (typeof token !== "string" || token.length > 4096) return;
      try {
        const fresh = verifyAccessToken(token);
        if (fresh.sub !== userId) {
          ws.close(4401, "unauthorized");
          return;
        }
        scheduleExpiry(fresh.exp);
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: "auth", ok: true }));
      } catch {
        ws.close(4401, "unauthorized");
      }
    };

    let bucket = WS_BUCKET_CAPACITY;
    let lastRefill = Date.now();
    const allow = () => {
      const now = Date.now();
      bucket = Math.min(WS_BUCKET_CAPACITY, bucket + (now - lastRefill) * WS_REFILL_PER_MS);
      lastRefill = now;
      if (bucket < 1) return false;
      bucket -= 1;
      return true;
    };

    const handle = async (raw: { toString(): string }) => {
      let data: unknown;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!data || typeof data !== "object") return;
      const { type, conversationId, body, clientId, token } = data as Record<string, unknown>;
      const safeClientId = typeof clientId === "string" && clientId.length <= 64 ? clientId : undefined;
      // Token yangilash kadri bazaga bormaydi — `ready` dan oldin ham javob beradi.
      // Token bucket bu kadrga HAM tegishli (audit R3, realtime-3 review): aks holda bitta ulanish
      // cheksiz `auth` kadri yuborib, har biri uchun imzo tekshiruvi va javob kadri olardi —
      // ulanish bo'yicha yagona chegara chetlab o'tilardi. Haqiqiy klient 15 daqiqada bir marta yuboradi.
      if (type === "auth") {
        if (allow()) handleAuthFrame(token);
        return;
      }
      if (!(await ready)) return;
      if (type !== "read" && type !== "message") return;
      // Noto'g'ri formatdagi ID Prisma'ga yetmaydi (audit ISSUE-003: ilgari butun jarayonni yiqitardi)
      if (typeof conversationId !== "string" || !isObjectId(conversationId)) {
        if (type === "message") sendError("FORBIDDEN", safeClientId);
        return;
      }
      if (!allow()) {
        sendError("RATE_LIMITED", safeClientId);
        return;
      }
      // Token bucket ULANISH bo'yicha ishlaydi, shuning uchun hisob bo'yicha ham chegara bor
      // (audit R3, realtime-3): bir nechta ulanish ochib chegarani ko'paytirib bo'lmaydi.
      if (type === "message" && !(await consumeQuota(`ws:msg:${userId}`, WS_MESSAGES_PER_MINUTE, MINUTE_MS))) {
        sendError("RATE_LIMITED", safeClientId);
        return;
      }

      const parts = await participantsOf(conversationId);
      if (!parts || (userId !== parts.seekerId && userId !== parts.employerId)) {
        if (type === "message") sendError("FORBIDDEN", safeClientId);
        return;
      }
      const otherId = userId === parts.seekerId ? parts.employerId : parts.seekerId;

      if (type === "read") {
        if (!(await consumeQuota(`ws:read:${userId}`, WS_READS_PER_MINUTE, MINUTE_MS))) return;
        // Suhbatni o'qidim — yuboruvchini xabardor qilamiz (ikki belgi)
        await prisma.message.updateMany({
          where: { conversationId, senderId: { not: userId }, isRead: false },
          data: { isRead: true },
        });
        sendToUser(otherId, JSON.stringify({ type: "read", conversationId }));
        return;
      }

      if (typeof body !== "string") return;
      const text = body.trim();
      if (!text) return;

      // Telefon tasdig'i REST bilan bir xil (audit R3, realtime-2 / gap2-6). Bayroq ulanish
      // boshida o'qilgani uchun, tasdiqlanmagan bo'lsa bazadan bir marta qayta tekshiriladi:
      // foydalanuvchi boshqa varaqda tasdiqlagan bo'lsa qayta ulanishni kutmaydi.
      if (!phoneVerified) {
        const fresh = await prisma.user
          .findUnique({ where: { id: userId }, select: { isPhoneVerified: true } })
          .catch(() => null);
        phoneVerified = fresh?.isPhoneVerified === true;
        if (!phoneVerified) {
          sendError("PHONE_NOT_VERIFIED", safeClientId);
          return;
        }
      }

      try {
        await deliverMessage(conversationId, userId, otherId, text, safeClientId);
      } catch (err) {
        req.log.warn({ err }, "WS xabarini saqlab bo'lmadi");
        sendError("SERVER_ERROR", safeClientId);
      }
    };

    // Kadrlar KETMA-KET qayta ishlanadi (audit R3, realtime-13): ilgari har kadr mustaqil
    // ishlagani uchun tez yozilgan ikki xabar bazaga teskari tartibda tushishi mumkin edi.
    let queue: Promise<void> = Promise.resolve();
    ws.on("message", (raw) => {
      // Har qanday xato shu ulanish doirasida qoladi — jarayon yiqilmaydi
      queue = queue
        .then(() => handle(raw))
        .catch((err: unknown) => req.log.warn({ err }, "WS xabarini qayta ishlab bo'lmadi"));
    });

    ws.on("close", () => {
      closed = true;
      if (expiryTimer) clearTimeout(expiryTimer);
      removeSocket(userId, ws);
    });
    ws.on("error", () => {
      closed = true;
      removeSocket(userId, ws);
    });
  });
}
