import type { UserRole } from "@prisma/client";
import { env } from "./env.js";
import { CHANNEL, INSTANCE_ID, publishMessage, subscribeToChannel } from "./redis.js";

/**
 * Foydalanuvchi holatining QISQA MUDDATLI keshi (audit: perf-auth-1).
 *
 * Har bir autentifikatsiyalangan so'rov bazadan bitta qator o'qirdi. 10 ming
 * foydalanuvchida bu bazadagi eng katta bir xil yuk edi: bitta sahifa 5-10 ta
 * so'rov qilsa, shuncha marta AYNAN bir xil hujjat o'qilardi.
 *
 * Xavfsizlik (audit PHASE 6, V5) saqlanadi: qator muddati tugaganda emas, holat
 * O'ZGARGANDA keshdan chiqariladi. Buni HAR BIR chaqiruv joyi emas, `common/prisma.ts`
 * dagi kengaytma bajaradi: `user` jadvaliga har qanday yozuv shu foydalanuvchini keshdan
 * chiqaradi (bloklash, blokdan chiqarish, rol o'zgarishi, logout, telefon tasdig'i...).
 * Redis bo'lsa signal BARCHA nusxalarga boradi, ya'ni o'zgarish bir zumda hamma
 * joyda kuchga kiradi.
 *
 * TTL — faqat zaxira to'r: kodni chetlab o'tib bazada QO'LDA o'zgartirilgan qiymat
 * ham 10 soniyadan keyin amal qiladi.
 *
 * Bu alohida modul, chunki uni ham `auth-guard`, ham `auth.service` ishlatadi —
 * bir modulda bo'lsa import halqasi hosil bo'lardi.
 */

/** requireAuth bazadan o'qiydigan foydalanuvchi holati (audit PHASE 6, V5). */
export interface AuthUser {
  role: UserRole;
  isBlocked: boolean;
  tokenVersion: number | null;
  isPhoneVerified: boolean;
}

const TTL_MS = env.AUTH_CACHE_MS;
const MAX_ENTRIES = 20_000;

/**
 * Yozuv: `user` bor — keshlangan qiymat; `user === null` — BEKOR QILINGAN belgisi
 * (tombstone) va u qachon qo'yilgani.
 *
 * Tombstone kerak, chunki bekor qilish bilan o'qish ORASIDA poyga bor: bazadan
 * eski qiymatni o'qib ulgurgan so'rov, bekor qilingandan KEYIN kelib, o'sha eski
 * qiymatni keshga qaytarib yozib qo'yardi — natijada o'zgarish TTL tugaguncha
 * (10 s) ko'rinmasdi. Shuning uchun har o'qish "qachon boshlangani" bilan keladi
 * va bekor qilingandan OLDIN boshlangan o'qish keshga yozilmaydi.
 */
interface Entry {
  at: number;
  user: AuthUser | null;
}

const cache = new Map<string, Entry>();
/** `invalidateAllAuthUsers` chaqirilgan payt — undan oldin boshlangan o'qishlar keshlanmaydi. */
let clearedAt = 0;

export function getCachedAuthUser(userId: string): AuthUser | null {
  if (TTL_MS === 0) return null;
  const hit = cache.get(userId);
  if (!hit || !hit.user || Date.now() - hit.at >= TTL_MS) return null;
  return hit.user;
}

/** `readStartedAt` — bazadan o'qish BOSHLANGAN payt (`Date.now()`), poygani ajratish uchun. */
export function cacheAuthUser(userId: string, user: AuthUser, readStartedAt: number): void {
  if (TTL_MS === 0) return;
  if (readStartedAt <= clearedAt) return;
  const hit = cache.get(userId);
  // O'qish bekor qilishdan OLDIN boshlangan — qiymat eskirgan bo'lishi mumkin, keshlamaymiz
  if (hit && hit.user === null && readStartedAt <= hit.at) return;
  // Map qo'shilish tartibini saqlaydi — chegaraga yetganda eng eskisi chiqadi
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(userId, { at: Date.now(), user });
}

/** Holat o'zgardi: shu nusxada ham, qolganlarida ham keshdan chiqariladi. */
export function invalidateAuthUser(userId: string): void {
  markInvalidated(userId);
  publishMessage(CHANNEL.auth, { from: INSTANCE_ID, userId });
}

function markInvalidated(userId: string): void {
  if (TTL_MS === 0) return;
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(userId, { at: Date.now(), user: null });
}

/**
 * Qaysi foydalanuvchi o'zgargani noma'lum (masalan `updateMany` ixtiyoriy shart bilan) —
 * butun kesh tashlanadi. Bunday yozuvlar kam, keyingi so'rovlar bazadan qayta o'qiydi.
 */
export function invalidateAllAuthUsers(): void {
  cache.clear();
  clearedAt = Date.now();
  publishMessage(CHANNEL.auth, { from: INSTANCE_ID, all: true });
}

subscribeToChannel(CHANNEL.auth, (payload) => {
  const msg = payload as { from?: string; userId?: string; all?: boolean };
  if (!msg || msg.from === INSTANCE_ID) return;
  if (msg.all === true) {
    cache.clear();
    clearedAt = Date.now();
  } else if (typeof msg.userId === "string") {
    markInvalidated(msg.userId);
  }
});
