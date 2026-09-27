import webpush from "web-push";
import { env, features } from "./env.js";
import { prisma } from "./prisma.js";

/**
 * Brauzer push xabarnomalari (Web Push / VAPID).
 *
 * VAPID kalitlari .env'da bo'lmasa modul o'zini o'chiradi — sayt oddiy ishlaydi,
 * faqat push bormaydi. Kalit yaratish: `npm run push:keys`.
 */

let configured = false;

function ensureConfigured(): boolean {
  if (!features.push) return false;
  if (!configured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Ma'lum push xizmatlari (audit R3, gap2-5): obuna manzili sifatida istalgan host qabul qilinsa,
 * server hujumchi tanlagan host:port ga chiquvchi so'rov yuboradi (SSRF yo'nalishi).
 * Ro'yxat brauzerlarning haqiqiy push xizmatlari bilan cheklangan; port — faqat standart 443.
 */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
] as const;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.port && url.port !== "443") return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** Push xizmatining javobini cheksiz kutmaslik uchun (audit R3, gap2-5). */
const PUSH_TIMEOUT_MS = 10_000;

/**
 * Foydalanuvchining barcha qurilmalariga push yuboradi.
 * Obuna eskirgan bo'lsa (404/410) — bazadan tozalanadi.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;

  await Promise.all(
    subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      // Eski yozuvda notanish host bo'lishi mumkin — chiquvchi so'rov yuborilmaydi (audit R3, gap2-5)
      if (!isAllowedPushEndpoint(sub.endpoint)) return;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { timeout: PUSH_TIMEOUT_MS }
        );
        delivered += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        }
      }
    })
  );

  return delivered;
}

/**
 * Foydalanuvchining barcha push obunalarini o'chiradi (audit R3, gap2-4).
 *
 * Seans bekor qilinganda (chiqish "barcha qurilmalardan", bloklash, rol o'zgarishi,
 * parol tiklash, telefon almashtirish) eski qurilma push olishda davom etardi —
 * umumiy kompyuterda bu boshqa odamga bildirishnoma ko'rsatardi.
 * Hech qachon reject qilmaydi: asosiy oqim (bloklash, parol tiklash) buzilmasin.
 */
export async function deleteUserPushSubscriptions(userId: string): Promise<number> {
  try {
    const res = await prisma.pushSubscription.deleteMany({ where: { userId } });
    return res.count;
  } catch {
    return 0;
  }
}

export function getVapidPublicKey(): string {
  return features.push ? env.VAPID_PUBLIC_KEY : "";
}
