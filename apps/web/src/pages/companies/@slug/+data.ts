import { render } from "vike/abort";
import { ApiError, fetchCompanyDetail, fetchSimilarCompanies } from "../../../lib/api.js";
import { COMPANY_NOT_FOUND } from "../../../lib/companies/detail.js";
import { SIMILAR_COMPANIES_LIMIT, type CompanyDetailData } from "../../../lib/companies/useCompanyDetail.js";

/**
 * Kompaniya + o'xshashlar parallel. Topilmasa — haqiqiy 404 (`_error`
 * kompaniyaga xos holatni chizadi).
 *
 * API javob bermasa SSR 503 qaytaradi (audit R3, seo-2 / api-errors-1) —
 * 200 + `noindex` tirik sahifani indeksdan chiqarib yuborardi. Brauzer ichidagi
 * navigatsiyada esa `company: null` va "Qayta urinish" holati saqlanadi.
 */
export async function data(pageContext: {
  routeParams: { slug: string };
  isClientSideNavigation?: boolean;
}): Promise<CompanyDetailData> {
  const { slug } = pageContext.routeParams;
  const [detail, similar] = await Promise.all([
    fetchCompanyDetail(slug).then(
      (company) => ({ company, failed: false }),
      (error: unknown) => {
        if (error instanceof ApiError) return { company: null, failed: true };
        throw error;
      }
    ),
    fetchSimilarCompanies(slug, SIMILAR_COMPANIES_LIMIT),
  ]);
  if (!detail.failed && !detail.company) throw render(404, COMPANY_NOT_FOUND);
  if (detail.failed && !pageContext.isClientSideNavigation) throw render(503);
  return { slug, company: detail.company, similar: detail.company ? similar : [] };
}
