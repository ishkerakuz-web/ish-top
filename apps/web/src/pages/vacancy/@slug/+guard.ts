import { redirect } from "vike/abort";
import type { PageContext } from "vike/types";
import { DEFAULT_LOCALE, isLocale, localizeHref } from "../../../lib/i18n/config.js";

/**
 * Eski detail manzili: `/vacancy/:slug` → `/vacancies/:slug` (301). Til prefiksi
 * va so'rov parametrlari saqlanadi — xabarnomalar, ulashilgan havolalar va
 * qidiruv tizimidagi eski manzillar ishlashda davom etadi.
 */
export function guard(pageContext: PageContext) {
  const slug = encodeURIComponent(pageContext.routeParams.slug ?? "");
  const locale = (pageContext as { locale?: unknown }).locale;
  const search = pageContext.urlParsed.searchOriginal ?? "";
  throw redirect(localizeHref(`/vacancies/${slug}${search}`, isLocale(locale) ? locale : DEFAULT_LOCALE), 301);
}
