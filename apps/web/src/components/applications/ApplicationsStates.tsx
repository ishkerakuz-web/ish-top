import React from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import { Skeleton } from "../Skeleton.js";
import { PRIMARY } from "../vacancies/detail/VacancyDetailStates.js";
import { SUMMARY_GRID, summaryCellClass } from "./ApplicationSummary.js";
import { IconAlert, IconArrowRight, IconRefresh, IconSearch, IconSend } from "./icons.js";

/** Asosiy ustun (sarlavha ham shu yerda) + o'ng panel — panel sahifa tepasidan boshlanadi. */
export const APPLICATIONS_LAYOUT = "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]";

function ApplicationCardSkeleton() {
  return (
    <div className="rounded-3xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex gap-3.5 sm:gap-4">
        <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="mt-2 h-3.5 w-1/3" />
          <Skeleton className="mt-3 h-3.5 w-4/5" />
        </div>
        <Skeleton className="hidden h-7 w-32 shrink-0 self-center rounded-full xl:block" />
        <Skeleton className="hidden h-10 w-44 shrink-0 self-center rounded-xl md:block" />
      </div>
      <Skeleton className="mt-4 h-9 w-full rounded-xl" />
    </div>
  );
}

/** Asosiy ustun skeleti: statistika, tablar + filtrlar, kartalar — yuklangach sakrash bo'lmaydi. */
export function ApplicationsMainSkeleton() {
  const a = useT().applicationsPage;
  return (
    <div aria-busy="true" className="space-y-5">
      <span role="status" className="sr-only">
        {a.loading}
      </span>
      <div className={`grid gap-3 ${SUMMARY_GRID[5]}`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`rounded-2xl border border-line bg-surface p-4 ${summaryCellClass(i, 5)}`}>
            <Skeleton className="h-7 w-24 rounded-lg" />
            <Skeleton className="mt-3 h-[26px] w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-3xl border border-line bg-surface">
        <div className="flex gap-5 overflow-hidden border-b border-line px-4 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-24 shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2.5 p-3 min-[480px]:grid-cols-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_140px_140px_140px]">
          <Skeleton className="h-11 rounded-xl min-[480px]:col-span-3 xl:col-span-1" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-11 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ApplicationCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** O'ng panel skeleti (lg+; telefonda panel ro'yxatdan keyin keladi). */
export function ApplicationsSidebarSkeleton() {
  return (
    <div aria-hidden className="hidden flex-col gap-5 lg:flex">
      <Skeleton className="h-[380px] rounded-3xl" />
      <Skeleton className="h-[280px] rounded-3xl" />
      <Skeleton className="h-[170px] rounded-3xl" />
    </div>
  );
}

/** Hali birorta ariza yo'q (filtrsiz). */
export function ApplicationsEmptyState() {
  const e = useT().applicationsPage.empty;
  const l = useHref();
  return (
    <section className="flex flex-col items-center rounded-3xl border border-line bg-surface px-6 py-12 text-center shadow-card sm:py-14">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-signal-soft text-signal">
        <IconSend size={28} />
      </span>
      <h2 className="mt-5 font-display text-xl font-bold text-ink">{e.title}</h2>
      <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-dusk">{e.text}</p>
      <a href={l("/vacancies")} className={`${PRIMARY} mt-7`}>
        {e.cta}
        <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </a>
    </section>
  );
}

/** Arizalar bor, lekin qidiruv/filtr natijasi bo'sh. */
export function ApplicationsFilterEmptyState({ onClear }: { onClear: () => void }) {
  const f = useT().applicationsPage.filterEmpty;
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-dusk">
        <IconSearch size={22} />
      </span>
      <h3 className="mt-4 font-display text-[16px] font-bold text-ink">{f.title}</h3>
      <p className="mt-1.5 max-w-sm text-[14px] text-dusk">{f.text}</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-5 inline-flex h-10 items-center rounded-xl border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        {f.clear}
      </button>
    </div>
  );
}

/** API xatosi — "Qayta urinish" haqiqiy so'rovni qayta yuboradi. */
export function ApplicationsErrorState({ onRetry }: { onRetry: () => void }) {
  const e = useT().applicationsPage.error;
  return (
    <div role="alert" className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface px-6 py-12 text-center sm:py-14">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <IconAlert size={26} />
      </span>
      <h2 className="mt-5 font-display text-xl font-bold text-ink">{e.title}</h2>
      <p className="mt-2 max-w-sm text-[14.5px] text-dusk">{e.text}</p>
      <button type="button" onClick={onRetry} className={`${PRIMARY} mt-7`}>
        <IconRefresh size={16} />
        {e.retry}
      </button>
    </div>
  );
}
