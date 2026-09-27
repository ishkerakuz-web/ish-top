import crypto from "node:crypto";
import type { FastifyRequest } from "fastify";
import { env } from "./env.js";
import { redisCall } from "./redis.js";
import { verifyAccessToken } from "./jwt.js";

/**
 * "Bu ish shu kalit uchun allaqachon bajarilganmi?" filtri (ko'rishlar hisoblagichi,
 * maqolaga ovoz berish).
 *
 * Redis bo'lsa `SET key 1 NX EX <ttl>` — atomik va nusxalar orasida umumiy.
 * Bo'lmasa jarayon xotirasidagi cheklangan Map: `quota.ts` dagi kabi, butun
 * Map'ni aylanib chiqadigan O(n) tozalash ATAYLAB yo'q, aks holda anonim
 * so'rov bilan CPU'ni yuklash mumkin bo'lardi (audit R3, headers-infra-2).
 */

const MAX_KEYS = 200_000;
const SWEEP_BATCH = 200;

/** kalit -> qachon eskiradi (ms) */
const seen = new Map<string, number>();

function makeRoom(now: number): void {
  if (seen.size < MAX_KEYS) return;
  let removed = 0;
  let scanned = 0;
  for (const [key, expiresAt] of seen) {
    if (expiresAt <= now) {
      seen.delete(key);
      removed += 1;
      if (removed >= SWEEP_BATCH) return;
    }
    scanned += 1;
    if (scanned >= SWEEP_BATCH * 5) break;
  }
  if (removed > 0) return;
  // Hech narsa eskirmagan — Map qo'shilish tartibini saqlaydi, eng eskisi ketadi
  const oldest = seen.keys().next().value;
  if (oldest !== undefined) seen.delete(oldest);
}

function firstTimeInMemory(key: string, ttlSec: number): boolean {
  const now = Date.now();
  const expiresAt = seen.get(key);
  if (expiresAt !== undefined && expiresAt > now) return false;
  makeRoom(now);
  seen.set(key, now + ttlSec * 1000);
  return true;
}

/**
 * Kalit shu oynada BIRINCHI marta uchrayaptimi. `true` — birinchi marta (amal
 * bajarilsin), `false` — takror (e'tiborsiz qoldirilsin).
 *
 * Redis xato bersa xotiradagi zaxira yo'lga tushadi: filtr nusxa ichida
 * ishlayveradi, ya'ni eng yomon holatda takror ko'rish bir nechta nusxada
 * bir martadan sanaladi — bu hisoblagich uchun maqbul.
 */
export async function firstTime(key: string, ttlSec: number): Promise<boolean> {
  // DIQQAT: natija `redisCall` ICHIDA `boolean` ga aylantiriladi. `SET ... NX` kalit
  // allaqachon bor bo'lsa `null` qaytaradi, `redisCall` esa "Redis ishlamayapti" holatini
  // ham `null` bilan bildiradi — ikkalasini tashqarida ajratib bo'lmasdi va "takror"
  // "Redis yo'q" deb tushunilib, ko'rish qayta sanalardi (lokal sinovda shu chiqdi).
  const fresh = await redisCall("dedupe", async (redis) => (await redis.set(`seen:${key}`, "1", "EX", ttlSec, "NX")) === "OK");
  if (fresh !== null) return fresh;
  return firstTimeInMemory(key, ttlSec);
}

/**
 * Anonim ko'ruvchi kalitini yasashda ishlatiladigan sir. IP va User-Agent xom
 * holda kalitga tushmasin (Redis'da ham shaxsiy ma'lumot saqlanmaydi); sir har
 * ishga tushishda o'zgarmaydi — JWT siridan hosil qilinadi — nusxalar bir xil kalit
 * hisoblashi uchun.
 */
const VIEWER_SALT = crypto.createHash("sha256").update(`viewer:${env.JWT_ACCESS_SECRET}`).digest();

/**
 * Bot va boshqa avtomatik mijozlar. Hisoblagich brauzerdan (JS bilan) yuboriladi,
 * shuning uchun aksariyat crawler allaqachon chetda qoladi — bu tekshiruv JS
 * ishlatadigan (Googlebot, headless) va havola ko'rinishini oladigan botlar uchun.
 *
 * Tekshiruv IKKI bosqichli, chunki faqat "qora ro'yxat" yetarli emas edi: har qanday
 * skript o'zini istalgan nom bilan atashi mumkin. Shuning uchun avval MUSBAT shart —
 * User-Agent'da `Mozilla` belgisi bo'lishi kerak (barcha haqiqiy brauzerlar uni
 * yuboradi, `curl`, `node`, `python-requests` esa yo'q), keyin tanilgan botlar
 * ro'yxati (ular ham `Mozilla` deb yozadi).
 *
 * Ro'yxatda messenjer NOMLARI ataylab yo'q ("telegram", "whatsapp"): ularning havola
 * ko'rinishini oladigan botlari `Mozilla` yozmaydi yoki nomida `bot` bor, ilova ICHIDAGI
 * brauzer esa haqiqiy foydalanuvchi — u sanalishi kerak (Telegram'dan kelgan trafik
 * bu sayt uchun oddiy hol).
 */
const BOT_UA = /bot|crawler|spider|crawling|slurp|headless|phantomjs|puppeteer|playwright|preview|fetcher|monitor|scraper|embedly|facebookexternalhit|yandex(?:images|bot)|ahrefs|semrush/i;

export function isBotRequest(req: FastifyRequest): boolean {
  const ua = req.headers["user-agent"];
  if (!ua || typeof ua !== "string") return true; // User-Agent'siz so'rov — brauzer emas
  if (!ua.includes("Mozilla")) return true;
  return BOT_UA.test(ua);
}

/**
 * Ko'ruvchi kaliti: kirgan foydalanuvchi uchun — hisob ID'si (qurilma va brauzerdan
 * qat'i nazar bitta odam), aks holda IP + User-Agent dan hosil qilingan qisqa hash.
 *
 * Token BAZADAN tekshirilmaydi — faqat imzo. Sabab: bu yo'l har ko'rishda
 * chaqiriladi va maqsadi xavfsizlik emas, BARQAROR identifikator. Token yaroqsiz
 * bo'lsa anonim kalitga tushadi.
 */
export function viewerKey(req: FastifyRequest): string {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (token) {
    try {
      return `u:${verifyAccessToken(token).sub}`;
    } catch {
      // Yaroqsiz/eskirgan token — anonim sifatida sanaladi
    }
  }
  const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "";
  const hash = crypto.createHmac("sha256", VIEWER_SALT).update(`${req.ip}|${ua}`).digest("base64url").slice(0, 16);
  return `a:${hash}`;
}
