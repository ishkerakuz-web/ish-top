import React, { useEffect, useRef, useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import { ARTICLE_SEARCH_MAX } from "../../lib/articles/query.js";
import { IconSearch, IconX } from "./icons.js";

const DEBOUNCE_MS = 350;

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

/**
 * Qidiruv maydoni: yozish to'xtagach (debounce) URL yangilanadi, Enter — darhol.
 * URL tashqaridan o'zgarsa (orqaga, "Filtrlarni tozalash") maydon ham yangilanadi.
 */
export function ArticlesSearch({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const a = useT().articles;
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
      className="relative min-w-0 flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        submitNow(normalize(draft));
      }}
    >
      <label htmlFor="articles-search" className="sr-only">
        {a.searchLabel}
      </label>
      <IconSearch size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dusk" />
      <input
        ref={inputRef}
        id="articles-search"
        type="search"
        value={draft}
        maxLength={ARTICLE_SEARCH_MAX}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={a.searchPlaceholder}
        autoComplete="off"
        enterKeyHint="search"
        className="h-12 w-full rounded-2xl border border-line bg-surface pl-11 pr-12 text-[14.5px] text-ink shadow-card transition-colors placeholder:text-dusk hover:border-signal/40 focus:border-signal focus:outline-none focus:ring-4 focus:ring-signal/10 sm:h-14 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {draft && (
        <button
          type="button"
          aria-label={a.clearSearch}
          onClick={() => {
            setDraft("");
            submitNow("");
            inputRef.current?.focus();
          }}
          className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          <IconX size={16} />
        </button>
      )}
    </form>
  );
}
