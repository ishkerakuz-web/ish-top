import React, { useEffect, useId, useRef } from "react";
import { useT } from "../../../lib/i18n/index.js";
import type { FilterOption } from "../../../lib/employer/applications/adapter.js";
import type { EmployerApplicationQuery } from "../../../lib/employer/applications/query.js";
import { Field, SelectInput } from "../vacancies/form/FormControls.js";
import { IconX } from "./icons.js";

/**
 * "Filtrlar" paneli (sarlavha ostida ochiladi): vakansiya, nomzod hududi, ariza sanasi, saralash.
 * Vakansiyalar — server bergan (ariza kelgan) ro'yxat va sonlar; hududlar — statik katalog
 * (audit R3, D-061: filtr serverda qo'llanadi). Esc yopadi, fokus tugmaga qaytadi.
 */
export function ApplicationsFilters({
  query,
  vacancies,
  regions,
  onChange,
  onReset,
  onClose,
}: {
  query: EmployerApplicationQuery;
  vacancies: FilterOption[];
  regions: FilterOption[];
  onChange: (patch: Partial<EmployerApplicationQuery>) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const p = useT().employerApplicationsPage;
  const f = p.filters;
  const headingId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("select")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Son faqat server bergan variantlarda ko'rsatiladi — to'qib chiqarilmaydi
  const withCount = (options: FilterOption[]) =>
    options.map((o) => ({ value: o.value, label: typeof o.count === "number" ? f.optionCount(o.label, o.count) : o.label }));

  return (
    <section ref={panelRef} id="applications-filters" aria-labelledby={headingId} data-testid="applications-filters" className="mt-4 animate-slide-down rounded-2xl border border-line bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="font-display text-[15px] font-semibold text-ink">
          {f.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={f.close}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          <IconX size={16} />
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field id="applications-filter-vacancy" label={f.vacancy}>
          <SelectInput id="applications-filter-vacancy" value={query.vacancy} options={withCount(vacancies)} placeholder={f.allVacancies} onChange={(v) => onChange({ vacancy: v })} />
        </Field>
        {regions.length > 0 && (
          <Field id="applications-filter-region" label={f.region}>
            <SelectInput id="applications-filter-region" value={query.region} options={withCount(regions)} placeholder={f.allRegions} onChange={(v) => onChange({ region: v })} />
          </Field>
        )}
        <Field id="applications-filter-period" label={f.period}>
          <SelectInput
            id="applications-filter-period"
            value={query.period}
            options={[
              { value: "7d", label: f.period7 },
              { value: "30d", label: f.period30 },
            ]}
            placeholder={f.periodAll}
            onChange={(v) => onChange({ period: v as EmployerApplicationQuery["period"] })}
          />
        </Field>
        <Field id="applications-filter-sort" label={f.sort}>
          <SelectInput
            id="applications-filter-sort"
            value={query.sort}
            options={[
              { value: "newest", label: f.sortNewest },
              { value: "oldest", label: f.sortOldest },
            ]}
            onChange={(v) => onChange({ sort: v as EmployerApplicationQuery["sort"] })}
          />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={onReset} className="rounded-md text-[13.5px] font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-indigo-300">
          {f.reset}
        </button>
      </div>
    </section>
  );
}
