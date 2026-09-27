import React from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import { Skeleton } from "../Skeleton.js";
import { PRIMARY } from "../vacancies/detail/VacancyDetailStates.js";
import { IconAlert, IconArrowRight, IconBell, IconFilter, IconRefresh } from "./icons.js";

/** Asosiy ustun (sarlavha ham shu yerda) + o'ng panel — panel sahifa tepasidan boshlanadi. */
export const NOTIFICATIONS_LAYOUT = "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]";

function CardSkeleton() {
  return (
    <div className="rounded-3xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex gap-3.5 sm:gap-4">
        <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="mt-2.5 h-3.5 w-4/5" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-9 w-36 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tablar, amallar paneli va kartalar skeleti — yuklangach sakrash bo'lmaydi. */
export function NotificationsMainSkeleton() {
  const n = useT().notificationsPage;
  return (
    <div aria-busy="true" className="space-y-5">
      <span role="status" className="sr-only">
        {n.loading}
      </span>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-48 rounded-2xl" />
        <Skeleton className="h-11 w-36 rounded-2xl" />
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-10 w-60 rounded-xl sm:ml-auto" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function NotificationsSidebarSkeleton() {
  return (
    <div aria-hidden className="hidden flex-col gap-5 lg:flex">
      <Skeleton className="h-[190px] rounded-3xl" />
      <Skeleton className="h-[260px] rounded-3xl" />
      <Skeleton className="h-[170px] rounded-3xl" />
      <Skeleton className="h-[170px] rounded-3xl" />
    </div>
  );
}

/** Umuman bildirishnoma yo'q. CTA — faqat nomzodga (vakansiyalar). */
export function NotificationsEmptyState({ showCta }: { showCta: boolean }) {
  const e = useT().notificationsPage.empty;
  const l = useHref();
  return (
    <section className="flex flex-col items-center rounded-3xl border border-line bg-surface px-6 py-12 text-center shadow-card sm:py-14">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-signal-soft text-signal">
        <IconBell size={28} />
      </span>
      <h2 className="mt-5 font-display text-xl font-bold text-ink">{e.title}</h2>
      <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-dusk">{e.text}</p>
      {showCta && (
        <a href={l("/vacancies")} className={`${PRIMARY} mt-7`}>
          {e.cta}
          <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </a>
      )}
    </section>
  );
}

/** Bildirishnomalar bor, lekin filtr natijasi bo'sh. */
export function NotificationsFilterEmptyState({ onClear }: { onClear: () => void }) {
  const f = useT().notificationsPage.filterEmpty;
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-dusk">
        <IconFilter size={22} />
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

/**
 * Kursor sahifalash (audit R3, D-078): "Yana yuklash" tugmasi va uning holatlari.
 * Yuklanmoqda, xato (qayta urinish) va ro'yxat oxiri — hammasi ko'rinib turadi;
 * xato hech qachon bo'sh ro'yxatga aylanmaydi (eski qatorlar ekranda qoladi).
 */
export function NotificationsLoadMore({
  hasMore,
  status,
  reachedEnd,
  truncatedNote,
  onLoad,
}: {
  hasMore: boolean;
  status: "idle" | "loading" | "error";
  reachedEnd: boolean;
  /** Server kursorni qo'llab-quvvatlamasa — "oxirgi N ta ko'rsatilmoqda" izohi. */
  truncatedNote: string | null;
  onLoad: () => void;
}) {
  const n = useT().notificationsPage;
  if (!hasMore) {
    if (truncatedNote) return <p className="text-center text-[12.5px] text-dusk">{truncatedNote}</p>;
    return reachedEnd ? <p className="text-center text-[12.5px] text-dusk">{n.list.end}</p> : null;
  }
  const loading = status === "loading";
  return (
    <div className="flex flex-col items-center gap-2">
      {status === "error" && (
        <p role="alert" className="text-center text-[13px] text-danger">
          {n.list.loadMoreError}
        </p>
      )}
      <button
        type="button"
        onClick={onLoad}
        disabled={loading}
        aria-busy={loading}
        className="inline-flex h-10 items-center rounded-xl border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-60"
      >
        {loading ? n.list.loadingMore : status === "error" ? n.error.retry : n.list.loadMore}
      </button>
      {loading && (
        <span role="status" className="sr-only">
          {n.list.loadingMore}
        </span>
      )}
    </div>
  );
}

/** API xatosi — "Qayta urinish" haqiqiy so'rovni qayta yuboradi. */
export function NotificationsErrorState({ onRetry }: { onRetry: () => void }) {
  const e = useT().notificationsPage.error;
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
