import Redis from "ioredis";
import { env } from "./env.js";

/**
 * Ixtiyoriy Redis ulanishi (10k foydalanuvchi uchun gorizontal kengayish poydevori).
 *
 * `REDIS_URL` bo'sh bo'lsa modul butunlay o'chadi va chaqiruvchilar jarayon
 * ichidagi (xotiradagi) yo'lga tushadi — dev muhitda Redis o'rnatish shart emas,
 * sayt avvalgidek ishlayveradi. `REDIS_URL` berilsa o'sha ma'lumot nusxalar
 * orasida UMUMIY bo'ladi: ko'rishlar buferi, takrorni filtrlash, kvotalar,
 * rate-limit, kesh yangilanishi va WebSocket fan-out.
 *
 * Asosiy qoida (Rule K): **Redis yiqilsa sayt yiqilmaydi.** Har bir chaqiruv
 * `redisCall` orqali ketadi; ulanish tayyor bo'lmasa yoki buyruq xato bersa
 * `null` qaytadi va chaqiruvchi xotiradagi zaxira yo'lga o'tadi. Shuning uchun
 * asosiy klientda `enableOfflineQueue: false` — Redis o'chganda buyruqlar navbatda
 * to'planib xotirani to'ldirmaydi va so'rov osilib qolmaydi, darhol xato beradi.
 * Obuna klienti bundan mustasno (pastdagi `createClient` izohiga qarang).
 */

/** Kanal nomlari (pub/sub). `keyPrefix` kanallarga QO'LLANMAYDI — prefiks qo'lda yoziladi. */
export const CHANNEL = {
  /** Kesh bo'limi versiyasi o'zgardi (cache.ts) */
  cache: `${env.REDIS_PREFIX}cache`,
  /** Foydalanuvchiga WebSocket xabari (realtime.ts) */
  realtime: `${env.REDIS_PREFIX}realtime`,
  /** Foydalanuvchi holati o'zgardi — keshdan chiqarilsin (auth-guard.ts) */
  auth: `${env.REDIS_PREFIX}auth`,
} as const;

export const redisEnabled = Boolean(env.REDIS_URL);

type Client = InstanceType<typeof Redis>;

let client: Client | null = null;
let subscriber: Client | null = null;
let ready = false;
let lastErrorLogAt = 0;

/** Xato loglari sekundiga o'nlab marta takrorlanmasin — daqiqada bittadan. */
function logError(scope: string, err: unknown): void {
  const now = Date.now();
  if (now - lastErrorLogAt < 60_000) return;
  lastErrorLogAt = now;
  console.warn(`Redis (${scope}) xatosi — xotiradagi zaxira yo'lga o'tildi:`, (err as Error)?.message ?? err);
}

function createClient(role: "main" | "subscriber"): Client {
  const conn = new Redis(env.REDIS_URL, {
    keyPrefix: role === "main" ? env.REDIS_PREFIX : undefined,
    // Redis javob bermasa so'rov osilib qolmasin: tez xato → xotiradagi zaxira yo'l
    maxRetriesPerRequest: 1,
    // Obuna klienti ISTISNO: `SUBSCRIBE` ulanish tayyor bo'lgunicha navbatda kutib tursin.
    // Aks holda modul yuklanayotganda yuborilgan obuna "Stream isn't writeable" bilan
    // yo'qolardi va nusxalararo xabarlar (chat, kesh yangilanishi) JIMGINA ishlamasdi —
    // lokal sinovda aynan shu chiqdi.
    enableOfflineQueue: role === "subscriber",
    connectTimeout: 5_000,
    // Uzilishda ortib boruvchi, lekin cheklangan kutish — qayta ulanish urinishlari cheksiz
    retryStrategy: (times: number) => Math.min(times * 200, 5_000),
    lazyConnect: false,
  });
  conn.on("error", (err: unknown) => logError(role, err));
  if (role === "main") {
    conn.on("ready", () => {
      ready = true;
      console.log("Redis ulanishi tayyor — hisoblagich, kvota va kesh nusxalar orasida umumiy");
    });
    conn.on("end", () => {
      ready = false;
    });
    conn.on("close", () => {
      ready = false;
    });
  }
  return conn;
}

if (redisEnabled) client = createClient("main");

/** Redis holati — `/health` va diagnostika uchun. */
export function redisState(): "off" | "ready" | "down" {
  if (!redisEnabled) return "off";
  return ready ? "ready" : "down";
}

/**
 * Buyruqni bajaradi. Redis o'chiq, ulanmagan yoki xato bo'lsa — `null`.
 * Chaqiruvchi `null` ni "Redis yo'q, o'zim hal qilaman" deb tushunishi SHART.
 */
export async function redisCall<T>(scope: string, fn: (redis: Client) => Promise<T>): Promise<T | null> {
  if (!client || !ready) return null;
  try {
    return await fn(client);
  } catch (err) {
    logError(scope, err);
    return null;
  }
}

/** Rate-limit plaginiga beriladigan xom klient (o'zi ishlata oladi) yoki `null`. */
export function rawRedis(): Client | null {
  return client;
}

/**
 * Kanalga xabar yuboradi (fan-out). Yuborilmasa jim qaytadi — bu faqat
 * nusxalar orasidagi xabar, bitta nusxali deployda umuman kerak emas.
 */
export function publishMessage(channel: string, payload: unknown): void {
  void redisCall("publish", (redis) => redis.publish(channel, JSON.stringify(payload)));
}

