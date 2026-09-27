import { prisma } from "../../common/prisma.js";
import { env, isProd } from "../../common/env.js";

/**
 * Telegram TRANSPORTI va bot holati.
 *
 * Bu yerda faqat "qanday yuboriladi va bot tirikmi" degan qism: HTTP chaqiruvi, 429 qayta
 * urinishi, matnni kesish, deep-link va mavjudlik oynasi. Bot MANTIG'I (telefon tasdig'i,
 * tiklash, support) `telegram.flows.ts` va `telegram.support.ts` da, long-polling esa
 * `telegram.polling.ts` da — ilgari hammasi bitta 900 qatorli faylda edi.
 */

/**
 * Telegram bot — qo'shimcha kutubxonasiz (fetch + long-polling).
 *
 * Vazifalari (audit R3, Rule A–K):
 *  1) Telefonni tasdiqlash va hisobga bog'lash (deep-link challenge + kontakt ulashish)
 *  2) Telefonni almashtirish va zaxira raqam
 *  3) Parolni tiklash (reset havolasi FAQAT shu yerdan boradi)
 *  4) Qo'lda tiklashni yakunlash (admin tasdiqlagandan keyin)
 *  5) Bildirishnomalar va support relay
 *
 * TELEGRAM ORQALI KIRISH YO'Q (D-041): bot hech qachon seans ochmaydi. Barcha auth oqimlari
 * faqat PRIVATE chatda ishlaydi va identity = `message.from.id` (D-043).
 */

const API = () => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

/** Test rejimida (D-062) bot mavjud deb hisoblanadi va polling ishga tushmaydi. */
const TEST_BOT_USERNAME = "ishbor_test_bot";
/** Oxirgi muvaffaqiyatli `getUpdates` shu vaqtdan eski bo'lsa — bot "mavjud emas" (D-051). */
const AVAILABILITY_WINDOW_MS = 90_000;
/** Bitta chatdan daqiqasiga qabul qilinadigan update soni (D-046); ortiqchasi jimgina tashlanadi. */
export const CHAT_UPDATES_PER_MINUTE = 30;
/** Telegram xabari 4096 belgi; matnni shu chegaradan oldin kesamiz. */
const MAX_TEXT = 3900;

let botUsername: string | null = null;
let lastPollOkAt = 0;
let logger: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void } = {
  info: console.log,
  warn: console.warn,
};

export const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms).unref());

/** 429 javobidagi `retry_after` (soniya) shu chegaradan oshmasa — kutib, bir marta qayta uriniladi. */
const TG_MAX_RETRY_AFTER_S = 30;
/** Bitta Telegram so'rovining kutish chegarasi (getUpdates'da long-poll `timeout` ustiga qo'shiladi). */
const TG_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Testlar uchun transport (D-062): faqat TARMOQ qismi almashtiriladi — challenge, identity,
 * yagonalik va seans mantiqi haqiqiy kod va haqiqiy bazada tekshiriladi.
 */
export type TelegramTransport = (method: string, payload?: Record<string, unknown>) => Promise<unknown>;
let transport: TelegramTransport | null = null;

export function setTelegramTransportForTests(fn: TelegramTransport | null): void {
  if (isProd) throw new Error("setTelegramTransportForTests production'da ishlatilmaydi");
  transport = fn;
}

interface TgResult<T> {
  ok: boolean;
  result?: T;
  errorCode?: number;
}

export async function tgCall<T = unknown>(method: string, payload?: Record<string, unknown>): Promise<TgResult<T>> {
  if (transport) {
    try {
      return { ok: true, result: (await transport(method, payload)) as T };
    } catch (e) {
      logger.warn({ method, err: String(e) }, "Telegram test transport xatosi");
      return { ok: false };
    }
  }
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false };
  // Telegram 429 (Too Many Requests): `retry_after` <= 30s bo'lsa kutib BIR MARTA qayta urinamiz
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${API()}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
        // Osilib qolgan so'rov (undici sukuti 300s) yuborishni daqiqalab to'xtatmasin
        signal: AbortSignal.timeout(
          TG_REQUEST_TIMEOUT_MS + (typeof payload?.timeout === "number" ? payload.timeout * 1000 : 0)
        ),
      });
      const json = (await res.json()) as {
        ok: boolean;
        result?: T;
        description?: string;
        error_code?: number;
        parameters?: { retry_after?: number };
      };
      if (!json.ok) {
        const retryAfter = json.parameters?.retry_after;
        const rateLimited = json.error_code === 429 || res.status === 429;
        if (
          rateLimited &&
          attempt === 0 &&
          typeof retryAfter === "number" &&
          retryAfter >= 0 &&
          retryAfter <= TG_MAX_RETRY_AFTER_S
        ) {
          logger.warn({ method, retryAfter }, "Telegram 429 — kutib qayta urinamiz");
          await pause(retryAfter * 1000);
          continue;
        }
        logger.warn({ method, description: json.description }, "Telegram API xatosi");
        return { ok: false, errorCode: json.error_code ?? res.status };
      }
      return { ok: true, result: json.result };
    } catch (e) {
      logger.warn({ method, err: String(e) }, "Telegram API ulanish xatosi");
      return { ok: false };
    }
  }
}

