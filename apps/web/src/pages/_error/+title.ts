import type { PageContext } from "vike/types";
import { messagesFor } from "../../lib/i18n/messagesFor.js";
import { VACANCY_NOT_FOUND } from "../../lib/vacancies/detail.js";
import { COMPANY_NOT_FOUND } from "../../lib/companies/detail.js";
import { ARTICLE_NOT_FOUND } from "../../lib/articles/adapter.js";

/** Brauzer sarlavhasi holatga mos bo'lsin: 500/503 "topilmadi" emas (audit R3, seo-12). */
export default (pageContext: PageContext) => {
  const t = messagesFor(pageContext);
  const reason = (pageContext as { abortReason?: unknown }).abortReason;
  const status = (pageContext as { abortStatusCode?: number }).abortStatusCode;
  if (status === 503) return `${t.error.title503} | ISH BOR!`;
  if (reason === VACANCY_NOT_FOUND) return `${t.vacancyDetail.states.notFoundTitle} | ISH BOR!`;
  if (reason === COMPANY_NOT_FOUND) return `${t.companyDetail.states.notFoundTitle} | ISH BOR!`;
  if (reason === ARTICLE_NOT_FOUND) return `${t.articles.detail.notFound.title} | ISH BOR!`;
  if (pageContext.is404 === false) return `${t.error.title500} | ISH BOR!`;
  return t.meta.notFound.title;
};
