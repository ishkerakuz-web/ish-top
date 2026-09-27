// i18n asoslari: tillar ro'yxati va URL bo'yicha til aniqlash.
// Til URL prefiksida saqlanadi: uz (default) — prefikssiz, ru/en — /ru, /en.
// Bu SEO uchun zarur (Google har tilni alohida URL'da indekslaydi + hreflang).

export const LOCALES = ["uz", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "uz";
export const LOCALE_COOKIE = "locale";

/**
 * Sayt production manzili — canonical / hreflang / og:url uchun yagona manba.
 *
 * `VITE_SITE_URL` orqali beriladi (Vercel'da Environment Variables). Ilgari bu
 * yerda domen qattiq yozilgan edi: qayerga deploy qilinsa ham har sahifa
 * canonical'i o'sha domenga ishora qilardi va Google haqiqiy saytni
 * indeksdan chiqarib yuborardi.
 *
 * Oxiridagi "/" olib tashlanadi — yo'llar unga qo'shib yoziladi.
 *
 * Zaxira qiymat FAQAT lokal ish uchun: production build'da `VITE_SITE_URL`
 * yo'q yoki localhost bo'lsa build to'xtaydi (`vite.config.ts` dagi tekshiruv,
 * audit R3, seo-10) — canonical/hreflang jimgina localhost'ga ishora qilmasin.
 */
export const SITE_ORIGIN = (
  (import.meta.env.VITE_SITE_URL as string | undefined) || "http://localhost:3001"
).replace(/\/+$/, "");

/** URL pathname'dan tilni ajratadi: "/ru/companies" -> { locale:"ru", pathname:"/companies" }. */
export function extractLocale(pathname: string): { locale: Locale; pathname: string } {
  const match = pathname.match(/^\/(ru|en)(?=\/|$)/);
  if (match) {
    const locale = match[1] as Locale;
    const rest = pathname.slice(match[0].length);
    return { locale, pathname: rest === "" ? "/" : rest };
  }
  return { locale: DEFAULT_LOCALE, pathname };
}

/** Ichki yo'lga til prefiksini qo'shadi. uz uchun prefiks yo'q. Tashqi/anchor tegilmaydi. */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith("/")) return href; // http, mailto:, tel:, #, tashqi
  if (locale === DEFAULT_LOCALE) return href;
  return href === "/" ? `/${locale}` : `/${locale}${href}`;
}

export const LOCALE_LABELS: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: "Русский",
  en: "English",
};

export const LOCALE_SHORT: Record<Locale, string> = {
  uz: "UZ",
  ru: "RU",
  en: "EN",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Cookie satridan (`a=b; locale=ru`) tilni ajratib oladi. */
export function resolveLocale(cookieHeader: string | null | undefined): Locale {
  if (!cookieHeader) return DEFAULT_LOCALE;
  const match = cookieHeader.match(/(?:^|;\s*)locale=([^;]+)/);
  const value = match?.[1];
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Brauzerda cookie'ga tilni yozadi (1 yil). */
export function persistLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${oneYear}; samesite=lax`;
}
