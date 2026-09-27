import React, { useEffect, useId, useRef, useState } from "react";
import { SORTS, type FavoritesQuery, type RegionOption } from "../../lib/favorites/query.js";
import type { FavoritesPatch } from "../../lib/favorites/useFavoritesQuery.js";
import { useLocale, useT } from "../../lib/i18n/index.js";
import { regionName } from "../../lib/i18n/regions.js";
import type { EmploymentType } from "../../lib/types.js";
import { FieldSelect } from "../vacancies/FieldSelect.js";
import { IconSearch, IconX } from "./icons.js";

const DEBOUNCE_MS = 300;

/**
 * Qidiruv (debounce, sarlavha/kompaniya/kategoriya/hudud) + joylashuv, ish turi, saralash.
 * Enter — darhol, Esc yoki × — tozalash. Joylashuv variantlari — faqat saqlanganlar
 * orasidagi hududlar. Qidiruv alohida qatorda: 1280px konteynerda bitta qatorga
 * sig'dirilsa placeholder va tanlov yozuvlari qirqilardi.
 */
export function FavoritesFilters({
  query,
  regions,
  types,
  onChange,
}: {
  query: FavoritesQuery;
  regions: RegionOption[];
  types: EmploymentType[];
  onChange: (patch: FavoritesPatch, options?: { replace?: boolean }) => void;
}) {
  const t = useT();
  const f = t.favoritesPage.filters;
  const { locale } = useLocale();
  const id = useId();
  const [text, setText] = useState(query.q);
  const committed = useRef(query.q);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.q !== committed.current) {
      committed.current = query.q;
      setText(query.q);
    }
  }, [query.q]);

  const commit = (value: string) => {
    const next = value.trim();
    if (next === committed.current) return;
    // Bo'sh qidiruvdan birinchi so'z — yangi tarix yozuvi, keyingilari almashtiradi
    const replace = committed.current !== "" && next !== "";
    committed.current = next;
    onChange({ q: next }, { replace });
  };

  useEffect(() => {
    if (text.trim() === committed.current) return;
    const timer = window.setTimeout(() => commit(text), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // commit har renderda yangi — faqat matn o'zgarganda qayta rejalashtiriladi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <form
      role="search"
      aria-label={f.label}
      onSubmit={(e) => {
        e.preventDefault();
        commit(text);
      }}
      className="grid grid-cols-1 gap-2.5 p-3 min-[480px]:grid-cols-3 sm:p-4"
    >
      <div className="relative min-w-0 min-[480px]:col-span-3">
        <label htmlFor={`${id}-q`} className="sr-only">
          {f.searchLabel}
        </label>
        <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dusk" />
        <input
          ref={inputRef}
          id={`${id}-q`}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && text) {
              e.preventDefault();
              setText("");
              commit("");
            }
          }}
          placeholder={f.search}
          className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-11 text-[14px] text-ink transition-colors placeholder:text-dusk hover:border-signal/40 focus:border-signal focus:outline-none focus:ring-4 focus:ring-signal/10"
        />
        {text && (
          <button
            type="button"
            onClick={() => {
              setText("");
              commit("");
              inputRef.current?.focus();
            }}
            aria-label={f.clear}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <IconX size={16} />
          </button>
        )}
      </div>

      <FieldSelect
        id={`${id}-region`}
        label={f.region}
        size="md"
        value={query.region}
        options={[
          { value: "all", label: f.allRegions },
          ...regions.map((r) => ({ value: r.slug, label: regionName(locale, r.slug, r.name) })),
        ]}
        onChange={(value) => onChange({ region: value })}
      />
      <FieldSelect
        id={`${id}-type`}
        label={f.type}
        size="md"
        value={query.type}
        options={[{ value: "all", label: f.allTypes }, ...types.map((type) => ({ value: type, label: t.enums.employment[type] }))]}
        onChange={(value) => onChange({ type: value as FavoritesQuery["type"] })}
      />
      <FieldSelect
        id={`${id}-sort`}
        label={f.sort}
        size="md"
        value={query.sort}
        options={SORTS.map((sort) => ({ value: sort, label: f.sorts[sort] }))}
        onChange={(value) => onChange({ sort: value as FavoritesQuery["sort"] })}
      />
    </form>
  );
}
