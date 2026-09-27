import React, { useEffect, useRef, useState } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { EMPLOYER_VACANCY_SEARCH_MAX } from "../../../lib/employer/vacancies/query.js";
import { IconSearch, IconX } from "./icons.js";

const DEBOUNCE_MS = 300;
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

/** Qidiruv: yozish to'xtagach (debounce) URL yangilanadi, Enter — darhol; URL tashqaridan o'zgarsa maydon ham. */
export function VacancySearch({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const p = useT().employerVacanciesPage;
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
      className="relative min-w-0 xl:w-[400px] 2xl:w-[460px]"
      onSubmit={(e) => {
        e.preventDefault();
        submitNow(normalize(draft));
      }}
    >
      <label htmlFor="employer-vacancies-search" className="sr-only">
        {p.searchLabel}
      </label>
      <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dusk" />
      <input
        ref={inputRef}
        id="employer-vacancies-search"
        type="search"
        value={draft}
        maxLength={EMPLOYER_VACANCY_SEARCH_MAX}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={p.searchPlaceholder}
        autoComplete="off"
        enterKeyHint="search"
        className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-10 text-[14px] text-ink transition-colors placeholder:text-dusk hover:border-signal/40 focus:border-signal focus:outline-none focus:ring-4 focus:ring-signal/10 [&::-webkit-search-cancel-button]:appearance-none"
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
