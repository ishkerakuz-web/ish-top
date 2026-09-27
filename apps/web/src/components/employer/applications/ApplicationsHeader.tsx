import React, { useEffect, useRef, useState } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { APPLICATION_SEARCH_MAX } from "../../../lib/employer/applications/query.js";
import { IconSearch, IconSliders, IconX } from "./icons.js";

const DEBOUNCE_MS = 300;
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

/** Qidiruv: yozish to'xtagach (debounce) URL yangilanadi, Enter — darhol; URL tashqaridan o'zgarsa maydon ham. */
function ApplicationsSearch({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const p = useT().employerApplicationsPage;
  const [draft, setDraft] = useState(value);
  const sent = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    if (value !== sent.current) {
      sent.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    const next = normalize(draft);
    if (next === sent.current) return;
    const timer = window.setTimeout(() => {
      sent.current = next;
      onSearchRef.current(next);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const submitNow = (next: string) => {
    if (next === sent.current) return;
    sent.current = next;
    onSearchRef.current(next);
  };

  return (
    <form
      role="search"
      className="relative min-w-0 flex-1 lg:w-[360px] lg:flex-none xl:w-[420px]"
      onSubmit={(e) => {
        e.preventDefault();
        submitNow(normalize(draft));
      }}
    >
      <label htmlFor="employer-applications-search" className="sr-only">
        {p.searchLabel}
      </label>
      <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dusk" />
      <input
        ref={inputRef}
        id="employer-applications-search"
        type="search"
        value={draft}
        maxLength={APPLICATION_SEARCH_MAX}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={p.searchPlaceholder}
        autoComplete="off"
        enterKeyHint="search"
        className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-10 text-[14px] text-ink shadow-xs transition-colors placeholder:text-dusk hover:border-signal/40 focus:border-signal focus:outline-none focus:ring-4 focus:ring-signal/10 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {draft && (
        <button
          type="button"
          aria-label={p.clearSearch}
          onClick={() => {
            setDraft("");
            submitNow("");
            inputRef.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          <IconX size={15} />
        </button>
      )}
    </form>
  );
}

/** Sarlavha + tavsif; o'ngda qidiruv va "Filtrlar" (faqat arizalar bo'lsa). */
export function ApplicationsHeader({
  q,
  onSearch,
  showTools,
  filtersOpen,
  filterCount,
  onToggleFilters,
  filtersButtonRef,
}: {
  q: string;
  onSearch: (q: string) => void;
  showTools: boolean;
  filtersOpen: boolean;
  filterCount: number;
  onToggleFilters: () => void;
  filtersButtonRef: React.RefObject<HTMLButtonElement>;
}) {
  const p = useT().employerApplicationsPage;
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[32px]">{p.title}</h1>
        <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-dusk">{p.subtitle}</p>
      </div>
      {showTools && (
        <div className="flex w-full items-center gap-2.5 lg:w-auto">
          <ApplicationsSearch value={q} onSearch={onSearch} />
          <button
            ref={filtersButtonRef}
            type="button"
            onClick={onToggleFilters}
            aria-expanded={filtersOpen}
            aria-controls="applications-filters"
            data-testid="applications-filters-toggle"
            className={`relative inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-semibold shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:px-4 ${
              filtersOpen || filterCount > 0 ? "border-signal/40 bg-signal-soft/60 text-signal dark:text-indigo-300" : "border-line bg-surface text-ink hover:border-signal/40 hover:text-signal"
            }`}
          >
            <IconSliders size={17} />
            <span className="sr-only sm:not-sr-only">{p.filters.open}</span>
            {filterCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-signal px-1 text-[11px] font-bold tabular-nums text-white">{filterCount}</span>
            )}
          </button>
        </div>
      )}
    </header>
  );
}