export async function tg<T = unknown>(method: string, payload?: Record<string, unknown>): Promise<T | null> {
  const res = await tgCall<T>(method, payload);
  return res.ok ? res.result ?? null : null;
}

/**
 * Xabar matnini Telegram chegarasiga sig'diradi (audit R3, telegram-11).
 *
 * `parse_mode: "HTML"` bo'lgani uchun kesish HTML mohiyati (`&amp;`, `&lt;`) O'RTASIDAN
 * tushmasligi kerak: yarim qolgan `&am` Telegram'da "can't parse entities" xatosi beradi va
 * uzun support xabari umuman yetkazilmasdi. Shuning uchun oxiridagi tugallanmagan `&...`
 * bo'lagi kesib tashlanadi (audit R3 reviewer).
 */
function clip(text: string): string {
  if (text.length <= MAX_TEXT) return text;
  let cut = text.slice(0, MAX_TEXT);
  const amp = cut.lastIndexOf("&");
  if (amp >= 0 && !cut.slice(amp).includes(";")) cut = cut.slice(0, amp);
  return `${cut}…`;
}

export function sendTelegramMessage(chatId: string | number, text: string, extra?: Record<string, unknown>) {
  return tg<{ message_id?: number }>("sendMessage", { chat_id: chatId, text: clip(text), parse_mode: "HTML", ...extra });
}

/** Foydalanuvchi matnini HTML parse_mode uchun xavfsizlaydi ("<" xabarni buzmasin). */
export function tgEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------------------------------------------------------
// Bot holati
// ---------------------------------------------------------

export function getBotUsername(): string | null {
  if (env.TELEGRAM_TEST_MODE) return TEST_BOT_USERNAME;
  return botUsername;
}

/**
 * Bot haqiqatan ishlayaptimi (D-051): token bor, username ma'lum va oxirgi muvaffaqiyatli
 * `getUpdates` 90 soniya ichida bo'lgan. Ilgari `getMe` bir marta tekshirilar, keyin polling
 * yiqilsa ham havolalar berilaverardi (telegram-9).
 */
export function isTelegramAvailable(): boolean {
  if (env.TELEGRAM_TEST_MODE) return true;
  if (!env.TELEGRAM_BOT_TOKEN || !botUsername) return false;
  return Date.now() - lastPollOkAt < AVAILABILITY_WINDOW_MS;
}

/** Deep-link havolasi. Bot mavjud bo'lmasa `null` — chaqiruvchi 503 qaytaradi. */
export function telegramDeepLink(payload: string): string | null {
  const username = getBotUsername();
  if (!username) return null;
  return `https://t.me/${username}?start=${payload}`;
}

/** Foydalanuvchiga (bog'langan bo'lsa) Telegram orqali bildirishnoma. */
export async function notifyUserViaTelegram(userId: string, text: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  });
  if (!user?.telegramChatId) return;
  await sendTelegramMessage(user.telegramChatId, text);
}

// ---------------------------------------------------------
// Update turlari
// ---------------------------------------------------------

interface TgUser {
  id: number;
  first_name?: string;
}
export interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type?: string };
  text?: string;
  contact?: { phone_number: string; user_id?: number };
  reply_to_message?: TgMessage;
}
export interface TgCallbackQuery {
  id: string;
  from: TgUser;
  data?: string;
  message?: TgMessage;
}
export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

export const CONTACT_KEYBOARD = {
  reply_markup: {
    keyboard: [[{ text: "📱 Telefon raqamni ulashish", request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};
export const REMOVE_KEYBOARD = { reply_markup: { remove_keyboard: true } };

/**
 * Bot javoblari o'zbekcha (D-059: foydalanuvchi tili saqlanmaydi, Telegram matnlari tarjima qilinmaydi).
 * Yaroqsiz, eskirgan, ishlatilgan yoki identity mos kelmagan payload uchun BITTA umumiy javob —
 * hisob mavjudligi hech qachon oshkor qilinmaydi (D-046).
 */
export const MSG_INVALID = "⚠️ Havola yaroqsiz yoki muddati tugagan. Saytdan qaytadan urinib ko'ring.";
export const MSG_ERROR = "⚠️ Kutilmagan xatolik yuz berdi. Saytdan qaytadan urinib ko'ring.";

/** Saytga o'tish tugmasi: Telegram inline URL tugmasi faqat https havolani qabul qiladi. */

/** Long-polling holatni shu yerga yozadi (mavjudlik oynasi va username shu yerdan o'qiladi). */
export function setBotUsername(value: string | null): void {
  botUsername = value;
}

export function markPollSuccess(): void {
  lastPollOkAt = Date.now();
}

export function setTelegramLogger(log: typeof logger): void {
  logger = log;
}

export function telegramLogger(): typeof logger {
  return logger;
}
