import { render } from "vike/abort";
import { fetchCompanyPage, fetchFeaturedCompanies, type CompanyPage } from "../../lib/api.js";
import { PAGE_SIZE, parseCompanyQuery, queryKey, toSearchParams } from "../../lib/companies/query.js";

/**
 * Birinchi sahifa serverda olinadi (SEO va tez birinchi ko'rinish), keyingilari
 * brauzerda cursor bilan. Filtr o'zgarganda Vike shu hookni qayta chaqiradi.
 *
 * - `saved=1` — token faqat brauzerda, shuning uchun bu holatda ro'yxat
 *   brauzerda olinadi (`first: null`).
 * - Server xatosida ham `first: null` — brauzer bir marta qayta urinadi,
 *   bo'lmasa xato holati ko'rsatiladi. SSR'da esa 503 qaytariladi (audit R3,
 *   seo-3): indekslanadigan "yuklab bo'lmadi" sahifasi bo'lmasin.
 * - "Top kompaniyalar" filtrga bog'liq emas: sahifa ichidagi navigatsiyada
 *   qayta so'ralmaydi (sahifa oldingisini saqlaydi). U ikkinchi darajali —
 *   yiqilsa `null` bo'ladi va brauzer qayta so'raydi (audit R3, api-errors-8),
 *   sahifa holati 200 bo'lib qolaveradi.
 */
export async function data(pageContext: { urlParsed: { search: Record<string, string> }; isClientSideNavigation?: boolean }) {
  const query = parseCompanyQuery(pageContext.urlParsed.search);
  const [first, featured] = await Promise.all([
    query.saved
      ? Promise.resolve(null)
      : fetchCompanyPage(toSearchParams(query), { limit: PAGE_SIZE }).catch((): CompanyPage | null => null),
    pageContext.isClientSideNavigation ? Promise.resolve(null) : fetchFeaturedCompanies(),
  ]);
  if (!query.saved && !first && !pageContext.isClientSideNavigation) throw render(503);
  // `[]` — "yuklab bo'lmadi" ham, "hech narsa yo'q" ham bo'lishi mumkin; brauzer
  // bir marta qayta so'rasin, aks holda blok butun tashrif davomida bo'sh qolardi.
  return { key: queryKey(query), first, featured: featured && featured.length ? featured : null };
}
