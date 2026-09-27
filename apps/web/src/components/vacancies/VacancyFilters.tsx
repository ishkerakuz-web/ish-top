import React, { useEffect, useId, useMemo, useState } from "react";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { REGIONS, regionName } from "../../lib/i18n/regions.js";
import { CATEGORY_NAMES } from "../../lib/i18n/categories.js";
import { EXPERIENCE_API, EXPERIENCE_KEYS, WORK_TYPES, WORK_TYPE_API, toggleIn, type VacancyQuery } from "../../lib/vacancies/query.js";
import type { VacancyFacets } from "../../lib/types.js";
import { FieldSelect } from "./FieldSelect.js";
import { IconSearch, IconVerified } from "./icons.js";

/** Uzun ro'yxatlarda dastlab ko'rinadigan qatorlar (tanlanganlari doim ko'rinadi). */
const VISIBLE = 5;

function toAmount(value: string): number | null {
  const n = Math.trunc(Number(value.replace(/\s/g, "")));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Filtrlar tarkibi — desktop yon panelida ham, mobil drawer'da ham bir xil.
 * Holatni o'zi saqlamaydi: `value` + `onChange`. Sonlar `facets` dan (har bir
 * guruh o'z filtrini chetlab hisoblangan); facets kelmasa — sonsiz ishlaydi.
 *
 * `live` — drawer'dagi qoralama: maosh har harfda yoziladi. Yon panelda maosh
 * "Qo'llash" yoki Enter bilan qo'llanadi (har harfga ro'yxat qayta yuklanmasin).
 */
