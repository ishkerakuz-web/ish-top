import { render } from "vike/abort";
import { ApiError, fetchSimilarVacancies, fetchVacancyDetail } from "../../../lib/api.js";
import { VACANCY_NOT_FOUND } from "../../../lib/vacancies/detail.js";
import { SIMILAR_LIMIT, type VacancyDetailData } from "../../../lib/vacancies/useVacancyDetail.js";

/**
 * Vakansiya + o'xshashlar parallel. Topilmasa — haqiqiy 404 (`_error` sahifasi
 * vakansiyaga xos holatni chizadi).
 *
 * API javob bermasa (5xx, tarmoq, 8 s timeout) SSR endi 200 + `noindex` emas,
 * 503 qaytaradi (audit R3, seo-2 / api-errors-1): vaqtinchalik uzilishda
 * qidiruv tizimi keyin qayta uradi, tirik e'lon indeksdan chiqmaydi.
 * Brauzer ichidagi navigatsiyada eski xatti-harakat saqlanadi — `vacancy: null`
 * va sahifadagi "Qayta urinish" holati.
 */
export async function data(pageContext: {
  routeParams: { slug: string };
  isClientSideNavigation?: boolean;
}): Promise<VacancyDetailData> {
  const { slug } = pageContext.routeParams;
  const [detail, similar] = await Promise.all([
    fetchVacancyDetail(slug).then(
      (vacancy) => ({ vacancy, failed: false }),
      (error: unknown) => {
        if (error instanceof ApiError) return { vacancy: null, failed: true };
        throw error;
      }
    ),
    fetchSimilarVacancies(slug, SIMILAR_LIMIT),
  ]);
  if (!detail.failed && !detail.vacancy) throw render(404, VACANCY_NOT_FOUND);
  if (detail.failed && !pageContext.isClientSideNavigation) throw render(503);
  return { slug, vacancy: detail.vacancy, similar: detail.vacancy ? similar : [] };
}
