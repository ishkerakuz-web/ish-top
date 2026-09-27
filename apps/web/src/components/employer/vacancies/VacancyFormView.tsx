import React, { useEffect, useRef, useState } from "react";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { fetchCategories, fetchRegions } from "../../../lib/api.js";
import { fetchEmployerCompanySummary, fetchEmployerVacancyRecord, type EmployerCompanySummary } from "../../../lib/employer/vacancies/api.js";
import type { Category, EmployerVacancy, Region } from "../../../lib/types.js";
import { Skeleton } from "../../Skeleton.js";
import { IconChevronRight } from "../../companies/icons.js";
import { VacancyForm } from "./VacancyForm.js";
import { NeedCompanyState, VacanciesError } from "./VacanciesStates.js";
import { CTA_SECONDARY } from "./styles.js";
import { IconSearch } from "./icons.js";

type FormState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "no_company" }
  | { kind: "not_found" }
  | { kind: "ready"; categories: Category[]; regions: Region[]; company: EmployerCompanySummary; vacancy: EmployerVacancy | null };

/** Yuklanish — tayyor sahifa bilan bir xil tartib (layout sakramasin). */
function FormSkeleton() {
  const t = useT();
  return (
    <div aria-busy="true" data-testid="vacancy-form-skeleton">
      <span role="status" className="sr-only">
        {t.employerVacanciesPage.loading}
      </span>
      <div aria-hidden className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Skeleton className="h-[58px] rounded-2xl" />
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex items-center gap-3.5">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Skeleton className="h-11 rounded-xl md:col-span-2" />
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-11 rounded-xl" />
              ))}
            </div>
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <div className="hidden space-y-5 xl:block">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * `/employer/vacancies/new` va `/employer/vacancies/:id/edit`. Tahrirlanadigan vakansiya
 * `GET /api/employer/vacancies/:id` dan olinadi (audit R3, scale-10k-13) — ilgari butun
 * ro'yxat yuklanib, keraklisi xotirada topilardi. Egalikni server tekshiradi: begona
 * yoki mavjud bo'lmagan e'lon "topilmadi" holatini beradi.
 */
export function VacancyFormView({ token, mode, vacancyId }: { token: string; mode: "new" | "edit"; vacancyId?: string }) {
  const t = useT();
  const f = t.employerVacanciesPage.form;
  const vf = t.vacancyForm;
  const l = useHref();
  const [state, setState] = useState<FormState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    Promise.all([
      fetchEmployerCompanySummary(tokenRef.current, controller.signal),
      fetchCategories(),
      fetchRegions(),
      mode === "edit" && vacancyId ? fetchEmployerVacancyRecord(tokenRef.current, vacancyId, controller.signal) : Promise.resolve(null),
    ])
      .then(([company, categories, regions, record]) => {
        if (controller.signal.aborted) return;
        if (!company) return setState({ kind: "no_company" });
        // Kategoriya va hudud majburiy — ro'yxatlar yuklanmasa formani to'ldirib bo'lmaydi (bo'sh forma emas, xato)
        if (categories.length === 0 || regions.length === 0) return setState({ kind: "error" });
        if (mode === "edit") {
          // Bitta yozuv alohida endpointdan (audit R3, scale-10k-13): topilmasa yoki begona bo'lsa — "topilmadi"
          if (!record) return setState({ kind: "not_found" });
          return setState({ kind: "ready", categories, regions, company, vacancy: record as unknown as EmployerVacancy });
        }
        setState({ kind: "ready", categories, regions, company, vacancy: null });
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name !== "AbortError") setState({ kind: "error" });
      });
    return () => controller.abort();
  }, [attempt, mode, vacancyId]);

  const listHref = l("/employer/vacancies");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-6 lg:pt-8">
      <header>
        <nav aria-label={t.companyDetail.breadcrumb}>
          <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-dusk">
            <li>
              {/* Saqlanmagan o'zgarish bo'lsa havolani forma ushlaydi (useLeaveGuard) */}
              <a
                href={listHref}
                className="rounded-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                {f.back}
              </a>
            </li>
            <li aria-hidden className="text-dusk/70">
              <IconChevronRight size={14} />
            </li>
            <li aria-current="page" className="font-medium text-ink">
              {mode === "new" ? vf.breadcrumbNew : vf.breadcrumbEdit}
            </li>
          </ol>
        </nav>
        <h1 className="mt-3 font-display text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[32px]">{mode === "new" ? f.newTitle : f.editTitle}</h1>
        <p className="mt-1 max-w-3xl text-[15px] leading-relaxed text-dusk">{mode === "new" ? f.newSubtitle : f.editSubtitle}</p>
      </header>

      {state.kind === "loading" && <FormSkeleton />}
      {state.kind === "error" && <VacanciesError onRetry={() => setAttempt((n) => n + 1)} />}
      {state.kind === "no_company" && <NeedCompanyState />}
      {state.kind === "not_found" && (
        <div data-testid="vacancy-form-not-found" className="mt-6 flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface px-5 py-14 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-signal-soft text-signal dark:text-indigo-300">
            <IconSearch size={28} />
          </span>
          <h2 className="mt-5 font-display text-xl font-bold text-ink">{f.notFoundTitle}</h2>
          <p className="mt-2 max-w-md text-[14.5px] text-dusk">{f.notFoundText}</p>
          <a href={listHref} className={`${CTA_SECONDARY} mt-7`}>
            {f.back}
          </a>
        </div>
      )}
      {state.kind === "ready" && (
        <VacancyForm
          token={token}
          categories={state.categories}
          regions={state.regions}
          company={state.company}
          vacancy={state.vacancy}
          listHref={listHref}
        />
      )}
    </div>
  );
}
