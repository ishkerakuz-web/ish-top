import { redirect } from "vike/abort";
import type { PageContext } from "vike/types";
import { pageLocale } from "../../../lib/i18n/pageLocale.js";
import { localizeHref } from "../../../lib/i18n/config.js";

/**
 * Eski ochiq profil manzili: `/employer/:slug` → `/companies/:slug` (301).
 * Ish beruvchi boshqaruv sahifalari statik yo'llarda (`/employer/vacancies`,
 * `/employer/candidates`, `/employer/applications`) — ular bu yo'ldan ustun
 * turadi va o'zgarmaydi. Til prefiksi va so'rov parametrlari saqlanadi.
 */
export function guard(pageContext: PageContext) {
  const slug = encodeURIComponent(pageContext.routeParams.slug ?? "");
  const search = pageContext.urlParsed.searchOriginal ?? "";
  throw redirect(localizeHref(`/companies/${slug}${search}`, pageLocale(pageContext).locale), 301);
}
