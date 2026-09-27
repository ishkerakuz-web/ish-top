import type { FastifyBaseLogger } from "fastify";
import { prisma } from "./prisma.js";
import { env } from "./env.js";
import { redisCall, INSTANCE_ID } from "./redis.js";

/**
 * Ko'rishlar va ovozlar hisoblagichi — YIG'IB yoziladi (audit: views-1).
 *
 * Ilgari har bir sahifa ochilishi bazaga alohida `$inc` yuborardi: 10 ming
 * foydalanuvchida bu sekundiga o'nlab keraksiz yozuv, har biri oplog'ga tushadi
 * va Atlas'da pul turadi. Endi oshirishlar xotirada (Redis bo'lsa — Redis
 * hash'ida) yig'iladi va `VIEW_FLUSH_MS` oralig'ida BITTA `bulkWrite` bilan
 * bazaga tushadi: 1000 ta ko'rish = 1 ta so'rov, ichida har e'lon uchun bitta
 * `$inc`.
 *
 * Nimasi bilan to'lanadi: sahifadagi son yarim daqiqagacha kechikishi mumkin va
 * jarayon kutilmaganda yiqilsa oxirgi oraliq yo'qoladi. Hisoblagich uchun ikkalasi
 * ham arzimas; `SIGTERM` da bufer baribir bo'shatiladi.
 *
 * Yozuv `updatedAt` ga TEGMAYDI (xom `update` buyrug'i, Prisma emas): aks holda
 * har ko'rish e'lonni "tahrirlangan" qilib, sitemap'dagi `lastmod` ni buzardi.
 */

/** Hisoblagich qaysi kolleksiyada va qaysi maydonda. */
export type CounterCollection = "vacancies" | "articles";
export type CounterField = "views_count" | "helpful_yes" | "helpful_no";

/** Xotiradagi bufer chegarasi: kutilmagan oqimda ham xotira o'smasin. */
const MAX_PENDING_KEYS = 50_000;
/** Bitta bazaga so'rovda nechta yozuv (juda katta buyruq yubormaslik uchun). */
const CHUNK = 500;
/** Redis'dagi umumiy bufer va shu nusxaning "olingan" nusxasi. */
const PENDING_KEY = "counters:pending";
const SNAPSHOT_KEY = `counters:flushing:${INSTANCE_ID}`;

/** `<kolleksiya>|<slug>|<maydon>` -> nechta oshirish */
const pending = new Map<string, number>();

function bufferKey(collection: CounterCollection, slug: string, field: CounterField): string {
  return `${collection}|${slug}|${field}`;
}

/**
 * Hisoblagichni oshirishni BUFERGA qo'yadi (bazaga darhol yozilmaydi).
 * Javobni kutdirmaslik uchun hech narsa qaytarmaydi.
 */
export function bumpCounter(collection: CounterCollection, slug: string, field: CounterField, by = 1): void {
  const key = bufferKey(collection, slug, field);
  void (async () => {
    const written = await redisCall("counters", (redis) => redis.hincrby(PENDING_KEY, key, by));
    if (written !== null) return;
    // Redis yo'q yoki uzilgan — jarayon xotirasida yig'amiz
    if (pending.size >= MAX_PENDING_KEYS && !pending.has(key)) return;
    pending.set(key, (pending.get(key) ?? 0) + by);
  })();
}

/** `<kolleksiya>|<slug>|<maydon>` juftliklarini bazaga yoziladigan shaklga aylantiradi. */
function toUpdates(entries: Iterable<[string, number]>): Map<CounterCollection, Map<string, Record<string, number>>> {
  const byCollection = new Map<CounterCollection, Map<string, Record<string, number>>>();
  for (const [key, count] of entries) {
    if (!count) continue;
    const [collection, slug, field] = key.split("|") as [CounterCollection, string, CounterField];
    if (!collection || !slug || !field) continue;
    let bySlug = byCollection.get(collection);
    if (!bySlug) {
      bySlug = new Map();
      byCollection.set(collection, bySlug);
    }
    const fields = bySlug.get(slug) ?? {};
    fields[field] = (fields[field] ?? 0) + count;
    bySlug.set(slug, fields);
  }
  return byCollection;
}

