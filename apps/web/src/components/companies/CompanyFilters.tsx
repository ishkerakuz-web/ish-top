import React, { useId, useState } from "react";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { REGIONS, REGION_NAMES } from "../../lib/i18n/regions.js";
import {
  INDUSTRY_SLUGS,
  RATING_OPTIONS,
  SIZE_OPTIONS,
  toggleIn,
  type CompanyQuery,
} from "../../lib/companies/query.js";
import { Select } from "../Select.js";
import { IconStar } from "./icons.js";

const VISIBLE_INDUSTRIES = 6;

/**
 * Filtrlar tarkibi — desktop yon panelida ham, mobil drawer'da ham bir xil.
 * Holatni o'zi saqlamaydi: `value` + `onChange` (panelda darhol URL'ga,
 * drawer'da esa "Natijalarni ko'rsatish" bosilguncha qoralama sifatida).
 */
export function CompanyFilters({
  value,
  onChange,
  canFilterSaved,
}: {
  value: CompanyQuery;
  onChange: (patch: Partial<CompanyQuery>) => void;
  /** "Saqlanganlarim" — faqat kirgan ish izlovchiga. */
  canFilterSaved: boolean;
}) {
  const t = useT().companiesPage;
  const f = t.filters;
  const { locale } = useLocale();
  const uid = useId();
  const [showAllIndustries, setShowAllIndustries] = useState(false);

  const hiddenSelected = INDUSTRY_SLUGS.slice(VISIBLE_INDUSTRIES).some((s) => value.industry.includes(s));
  const industries = showAllIndustries || hiddenSelected ? INDUSTRY_SLUGS : INDUSTRY_SLUGS.slice(0, VISIBLE_INDUSTRIES);
  const hiddenCount = INDUSTRY_SLUGS.length - VISIBLE_INDUSTRIES;

  const regionOptions = [
    { value: "", label: f.regionAll },
    ...REGIONS.map((r) => ({ value: r.slug, label: REGION_NAMES[locale][r.slug] ?? r.slug })),
  ];

  return (
    <div className="divide-y divide-line">
      <Group legend={f.industry}>
        {industries.map((slug) => (
          <Check key={slug} checked={value.industry.includes(slug)} onChange={() => onChange({ industry: toggleIn(value.industry, slug) })}>
            {t.industries[slug]}
          </Check>
        ))}
        {!hiddenSelected && (
          <button
            type="button"
            onClick={() => setShowAllIndustries((v) => !v)}
            aria-expanded={showAllIndustries}
            className="mt-1 rounded-md text-left text-[13px] font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {showAllIndustries ? f.showLess : f.showMore(hiddenCount)}
          </button>
        )}
      </Group>

      <div className="py-5">
        <label htmlFor={`${uid}-region`} className="mb-2.5 block text-[13px] font-bold uppercase tracking-[0.08em] text-dusk">
          {f.region}
        </label>
        <Select id={`${uid}-region`} value={value.region} onChange={(region) => onChange({ region })} options={regionOptions} />
      </div>

      <Group legend={f.size}>
        {SIZE_OPTIONS.map((option) => (
          <Check key={option.slug} checked={value.size.includes(option.slug)} onChange={() => onChange({ size: toggleIn(value.size, option.slug) })}>
            {f.sizeOption(option.label)}
          </Check>
        ))}
      </Group>

      <Group legend={f.rating}>
        <Radio name={`${uid}-rating`} checked={value.rating === null} onChange={() => onChange({ rating: null })}>
          {f.ratingAny}
        </Radio>
        {RATING_OPTIONS.map((rating) => (
          <Radio key={rating} name={`${uid}-rating`} checked={value.rating === rating} onChange={() => onChange({ rating })}>
            <span className="inline-flex items-center gap-1.5">
              <Stars value={rating} />
              {f.ratingOption(rating.toFixed(1))}
            </span>
          </Radio>
        ))}
      </Group>

      <Group legend={f.work} hint={f.workHint}>
        <Check checked={value.work.includes("office")} onChange={() => onChange({ work: toggleIn(value.work, "office") })}>
          {f.workOffice}
        </Check>
        <Check checked={value.work.includes("remote")} onChange={() => onChange({ work: toggleIn(value.work, "remote") })}>
          {f.workRemote}
        </Check>
      </Group>

      <div className="space-y-1 pt-4">
        <Switch checked={value.verified} onChange={(verified) => onChange({ verified })}>
          {f.verified}
        </Switch>
        <Switch checked={value.hiring} onChange={(hiring) => onChange({ hiring })}>
          {f.hiring}
        </Switch>
        {(canFilterSaved || value.saved) && (
          <Switch checked={value.saved} onChange={(saved) => onChange({ saved })}>
            {f.saved}
          </Switch>
        )}
      </div>
    </div>
  );
}

function Group({ legend, hint, children }: { legend: string; hint?: string; children: React.ReactNode }) {
  return (
    // Chegara tashqi div'da: fieldset'ning o'ziga border berilsa legend chiziq ustiga tushadi
    <div className="py-5 first:pt-0">
      <fieldset>
        <legend className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.08em] text-dusk">{legend}</legend>
        {hint && <p className="-mt-1.5 mb-2 text-xs text-dusk">{hint}</p>}
        <div className="flex flex-col gap-0.5">{children}</div>
      </fieldset>
    </div>
  );
}

const optionRow =
  "flex min-h-[38px] cursor-pointer items-center gap-3 rounded-lg px-2 -mx-2 text-[14px] text-ink transition-colors hover:bg-surface-2";

function Check({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className={optionRow}>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded accent-signal dark:[color-scheme:dark]" />
      <span className={checked ? "font-semibold" : ""}>{children}</span>
    </label>
  );
}

function Radio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className={optionRow}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-signal dark:[color-scheme:dark]" />
      <span className={checked ? "font-semibold" : ""}>{children}</span>
    </label>
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

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <IconStar key={i} size={13} className={i <= Math.floor(value) ? "text-gold" : i - 0.5 === value ? "text-gold/50" : "text-line"} />
      ))}
    </span>
  );
}