interface Handler {
  channel: string;
  handle: (payload: unknown) => void;
}

const handlers: Handler[] = [];
/** Obuna bo'lingan kanallar — qayta ulanishda tiklash uchun. */
const channels = new Set<string>();

/**
 * Kanalga obuna bo'ladi. Obuna uchun ALOHIDA ulanish kerak: ioredis'da obuna
 * rejimidagi klient oddiy buyruqlarni bajara olmaydi.
 *
 * O'z nusxasi yuborgan xabar o'ziga ham qaytadi — chaqiruvchilar buni hisobga
 * olishi kerak (xabarda yuboruvchi nusxa ID'si bor, `INSTANCE_ID` ga qarang).
 */
export function subscribeToChannel(channel: string, handle: (payload: unknown) => void): void {
  if (!redisEnabled) return;
  handlers.push({ channel, handle });
  channels.add(channel);
  if (!subscriber) {
    subscriber = createClient("subscriber");
    // Har "ready" da (birinchi ulanish ham, uzilishdan keyingi qayta ulanish ham) obunalar
    // qaytadan e'lon qilinadi: obunasiz qolgan nusxa xato bermaydi, shunchaki xabar olmaydi —
    // bunday jim nosozlikni sezish qiyin, shuning uchun tiklash aniq qilingan.
    subscriber.on("ready", () => {
      if (channels.size && subscriber) {
        void subscriber.subscribe(...channels).catch((err: unknown) => logError("resubscribe", err));
      }
    });
    subscriber.on("message", (ch: string, raw: string) => {
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }
      for (const h of handlers) {
        if (h.channel !== ch) continue;
        try {
          h.handle(payload);
        } catch (err) {
          logError("handler", err);
        }
      }
    });
  }
  void subscriber.subscribe(channel).catch((err: unknown) => logError("subscribe", err));
}

/**
 * Nusxa (process) identifikatori. Pub/sub xabarlarida "bu xabarni o'zim
 * yubordim" ni ajratish va leader-lock egasini belgilash uchun.
 */
export const INSTANCE_ID = `${process.pid.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Bir vaqtda faqat BITTA nusxa bajarishi kerak bo'lgan ish uchun qulf
 * (jadval bo'yicha yuboriladigan xabarlar, Telegram long-polling).
 *
 * `true` — ishni shu nusxa bajaradi; `false` — boshqasi bajaryapti.
 *
 * `whenUnavailable` Redis O'CHIQ yoki UZILGAN holatda nima qilishni belgilaydi,
 * chunki bu ikki holatda kelishuvga erishib bo'lmaydi:
 *   - `"allow"` — ish bajarilsin (takrorlansa zarari yo'q yoki deploy bitta nusxali).
 *   - `"deny"` — bajarilmasin (takrorlanishi zarar: bir xat ikki marta ketishi).
 * Redis umuman sozlanmagan bo'lsa (bitta nusxali deploy — DEPLOY.md) qulfning
 * ma'nosi yo'q, shuning uchun har doim `true`.
 */
export async function acquireLock(
  name: string,
  ttlMs: number,
  whenUnavailable: "allow" | "deny" = "allow"
): Promise<boolean> {
  if (!redisEnabled) return true;
  // Natija `redisCall` ICHIDA `boolean` ga aylantiriladi: `SET ... NX` qulf band bo'lsa
  // `null` qaytaradi, `redisCall` esa uzilishni ham `null` bilan bildiradi. Tashqarida
  // ajratilmasa "qulf boshqa nusxada" holati "Redis yo'q" deb o'qilib, ish IKKI marta
  // bajarilardi (xat ikki marta ketardi).
  const got = await redisCall("lock", async (redis) => (await redis.set(`lock:${name}`, INSTANCE_ID, "PX", ttlMs, "NX")) === "OK");
  if (got === null) return whenUnavailable === "allow";
  return got;
}

/**
 * Qulf muddatini uzaytiradi (uzoq davom etadigan ish uchun: Telegram long-polling).
 *
 * `false` — qulf endi bizniki emas (boshqa nusxa oldi yoki Redis uzildi), ya'ni ishni
 * TO'XTATISH kerak. Redis umuman sozlanmagan bo'lsa har doim `true`.
 */
export async function renewLock(name: string, ttlMs: number): Promise<boolean> {
  if (!redisEnabled) return true;
  const ok = await redisCall("lock", async (redis) => {
    const owner = await redis.get(`lock:${name}`);
    if (owner !== INSTANCE_ID) return false;
    await redis.pexpire(`lock:${name}`, ttlMs);
    return true;
  });
  // Redis javob bermasa qulfni YO'QOTGAN deb hisoblaymiz: ikkita nusxa bir vaqtda
  // long-polling qilgandan ko'ra vaqtincha to'xtab turgani xavfsizroq
  return ok === true;
}

/** Qulfni bo'shatadi — faqat egasi (boshqa nusxaning qulfini ochib yubormaslik uchun). */
export async function releaseLock(name: string): Promise<void> {
  await redisCall("unlock", async (redis) => {
    const owner = await redis.get(`lock:${name}`);
    if (owner === INSTANCE_ID) await redis.del(`lock:${name}`);
  });
}

export async function closeRedis(): Promise<void> {
  ready = false;
  const clients = [client, subscriber].filter(Boolean) as Client[];
  client = null;
  subscriber = null;
  await Promise.all(
    clients.map(async (c) => {
      try {
        await c.quit();
      } catch {
        c.disconnect();
      }
    })
  );
}