/**
 * Bufer bazaga yoziladi. Yozib bo'lmasa (baza uzilgan) hisoblar buferga
 * QAYTARILADI — ko'rishlar yo'qolmasin, keyingi urinishda yoziladi.
 */
async function writeToDatabase(snapshot: Map<string, number>): Promise<void> {
  const failed: [string, number][] = [];
  for (const [collection, bySlug] of toUpdates(snapshot)) {
    const updates = [...bySlug].map(([slug, fields]) => ({ q: { slug }, u: { $inc: fields } }));
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK);
      try {
        // `ordered: false` — bitta e'lon o'chirilgan bo'lsa qolganlari baribir yoziladi
        await prisma.$runCommandRaw({ update: collection, updates: chunk, ordered: false });
      } catch {
        for (const { q, u } of chunk) {
          for (const [field, count] of Object.entries(u.$inc)) {
            failed.push([`${collection}|${q.slug}|${field}`, count]);
          }
        }
      }
    }
  }
  for (const [key, count] of failed) {
    const restored = await redisCall("counters", (redis) => redis.hincrby(PENDING_KEY, key, count));
    if (restored === null && pending.size < MAX_PENDING_KEYS) pending.set(key, (pending.get(key) ?? 0) + count);
  }
}

/**
 * Redis'dagi umumiy buferni oladi. `RENAME` atomik: nom o'zgargandan keyin
 * kelgan oshirishlar YANGI hash'ga tushadi, ya'ni o'qish va o'chirish orasida
 * hech narsa yo'qolmaydi (oddiy `HGETALL` + `DEL` da yo'qolardi).
 *
 * Nusxa nomi har jarayonda boshqacha: agar oldingi urinish bazaga yozishdan
 * oldin uzilib qolgan bo'lsa, o'sha "osilib qolgan" nusxa keyingi safar
 * birinchi bo'lib olinadi.
 */
async function takeRedisSnapshot(): Promise<Map<string, number> | null> {
  const raw = await redisCall("counters", async (redis) => {
    const leftover = await redis.hgetall(SNAPSHOT_KEY);
    if (!leftover || Object.keys(leftover).length === 0) {
      try {
        await redis.rename(PENDING_KEY, SNAPSHOT_KEY);
      } catch {
        return {} as Record<string, string>; // bufer bo'sh — yozadigan narsa yo'q
      }
      return redis.hgetall(SNAPSHOT_KEY);
    }
    return leftover;
  });
  if (raw === null) return null;
  const snapshot = new Map<string, number>();
  for (const [key, value] of Object.entries(raw)) {
    const count = Number(value);
    if (Number.isFinite(count) && count > 0) snapshot.set(key, count);
  }
  return snapshot;
}

let flushing: Promise<void> | null = null;

/** Buferni bazaga yozadi. Bir vaqtda faqat bitta yozuv ketadi (qayta kirish xavfsiz). */
export function flushCounters(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      const fromRedis = await takeRedisSnapshot();
      const snapshot = fromRedis ?? new Map<string, number>();
      // Redis'dan oldin xotirada yig'ilgan (yoki Redis uzilgan paytdagi) hisoblar ham yoziladi
      for (const [key, count] of pending) snapshot.set(key, (snapshot.get(key) ?? 0) + count);
      pending.clear();
      if (snapshot.size === 0) return;
      await writeToDatabase(snapshot);
      if (fromRedis !== null) await redisCall("counters", (redis) => redis.del(SNAPSHOT_KEY));
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

let timer: NodeJS.Timeout | null = null;

export function startCounterFlush(log?: FastifyBaseLogger): void {
  if (timer) return;
  timer = setInterval(() => {
    void flushCounters().catch((err) => log?.error({ err }, "Ko'rishlar buferini yozishda xatolik"));
  }, env.VIEW_FLUSH_MS);
  // Bufer taymeri jarayonni tirik ushlab turmasin
  timer.unref();
}

export function stopCounterFlush(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
