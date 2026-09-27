import React from "react";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { Skeleton } from "../../Skeleton.js";
import { CTA_PRIMARY, CTA_SECONDARY } from "./styles.js";
import { IconAlert, IconBriefcase, IconPlus, IconRefresh, IconSearch } from "./icons.js";

function StatePanel({
  testId,
  tone = "neutral",
  icon,
  title,
  text,
  role,
  children,
}: {
  testId: string;
  tone?: "neutral" | "danger";
  icon: React.ReactNode;
  title: string;
  text: string;
  role?: "alert";
  children?: React.ReactNode;
}) {
  return (
    <div role={role} data-testid={testId} className="mt-6 flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface px-5 py-14 text-center sm:px-8 sm:py-16">
      <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ${tone === "danger" ? "bg-danger/10 text-danger" : "bg-signal-soft text-signal dark:text-indigo-300"}`}>{icon}</span>
      <h2 className="mt-5 max-w-md font-display text-xl font-bold text-ink sm:text-2xl">{title}</h2>
      <p className="mt-2 max-w-md text-[14.5px] leading-relaxed text-dusk">{text}</p>
      {children && <div className="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">{children}</div>}
    </div>
  );
}

/** Kompaniyada hali birorta vakansiya yo'q. */
export function VacanciesEmpty() {
  const p = useT().employerVacanciesPage;
  const t = useT();
  const l = useHref();
  return (
    <StatePanel testId="vacancies-empty" icon={<IconBriefcase size={30} />} title={p.empty.title} text={p.empty.text}>
      <a href={l("/employer/vacancies/new")} className={CTA_PRIMARY}>
        <IconPlus size={18} />
        {t.empVacancies.newButton}
      </a>
    </StatePanel>
  );
}

/** Vakansiyalar bor, lekin qidiruv/filtr bo'yicha natija yo'q — umumiy bo'sh holatdan alohida. */
export function VacanciesNoResults({ onReset }: { onReset: () => void }) {
  const p = useT().employerVacanciesPage;
  return (
    <StatePanel testId="vacancies-no-results" icon={<IconSearch size={28} />} title={p.noResults.title} text={p.noResults.text}>
      <button type="button" onClick={onReset} className={CTA_SECONDARY}>
        {p.noResults.reset}
      </button>
    </StatePanel>
  );
}

/** API xatosi — hech qachon "vakansiyalar yo'q" bo'lib ko'rinmaydi; qayta urinish haqiqiy so'rov. */
export function VacanciesError({ onRetry }: { onRetry: () => void }) {
  const p = useT().employerVacanciesPage;
  return (
    <StatePanel testId="vacancies-error" role="alert" tone="danger" icon={<IconAlert size={28} />} title={p.error.title} text={p.error.text}>
      <button type="button" onClick={onRetry} className={CTA_PRIMARY}>
        <IconRefresh size={17} />
        {p.error.retry}
      </button>
    </StatePanel>
  );
}

/** Kompaniya profili to'ldirilmagan — vakansiya joylashdan oldin kerak. */
export function NeedCompanyState() {
  const t = useT();
  const l = useHref();
  return (
    <StatePanel testId="vacancies-need-company" icon={<IconBriefcase size={30} />} title={t.empVacancies.needCompanyTitle} text={t.empVacancies.needCompanyDesc}>
      <a href={l("/profile")} className={CTA_PRIMARY}>
        {t.empVacancies.needCompanyButton}
      </a>
    </StatePanel>
  );
}

/** Birinchi yuklanish — statistika, qidiruv paneli va qatorlar o'lchamida (layout sakramasin). */
export function VacanciesSkeleton() {
  const p = useT().employerVacanciesPage;
  return (
    <div aria-busy="true" data-testid="vacancies-skeleton">
      <span role="status" className="sr-only">
        {p.loading}
      </span>
      <div aria-hidden>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`}>
              <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-6 w-10" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-3 xl:flex-row">
          <Skeleton className="h-11 w-full rounded-xl xl:w-[400px]" />
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 xl:flex-row xl:items-center">
              <div className="flex flex-1 items-start gap-4">
                <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="mt-2 h-3 w-40" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-32 rounded-xl" />
                <Skeleton className="h-9 w-24 rounded-xl" />
                <Skeleton className="h-9 w-10 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
