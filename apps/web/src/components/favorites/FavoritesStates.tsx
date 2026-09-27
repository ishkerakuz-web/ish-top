import React from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import { Skeleton } from "../Skeleton.js";
import { PRIMARY } from "../vacancies/detail/VacancyDetailStates.js";
import { IconAlert, IconArrowRight, IconBookmarkFilled, IconRefresh, IconSearch } from "./icons.js";

/** Asosiy ustun (sarlavha ham shu yerda) + o'ng panel — panel sahifa tepasidan boshlanadi. */
export const FAVORITES_LAYOUT = "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]";

function CardSkeleton() {
  return (
    <div className="rounded-3xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex gap-3.5 sm:gap-4">
        <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="mt-2 h-3.5 w-1/3" />
          <Skeleton className="mt-3 h-4 w-4/5" />
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-3 md:flex">
          <Skeleton className="h-6 w-36 rounded-full" />
          <Skeleton className="h-10 w-56 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/** Asosiy ustun skeleti: tablar + filtrlar, kartalar — yuklangach sakrash bo'lmaydi. */
export function FavoritesMainSkeleton() {
  const f = useT().favoritesPage;
  return (
    <div aria-busy="true" className="space-y-5">
      <span role="status" className="sr-only">
        {f.loading}
      </span>
      <div className="rounded-3xl border border-line bg-surface">
        <div className="flex gap-5 overflow-hidden border-b border-line px-4 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-28 shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2.5 p-3 min-[480px]:grid-cols-3 sm:p-4">
          <Skeleton className="h-11 rounded-xl min-[480px]:col-span-3" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-11 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** O'ng panel skeleti (lg+; telefonda panel ro'yxatdan keyin keladi). */
export function FavoritesSidebarSkeleton() {
  return (
    <div aria-hidden className="hidden flex-col gap-5 lg:flex">
      <Skeleton className="h-[200px] rounded-3xl" />
      <Skeleton className="h-[230px] rounded-3xl" />
      <Skeleton className="h-[280px] rounded-3xl" />
      <Skeleton className="h-[170px] rounded-3xl" />
    </div>
  );
}

/** Birorta saqlangan vakansiya yo'q. */
export function FavoritesEmptyState() {
  const e = useT().favoritesPage.empty;
  const l = useHref();
  return (
    <section className="flex flex-col items-center rounded-3xl border border-line bg-surface px-6 py-12 text-center shadow-card sm:py-14">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-signal-soft text-signal">
        <IconBookmarkFilled size={28} />
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

/** Saqlanganlar bor, lekin qidiruv/filtr natijasi bo'sh. */
export function FavoritesFilterEmptyState({ onClear }: { onClear: () => void }) {
  const f = useT().favoritesPage.filterEmpty;
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
export function FavoritesErrorState({ onRetry }: { onRetry: () => void }) {
  const e = useT().favoritesPage.error;
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
