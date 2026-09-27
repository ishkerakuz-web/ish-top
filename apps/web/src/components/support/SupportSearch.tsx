import React, { useEffect, useRef, useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import { SUPPORT_SEARCH_MAX } from "../../lib/support/query.js";
import { IconSearch, IconX } from "./icons.js";

const DEBOUNCE_MS = 300;
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

/**
 * Savol qidiruvi: yozish to'xtagach (debounce) natija yangilanadi, Enter yoki
 * "Qidirish" — darhol. URL tashqaridan o'zgarsa (tezkor so'z, orqaga) maydon ham yangilanadi.
 */
export function SupportSearch({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const s = useT().support;
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
      onSubmit={(e) => {
        e.preventDefault();
        submitNow(normalize(draft));
      }}
      className="relative flex items-center rounded-2xl border border-line bg-surface shadow-card transition-colors focus-within:border-signal focus-within:ring-4 focus-within:ring-signal/10 hover:border-signal/40"
    >
      <label htmlFor="support-search" className="sr-only">
        {s.searchLabel}
      </label>
      <IconSearch size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dusk" />
      <input
        ref={inputRef}
        id="support-search"
        type="search"
        value={draft}
        maxLength={SUPPORT_SEARCH_MAX}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={s.searchPlaceholder}
        autoComplete="off"
        enterKeyHint="search"
        className="h-12 min-w-0 flex-1 rounded-2xl bg-transparent pl-11 pr-2 text-[14.5px] text-ink placeholder:text-dusk focus:outline-none sm:h-14 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {draft && (
        <button
          type="button"
          aria-label={s.clearSearch}
          onClick={() => {
            setDraft("");
            submitNow("");
            inputRef.current?.focus();
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          <IconX size={16} />
        </button>
      )}
      <button
        type="submit"
        className="mr-1.5 inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-signal px-3 text-sm font-semibold text-white transition-colors hover:bg-signal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:mr-2 sm:h-10 sm:px-5"
      >
        <IconSearch size={16} className="sm:hidden" />
        <span className="sr-only sm:not-sr-only">{s.searchButton}</span>
      </button>
    </form>
  );
}