export function VacancyFilters({
  value,
  onChange,
  facets,
  live = false,
}: {
  value: VacancyQuery;
  onChange: (patch: Partial<VacancyQuery>) => void;
  facets: VacancyFacets | null;
  live?: boolean;
}) {
  const t = useT();
  const v = t.vacanciesPage;
  const f = v.filters;
  const { locale } = useLocale();
  const uid = useId();
  const [allRegions, setAllRegions] = useState(false);
  const [allCompanies, setAllCompanies] = useState(false);
  const [companyText, setCompanyText] = useState("");

  // ---- hududlar: ko'pdan kamga, bir xil bo'lsa alifbo bo'yicha
  const regions = useMemo(
    () =>
      REGIONS.map((r) => ({
        slug: r.slug,
        name: regionName(locale, r.slug),
        count: facets ? (facets.regions.find((x) => x.slug === r.slug)?.count ?? 0) : null,
      })).sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name)),
    [facets, locale]
  );
  const visibleRegions = allRegions ? regions : regions.filter((r, i) => i < VISIBLE || value.region.includes(r.slug));

  // ---- kompaniyalar: facets ro'yxati + (boshqa filtrlar tufayli sanalmagan) tanlanganlar
  const companies = useMemo(() => {
    const rows = facets?.companies ?? [];
    const missing = value.company
      .filter((slug) => !rows.some((r) => r.slug === slug))
      .map((slug) => ({ slug, name: slug, isVerified: false, count: 0 }));
    return [...rows, ...missing];
  }, [facets, value.company]);
  const needle = companyText.trim().toLocaleLowerCase();
  const matchedCompanies = needle ? companies.filter((c) => c.name.toLocaleLowerCase().includes(needle)) : companies;
  const visibleCompanies =
    allCompanies || needle ? matchedCompanies : matchedCompanies.filter((c, i) => i < VISIBLE || value.company.includes(c.slug));

  // ---- yo'nalish
  const categoryOptions = [
    { value: "", label: f.allCategories },
    ...(facets?.categories ?? []).map((c) => ({
      value: c.slug,
      label: `${CATEGORY_NAMES[locale][c.slug] ?? c.name} (${c.count})`,
    })),
  ];
  if (value.category && !categoryOptions.some((o) => o.value === value.category)) {
    categoryOptions.push({ value: value.category, label: CATEGORY_NAMES[locale][value.category] ?? value.category });
  }

  // ---- maosh (mahalliy qoralama)
  const [salaryFrom, setSalaryFrom] = useState(value.salaryFrom ? String(value.salaryFrom) : "");
  const [salaryTo, setSalaryTo] = useState(value.salaryTo ? String(value.salaryTo) : "");
  useEffect(() => {
    setSalaryFrom(value.salaryFrom ? String(value.salaryFrom) : "");
    setSalaryTo(value.salaryTo ? String(value.salaryTo) : "");
  }, [value.salaryFrom, value.salaryTo]);
  const salaryDirty = toAmount(salaryFrom) !== value.salaryFrom || toAmount(salaryTo) !== value.salaryTo;
  const applySalary = () => onChange({ salaryFrom: toAmount(salaryFrom), salaryTo: toAmount(salaryTo) });

  const workCount = (w: (typeof WORK_TYPES)[number]) =>
    facets ? (facets.employment.find((e) => e.value === WORK_TYPE_API[w])?.count ?? 0) : null;
  const experienceCount = (k: (typeof EXPERIENCE_KEYS)[number]) =>
    facets ? (facets.experience.find((e) => e.value === EXPERIENCE_API[k])?.count ?? 0) : null;

  return (
    <div className="divide-y divide-line">
      <Group legend={f.region}>
        {visibleRegions.map((r) => (
          <Check key={r.slug} checked={value.region.includes(r.slug)} count={r.count} onChange={() => onChange({ region: toggleIn(value.region, r.slug) })}>
            {r.name}
          </Check>
        ))}
        {regions.length > VISIBLE && (
          <MoreButton expanded={allRegions} onClick={() => setAllRegions((x) => !x)}>
            {allRegions ? f.showLess : f.showMore(regions.length - visibleRegions.length)}
          </MoreButton>
        )}
      </Group>

      <Group legend={f.workType}>
        {WORK_TYPES.map((w) => (
          <Check key={w} checked={value.workType.includes(w)} count={workCount(w)} onChange={() => onChange({ workType: toggleIn(value.workType, w) })}>
            {v.workTypes[w]}
          </Check>
        ))}
      </Group>

      <Group legend={f.experience}>
        {EXPERIENCE_KEYS.map((k) => (
          <Check
            key={k}
            checked={value.experience.includes(k)}
            count={experienceCount(k)}
            onChange={() => onChange({ experience: toggleIn(value.experience, k) })}
          >
            {v.experience[k]}
          </Check>
        ))}
      </Group>

      <Group legend={f.salary}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applySalary();
          }}
          className="flex flex-col gap-2"
        >
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                [f.salaryFrom, salaryFrom, setSalaryFrom, "from"],
                [f.salaryTo, salaryTo, setSalaryTo, "to"],
              ] as const
            ).map(([label, current, set, key]) => (
              <div key={key}>
                <label htmlFor={`${uid}-salary-${key}`} className="sr-only">
                  {`${f.salary} — ${label}`}
                </label>
                <input
                  id={`${uid}-salary-${key}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={500000}
                  placeholder={label}
                  value={current}
                  onChange={(e) => {
                    set(e.target.value);
                    if (live) {
                      onChange(key === "from" ? { salaryFrom: toAmount(e.target.value) } : { salaryTo: toAmount(e.target.value) });
                    }
                  }}
                  className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-[14px] text-ink placeholder:text-dusk focus:border-signal focus:bg-surface focus:outline-none focus:ring-4 focus:ring-signal/10 dark:[color-scheme:dark]"
                />
              </div>
            ))}
          </div>
          {!live && salaryDirty && (
            <button
              type="submit"
              className="h-10 rounded-xl bg-signal text-[13.5px] font-semibold text-white transition-colors hover:bg-signal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {f.salaryApply}
            </button>
          )}
        </form>
      </Group>

      <div className="py-4">
        <p className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.08em] text-dusk" aria-hidden>
          {f.category}
        </p>
        <FieldSelect
          id={`${uid}-category`}
          label={f.category}
          size="md"
          value={value.category}
          options={categoryOptions}
          onChange={(category) => onChange({ category })}
        />
      </div>

      <Group legend={f.company}>
        {companies.length > VISIBLE && (
          <div className="mb-2 flex h-10 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 transition-[border-color,box-shadow] focus-within:border-signal focus-within:bg-surface focus-within:ring-4 focus-within:ring-signal/10">
            <IconSearch size={16} className="shrink-0 text-dusk" />
            <label htmlFor={`${uid}-company`} className="sr-only">
              {f.companySearch}
            </label>
            <input
              id={`${uid}-company`}
              type="search"
              value={companyText}
              onChange={(e) => setCompanyText(e.target.value)}
              placeholder={f.companySearch}
              className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-dusk focus:outline-none"
            />
          </div>
        )}
        {visibleCompanies.length === 0 ? (
          <p className="py-1 text-[13px] text-dusk">{f.companyEmpty}</p>
        ) : (
          visibleCompanies.map((c) => (
            <Check key={c.slug} checked={value.company.includes(c.slug)} count={facets ? c.count : null} onChange={() => onChange({ company: toggleIn(value.company, c.slug) })}>
              <span className="inline-flex min-w-0 items-center gap-1">
                <span className="truncate">{c.name}</span>
                {c.isVerified && (
                  <span className="shrink-0 text-signal">
                    <IconVerified size={14} />
                    <span className="sr-only">{v.card.verified}</span>
                  </span>
                )}
              </span>
            </Check>
          ))
        )}
        {!needle && companies.length > VISIBLE && (
          <MoreButton expanded={allCompanies} onClick={() => setAllCompanies((x) => !x)}>
            {allCompanies ? f.showLess : f.showMore(companies.length - visibleCompanies.length)}
          </MoreButton>
        )}
      </Group>

      <div className="space-y-1 pt-4">
        <Switch checked={value.verified} onChange={(verified) => onChange({ verified })}>
          {f.verified}
        </Switch>
        <Switch checked={value.premium} onChange={(premium) => onChange({ premium })}>
          {f.premium}
        </Switch>
      </div>
    </div>
  );
}

function Group({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    // Chegara tashqi div'da: fieldset'ning o'ziga border berilsa legend chiziq ustiga tushadi
    <div className="py-4 first:pt-0">
      <fieldset>
        <legend className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.08em] text-dusk">{legend}</legend>
        <div className="flex flex-col gap-0.5">{children}</div>
      </fieldset>
    </div>
  );
}

function Check({
  checked,
  onChange,
  count,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  count: number | null;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`-mx-2 flex min-h-[34px] cursor-pointer items-center gap-3 rounded-lg px-2 text-[14px] text-ink transition-colors hover:bg-surface-2 ${
        count === 0 && !checked ? "text-ink/55" : ""
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded accent-signal dark:[color-scheme:dark]" />
      <span className={`min-w-0 flex-1 truncate ${checked ? "font-semibold" : ""}`}>{children}</span>
      {count !== null && <span className="shrink-0 text-[12.5px] tabular-nums text-dusk">{count}</span>}
    </label>
  );
}

function MoreButton({ expanded, onClick, children }: { expanded: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className="mt-1 self-start rounded-md text-left text-[13px] font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
    >
      {children}
    </button>
  );
}

function Switch({ checked, onChange, children }: { checked: boolean; onChange: (next: boolean) => void; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3">
      <span id={id} className="text-[14px] font-medium text-ink">
        {children}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
          checked ? "bg-signal" : "bg-line"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
          aria-hidden
        />
      </button>
    </div>
  );
}
