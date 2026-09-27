import type { PageContext } from "vike/types";
import { extractLocale } from "../lib/i18n/config.js";

// Global hook: URL prefiksidan (/ru, /en) tilni aniqlab, routing uchun toza URL beradi.
// Masalan "/ru/companies" -> locale="ru", urlLogical="/companies" (filesystem routing shu bo'yicha).
export function onBeforeRoute(pageContext: PageContext) {
  const urlParsed = pageContext.urlParsed;
  const { locale, pathname } = extractLocale(urlParsed.pathname);
  // Hash faqat brauzerda mavjud — server tomonda o'qilsa Vike ogohlantiradi.
  const hash = typeof window === "undefined" ? "" : (urlParsed.hashOriginal ?? "");
  const urlLogical = pathname + (urlParsed.searchOriginal ?? "") + hash;
  return {
    pageContext: {
      locale,
      localePathname: pathname,
      urlLogical,
    },
  };
}
