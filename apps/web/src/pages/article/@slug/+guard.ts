import { redirect } from "vike/abort";
import type { PageContext } from "vike/types";
import { DEFAULT_LOCALE, isLocale, localizeHref } from "../../../lib/i18n/config.js";

/** Eski detail manzili: `/article/:slug` → `/articles/:slug` (301). */
export function guard(pageContext: PageContext) {
  const slug = encodeURIComponent(pageContext.routeParams.slug ?? "");
  const locale = (pageContext as { locale?: unknown }).locale;
  const search = pageContext.urlParsed.searchOriginal ?? "";
  throw redirect(localizeHref(`/articles/${slug}${search}`, isLocale(locale) ? locale : DEFAULT_LOCALE), 301);
}
