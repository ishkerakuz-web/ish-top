import { redirect } from "vike/abort";
import type { PageContext } from "vike/types";
import { DEFAULT_LOCALE, isLocale, localizeHref } from "../../../lib/i18n/config.js";
import { parseVacancyQuery, queryKey } from "../../../lib/vacancies/query.js";

/**
 * `/search/vacancy?text=react&area=tashkent` → `/vacancies?q=react&region=tashkent` (301).
 * Eski parametr nomlari yangi URL holatiga aylantiriladi; til prefiksi saqlanadi
 * (`/ru/search/vacancy` → `/ru/vacancies`). Xatcho'plar, tashqi havolalar va
 * qidiruv tizimidagi eski manzillar yo'qolmaydi.
 */
export function guard(pageContext: PageContext) {
  const qs = queryKey(parseVacancyQuery(pageContext.urlParsed.search));
  const locale = (pageContext as { locale?: unknown }).locale;
  throw redirect(localizeHref(`/vacancies${qs ? `?${qs}` : ""}`, isLocale(locale) ? locale : DEFAULT_LOCALE), 301);
}
