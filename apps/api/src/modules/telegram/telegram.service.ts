/**
 * Telegram moduli — ochiq yuzasi.
 *
 * Ichki tuzilma: `telegram.api.ts` (transport va bot holati), `telegram.flows.ts`
 * (telefon/tiklash oqimlari), `telegram.support.ts` (support relay),
 * `telegram.polling.ts` (update marshruti va long-polling). Boshqa modullar
 * faqat shu fayldan import qiladi, shuning uchun ichki bo'linish o'zgarsa ham
 * chaqiruvchilar tegilmaydi.
 */
export {
  sendTelegramMessage,
  tgEscape,
  getBotUsername,
  isTelegramAvailable,
  telegramDeepLink,
  notifyUserViaTelegram,
  setTelegramTransportForTests,
  type TelegramTransport,
  type TgUpdate,
} from "./telegram.api.js";
export { handleTelegramUpdate, startTelegramBot, stopTelegramBot } from "./telegram.polling.js";
