import { env } from "../../common/env.js";
import { consumeQuota } from "../../common/quota.js";
import { acquireLock, releaseLock, renewLock } from "../../common/redis.js";
import {
  CHAT_UPDATES_PER_MINUTE,
  markPollSuccess,
  pause,
  setBotUsername,
  setTelegramLogger,
  tgCall,
  MSG_ERROR,
  sendTelegramMessage,
  tg,
  tgEscape,
  telegramLogger,
  type TgCallbackQuery,
  type TgUpdate,
} from "./telegram.api.js";
import { handleStart, handleContact } from "./telegram.flows.js";
import { handleSupport, handleAdminReply } from "./telegram.support.js";

/**
 * Update marshruti va long-polling sikli (bir vaqtda faqat bitta nusxa — Redis qulfi).
 */

// ---------------------------------------------------------
// Update marshruti
// ---------------------------------------------------------

/**
 * Long-polling qulfi (audit: scale-redis-6): bir vaqtda faqat bitta nusxa `getUpdates`
 * so'raydi. Muddat `getUpdates` timeout'idan (25 s) uzun — lider har aylanishda uzaytiradi.
 */
const POLL_LOCK = "telegram:poll";
const POLL_LEASE_MS = 60_000;

let stopped = false;
let lastOffset = 0;
const logger = {
  info: (o: unknown, m?: string) => telegramLogger().info(o, m),
  warn: (o: unknown, m?: string) => telegramLogger().warn(o, m),
};

/** Callback tugmalari endi ishlatilmaydi (Telegram orqali kirish olib tashlandi — D-041). */
async function handleCallbackQuery(query: TgCallbackQuery) {
  await tg("answerCallbackQuery", { callback_query_id: query.id });
}

async function handleUpdate(update: TgUpdate) {
  if (update.callback_query) return handleCallbackQuery(update.callback_query);
  const msg = update.message;
  if (!msg) return;
  const chatId = String(msg.chat.id);
  const text = msg.text ?? "";

  // Chat bo'yicha yumshoq limit (D-046): ortiqcha update jimgina tashlanadi
  if (!(await consumeQuota(`tg:chat:${chatId}`, CHAT_UPDATES_PER_MINUTE, 60_000))) return;

  if (msg.contact) return handleContact(msg);

  if (text.startsWith("/start")) return handleStart(msg, text.slice(6).trim());
  // Chat ID faqat support hali sozlanmaganda kerak (audit R3, telegram-15)
  if ((text === "/myid" || text === "/id") && !env.TELEGRAM_ADMIN_CHAT_ID) {
    return sendTelegramMessage(chatId, `🆔 Chat ID: <code>${tgEscape(chatId)}</code>`);
  }

  // Admin reply -> foydalanuvchiga relay
  if (env.TELEGRAM_ADMIN_CHAT_ID && chatId === env.TELEGRAM_ADMIN_CHAT_ID && msg.reply_to_message) {
    return handleAdminReply(msg);
  }

  // Oddiy matn -> support
  if (text) return handleSupport(msg);
}

/**
 * Bitta update'ni ishlaydi. Handler xato tashlasa foydalanuvchi javobsiz qolmasin
 * (audit R3, api-errors-11): umumiy xabar yuboriladi, ichki tafsilotlar chiqmaydi.
 * Testlar shu funksiyani to'g'ridan-to'g'ri chaqiradi (D-062).
 */
export async function handleTelegramUpdate(update: TgUpdate): Promise<void> {
  try {
    await handleUpdate(update);
  } catch (e) {
    logger.warn({ err: String(e), kind: update.callback_query ? "callback_query" : "message" }, "Telegram update xatosi");
    const chatId = update.message?.chat.id;
    if (chatId !== undefined) {
      await sendTelegramMessage(chatId, MSG_ERROR).catch(() => undefined);
    }
  }
}

// ---------------------------------------------------------
// Long-polling
// ---------------------------------------------------------

