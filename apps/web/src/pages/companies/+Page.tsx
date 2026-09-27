import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "vike-react/useData";
import type { data } from "./+data.js";
import { fetchFeaturedCompanies } from "../../lib/api.js";
import type { Company } from "../../lib/types.js";
import { useT, useHref } from "../../lib/i18n/index.js";
import { useRedirectRole } from "../../lib/useRoleGuard.js";
import { useAuth } from "../../components/AuthContext.js";
import { useCompanyQuery } from "../../lib/companies/useCompanyQuery.js";
import { useSavedCompanies } from "../../lib/companies/useSavedCompanies.js";
import { clearFilters, countFilters, toSearchParams, type CompanyQuery } from "../../lib/companies/query.js";
import { CompaniesHero } from "../../components/companies/CompaniesHero.js";
import { CompanySearch } from "../../components/companies/CompanySearch.js";
import { QuickCompanyFilters } from "../../components/companies/QuickCompanyFilters.js";
import { FeaturedCompanies } from "../../components/companies/FeaturedCompanies.js";
import { CompanyFilters } from "../../components/companies/CompanyFilters.js";
import { CompanyFilterDrawer } from "../../components/companies/CompanyFilterDrawer.js";
import { ActiveFilterChips, CompanyToolbar } from "../../components/companies/CompanyToolbar.js";
import { CompanyResults } from "../../components/companies/CompanyResults.js";
import { CompanyGridSkeleton } from "../../components/companies/CompanySkeleton.js";
import { SavedLoginState } from "../../components/companies/CompaniesStates.js";
import type { CardView } from "../../components/companies/CompanyCard.js";

type Data = Awaited<ReturnType<typeof data>>;

const VIEW_KEY = "ishbor:companies:view";

/** Katak/ro'yxat tanlovi — shu brauzerda eslab qolinadi (SSR'da doim katak). */
function useCardView(): [CardView, (view: CardView) => void] {
  const [view, setView] = useState<CardView>("grid");
  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_KEY) === "list") setView("list");
    } catch {
      // saqlash bloklangan — standart ko'rinish
    }
  }, []);
  const change = useCallback((next: CardView) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // e'tiborsiz
    }
  }, []);
  return [view, change];
}

export default function Page() {
  const initial = useData<Data>();
  const t = useT();
  const l = useHref();
  useRedirectRole("employer", "/employer/candidates");
  const { status } = useAuth();
  const { query, urlQuery, urlKey, pending, update } = useCompanyQuery();
  const saved = useSavedCompanies();
  const [view, setView] = useCardView();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [total, setTotal] = useState<number | null>(initial.first?.total ?? null);
  const resultsRef = useRef<HTMLElement>(null);

  // "Top kompaniyalar": serverdan kelgani, sahifaga boshqa sahifadan o'tilganda esa brauzerda
  const [featured, setFeatured] = useState<Company[] | null>(initial.featured);
  useEffect(() => {
    if (initial.featured) setFeatured(initial.featured);
  }, [initial.featured]);
  useEffect(() => {
    if (featured === null) void fetchFeaturedCompanies().then(setFeatured);
    // faqat birinchi yuklanishda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setTotal(initial.first?.total ?? null);
  }, [initial.key, initial.first]);

  const params = useMemo(() => toSearchParams(urlQuery), [urlQuery]);

  /** Filtr o'zgarishi: URL yangilanadi, sahifa natijalar boshidan pastda bo'lsa — tepaga. */
  const change = useCallback(
    (patch: Partial<CompanyQuery> | ((current: CompanyQuery) => CompanyQuery)) => {
      update(patch);
      const el = resultsRef.current;
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [update]
  );

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const { enabled: saveEnabled, toggle: toggleSaved } = saved;
  const onToggleSave = useCallback(
    (company: Company) => {
      if (saveEnabled) void toggleSaved(company.id);
      else window.location.assign(l("/login"));
    },
    [saveEnabled, toggleSaved, l]
  );

  // Mehmon ham yurakchani ko'radi (bosganda kirishga taklif); tekshiruv tugamaguncha — yashirin
  const canSave = saved.enabled || status === "guest";
  const filterCount = countFilters(query);
  const savedNeedsLogin = urlQuery.saved && status === "guest";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <CompaniesHero>
        <CompanySearch value={query.q} pending={pending} onSearch={(q) => update({ q }, { replace: true })} />
      </CompaniesHero>

      <div className="mt-5">
        <QuickCompanyFilters query={query} onChange={change} />
      </div>

      <FeaturedCompanies items={featured} />

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label={t.companiesPage.filters.title}>
          <div className="sticky top-24 max-h-[calc(100vh-7.5rem)] overflow-y-auto overscroll-contain rounded-3xl border border-line bg-surface p-5 shadow-card">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-display text-[17px] font-bold text-ink">{t.companiesPage.filters.title}</h2>
              {filterCount > 0 && (
                <button
                  type="button"
                  onClick={() => change((current) => clearFilters(current, true))}
                  className="rounded-md text-[13px] font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                >
                  {t.companiesPage.filters.clear}
                </button>
              )}
            </div>
            <CompanyFilters value={query} onChange={change} canFilterSaved={saved.enabled} />
          </div>
        </aside>

        <section ref={resultsRef} className="min-w-0 scroll-mt-28" aria-busy={pending}>
          <CompanyToolbar
            total={pending ? null : total}
            query={query}
            view={view}
            onViewChange={setView}
            onSortChange={(sort) => change({ sort })}
            onOpenFilters={() => setDrawerOpen(true)}
          />
          <div className="mt-3 empty:hidden">
            <ActiveFilterChips query={query} onChange={(next) => change(() => next)} />
          </div>

          <div className="mt-5">
            {savedNeedsLogin ? (
              <SavedLoginState loginHref={l("/login")} />
            ) : pending ? (
              <CompanyGridSkeleton count={6} view={view} />
            ) : (
              <CompanyResults
                key={urlKey}
                params={params}
                initial={initial.key === urlKey ? initial.first : null}
                token={saved.accessToken}
                needsToken={urlQuery.saved}
                view={view}
                isSaved={canSave ? saved.isSaved : undefined}
                onToggleSave={canSave ? onToggleSave : undefined}
                onTotal={setTotal}
                onReset={() => change((current) => clearFilters(current))}
                savedMode={urlQuery.saved}
              />
            )}
          </div>
        </section>
      </div>

      <CompanyFilterDrawer
        open={drawerOpen}
        value={query}
        canFilterSaved={saved.enabled}
        onClose={closeDrawer}
        onApply={(next) => {
          setDrawerOpen(false);
          change(() => next);
        }}
      />
    </div>
  );
}
