import React, { useCallback, useEffect, useRef, useState } from "react";
import { useData } from "vike-react/useData";
import type { data } from "./+data.js";
import { useT, useHref } from "../../lib/i18n/index.js";
import { useRedirectRole } from "../../lib/useRoleGuard.js";
import { useAuth } from "../../components/AuthContext.js";
import { useFavorites } from "../../lib/useFavorites.js";
import { useUrlQuery } from "../../lib/useUrlQuery.js";
import { useDelayedFlag } from "../../lib/useDelayedFlag.js";
import {
  clearFilters,
  countFilters,
  parseVacancyQuery,
  queryKey,
  toSearchParams,
  type VacancyQuery,
  type VacancySort,
  type WorkType,
} from "../../lib/vacancies/query.js";
import { useVacancyResults } from "../../lib/vacancies/useVacancyResults.js";
import { VacancyHero } from "../../components/vacancies/VacancyHero.js";
import { VacancySearch } from "../../components/vacancies/VacancySearch.js";
import { PopularSearches } from "../../components/vacancies/PopularSearches.js";
import { VacancyFilters } from "../../components/vacancies/VacancyFilters.js";
import { VacancyFilterDrawer } from "../../components/vacancies/VacancyFilterDrawer.js";
import { ActiveFilterChips, VacancyToolbar } from "../../components/vacancies/VacancyToolbar.js";
import { VacancyList } from "../../components/vacancies/VacancyList.js";
import { VacancyListSkeleton } from "../../components/vacancies/VacancySkeleton.js";
import { VacancyEmptyState, VacancyErrorState } from "../../components/vacancies/VacancyStates.js";
import { VacancyPagination } from "../../components/vacancies/VacancyPagination.js";

type Data = Awaited<ReturnType<typeof data>>;
type Patch = Partial<VacancyQuery> | ((current: VacancyQuery) => VacancyQuery);

/**
 * Vakansiyalar — qidiruv, filtr, saralash va sahifalash. Holat to'liq URL'da
 * (lib/vacancies/query.ts): yangilash, orqaga/oldinga va ulashilgan havola bir
 * xil natijani ochadi. Sahifalash backend'dagi mavjud `page`/`pageSize` bilan.
 */
