import React, { useId } from "react";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { regionName } from "../../lib/i18n/regions.js";
import { CATEGORY_NAMES } from "../../lib/i18n/categories.js";
import { formatNumber } from "../../lib/format.js";
import {
  VACANCY_SORTS,
  clearFilters,
  countFilters,
  toSavedSearchParams,
  toggleIn,
  type VacancyQuery,
  type VacancySort,
} from "../../lib/vacancies/query.js";
import type { VacancyFacets } from "../../lib/types.js";
import { SaveSearchButton } from "../SaveSearchButton.js";
import { FieldSelect } from "./FieldSelect.js";
import { IconSliders, IconX } from "./icons.js";

/**
 * Natijalar ustidagi qator: son, obuna (mavjud saqlangan qidiruv mexanizmi),
 * saralash; < 1024px da "Filtrlar" tugmasi.
 */
export function VacancyToolbar({
  total,
  query,
  onSort,
  onOpenFilters,
}: {
  total: number | null;
  query: VacancyQuery;
  onSort: (sort: VacancySort) => void;
  onOpenFilters: () => void;
}) {
  const t = useT();
  const v = t.vacanciesPage;
  const id = useId();
  const count = countFilters(query);
  const sorts: VacancySort[] = query.sort === "salary-asc" ? [...VACANCY_SORTS, "salary-asc"] : [...VACANCY_SORTS];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[17px] font-bold text-ink" aria-live="polite">
          {total === null ? " " : v.toolbar.count(total)}
        </h2>
        <div className="sm:hidden">
          <SaveSearchButton
            params={toSavedSearchParams(query)}
            defaultName={query.q || t.search.titleAll}
            buttonClassName={subscribeButton}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold text-ink transition-colors hover:border-signal hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal lg:hidden"
        >
          <IconSliders size={17} />
          {v.filters.open}
          {count > 0 && <span className="rounded-full bg-signal px-1.5 text-[11px] font-bold leading-5 text-white">{count}</span>}
        </button>
        <div className="hidden sm:block">
          <SaveSearchButton params={toSavedSearchParams(query)} defaultName={query.q || t.search.titleAll} buttonClassName={subscribeButton} />
        </div>
        <span className="hidden text-sm text-dusk xl:inline">{v.toolbar.sort}:</span>
        <FieldSelect
          id={`${id}-sort`}
          label={v.toolbar.sort}
          size="sm"
          className="min-w-0 flex-1 sm:w-56 sm:flex-none"
          value={query.sort}
          options={sorts.map((sort) => ({ value: sort, label: v.toolbar.sorts[sort] }))}
          onChange={(sort) => onSort(sort as VacancySort)}
        />
      </div>
    </div>
  );
}

const subscribeButton =
  "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold text-ink transition-colors hover:border-signal hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

/** Qo'llangan filtrlar — har biri alohida olib tashlanadi. */
export function ActiveFilterChips({
  query,
  facets,
  onChange,
}: {
  query: VacancyQuery;
  facets: VacancyFacets | null;
  onChange: (next: VacancyQuery) => void;
}) {
  const t = useT();
  const v = t.vacanciesPage;
  const { locale } = useLocale();
  if (countFilters(query) === 0) return null;

  const chips: { key: string; label: string; next: VacancyQuery }[] = [
    ...query.region.map((slug) => ({ key: `r-${slug}`, label: regionName(locale, slug), next: { ...query, region: toggleIn(query.region, slug) } })),
    ...query.workType.map((w) => ({ key: `w-${w}`, label: v.workTypes[w], next: { ...query, workType: toggleIn(query.workType, w) } })),
    ...query.experience.map((e) => ({ key: `e-${e}`, label: v.experience[e], next: { ...query, experience: toggleIn(query.experience, e) } })),
    ...(query.category
      ? [
          {
            key: "category",
            label: CATEGORY_NAMES[locale][query.category] ?? facets?.categories.find((c) => c.slug === query.category)?.name ?? query.category,
            next: { ...query, category: "" },
          },
        ]
      : []),
    ...query.company.map((slug) => ({
      key: `c-${slug}`,
      label: facets?.companies.find((c) => c.slug === slug)?.name ?? slug,
      next: { ...query, company: toggleIn(query.company, slug) },
    })),
    ...(query.salaryFrom || query.salaryTo
      ? [
          {
            key: "salary",
            label: v.chips.salary(
              query.salaryFrom ? formatNumber(query.salaryFrom, locale) : null,
              query.salaryTo ? formatNumber(query.salaryTo, locale) : null
            ),
            next: { ...query, salaryFrom: null, salaryTo: null },
          },
        ]
      : []),
    ...(query.verified ? [{ key: "verified", label: v.chips.verified, next: { ...query, verified: false } }] : []),
    ...(query.premium ? [{ key: "premium", label: v.chips.premium, next: { ...query, premium: false } }] : []),
  ];

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => onChange(chip.next)}
            aria-label={v.chips.remove(chip.label)}
            className="inline-flex h-8 max-w-[240px] items-center gap-1.5 rounded-full border border-signal/25 bg-signal-soft pl-3 pr-2 text-[12.5px] font-semibold text-signal transition-colors hover:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <span className="truncate">{chip.label}</span>
            <IconX size={13} className="shrink-0" />
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={() => onChange(clearFilters(query))}
          className="rounded-md px-1 text-[13px] font-semibold text-dusk underline-offset-4 hover:text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          {v.filters.clearAll}
        </button>
      </li>
    </ul>
  );
}
