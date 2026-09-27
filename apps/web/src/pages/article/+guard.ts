import { redirect } from "vike/abort";
import type { PageContext } from "vike/types";
import { DEFAULT_LOCALE, isLocale, localizeHref } from "../../lib/i18n/config.js";

/**
 * Eski ro'yxat manzili: `/article` → `/articles` (301). Til prefiksi va so'rov
 * parametrlari saqlanadi — eski havolalar, xabarnomalar va qidiruv tizimidagi
 * manzillar ishlashda davom etadi.
 */
export function guard(pageContext: PageContext) {
  const locale = (pageContext as { locale?: unknown }).locale;
  const search = pageContext.urlParsed.searchOriginal ?? "";
  throw redirect(localizeHref(`/articles${search}`, isLocale(locale) ? locale : DEFAULT_LOCALE), 301);
}
