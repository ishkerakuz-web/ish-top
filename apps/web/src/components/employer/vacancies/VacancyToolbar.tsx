import React, { useId } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { FieldSelect } from "../../vacancies/FieldSelect.js";
import { VACANCY_STATUSES, type EmployerVacancyStats, type EmployerVacancyStatus, type FilterOption } from "../../../lib/employer/vacancies/adapter.js";
import { EMPLOYER_VACANCY_SORTS, type EmployerVacancyQuery, type EmployerVacancySort } from "../../../lib/employer/vacancies/query.js";
import { VacancySearch } from "./VacancySearch.js";
import { IconSort } from "./icons.js";

/**
 * Qidiruv, holat / hudud / toifa filtrlari va saralash. Hudud va toifa variantlari
 * ro'yxatdagi haqiqiy qiymatlardan — bittasi ham bo'lmasa o'sha tanlov chizilmaydi.
 */
export function VacancyToolbar({
  query,
  stats,
  regions,
  categories,
  onChange,
}: {
  query: EmployerVacancyQuery;
  stats: EmployerVacancyStats;
  regions: FilterOption[];
  categories: FilterOption[];
  onChange: (patch: Partial<EmployerVacancyQuery>, replace?: boolean) => void;
}) {
  const p = useT().employerVacanciesPage;
  const id = useId();
  const statusOptions = VACANCY_STATUSES.filter((s) => stats.byStatus[s] > 0 || query.status === s).map((s) => ({
    value: s,
    label: p.optionCount(p.status[s], stats.byStatus[s]),
  }));

  return (
    <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center" data-testid="vacancies-toolbar">
      <VacancySearch value={query.q} onSearch={(q) => onChange({ q }, true)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:flex xl:flex-1 xl:items-center">
        <FieldSelect
          id={`${id}-status`}
          label={p.filters.status}
          size="md"
          className="xl:w-[184px]"
          value={query.status ?? ""}
          options={[{ value: "", label: p.filters.allStatuses }, ...statusOptions]}
          onChange={(value) => onChange({ status: (value || null) as EmployerVacancyStatus | null })}
        />
        {regions.length > 0 && (
          <FieldSelect
            id={`${id}-region`}
            label={p.filters.region}
            size="md"
            className="xl:w-[184px]"
            value={query.region}
            options={[{ value: "", label: p.filters.allRegions }, ...regions.map((o) => ({ value: o.value, label: p.optionCount(o.label, o.count) }))]}
            onChange={(value) => onChange({ region: value })}
          />
        )}
        {categories.length > 0 && (
          <FieldSelect
            id={`${id}-category`}
            label={p.filters.category}
            size="md"
            className="xl:w-[184px]"
            value={query.category}
            options={[{ value: "", label: p.filters.allCategories }, ...categories.map((o) => ({ value: o.value, label: p.optionCount(o.label, o.count) }))]}
            onChange={(value) => onChange({ category: value })}
          />
        )}
        <FieldSelect
          id={`${id}-sort`}
          label={p.filters.sort}
          size="md"
          icon={<IconSort size={16} />}
          className="xl:ml-auto xl:w-[208px]"
          value={query.sort}
          options={EMPLOYER_VACANCY_SORTS.map((s) => ({ value: s, label: p.sort[s] }))}
          onChange={(value) => onChange({ sort: value as EmployerVacancySort })}
        />
      </div>
    </div>
  );
}
