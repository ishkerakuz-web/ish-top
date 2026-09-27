import type { WebSocket } from "ws";
import { deleteUserPushSubscriptions } from "./push.js";
import { CHANNEL, INSTANCE_ID, publishMessage, redisCall, subscribeToChannel } from "./redis.js";

/**
 * Ochiq WebSocket ulanishlarining yagona ro'yxati (userId -> socketlar).
 *
 * Chat ham, bildirishnoma ham shu ro'yxatdan foydalanadi: foydalanuvchi saytda
 * ochiq bo'lsa xabar darrov socket orqali boradi, oflayn bo'lsa —
 * notification xizmati Telegram/push/email kanallariga o'tadi.
 *
 * Heartbeat (audit ISSUE-040): mobil uyqu yoki NAT uzilishi `close` hodisasini
 * yubormaydi — o'lik socket ro'yxatda qolib `isOnline` yolg'on `true` berardi va
 * Telegram fallback ishlamasdi. Har 30 soniyada ping, javob bo'lmasa `terminate`.
 */
const sockets = new Map<string, Set<WebSocket>>();
const alive = new WeakMap<WebSocket, boolean>();

/**
 * Bitta hisob uchun ochiq socket chegarasi (audit R3, realtime-3).
 *
 * Ilgari chegara yo'q edi: bitta hisob o'nlab ulanish ochib har biridan alohida
 * token bucket bilan xabar yuborishi mumkin edi. Joriy web har varaqda IKKI ulanish
 * ochadi (chat + bildirishnoma qo'ng'irog'i), shuning uchun chegara 10 — taxminan
 * 5 ta varaq. Chegaradan oshsa ENG ESKI ulanish `4403` bilan yopiladi: klient bu
 * kodda qayta ulanmaydi, ya'ni varaqlar orasida uzluksiz qayta ulanish halqasi yuzaga kelmaydi.
 */
const MAX_SOCKETS_PER_USER = 10;
const CLOSE_TOO_MANY = 4403;

export function addSocket(userId: string, ws: WebSocket): void {
  let set = sockets.get(userId);
  if (!set) {
    set = new Set();
    sockets.set(userId, set);
  }
  // Set qo'shilish tartibini saqlaydi — eng eskisi birinchi
  while (set.size >= MAX_SOCKETS_PER_USER) {
    const oldest = set.values().next().value as WebSocket | undefined;
    if (!oldest) break;
    set.delete(oldest);
    try {
      oldest.close(CLOSE_TOO_MANY, "too many connections");
    } catch {
      /* allaqachon yopilgan */
    }
  }
  set.add(ws);
  alive.set(ws, true);
  ws.on("pong", () => alive.set(ws, true));
  markPresent(userId);
}

/**
 * "Bu foydalanuvchi SHU nusxada onlayn" belgisi (Redis bo'lsa). To'plam
 * ishlatiladi, chunki bitta odam bir nechta nusxaga ulangan bo'lishi mumkin.
 *
 * Muddat qo'yiladi (`PRESENCE_TTL_SEC`) va heartbeat'da yangilanadi: nusxa
 * kutilmaganda yiqilsa belgi o'zi yo'qoladi, "abadiy onlayn" hisob qolmaydi.
 */
function presenceKey(userId: string): string {
  return `presence:${userId}`;
}

const PRESENCE_TTL_SEC = 90;

function markPresent(userId: string): void {
  void redisCall("presence", async (redis) => {
    await redis.sadd(presenceKey(userId), INSTANCE_ID);
    await redis.expire(presenceKey(userId), PRESENCE_TTL_SEC);
  });
}

function markAbsent(userId: string): void {
  void redisCall("presence", (redis) => redis.srem(presenceKey(userId), INSTANCE_ID));
}

/** To'xtashdan oldin: shu nusxadagi onlayn belgilarini olib tashlaydi. */
export async function releasePresence(): Promise<void> {
  for (const userId of sockets.keys()) {
    await redisCall("presence", (redis) => redis.srem(presenceKey(userId), INSTANCE_ID));
  }
}

/** Foydalanuvchining ochiq ulanishlari soni (test va diagnostika uchun). */
export function socketCount(userId: string): number {
  return sockets.get(userId)?.size ?? 0;
}

export function removeSocket(userId: string, ws: WebSocket): void {
  const set = sockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    sockets.delete(userId);
    markAbsent(userId);
  }
}

