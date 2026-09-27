/**
 * Maosh sahifasi formatlari. Chrome ICU'da o'zbekcha raqam formati yo'q —
 * `uz` uchun ham `ru-RU` (vergul, bo'shliq) ishlatiladi, aks holda server va
 * brauzer turlicha chizib, hydration xatosi chiqadi (lib/format.ts dagidek).
 */
const decimal = {
  comma: new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }),
  dot: new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }),
};

function fmt(locale: string) {
  return locale === "en" ? decimal.dot : decimal.comma;
}

/** 6 500 000 → "6,5" (en: "6.5"). */
export function toMillions(value: number, locale: string): string {
  return fmt(locale).format(Math.round(value / 100_000) / 10);
}

/** 2.14 → "2,1" (en: "2.1"). */
export function formatRatio(value: number, locale: string): string {
  return fmt(locale).format(Math.round(value * 10) / 10);
}

/** Taqsimot ustuni: "0–3", "25+" (birlik alohida chiziladi). */
export function bucketRange(from: number, to: number | null, locale: string): string {
  return to === null ? `${toMillions(from, locale)}+` : `${toMillions(from, locale)}–${toMillions(to, locale)}`;
}

/** Ikki qiymat farqi foizda (asos 0 bo'lsa null). */
export function percentDelta(value: number, base: number): number | null {
  if (!base || !value) return null;
  return Math.round(((value - base) / base) * 100);
}
