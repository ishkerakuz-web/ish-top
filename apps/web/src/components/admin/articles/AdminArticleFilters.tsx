import React, { useEffect, useRef, useState } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { ARTICLE_STATUSES, type ArticleStatus } from "../../../lib/admin/articles.js";
import { IconSearch, IconX } from "../icons.js";

/**
 * Qidiruv (sarlavha / muallif, debounce) va holat filtri — holatlar soni serverdan.
 * Filtr tugmalari `aria-pressed` bilan; tanlov URL'ga yoziladi.
 */
export function AdminArticleFilters({
  q,
  status,
  counts,
  onSearch,
  onStatus,
}: {
  q: string;
  status: ArticleStatus | null;
  counts: Record<"all" | ArticleStatus, number> | null;
  onSearch: (q: string) => void;
  onStatus: (status: ArticleStatus | null) => void;
}) {
  const c = useT().contentAdmin.articles;
  const [draft, setDraft] = useState(q);
  const sent = useRef(q);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    if (q !== sent.current) {
      sent.current = q;
      setDraft(q);
    }
  }, [q]);

  useEffect(() => {
    const next = draft.replace(/\s+/g, " ").trim();
    if (next === sent.current) return;
    const timer = window.setTimeout(() => {
      sent.current = next;
      onSearchRef.current(next);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const options: { key: ArticleStatus | null; label: string; count: number | undefined }[] = [
    { key: null, label: c.all, count: counts?.all },
    ...ARTICLE_STATUSES.map((s) => ({ key: s, label: c.status[s], count: counts?.[s] })),
  ];

  return (
    <div className="space-y-3">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const next = draft.replace(/\s+/g, " ").trim();
          sent.current = next;
          onSearchRef.current(next);
        }}
        className="relative"
      >
        <label htmlFor="admin-articles-search" className="sr-only">
          {c.searchLabel}
        </label>
        <IconSearch size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dusk" />
        <input
          id="admin-articles-search"
          type="search"
          value={draft}
          maxLength={120}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={c.searchPlaceholder}
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-10 text-sm text-ink placeholder:text-dusk focus:border-signal focus:outline-none focus:ring-4 focus:ring-signal/10 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {draft && (
          <button
            type="button"
            aria-label={c.emptyFilter.reset}
            onClick={() => {
              setDraft("");
              sent.current = "";
              onSearchRef.current("");
            }}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-dusk hover:bg-surface-2 hover:text-ink"
          >
            <IconX size={15} />
          </button>
        )}
      </form>

      <div role="group" aria-label={c.filtersLabel} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-none">
        {options.map((option) => {
          const active = option.key === status;
          return (
            <button
              key={option.key ?? "all"}
              type="button"
              aria-pressed={active}
              data-status-filter={option.key ?? "all"}
              onClick={() => onStatus(option.key)}
              className={`inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
                active ? "border-signal bg-signal text-white" : "border-line bg-surface text-ink hover:border-signal/40 hover:text-signal"
              }`}
            >
              {option.label}
              {option.count !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums ${active ? "bg-white/20 text-white" : "bg-surface-2 text-dusk"}`}>
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