/** Shu nusxadagi ochiq oynalarga yuboradi (pub/sub'dan kelgan xabar uchun ham). */
function sendLocally(userId: string, payload: string): void {
  const set = sockets.get(userId);
  if (!set) return;
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

/**
 * Foydalanuvchining barcha ochiq oynalariga JSON matn yuboradi — QAYSI nusxada
 * ulangan bo'lishidan qat'i nazar (audit: scale-redis-4).
 *
 * Ilgari socket ro'yxati faqat jarayon xotirasida edi: ikkita nusxali deployda
 * A nusxasidagi ish beruvchi yozgan xabar B nusxasiga ulangan nomzodga real
 * vaqtda YETMASDI (u sahifani yangilagandagina ko'rardi). Endi xabar Redis
 * kanaliga ham chiqadi va har bir nusxa o'zidagi oynalarga tarqatadi.
 */
export function sendToUser(userId: string, payload: string): void {
  sendLocally(userId, payload);
  publishMessage(CHANNEL.realtime, { from: INSTANCE_ID, kind: "send", userId, payload });
}

/**
 * Foydalanuvchi ayni damda saytda ochiqmi (chatda Telegram'ga ogohlantirish
 * yuborish-yubormaslik shunga bog'liq).
 *
 * Avval shu nusxa tekshiriladi (tezkor yo'l), keyin Redis'dagi umumiy ro'yxat:
 * boshqa nusxada ochiq bo'lsa ham "onlayn" hisoblanadi, aks holda odam saytda
 * o'tirib turib Telegram'ga ham keraksiz xabar olardi.
 */
export async function isOnline(userId: string): Promise<boolean> {
  if (sockets.has(userId)) return true;
  const instances = await redisCall("presence", (redis) => redis.scard(presenceKey(userId)));
  return (instances ?? 0) > 0;
}

/**
 * Bloklangan yoki roli o'zgargan foydalanuvchining ochiq socketlarini yopadi (klient qayta ulanishda tekshiriladi).
 *
 * Shu yerda push obunalari ham o'chiriladi (audit R3, gap2-4): bu funksiya seans bekor qilinganda
 * chaqiriladi (`revokeUserSessions`, bloklash, rol o'zgarishi, parol tiklash, telefon almashtirish),
 * push obunasi esa seansga bog'lanmagani uchun eski qurilmaga bildirishnoma kelaverardi.
 * Baza xatosi asosiy oqimni to'xtatmaydi (fire-and-forget).
 */
export function closeUserSockets(userId: string, code = 4403, reason = "session revoked"): void {
  void deleteUserPushSubscriptions(userId);
  closeLocalSockets(userId, code, reason);
  // Boshqa nusxadagi ulanish ham yopilsin — aks holda bloklangan hisob o'sha nusxada
  // ochiq socket orqali xabar olishda davom etardi (audit: scale-redis-4).
  publishMessage(CHANNEL.realtime, { from: INSTANCE_ID, kind: "close", userId, code, reason });
}

function closeLocalSockets(userId: string, code: number, reason: string): void {
  const set = sockets.get(userId);
  if (!set) return;
  for (const ws of [...set]) {
    try {
      ws.close(code, reason);
    } catch {
      /* allaqachon yopilgan */
    }
  }
}

/**
 * Boshqa nusxadan kelgan buyruqlar. Push obunasini o'chirish bu yerda TAKRORLANMAYDI —
 * uni xabarni yuborgan nusxa allaqachon bajargan.
 */
subscribeToChannel(CHANNEL.realtime, (payload) => {
  const msg = payload as { from?: string; kind?: string; userId?: string; payload?: string; code?: number; reason?: string };
  if (!msg || msg.from === INSTANCE_ID || typeof msg.userId !== "string") return;
  if (msg.kind === "send" && typeof msg.payload === "string") sendLocally(msg.userId, msg.payload);
  else if (msg.kind === "close") closeLocalSockets(msg.userId, msg.code ?? 4403, msg.reason ?? "session revoked");
});

let heartbeat: NodeJS.Timeout | null = null;

export function startHeartbeat(intervalMs = 30_000): void {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    for (const [userId, set] of sockets) {
      // Onlayn belgisining muddati uzaytiriladi (Redis bo'lsa)
      markPresent(userId);
      for (const ws of [...set]) {
        if (alive.get(ws) === false) {
          ws.terminate();
          removeSocket(userId, ws);
          continue;
        }
        alive.set(ws, false);
        try {
          ws.ping();
        } catch {
          /* ulanish yopilayotgan */
        }
      }
    }
  }, intervalMs);
  heartbeat.unref?.();
}

export function stopHeartbeat(): void {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
}