export default function Page() {
  const initial = useData<Data>();
  const t = useT();
  const v = t.vacanciesPage;
  const l = useHref();
  // Ish beruvchi ish qidirish sahifasiga emas, nomzodlar sahifasiga o'tadi
  useRedirectRole("employer", "/employer/candidates");
  const { status } = useAuth();
  const favorites = useFavorites();
  const { query, urlQuery, urlKey, pending, update } = useUrlQuery(parseVacancyQuery, toSearchParams);
  const { page, facets, retrying, retry } = useVacancyResults(initial, urlKey, urlQuery);
  // Tez javoblarda skelet ko'rinmaydi — eski ro'yxat bir lahza xiralashadi xolos
  const showSkeleton = useDelayedFlag(pending, 180);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);

  const scrollToResults = useCallback((always = false) => {
    const el = resultsRef.current;
    if (el && (always || el.getBoundingClientRect().top < 0)) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  /** Qidiruv, filtr yoki saralash o'zgarsa — birinchi sahifaga qaytiladi. */
  const change = useCallback(
    (patch: Patch, options: { replace?: boolean } = {}) => {
      update((current) => ({ ...(typeof patch === "function" ? patch(current) : { ...current, ...patch }), page: 1 }), options);
      scrollToResults();
    },
    [update, scrollToResults]
  );

  const onText = useCallback((q: string) => change({ q }, { replace: true }), [change]);
  const onRegion = useCallback((slug: string) => change({ region: slug ? [slug] : [] }), [change]);
  const onWorkType = useCallback((workType: WorkType | "") => change({ workType: workType ? [workType] : [] }), [change]);
  const onSort = useCallback((sort: VacancySort) => change({ sort }), [change]);
  const onPage = useCallback(
    (next: number) => {
      update({ page: next });
      scrollToResults(true);
    },
    [update, scrollToResults]
  );
  const onSize = useCallback((size: number) => change({ size }), [change]);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Sahifa raqami natijalar sonidan oshib ketsa (masalan filtrdan keyin eski havola) — oxirgi sahifaga
  useEffect(() => {
    if (!pending && page && page.items.length === 0 && page.total > 0 && urlQuery.page > 1) {
      update({ page: Math.max(1, page.pageCount) }, { replace: true });
    }
  }, [pending, page, urlQuery.page, update]);

  // Saqlash: faqat ish izlovchi; mehmon bosganda kirish sahifasiga
  const { enabled: saveEnabled, toggle: toggleFavorite, isFavorite } = favorites;
  const onToggleSave = useCallback(
    (id: string) => {
      if (saveEnabled) void toggleFavorite(id);
      else window.location.assign(l("/login"));
    },
    [saveEnabled, toggleFavorite, l]
  );
  const canSave = saveEnabled || status === "guest";

  const hrefFor = useCallback(
    (n: number) => {
      const qs = queryKey({ ...urlQuery, page: n });
      return l(`/vacancies${qs ? `?${qs}` : ""}`);
    },
    [urlQuery, l]
  );

  const filterCount = countFilters(query);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <VacancyHero total={page?.total ?? null}>
        <VacancySearch
          text={query.q}
          region={query.region}
          workType={query.workType}
          pending={pending}
          onText={onText}
          onRegion={onRegion}
          onWorkType={onWorkType}
        />
      </VacancyHero>

      <PopularSearches q={query.q} onSelect={(q) => change({ q })} />

      <p role="status" className="sr-only">
        {pending ? v.states.loading : page ? t.search.found(page.total) : ""}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[272px_minmax(0,1fr)] xl:gap-8">
        <aside className="hidden lg:block" aria-label={v.filters.title}>
          <div className="sticky top-24 max-h-[calc(100vh-7.5rem)] overflow-y-auto overscroll-contain rounded-3xl border border-line bg-surface p-5 shadow-card">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-display text-[16px] font-bold text-ink">{v.filters.title}</h2>
              {filterCount > 0 && (
                <button
                  type="button"
                  onClick={() => change((current) => clearFilters(current))}
                  className="rounded-md text-[13px] font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                >
                  {v.filters.clearAll}
                </button>
              )}
            </div>
            <VacancyFilters value={query} facets={facets} onChange={change} />
            {/* Panel ekrandan baland bo'lsa ichida aylanadi — pastda yana filtrlar borligiga ishora */}
            <div aria-hidden className="pointer-events-none sticky -bottom-5 -mx-5 -mb-5 mt-2 h-10 rounded-b-3xl bg-gradient-to-t from-surface via-surface/80 to-transparent" />
          </div>
        </aside>

        <section ref={resultsRef} className="min-w-0 scroll-mt-28" aria-busy={pending}>
          <VacancyToolbar
            total={page ? page.total : null}
            query={query}
            onSort={onSort}
            onOpenFilters={() => setDrawerOpen(true)}
          />
          <div className="mt-3 empty:hidden">
            <ActiveFilterChips query={query} facets={facets} onChange={(next) => change(() => next)} />
          </div>

          <div className={`mt-4 transition-opacity duration-200 ${pending && !showSkeleton ? "opacity-60" : ""}`}>
            {showSkeleton ? (
              <VacancyListSkeleton count={Math.min(query.size, 6)} />
            ) : page === null ? (
              <VacancyErrorState onRetry={retry} retrying={retrying} />
            ) : page.items.length === 0 ? (
              <VacancyEmptyState
                canReset={countFilters(urlQuery) > 0 || urlQuery.q !== ""}
                onReset={() => change((current) => clearFilters(current, false))}
              />
            ) : (
              <>
                <VacancyList
                  items={page.items}
                  isSaved={canSave ? isFavorite : undefined}
                  onToggleSave={canSave ? onToggleSave : undefined}
                />
                <VacancyPagination
                  page={urlQuery.page}
                  pageCount={page.pageCount}
                  total={page.total}
                  size={urlQuery.size}
                  hrefFor={hrefFor}
                  onPage={onPage}
                  onSize={onSize}
                />
              </>
            )}
          </div>
        </section>
      </div>

      <VacancyFilterDrawer
        open={drawerOpen}
        value={query}
        facets={facets}
        onClose={closeDrawer}
        onApply={(next) => {
          setDrawerOpen(false);
          change(() => next);
        }}
      />
    </div>
  );
}
