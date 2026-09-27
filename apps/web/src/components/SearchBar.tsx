import React, { useId, useState } from "react";
import { useT, useLocale, useHref } from "../lib/i18n/index.js";
import { REGIONS, REGION_NAMES, ALL_REGIONS_LABEL } from "../lib/i18n/regions.js";
import { Select } from "./Select.js";

/** Bosh sahifa qidiruv paneli — "buyruq paneli" uslubi: baland, 1px chegara,
 *  ichki ajratkichlar, siyoh tugma. Ota element kenglikni boshqaradi. */
export function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const t = useT();
  const { locale } = useLocale();
  const l = useHref();
  const regionNames = REGION_NAMES[locale];
  const [area, setArea] = useState("");
  const id = useId();
  // Audit R3, a11y-ui-10: maydonlar faqat placeholder bilan emas, yorliq bilan ham tanilsin
  const s = t.vacanciesPage.search;

  const regionOptions = [
    { value: "", label: ALL_REGIONS_LABEL[locale] },
    ...REGIONS.map((r) => ({ value: r.slug, label: regionNames[r.slug] })),
  ];

  return (
    <form
      action={l("/vacancies")}
      style={{ animationDelay: "100ms" }}
      role="search"
      className="flex w-full max-w-3xl animate-fade-up flex-col gap-2 rounded-2xl border border-line bg-surface p-2 shadow-card transition-[border-color,box-shadow] focus-within:border-signal focus-within:ring-4 focus-within:ring-signal/10 sm:flex-row sm:items-center sm:gap-1"
    >
      <div className="flex flex-1 items-center gap-2.5 px-3">
        <label htmlFor={`${id}-q`} className="sr-only">
          {s.label}
        </label>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-dusk" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id={`${id}-q`}
          name="q"
          type="text"
          defaultValue={defaultValue}
          placeholder={t.home.searchPlaceholder}
          className="h-12 w-full bg-transparent text-[15px] text-ink placeholder:text-dusk focus:outline-none"
        />
      </div>

      <div className="hidden h-7 w-px bg-line sm:block" />

      <div className="flex items-center gap-1.5 sm:w-52">
        <label htmlFor={`${id}-region`} className="sr-only">
          {s.region}
        </label>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="ml-2 shrink-0 text-dusk" aria-hidden>
          <path d="M12 21s-6-5.3-6-10a6 6 0 1112 0c0 4.7-6 10-6 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="2" />
        </svg>
        <Select
          id={`${id}-region`}
          value={area}
          onChange={setArea}
          options={regionOptions}
          name="region"
          variant="bare"
          className="flex-1"
        />
      </div>

      <button
        type="submit"
        className="glow-signal h-12 shrink-0 rounded-xl bg-signal px-7 text-sm font-semibold text-white transition-colors hover:bg-signal-dark active:scale-[0.98]"
      >
        {t.home.searchButton}
      </button>
    </form>
  );
}
