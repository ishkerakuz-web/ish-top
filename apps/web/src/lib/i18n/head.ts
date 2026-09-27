// +Head fayllari LocaleProvider'dan tashqarida render bo'ladi, shuning uchun
// til to'g'ridan-to'g'ri pageContext'dan olinadi (onBeforeRoute to'ldirgan).
import { usePageContext } from "vike-react/usePageContext";
import { getMessages, type Messages } from "./messages.js";
import { DEFAULT_LOCALE, LOCALES, SITE_ORIGIN, localizeHref, type Locale } from "./config.js";
import { pageLocale } from "./pageLocale.js";

export interface HrefAlternate {
  locale: Locale;
  href: string;
}

/**
 * Canonical va hreflang'da saqlanadigan query parametrlari (audit R3, seo-4).
 *
 * Sukut bo'yicha canonical filtrsiz yo'l bo'ladi. Lekin sitemap'da alohida URL
 * sifatida turgan sahifalar (masalan `/salaries?category=it`) va sahifalash
 * (`?page=2`) canonical'da SAQLANISHI kerak — aks holda sitemap va canonical
 * bir-biriga zid bo'ladi, sahifalangan ro'yxatlar esa 1-sahifaga "yig'iladi".
 *
 * Qiymatlar chaqiruvchi tomonidan TEKSHIRILGAN holda (query parser natijasi)
 * beriladi — xom foydalanuvchi matni canonical'ga tushmaydi.
 */
export type CanonicalParams = Record<string, string | number | null | undefined>;

/** Berilgan parametrlarni barqaror (alifbo) tartibda `?a=1&b=2` qilib qaytaradi. */
function canonicalSearch(params?: CanonicalParams): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === null || value === undefined || value === "") continue;
    qs.set(key, String(value));
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export function useHead(canonicalParams?: CanonicalParams): {
  t: Messages;
  locale: Locale;
  canonical: string;
  alternates: HrefAlternate[];
  xDefault: string;
} {
  const pc = usePageContext();
  const { locale, pathname: logical } = pageLocale(pc);
  const search = canonicalSearch(canonicalParams);
  return {
    t: getMessages(locale),
    locale,
    canonical: `${SITE_ORIGIN}${localizeHref(logical, locale)}${search}`,
    alternates: LOCALES.map((l) => ({ locale: l, href: `${SITE_ORIGIN}${localizeHref(logical, l)}${search}` })),
    xDefault: `${SITE_ORIGIN}${localizeHref(logical, DEFAULT_LOCALE)}${search}`,
  };
}