export async function startTelegramBot(log?: typeof logger) {
  if (log) setTelegramLogger(log);
  if (env.TELEGRAM_TEST_MODE) {
    logger.info({}, "TELEGRAM_TEST_MODE — bot test rejimida (polling yo'q)");
    return;
  }
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.info({}, "TELEGRAM_BOT_TOKEN yo'q — bot ishga tushirilmadi");
    return;
  }
  stopped = false;

  // Tarmoq vaqtincha uzilgan bo'lsa bot restartgacha o'chiq qolmasin — 30s dan 5 daqiqagacha qayta urinamiz
  let me = await tg<{ username: string }>("getMe");
  let delay = 30_000;
  while (!me && !stopped) {
    logger.warn({ retryInSeconds: delay / 1000 }, "Telegram bot token yaroqsiz yoki tarmoq xatosi — qayta urinamiz");
    await pause(delay);
    delay = Math.min(delay * 2, 5 * 60_000);
    me = await tg<{ username: string }>("getMe");
  }
  if (!me) return;
  setBotUsername(me.username);
  markPollSuccess();
  logger.info({ username: me.username }, "Telegram bot ishga tushdi (long-polling)");

  // Fon sikli — server bilan birga yashaydi, shutdown'da `stopTelegramBot()` to'xtatadi
  void (async () => {
    let failures = 0;
    while (!stopped) {
      /**
       * Long-polling'ni FAQAT BITTA nusxa bajaradi (audit: scale-redis-6).
       *
       * Telegram bir vaqtda ikkita `getUpdates` so'roviga 409 qaytaradi — ilgari shu sababli
       * `numReplicas: 1` majburiy edi. Endi nusxalar Redis qulfi orqali kelishadi: qulfni
       * olgani so'raydi, qolganlari kutadi va lider yiqilsa (qulf muddati tugaydi) o'rnini
       * egallaydi. Xabar YUBORISH hamma nusxada ishlayveradi — u qulfga bog'liq emas.
       * Redis sozlanmagan bo'lsa qulf har doim beriladi (bitta nusxali deploy).
       */
      if (!(await acquireLock(POLL_LOCK, POLL_LEASE_MS, "deny")) && !(await renewLock(POLL_LOCK, POLL_LEASE_MS))) {
        await pause(POLL_LEASE_MS / 2);
        continue;
      }
      const res = await tgCall<TgUpdate[]>("getUpdates", {
        offset: lastOffset,
        timeout: 25,
        allowed_updates: ["message", "callback_query"],
      });
      if (!res.ok) {
        failures += 1;
        // 401 (token bekor qilingan) yoki 409 (webhook o'rnatilgan) — qayta urinishning foydasi yo'q.
        // `botUsername` tozalanadi: endpointlar 503 TELEGRAM_UNAVAILABLE qaytaradi (D-051).
        if (res.errorCode === 401) {
          setBotUsername(null);
          logger.warn({ errorCode: res.errorCode }, "Telegram bot to'xtadi — token bekor qilingan");
          return;
        }
        // 409: boshqa getUpdates so'rovi (redeploy paytida eski nusxa hali ishlayapti) yoki webhook.
        // Birinchisi vaqtinchalik — to'xtab qolish botni keyingi restartgacha o'chirardi
        // (audit R3 ikkinchi audit, frontend-docs-2). Oshib boruvchi kutish bilan qayta urinamiz;
        // uzoq davom etsa 90 soniyalik mavjudlik oynasi tugaydi va endpointlar 503 qaytaradi.
        if (res.errorCode === 409) {
          if (failures % 6 === 1) logger.warn({ failures }, "Telegram getUpdates 409 — boshqa nusxa yoki webhook, qayta urinilmoqda");
          await pause(Math.min(60_000, 5000 * failures));
          continue;
        }
        // Uzluksiz xatoda 90 soniyalik "mavjudlik" oynasi tugaydi va havolalar berilmaydi.
        // Log toshib ketmasin: har 12-xatoda bir marta (taxminan daqiqada bir) yoziladi.
        if (failures % 12 === 1) logger.warn({ failures }, "Telegram getUpdates xatosi");
        await pause(5000);
        continue;
      }
      failures = 0;
      markPollSuccess();
      for (const u of res.result ?? []) {
        lastOffset = u.update_id + 1;
        await handleTelegramUpdate(u);
      }
      // Qulf egaligi uzaytiriladi; yo'qotilgan bo'lsa keyingi aylanishda qaytadan so'raladi
      await renewLock(POLL_LOCK, POLL_LEASE_MS);
    }
  })();
}

/**
 * Graceful shutdown: long-poll sikli keyingi aylanishda to'xtaydi va oxirgi bo'lak
 * Telegram tomonida TASDIQLANADI (audit R3, headers-infra-15) — aks holda restartdan
 * keyin o'sha update'lar qaytadan kelardi.
 */
export function stopTelegramBot(): void {
  stopped = true;
  // Qulf darhol bo'shatiladi — deploy paytida yangi nusxa muddat tugashini kutmasin
  void releaseLock(POLL_LOCK);
  if (lastOffset > 0 && env.TELEGRAM_BOT_TOKEN && !env.TELEGRAM_TEST_MODE) {
    void tg("getUpdates", { offset: lastOffset, timeout: 0, limit: 1 }).catch(() => undefined);
  }
}

