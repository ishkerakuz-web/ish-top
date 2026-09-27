import { AppError } from "./errors.js";
import { redisCall } from "./redis.js";

/**
 * Jarayon ichidagi oddiy kvota hisoblagichi (audit R3, D-052).
 *
 * `@fastify/rate-limit` faqat IP (yoki so'rov) bo'yicha ishlaydi; bu yerda esa
 * telefon raqami, foydalanuvchi ID'si yoki "email|ip" kabi mantiqiy kalitlar
 * bo'yicha chegara qo'yiladi.
 *
 * `REDIS_URL` berilgan bo'lsa hisoblar Redis'da — nusxalar orasida UMUMIY
 * (D-068 risk yopildi). Redis yo'q yoki uzilgan bo'lsa quyidagi jarayon ichidagi
 * hisob ishlatiladi: chegara saqlanadi, lekin faqat shu nusxa uchun.
 *
 * Xotira: kalitlar soni `MAX_KEYS` dan oshsa, yozishdan oldin CHEGARALANGAN
 * miqdordagi eskirgan yozuv tozalanadi. Har chaqiruvda butun Map'ni aylanib
 * chiqadigan O(n) tozalash ataylab yo'q (audit R3, headers-infra-2: anonim
 * so'rov bilan CPU'ni yuklash mumkin edi).
 */
const MAX_KEYS = 100_000;
const SWEEP_BATCH = 200;

interface Entry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Entry>();

function live(key: string, now: number): Entry | undefined {
  const entry = buckets.get(key);
  if (!entry) return undefined;
  if (entry.resetAt <= now) {
    buckets.delete(key);
    return undefined;
  }
  return entry;
}

/** Xotira chegarasi: eng eski yozuvlardan eskirganlarini (yoki majburan birinchisini) olib tashlaydi. */
function makeRoom(now: number): void {
  if (buckets.size < MAX_KEYS) return;
  let removed = 0;
  let scanned = 0;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
      removed += 1;
      if (removed >= SWEEP_BATCH) return;
    }
    scanned += 1;
    if (scanned >= SWEEP_BATCH * 5) break;
  }
  if (removed > 0) return;
  // Hech narsa eskirmagan bo'lsa — Map qo'shilish tartibini saqlaydi, eng eskisi ketadi
  const oldest = buckets.keys().next().value;
  if (oldest !== undefined) buckets.delete(oldest);
}

/** Kalit bo'yicha joriy hisob (oyna tugagan bo'lsa 0) — xotiradagi zaxira yo'l uchun. */
function memoryCount(key: string): number {
  return live(key, Date.now())?.count ?? 0;
}

/** Hisobni bittaga oshiradi va yangi qiymatni qaytaradi (xotirada). */
function bumpMemory(key: string, windowMs: number): number {
  const now = Date.now();
  const entry = live(key, now);
  if (entry) {
    entry.count += 1;
    return entry.count;
  }
  makeRoom(now);
  buckets.set(key, { count: 1, resetAt: now + windowMs });
  return 1;
}

/** Kalitni tozalaydi (masalan muvaffaqiyatli kirishdan keyin). */
export async function clearQuota(key: string): Promise<void> {
  buckets.delete(key);
  await redisCall("quota", (redis) => redis.del(`quota:${key}`));
}

/**
 * Chegaraga yetmagan bo'lsa hisoblab, `true` qaytaradi; yetgan bo'lsa `false`.
 *
 * Redis bo'lsa hisob NUSXALAR ORASIDA umumiy (audit: scale-redis-2). Busiz uchta
 * nusxali deployda "soatiga 5 ta SMS" aslida soatiga 15 ta bo'lardi — ya'ni
 * chegara nusxalar soniga ko'payib ketardi. `INCR` atomik; muddat faqat birinchi
 * oshirishda qo'yiladi, shuning uchun oyna cho'zilib ketmaydi.
 *
 * Redis uzilsa chaqiruv xotiradagi hisobga tushadi — chegara yo'qolmaydi, faqat
 * vaqtincha nusxa ichida qoladi.
 */
export async function consumeQuota(key: string, limit: number, windowMs: number): Promise<boolean> {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const count = await redisCall("quota", async (redis) => {
    const value = await redis.incr(`quota:${key}`);
    if (value === 1) await redis.expire(`quota:${key}`, windowSec);
    return value;
  });
  if (count !== null) return count <= limit;
  if (memoryCount(key) >= limit) return false;
  bumpMemory(key, windowMs);
  return true;
}

/** Chegara oshsa 429 tashlaydi. Xabar sirlar yoki hisob mavjudligini oshkor qilmaydi. */
export async function assertQuota(
  key: string,
  limit: number,
  windowMs: number,
  message = "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring."
): Promise<void> {
  if (!(await consumeQuota(key, limit, windowMs))) {
    throw new AppError(429, "TOO_MANY_ATTEMPTS", message);
  }
}

/** Testlar uchun: barcha kvotalarni tozalaydi. */
export function resetQuotasForTests(): void {
  buckets.clear();
}

export const MINUTE_MS = 60 * 1000;
export const QUARTER_HOUR_MS = 15 * MINUTE_MS;
export const HOUR_MS = 60 * MINUTE_MS;
