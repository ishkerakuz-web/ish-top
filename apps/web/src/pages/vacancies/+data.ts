import { render } from "vike/abort";
import { fetchVacancyFacets, fetchVacancyPage } from "../../lib/api.js";
import { parseVacancyQuery, queryKey, toApiParams, toFacetParams } from "../../lib/vacancies/query.js";
import type { VacancyFacets, VacancyPage } from "../../lib/types.js";

/**
 * Ro'yxat va filtr sonlari server tomonda — sahifa qidiruv tizimlariga tayyor
 * natijalar bilan boradi. Filtr/sahifa o'zgarganda Vike shu hookni qayta
 * chaqiradi (sahifa qayta yuklanmaydi, oraliq navigatsiyalar chizilmaydi).
 *
 * `page: null` — server javob bermadi (xato holati, brauzer qayta urinadi);
 * bo'sh natija esa `page.items.length === 0`.
 *
 * SSR'da asosiy ro'yxat kelmasa 200 emas, 503 qaytariladi (audit R3, seo-3 /
 * api-errors-1): aks holda Googlebot uzilish paytida "yuklab bo'lmadi" matnli
 * indekslanadigan sahifani ko'rardi (soft-404 xavfi). Filtr sonlari (`facets`)
 * ikkinchi darajali — ularsiz sahifa to'liq ishlaydi, shuning uchun ular
 * yiqilsa holat 200 bo'lib qolaveradi.
 */
export async function data(pageContext: {
  urlParsed: { search: Record<string, string> };
  isClientSideNavigation?: boolean;
}) {
  const query = parseVacancyQuery(pageContext.urlParsed.search);
  const [page, facets] = await Promise.all([
    fetchVacancyPage(toApiParams(query)).catch((): VacancyPage | null => null),
    fetchVacancyFacets(toFacetParams(query)).catch((): VacancyFacets | null => null),
  ]);
  if (!page && !pageContext.isClientSideNavigation) throw render(503);
  return { key: queryKey(query), page, facets };
}
