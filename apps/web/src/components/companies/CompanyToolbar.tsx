import React from "react";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { REGION_NAMES } from "../../lib/i18n/regions.js";
import {
  COMPANY_SORTS,
  SIZE_OPTIONS,
  clearFilters,
  countFilters,
  type CompanyQuery,
  type CompanySort,
} from "../../lib/companies/query.js";
import { Select } from "../Select.js";
import type { CardView } from "./CompanyCard.js";
import { IconGrid, IconList, IconSliders, IconX } from "./icons.js";

/** Natijalar ustidagi qator: son, mobil filtr tugmasi, saralash, ko'rinish. */
export function CompanyToolbar({
  total,
  query,
  view,
  onViewChange,
  onSortChange,
  onOpenFilters,
}: {
  total: number | null;
  query: CompanyQuery;
  view: CardView;
  onViewChange: (view: CardView) => void;
  onSortChange: (sort: CompanySort) => void;
  onOpenFilters: () => void;
}) {
  const t = useT().companiesPage;
  const active = countFilters(query);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="font-display text-[17px] font-bold text-ink" aria-live="polite">
        {total === null ? <span className="inline-block h-5 w-28 rounded-md bg-line shimmer align-middle" /> : t.toolbar.count(total)}
      </p>

      <div className="flex w-full items-center gap-2 sm:w-auto">
        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-signal hover:text-signal lg:hidden"
        >
          <IconSliders size={18} />
          {t.filters.open}
          {active > 0 && <span className="rounded-full bg-signal px-1.5 text-xs font-bold leading-5 text-white">{active}</span>}
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <span className="hidden text-sm text-dusk xl:inline">{t.toolbar.sortLabel}:</span>
          <Select
            ariaLabel={t.toolbar.sortLabel}
            className="min-w-0 flex-1 sm:w-56 sm:flex-none"
            value={query.sort}
            onChange={(value) => onSortChange(value as CompanySort)}
            options={COMPANY_SORTS.map((sort) => ({ value: sort, label: t.toolbar.sorts[sort] }))}
          />
        </div>

        <div role="group" aria-label={t.toolbar.view} className="hidden shrink-0 rounded-xl border border-line bg-surface p-1 sm:flex">
          {(["grid", "list"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              aria-label={option === "grid" ? t.toolbar.viewGrid : t.toolbar.viewList}
              title={option === "grid" ? t.toolbar.viewGrid : t.toolbar.viewList}
              onClick={() => onViewChange(option)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                view === option ? "bg-signal text-white" : "text-dusk hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {option === "grid" ? <IconGrid size={17} /> : <IconList size={17} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Tanlangan filtrlar chiplari — har birini alohida olib tashlash mumkin. */
export function ActiveFilterChips({ query, onChange }: { query: CompanyQuery; onChange: (next: CompanyQuery) => void }) {
  const t = useT().companiesPage;
  const { locale } = useLocale();
  const chips: { key: string; label: string; remove: () => CompanyQuery }[] = [];

  if (query.q) chips.push({ key: "q", label: `"${query.q}"`, remove: () => ({ ...query, q: "" }) });
  for (const slug of query.industry) {
    chips.push({ key: `i-${slug}`, label: t.industries[slug], remove: () => ({ ...query, industry: query.industry.filter((s) => s !== slug) }) });
  }
  if (query.region) {
    chips.push({ key: "region", label: REGION_NAMES[locale][query.region] ?? query.region, remove: () => ({ ...query, region: "" }) });
  }
  for (const slug of query.size) {
    const option = SIZE_OPTIONS.find((o) => o.slug === slug);
    chips.push({ key: `s-${slug}`, label: t.filters.sizeOption(option?.label ?? slug), remove: () => ({ ...query, size: query.size.filter((s) => s !== slug) }) });
  }
  if (query.rating !== null) {
    chips.push({ key: "rating", label: `★ ${t.filters.ratingOption(query.rating.toFixed(1))}`, remove: () => ({ ...query, rating: null }) });
  }
  for (const work of query.work) {
    chips.push({
      key: `w-${work}`,
      label: work === "remote" ? t.filters.workRemote : t.filters.workOffice,
      remove: () => ({ ...query, work: query.work.filter((w) => w !== work) }),
    });
  }
  if (query.verified) chips.push({ key: "verified", label: t.filters.verified, remove: () => ({ ...query, verified: false }) });
  if (query.hiring) chips.push({ key: "hiring", label: t.filters.hiring, remove: () => ({ ...query, hiring: false }) });
  if (query.saved) chips.push({ key: "saved", label: t.filters.saved, remove: () => ({ ...query, saved: false }) });

  if (chips.length === 0) return null;

  return (
    <ul aria-label={t.toolbar.activeFilters} className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => onChange(chip.remove())}
            aria-label={t.toolbar.removeFilter(chip.label)}
            className="inline-flex h-8 max-w-[240px] items-center gap-1.5 rounded-full border border-signal/25 bg-signal-soft pl-3 pr-2 text-[13px] font-medium text-signal transition-colors hover:border-signal"
          >
            <span className="truncate">{chip.label}</span>
            <IconX size={14} className="shrink-0" />
          </button>
        </li>
      ))}
      {chips.length > 1 && (
        <li>
          <button type="button" onClick={() => onChange(clearFilters(query))} className="h-8 px-2 text-[13px] font-semibold text-dusk hover:text-signal">
            {t.toolbar.clearAll}
          </button>
        </li>
      )}
    </ul>
  );
}
