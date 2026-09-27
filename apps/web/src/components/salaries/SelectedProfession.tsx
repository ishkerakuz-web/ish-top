import React from "react";
import { useT, useHref } from "../../lib/i18n/index.js";
import { vacancySearchHref, vacancySearchParams, type SalaryQuery, type SalaryRole } from "../../lib/salaries/query.js";
import type { Category, Region, SalaryStats } from "../../lib/types.js";
import { SaveSearchButton } from "../SaveSearchButton.js";
import {
  IconArrowRight,
  IconBriefcase,
  IconCalculator,
  IconChartBars,
  IconCode,
  IconMegaphone,
  IconPenTool,
  IconPieChart,
  IconPin,
  IconSearch,
  IconTarget,
  IconUsers,
} from "./icons.js";

const ROLE_ICON: Record<SalaryRole, (p: { size?: number }) => React.ReactElement> = {
  "frontend-developer": IconCode,
  "backend-developer": IconCode,
  "ui-ux-designer": IconPenTool,
  marketer: IconMegaphone,
  accountant: IconCalculator,
  "sales-manager": IconTarget,
  hr: IconUsers,
  "data-analyst": IconPieChart,
};

/**
 * Tanlangan kasb (yoki "Barcha kasblar") sarlavhasi: yo'nalish, hudud va
 * tajriba; o'ngda — obuna sifatida saqlash va shu tanlovdagi vakansiyalar.
 */
export function SelectedProfession({
  query,
  stats,
  categories,
  regions,
  onClear,
}: {
  query: SalaryQuery;
  stats: SalaryStats;
  categories: Category[];
  regions: Region[];
  onClear: () => void;
}) {
  const t = useT();
  const l = useHref();
  const s = t.salaries;
  const category = categories.find((c) => c.slug === query.category);
  const region = regions.find((r) => r.slug === query.region);
  // Erkin qidiruvda yo'nalish — mos vakansiyalar eng ko'p uchragan sohalar
  const topCategories = [...stats.byCategory]
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((c) => c.name);

  const title = query.role
    ? s.roles[query.role].label
    : query.q
      ? s.selected.query(query.q)
      : (category?.name ?? s.selected.all);
  const meta = query.role
    ? s.roles[query.role].meta
    : query.q
      ? topCategories.join(" · ") || s.selected.allMeta
      : category
        ? s.selected.categoryMeta
        : s.selected.allMeta;
  const Icon = query.role ? ROLE_ICON[query.role] : query.q ? IconSearch : category ? IconBriefcase : IconChartBars;
  const level = query.experience ? s.levels[query.experience] : null;
  const filtered = Boolean(query.role || query.q || query.category || query.region || query.experience);

  return (
    <section
      aria-labelledby="salary-selected-title"
      className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-signal to-[#7C3AED] text-white shadow-[0_12px_24px_-12px_rgba(79,70,229,0.65)] sm:h-16 sm:w-16">
          <Icon size={28} />
        </span>
        <div className="min-w-0">
          <h2 id="salary-selected-title" className="break-words font-display text-xl font-extrabold tracking-tight text-ink sm:text-[22px]">
            {title}
          </h2>
          <p className="mt-0.5 text-[13.5px] text-dusk">{meta}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
            <span className="inline-flex items-center gap-1 font-medium text-signal">
              <IconPin size={15} />
              {region?.name ?? s.selected.wholeCountry}
            </span>
            {level && (
              <span className="text-ink/80">
                · {level.label} ({level.years})
              </span>
            )}
            {filtered && (
              <button
                type="button"
                onClick={onClear}
                className="rounded text-[13px] font-semibold text-dusk underline-offset-4 transition-colors hover:text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                {s.selected.clear}
              </button>
            )}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 md:items-end">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap md:justify-end">
          <SaveSearchButton
            params={vacancySearchParams(query)}
            defaultName={[title, region?.name].filter(Boolean).join(", ")}
            label={s.selected.save}
            icon="heart"
            buttonClassName="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-signal/50 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:w-auto"
            popoverClassName="left-0 md:left-auto md:right-0"
          />
          <a
            href={l(vacancySearchHref(query))}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-signal px-5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-signal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            {s.selected.viewVacancies}
            <IconArrowRight size={16} />
          </a>
        </div>
        <p className="text-[13px] text-dusk md:text-right">{s.selected.vacancies(stats.vacancyCount)}</p>
      </div>
    </section>
  );
}
