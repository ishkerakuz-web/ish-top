import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { useT, useHref } from "../../lib/i18n/index.js";
import { VACANCY_NOT_FOUND } from "../../lib/vacancies/detail.js";
import { VacancyNotFound } from "../../components/vacancies/detail/VacancyDetailStates.js";
import { COMPANY_NOT_FOUND } from "../../lib/companies/detail.js";
import { CompanyNotFound } from "../../components/companies/detail/CompanyDetailStates.js";
import { ARTICLE_NOT_FOUND } from "../../lib/articles/adapter.js";
import { ArticleNotFound } from "../../components/articles/detail/ArticleError.js";

export default function Page() {
  const pageContext = usePageContext();
  const is404 = pageContext.is404;
  const t = useT();
  const l = useHref();

  // API vaqtincha javob bermadi — SSR `throw render(503)` qildi (audit R3, seo-2/seo-3).
  // Sahifa indekslanmaydi, lekin "topilmadi" ham demaydi: qayta urinish taklif qilinadi.
  const status = (pageContext as { abortStatusCode?: number }).abortStatusCode;
  const unavailable = status === 503;

  // /vacancies/:slug, /companies/:slug yoki /articles/:slug topilmadi — xos holat (HTTP 404 saqlanadi)
  const reason = (pageContext as { abortReason?: unknown }).abortReason;
  if (is404 && reason === ARTICLE_NOT_FOUND) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        <ArticleNotFound />
      </div>
    );
  }
  if (is404 && (reason === VACANCY_NOT_FOUND || reason === COMPANY_NOT_FOUND)) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        {reason === VACANCY_NOT_FOUND ? <VacancyNotFound /> : <CompanyNotFound />}
      </div>
    );
  }

  return (
    <div className="flex min-h-[72vh] items-center justify-center px-4">
      <div className="animate-fade-up text-center">
        {/* Dekorativ katta raqam (past kontrast ataylab) — h1 mazmunni beradi */}
        <div className="font-display text-7xl font-bold text-line sm:text-8xl" aria-hidden>
          {is404 ? "404" : unavailable ? "503" : "500"}
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
          {is404 ? t.error.title404 : unavailable ? t.error.title503 : t.error.title500}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-dusk">
          {is404 ? t.error.desc404 : unavailable ? t.error.desc503 : t.error.desc500}
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {unavailable && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark"
            >
              {t.error.retry}
            </button>
          )}
          <a
            href={l("/")}
            className={
              unavailable
                ? "rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-signal hover:text-signal"
                : "rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark"
            }
          >
            {t.error.backHome}
          </a>
          <a
            href={l("/vacancies")}
            className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-signal hover:text-signal"
          >
            {t.error.viewVacancies}
          </a>
        </div>
      </div>
    </div>
  );
}
