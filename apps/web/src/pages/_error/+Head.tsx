import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { Seo } from "../../components/Seo.js";
import { useHead } from "../../lib/i18n/head.js";
import { VACANCY_NOT_FOUND } from "../../lib/vacancies/detail.js";
import { COMPANY_NOT_FOUND } from "../../lib/companies/detail.js";
import { ARTICLE_NOT_FOUND } from "../../lib/articles/adapter.js";

/**
 * Xato sahifasining meta teglari. Barcha holatlar `noindex` (canonical ham
 * berilmaydi), lekin matn holatga mos bo'lishi kerak: 500 va 503 javoblarida
 * "sahifa topilmadi" deyish noto'g'ri edi (audit R3, seo-12).
 *
 * hreflang/x-default xato sahifasida umuman chiqmaydi — `HeadDefault` da.
 */
export default function Head() {
  const { t } = useHead();
  const pageContext = usePageContext();
  const reason = (pageContext as { abortReason?: unknown }).abortReason;
  const status = (pageContext as { abortStatusCode?: number }).abortStatusCode;

  // API vaqtincha javob bermadi (`throw render(503)`) — vaqtinchalik holat (audit R3, seo-2/seo-3)
  if (status === 503) {
    return <Seo title={t.error.title503} description={t.error.desc503} noindex />;
  }
  if (reason === VACANCY_NOT_FOUND) {
    const s = t.vacancyDetail.states;
    return <Seo title={s.notFoundTitle} description={s.notFoundText} noindex />;
  }
  if (reason === COMPANY_NOT_FOUND) {
    const s = t.companyDetail.states;
    return <Seo title={s.notFoundTitle} description={s.notFoundText} noindex />;
  }
  if (reason === ARTICLE_NOT_FOUND) {
    const s = t.articles.detail.notFound;
    return <Seo title={s.title} description={s.text} noindex />;
  }
  // `is404 === false` — bu 404 emas, server xatosi (500)
  if (pageContext.is404 === false) {
    return <Seo title={t.error.title500} description={t.error.desc500} noindex />;
  }
  return <Seo title={t.meta.notFound.title} description={t.meta.notFound.description} noindex />;
}
