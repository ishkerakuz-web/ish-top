import { useCallback, useEffect, useState } from "react";
import { fetchVacancyFacets, fetchVacancyPage } from "../api.js";
import type { VacancyFacets, VacancyPage } from "../types.js";
import { toApiParams, toFacetParams, type VacancyQuery } from "./query.js";

/**
 * Ro'yxat va filtr sonlari. Asosiy yo'l — `+data` (server; filtr o'zgarsa Vike
 * qayta chaqiradi, oraliq navigatsiyalar chizilmaydi). Bu hook faqat server
 * javob bermagan holatni boshqaradi (/salaries dagi naqsh):
 * - brauzer bir marta o'zi qayta so'raydi, "Qayta urinish" — yana bir marta;
 * - so'rov effekt ichida: URL o'zgarsa yoki sahifa yopilsa bekor qilinadi
 *   (StrictMode'dagi qayta o'rnatishda ham yo'qolib qolmaydi).
 */
export function useVacancyResults(
  initial: { key: string; page: VacancyPage | null; facets: VacancyFacets | null },
  urlKey: string,
  urlQuery: VacancyQuery
) {
  const [override, setOverride] = useState<{ key: string; page: VacancyPage; facets: VacancyFacets | null } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => setOverride(null), [initial]);

  const needsFetch = initial.page === null && initial.key === urlKey;

  useEffect(() => {
    if (!needsFetch) return;
    const ctrl = new AbortController();
    setRetrying(true);
    Promise.all([fetchVacancyPage(toApiParams(urlQuery), ctrl.signal), fetchVacancyFacets(toFacetParams(urlQuery), ctrl.signal)])
      .then(([page, facets]) => {
        if (!ctrl.signal.aborted) setOverride({ key: urlKey, page, facets });
      })
      .catch(() => undefined) // xato holati ko'rinishda qoladi
      .finally(() => {
        if (!ctrl.signal.aborted) setRetrying(false);
      });
    return () => {
      ctrl.abort();
      setRetrying(false);
    };
  }, [needsFetch, urlKey, urlQuery, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const current = override && override.key === urlKey ? override : initial;
  return { page: current.page, facets: current.facets, retrying, retry };
}
