import React from "react";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { Skeleton } from "../../Skeleton.js";
import { CTA_PRIMARY, CTA_SECONDARY } from "../vacancies/styles.js";
import { IconAlert, IconRefresh, IconSearch, IconUsers } from "./icons.js";

function StateCard({
  testId,
  icon,
  tone = "neutral",
  title,
  text,
  role,
  children,
  className = "",
}: {
  testId: string;
  icon: React.ReactNode;
  tone?: "neutral" | "danger";
  title: string;
  text: string;
  role?: "alert";
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div role={role} data-testid={testId} className={`flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-5 py-14 text-center sm:px-8 ${className}`}>
      <span aria-hidden className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone === "danger" ? "bg-danger/10 text-danger" : "bg-signal-soft text-signal dark:text-indigo-300"}`}>
        {icon}
      </span>
      <h2 className="mt-4 max-w-md font-display text-lg font-bold text-ink sm:text-xl">{title}</h2>
      <p className="mt-1.5 max-w-md text-[14.5px] leading-relaxed text-dusk">{text}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

/** Umuman ariza yo'q (xato emas). */
export function ApplicationsEmpty() {
  const p = useT().employerApplicationsPage;
  const l = useHref();
  return (
    <StateCard testId="applications-empty" icon={<IconUsers size={26} />} title={p.empty.title} text={p.empty.text} className="mt-6">
      <a href={l("/employer/vacancies")} className={CTA_PRIMARY}>
        {p.empty.cta}
      </a>
    </StateCard>
  );
}

/** Arizalar bor, lekin qidiruv/filtr natijasi bo'sh. */
export function ApplicationsNoResults({ onReset }: { onReset: () => void }) {
  const p = useT().employerApplicationsPage;
  return (
    <StateCard testId="applications-no-results" icon={<IconSearch size={26} />} title={p.noResults.title} text={p.noResults.text}>
      <button type="button" onClick={onReset} className={CTA_SECONDARY}>
        {p.noResults.reset}
      </button>
    </StateCard>
  );
}

/** Yuklash xatosi — "murojaatlar yo'q" emas. */
export function ApplicationsError({ onRetry }: { onRetry: () => void }) {
  const p = useT().employerApplicationsPage;
  return (
    <StateCard testId="applications-error" role="alert" tone="danger" icon={<IconAlert size={26} />} title={p.error.title} text={p.error.text} className="mt-6">
      <button type="button" onClick={onRetry} className={CTA_PRIMARY}>
        <IconRefresh size={16} />
        {p.error.retry}
      </button>
    </StateCard>
  );
}

/** Tanlangan arizaning tafsiloti yuklanmoqda (audit R3, D-061: tafsilot alohida so'rov). */
export function DetailSkeleton() {
  const p = useT().employerApplicationsPage;
  return (
    <div aria-busy="true" data-testid="application-detail-skeleton" className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-xs sm:p-6">
      <span role="status" className="sr-only">
        {p.loading}
      </span>
      <div aria-hidden>
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
        </div>
        <Skeleton className="mt-6 h-16 w-full rounded-xl" />
        <Skeleton className="mt-5 h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Tafsilotni yuklab bo'lmadi — bo'sh ariza emas, xato (qayta urinish va orqaga qaytish). */
export function DetailError({ onRetry, onBack }: { onRetry: () => void; onBack: () => void }) {
  const p = useT().employerApplicationsPage;
  return (
    <div className="min-w-0">
      <StateCard testId="application-detail-error" role="alert" tone="danger" icon={<IconAlert size={26} />} title={p.error.title} text={p.error.text}>
        <button type="button" onClick={onRetry} className={CTA_PRIMARY}>
          <IconRefresh size={16} />
          {p.error.retry}
        </button>
        <button type="button" onClick={onBack} className={CTA_SECONDARY}>
          {p.back}
        </button>
      </StateCard>
    </div>
  );
}

/** Ro'yxat bor, ariza tanlanmagan — markaziy panel. */
export function SelectPrompt() {
  const p = useT().employerApplicationsPage;
  return (
    <div data-testid="applications-select-prompt" className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-14 text-center shadow-xs">
      <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-2xl bg-signal-soft text-signal dark:text-indigo-300">
        <IconUsers size={26} />
      </span>
      <h2 className="mt-4 font-display text-lg font-bold text-ink">{p.select.title}</h2>
      <p className="mt-1.5 max-w-sm text-[14.5px] leading-relaxed text-dusk">{p.select.text}</p>
    </div>
  );
}

/** Yuklanish — tayyor sahifa bilan bir xil tartib: tablar, ro'yxat qatorlari, profil, amallar. */
export function ApplicationsSkeleton() {
  const p = useT().employerApplicationsPage;
  return (
    <div aria-busy="true" data-testid="applications-skeleton" className="mt-6">
      <span role="status" className="sr-only">
        {p.loading}
      </span>
      <div aria-hidden>
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-28 shrink-0 rounded-xl" />
          ))}
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_300px]">
          <div className="rounded-2xl border border-line bg-surface">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3 border-b border-line px-4 py-3.5 last:border-0">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden rounded-2xl border border-line bg-surface p-6 lg:block">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3.5 w-1/3" />
              </div>
            </div>
            <Skeleton className="mt-6 h-16 w-full rounded-xl" />
            <Skeleton className="mt-5 h-40 w-full rounded-xl" />
          </div>
          <div className="hidden space-y-5 xl:block">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
