import React, { useCallback } from "react";
import { useData } from "vike-react/useData";
import type { data } from "./+data.js";
import { useT } from "../../lib/i18n/index.js";
import { useUrlQuery } from "../../lib/useUrlQuery.js";
import {
  EMPTY_SALARY_QUERY,
  SALARY_ROLES,
  hasFilters,
  parseSalaryQuery,
  toSearchParams,
  type ExperienceKey,
  type SalaryRole,
} from "../../lib/salaries/query.js";
import { useDelayedFlag, useSalaryCatalogs, useSalaryStats } from "../../lib/salaries/useSalaryStats.js";
import { SalaryHero } from "../../components/salaries/SalaryHero.js";
import { SalarySearch } from "../../components/salaries/SalarySearch.js";
import { PopularRoles } from "../../components/salaries/PopularRoles.js";
import { SelectedProfession } from "../../components/salaries/SelectedProfession.js";
import { SalaryInsightCards } from "../../components/salaries/SalaryInsightCards.js";
import { SalaryDistributionChart } from "../../components/salaries/SalaryDistributionChart.js";
import { SalaryExperienceChart } from "../../components/salaries/SalaryExperienceChart.js";
import { RegionSalaryTable, SalaryTable } from "../../components/salaries/SalaryTables.js";
import { SalaryInsights } from "../../components/salaries/SalaryInsights.js";
import { RelatedVacanciesCTA } from "../../components/salaries/RelatedVacanciesCTA.js";
import { SalarySkeleton } from "../../components/salaries/SalarySkeleton.js";
import { SalaryEmptyState, SalaryErrorState } from "../../components/salaries/SalaryStates.js";

type Data = Awaited<ReturnType<typeof data>>;

/**
 * Maosh statistikasi — saytdagi real vakansiyalar asosida.
 * Holat URL'da (?role=&q=&category=&region=&experience=): yangilash, orqaga
 * tugmasi va ulashilgan havola bir xil ko'rinishni ochadi. Kasb → hudud →
 * tajriba tanlanadi, barcha karta/grafik/jadvallar birga yangilanadi,
 * oxirida — shu tanlovdagi vakansiyalarga o'tish.
 */
export default function Page() {
  const initial = useData<Data>();
  const t = useT();
  const s = t.salaries;
  const { query, urlQuery, urlKey, pending, update } = useUrlQuery(parseSalaryQuery, toSearchParams);
  const { categories, regions } = useSalaryCatalogs(initial.categories, initial.regions);
  const { stats, retrying, retry } = useSalaryStats(initial, urlKey, urlQuery);
  // Tez javoblarda skelet ko'rinmaydi — eski raqamlar bir lahza xiralashadi xolos
  const showSkeleton = useDelayedFlag(pending, 180);
  const roles = s.roles;

  /** Yozilgan matn ommabop kasb nomiga to'liq mos kelsa — o'sha kasb, aks holda erkin qidiruv. */
  const onText = useCallback(
    (text: string) => {
      const needle = text.toLocaleLowerCase();
      const role = SALARY_ROLES.find((r) => r === needle || roles[r].label.toLocaleLowerCase() === needle) ?? "";
      update((current) => ({ ...current, role, q: role ? "" : text, category: text ? "" : current.category }), { replace: true });
    },
    [roles, update]
  );
  const onRole = useCallback((role: SalaryRole | "") => update({ role, q: "", category: "" }), [update]);
  const onRegion = useCallback((region: string) => update({ region }), [update]);
  const onExperience = useCallback((experience: ExperienceKey | "") => update({ experience }), [update]);
  const onCategory = useCallback((category: string) => update({ category, role: "", q: "" }), [update]);
  const onReset = useCallback(() => update(() => EMPTY_SALARY_QUERY), [update]);

  const filtered = hasFilters(urlQuery);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <SalaryHero marketCount={stats?.market.count ?? null}>
        <SalarySearch
          text={query.role ? roles[query.role].label : query.q}
          region={query.region}
          experience={query.experience}
          regions={regions}
          pending={pending}
          onText={onText}
          onRegion={onRegion}
          onExperience={onExperience}
        />
      </SalaryHero>

      <PopularRoles active={query.role} onSelect={onRole} />

      <p role="status" className="sr-only">
        {pending ? s.states.loading : stats ? s.cards.basedOn(stats.summary.count) : ""}
      </p>

      <div
        aria-busy={pending}
        className={`mt-6 space-y-5 transition-opacity duration-200 ${pending && !showSkeleton ? "opacity-60" : ""}`}
      >
        {showSkeleton ? (
          <SalarySkeleton />
        ) : stats === null ? (
          <SalaryErrorState onRetry={retry} retrying={retrying} />
        ) : (
          <>
            <SelectedProfession query={urlQuery} stats={stats} categories={categories} regions={regions} onClear={onReset} />

            {stats.summary.count === 0 ? (
              <SalaryEmptyState onReset={onReset} canReset={filtered} />
            ) : (
              <>
                <SalaryInsightCards summary={stats.summary} market={stats.market} filtered={filtered} />
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <SalaryDistributionChart buckets={stats.distribution} median={stats.summary.median} />
                  <SalaryExperienceChart levels={stats.byExperience} selected={urlQuery.experience} />
                </div>
              </>
            )}

            {/* Jadvallar o'z filtrini chetlab hisoblanadi — bo'sh natijada ham boshqa hudud/sohani tanlashga yordam beradi */}
            {(stats.byCategory.length > 0 || stats.byRegion.length > 0) && (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <SalaryTable rows={stats.byCategory} selected={urlQuery.category} onSelect={onCategory} />
                <RegionSalaryTable rows={stats.byRegion} selected={urlQuery.region} onSelect={onRegion} />
              </div>
            )}

            {stats.summary.count > 0 && <SalaryInsights stats={stats} />}

            <RelatedVacanciesCTA query={urlQuery} summary={stats.summary} />
          </>
        )}
      </div>
    </div>
  );
}
