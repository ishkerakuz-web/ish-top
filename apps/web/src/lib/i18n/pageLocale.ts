import { extractLocale, isLocale, type Locale } from "./config.js";

/**
 * Sahifa tili va tilsiz yo'l. Odatda `onBeforeRoute` natijasi (`pageContext.locale`).
 * `+data` ichidan `throw render(404)` qilinganda Vike xato sahifasini yangi
 * pageContext bilan chizadi va u yerda bu maydonlar bo'lmaydi — shunda til
 * URL prefiksidan olinadi (aks holda /ru/... 404 o'zbekcha chiqardi).
 */
export function pageLocale(pc: { locale?: unknown; localePathname?: unknown; urlPathname?: string; urlOriginal?: string }): {
  locale: Locale;
  pathname: string;
} {
  if (isLocale(pc.locale)) {
    return { locale: pc.locale, pathname: typeof pc.localePathname === "string" && pc.localePathname ? pc.localePathname : "/" };
  }
  const raw = pc.urlPathname ?? (pc.urlOriginal ? pc.urlOriginal.split(/[?#]/)[0] : "/");
  return extractLocale(raw || "/");
}
