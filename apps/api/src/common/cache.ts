/**
 * Jarayon ichidagi yengil kesh (audit ISSUE-051, ISSUE-052).
 *
 * Og'ir ochiq hisoblar (bosh sahifa statistikasi, maosh tahlili, facets,
 * kompaniyalar katalogi) har so'rovda bazani skan qilmasin. Kesh ikki shart
 * bilan yangilanadi: TTL tugasa yoki bog'liq ma'lumot versiyasi o'zgarsa.
 * Bir vaqtdagi so'rovlar bitta promise'ni kutadi (stampede yo'q); xato
 * keshlanmaydi.
 *
 * Audit R3 (db-perf-6, scale-10k-5): ilgari versiya BITTA global hisoblagich
 * edi — sharh yozilishi ham vakansiya facets'ini, maosh to'plamini va bosh
 * sahifa sonlarini tozalardi. Endi versiyalar bo'limlarga ajratilgan
 * (`vacancies`, `companies`, `reviews`, `stats`) va har bir kesh o'zi
 * bog'liq bo'limlarni ko'rsatadi. `bumpDataVersion()` (argumentsiz) eski
 * ma'noda — barcha bo'limlarni yangilaydi, shuning uchun hali bo'limga
 * o'tmagan chaqiruvchilar ham to'g'ri ishlaydi.
 *
 * Kesh MA'LUMOTI har bir nusxada alohida (jarayon xotirasida), lekin YANGILANISH
 * signali Redis pub/sub orqali barcha nusxalarga tarqaladi (`REDIS_URL` berilgan
 * bo'lsa): bir nusxada vakansiya tahrirlansa, qolganlari ham eski javobni bermaydi.
 * Redis o'chiq bo'lsa farq faqat TTL muddatigacha qoladi.
 */

import { CHANNEL, INSTANCE_ID, publishMessage, subscribeToChannel } from "./redis.js";

/**
 * Kesh bo'limlari. `stats` — kelajakda faqat statistika yozuvlariga bog'liq
 * keshlar uchun; hozir hech bir yo'l uni alohida yangilamaydi.
 */
export const CACHE_SCOPES = ["vacancies", "companies", "reviews", "stats"] as const;
export type CacheScope = (typeof CACHE_SCOPES)[number];

const versions: Record<CacheScope, number> = { vacancies: 0, companies: 0, reviews: 0, stats: 0 };

/**
 * Ma'lumot o'zgarganini belgilaydi. Argumentsiz — barcha bo'limlar (eski
 * xatti-harakat); bo'lim berilsa faqat unga bog'liq keshlar yangilanadi.
 */
export function bumpDataVersion(...scopes: CacheScope[]): void {
  const changed = scopes.length ? scopes : [...CACHE_SCOPES];
  for (const scope of changed) versions[scope] += 1;
  // Boshqa nusxalar ham eski javobni bermasin (audit: scale-redis-3). Redis o'chiq bo'lsa
  // bu qator hech narsa qilmaydi — bitta nusxali deployda yangilanish allaqachon to'liq.
  publishMessage(CHANNEL.cache, { from: INSTANCE_ID, scopes: changed });
}

/**
 * Boshqa nusxadagi o'zgarishni eshitadi: u yerda vakansiya tahrirlansa, shu
 * nusxadagi ro'yxat/facets keshi ham darhol eskiradi. O'z xabarimiz qaytib kelsa
 * e'tiborsiz qoldiriladi (versiya ikki marta oshmasin — zarari yo'q, lekin
 * keraksiz).
 */
subscribeToChannel(CHANNEL.cache, (payload) => {
  const msg = payload as { from?: string; scopes?: CacheScope[] };
  if (!msg || msg.from === INSTANCE_ID || !Array.isArray(msg.scopes)) return;
  for (const scope of msg.scopes) {
    if (scope in versions) versions[scope] += 1;
  }
});

/** Test va diagnostika uchun: joriy versiyalar nusxasi. */
export function dataVersions(): Record<CacheScope, number> {
  return { ...versions };
}

function stampOf(scopes: readonly CacheScope[]): number[] {
  return scopes.map((scope) => versions[scope]);
}

/** Bo'sh bo'lim ro'yxati — faqat TTL (kalitning o'zi yangi qiymatni bildiradi). */
function isFresh(stamp: number[], scopes: readonly CacheScope[]): boolean {
  for (let i = 0; i < scopes.length; i += 1) {
    if (stamp[i] !== versions[scopes[i]]) return false;
  }
  return true;
}

/**
 * Kalit bo'yicha kesh (masalan so'rov parametrlari): TTL + bog'liq bo'limlar versiyasi,
 * eng ko'pi `maxEntries` ta (eng eskisi birinchi chiqariladi). Bir vaqtdagi bir xil
 * so'rovlar bitta promise'ni kutadi; xato keshlanmaydi.
 */
export function keyedCache<T>(
  ttlMs: number,
  maxEntries: number,
  scopes: readonly CacheScope[] = CACHE_SCOPES
): (key: string, load: () => Promise<T>) => Promise<T> {
  const entries = new Map<string, { at: number; stamp: number[]; promise: Promise<T> }>();
  return (key, load) => {
    const now = Date.now();
    const hit = entries.get(key);
    if (hit && now - hit.at <= ttlMs && isFresh(hit.stamp, scopes)) return hit.promise;
    if (hit) entries.delete(key);
    const promise = load();
    const fresh = { at: now, stamp: stampOf(scopes), promise };
    entries.set(key, fresh);
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
    promise.catch(() => {
      if (entries.get(key) === fresh) entries.delete(key);
    });
    return promise;
  };
}

export function cached<T>(
  ttlMs: number,
  load: () => Promise<T>,
  scopes: readonly CacheScope[] = CACHE_SCOPES
): () => Promise<T> {
  let entry: { at: number; stamp: number[]; promise: Promise<T> } | null = null;
  return () => {
    const now = Date.now();
    if (!entry || now - entry.at > ttlMs || !isFresh(entry.stamp, scopes)) {
      const promise = load();
      const fresh = { at: now, stamp: stampOf(scopes), promise };
      entry = fresh;
      promise.catch(() => {
        if (entry === fresh) entry = null;
      });
    }
    return entry.promise;
  };
}
