// Lug'at REGISTRY'si — matnlarning o'zi til bo'yicha alohida fayllarda
// (messages.uz.ts / messages.ru.ts / messages.en.ts), tiplar types.ts da.
//
// NEGA shunday: ilgari uchala til bitta modulda edi va bundler ularni bitta
// chunk qilardi — har bir tashrifchi UCHALA tilni yuklardi (~88 KB / 26 KB gzip),
// garchi bittasini o'qisa ham. Endi har til alohida chunk va faqat kerakligi
// tarmoqdan keladi (~9 KB gzip).
//
// Lug'at render paytida SINXRON kerak (ichida funksiyalar bor — `t.fmt.daysAgo(3)`),
// shuning uchun u render'dan OLDIN yuklab qo'yiladi:
//   server  — src/pages/+onBeforeRenderHtml.ts
//   brauzer — src/pages/+onBeforeRenderClient.ts
// Ikkala hook ham Vike tomonidan `await` qilinadi, ya'ni render boshlanganda
// lug'at joyida bo'ladi. Render ichida esa `getMessages()` sinxron ishlaydi.
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config.js";
import type { Messages } from "./types.js";

export type { Messages } from "./types.js";

// Dinamik import — bundler har birini alohida chunk qiladi.
const loaders: Record<Locale, () => Promise<{ default: Messages }>> = {
  uz: () => import("./messages.uz.js"),
  ru: () => import("./messages.ru.js"),
  en: () => import("./messages.en.js"),
};

const loaded = new Map<Locale, Messages>();

const asLocale = (locale: unknown): Locale => (isLocale(locale) ? locale : DEFAULT_LOCALE);

/**
 * Til lug'atini yuklaydi. Bir marta yuklanadi — keyingi chaqiriqlar darrov qaytadi.
 * Render'dan oldin (onBeforeRenderHtml / onBeforeRenderClient) chaqiriladi.
 */
export async function loadMessages(locale: unknown): Promise<void> {
  const l = asLocale(locale);
  if (loaded.has(l)) return;
  loaded.set(l, (await loaders[l]()).default);
}

/**
 * Yuklangan lug'atni sinxron qaytaradi — render ichida shu ishlatiladi.
 *
 * Amalda kerakli til doim yuklangan bo'ladi (hooklar har sahifada ishlaydi).
 * Agar bo'lmasa: SSR'da bitta xato butun sahifani 500 qiladi, shuning uchun
 * standart tilga tushamiz va ogohlantiramiz. Standart til ham yo'q bo'lsa —
 * bu chinakam dasturiy xato, uni yashirmaymiz.
 */
export function getMessages(locale: unknown): Messages {
  const l = asLocale(locale);
  const hit = loaded.get(l);
  if (hit) return hit;

  const fallback = loaded.get(DEFAULT_LOCALE);
  if (fallback) {
    console.warn(`i18n: "${l}" lug'ati yuklanmagan, "${DEFAULT_LOCALE}" ishlatildi.`);
    return fallback;
  }
  throw new Error(
    `i18n: "${l}" lug'ati yuklanmagan. loadMessages() render'dan oldin chaqirilishi kerak — ` +
      "src/pages/+onBeforeRenderHtml.ts (SSR) va +onBeforeRenderClient.ts (brauzer).",
  );
}
