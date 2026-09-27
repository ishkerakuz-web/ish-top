import React from "react";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { Skeleton } from "../../Skeleton.js";
import { PRIMARY, Panel } from "../../vacancies/detail/VacancyDetailStates.js";
import { IconAlert, IconArrowRight, IconBuilding, IconRefresh, Spinner } from "./icons.js";

/** API xatosi — "Kompaniya ma'lumotlarini yuklab bo'lmadi." + "Qayta urinish". */
export function CompanyDetailError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const t = useT();
  const s = t.companyDetail.states;
  const l = useHref();
  return (
    <Panel role="alert" tone="danger" icon={<IconAlert size={26} />} title={s.errorTitle} text={s.errorText}>
      <button type="button" onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined} className={PRIMARY}>
        {retrying ? <Spinner size={16} /> : <IconRefresh size={16} />}
        {s.retry}
      </button>
      <a
        href={l("/companies")}
        className="inline-flex h-11 items-center rounded-xl border border-line px-5 text-sm font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal"
      >
        {s.back}
      </a>
    </Panel>
  );
}

/** Kompaniya yo'q (404). Server 404 holatida `_error` sahifasi ham shuni chizadi. */
export function CompanyNotFound() {
  const s = useT().companyDetail.states;
  const l = useHref();
  return (
    <Panel tone="neutral" icon={<IconBuilding size={26} />} title={s.notFoundTitle} text={s.notFoundText}>
      <a href={l("/companies")} className={PRIMARY}>
        {s.back}
        <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </a>
    </Panel>
  );
}

/** Qayta yuklash skeleti — sarlavha, tablar, asosiy va yon ustun (layout sakramasin). */
export function CompanyDetailSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-5" aria-busy="true">
      <span role="status" className="sr-only">
        {label}
      </span>
      <div aria-hidden>
        <div className="rounded-3xl border border-line bg-surface p-5 sm:p-7">
          <div className="flex items-start gap-4 sm:gap-6">
            <Skeleton className="h-16 w-16 shrink-0 rounded-2xl sm:h-[88px] sm:w-[88px] sm:rounded-3xl" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-8 w-56 max-w-full" />
              <Skeleton className="mt-3 h-4 w-40" />
              <Skeleton className="mt-3 h-4 w-72 max-w-full" />
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-6 rounded-3xl border border-line bg-surface px-6 py-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-line bg-surface p-6">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="mt-4 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-11/12" />
              <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-2xl" />
                ))}
              </div>
            </div>
            <Skeleton className="h-72 w-full rounded-3xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-28 w-full rounded-3xl" />
            <Skeleton className="h-64 w-full rounded-3xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
