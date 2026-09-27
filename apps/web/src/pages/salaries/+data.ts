import { render } from "vike/abort";
import { fetchCategories, fetchRegions } from "../../lib/api.js";
import { fetchSalaryStats } from "../../lib/apiExtra.js";
import { parseSalaryQuery, queryKey, toApiParams } from "../../lib/salaries/query.js";
import type { SalaryStats } from "../../lib/types.js";

/**
 * Maosh statistikasi server tomonda yuklanadi — sahifa qidiruv tizimlariga
 * tayyor raqamlar bilan boradi. Filtr o'zgarganda Vike shu hookni qayta
 * chaqiradi; kategoriya/hudud ro'yxatlari esa sahifa ichidagi navigatsiyada
 * qayta so'ralmaydi (sahifa oldingisini saqlaydi).
 *
 * `stats: null` — server javob bermadi (sahifa xato holatini ko'rsatadi);
 * bo'sh natija esa `summary.count === 0`. SSR'da asosiy ma'lumot kelmasa 200
 * emas, 503 qaytariladi (audit R3, seo-3): uzilish paytida indekslanadigan
 * "yuklab bo'lmadi" sahifasi bo'lmasin.
 *
 * Kategoriya va hudud ro'yxatlari ikkinchi darajali: ular `[]` bilan qaytsa
 * ("yuklab bo'lmadi" ham shunday ko'rinadi) brauzer bir marta qayta so'rasin —
 * shuning uchun bo'sh ro'yxat `null` qilinadi (audit R3, api-errors-8).
 */
export async function data(pageContext: { urlParsed: { search: Record<string, string> }; isClientSideNavigation?: boolean }) {
  const query = parseSalaryQuery(pageContext.urlParsed.search);
  const client = Boolean(pageContext.isClientSideNavigation);
  const [stats, categories, regions] = await Promise.all([
    fetchSalaryStats(toApiParams(query)).catch((): SalaryStats | null => null),
    client ? Promise.resolve(null) : fetchCategories(),
    client ? Promise.resolve(null) : fetchRegions(),
  ]);
  if (!stats && !client) throw render(503);
  return {
    key: queryKey(query),
    stats,
    categories: categories && categories.length ? categories : null,
    regions: regions && regions.length ? regions : null,
  };
}
