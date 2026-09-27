import React, { useEffect, useId, useRef, useState } from "react";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { REGIONS, regionName } from "../../lib/i18n/regions.js";
import { WORK_TYPES, type WorkType } from "../../lib/vacancies/query.js";
import { FieldSelect } from "./FieldSelect.js";
import { IconBriefcase, IconPin, IconSearch, IconX, Spinner } from "./icons.js";

const DEBOUNCE_MS = 400;
/** Yozish paytida qidiruv 2 harfdan boshlanadi; Enter esa har doim darhol qidiradi. */
const MIN_CHARS = 2;
const MULTI = "__multi";

/**
 * Qidiruv qatori: matn + hudud + ish turi + "Qidirish".
 * - Matn: yozish to'xtagach ~400ms o'tib avtomatik; Enter / tugma — darhol;
 *   Esc yoki × — tozalash. URL o'zgarsa (orqaga tugmasi) maydon moslashadi.
 * - Hudud va ish turi — tanlanishi bilan qo'llanadi. Yon panelda bir nechtasi
 *   belgilangan bo'lsa, bu yerda "N ta tanlangan" ko'rinadi.
 */
export function VacancySearch({
  text: value,
  region,
  workType,
  pending,
  onText,
  onRegion,
  onWorkType,
}: {
  text: string;
  region: string[];
  workType: WorkType[];
  pending: boolean;
  onText: (text: string) => void;
  onRegion: (slug: string) => void;
  onWorkType: (workType: WorkType | "") => void;
}) {
  const t = useT();
  const s = t.vacanciesPage.search;
  const { locale } = useLocale();
  const id = useId();
  const [text, setText] = useState(value);
  const committed = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tashqaridan (URL, ommabop qidiruv) kelgan o'zgarish — yozilayotgan matnni bosib ketmaslik uchun
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(value);
    }
  }, [value]);

  const commit = (next: string) => {
    const trimmed = next.trim().replace(/\s+/g, " ");
    if (trimmed === committed.current) return;
    committed.current = trimmed;
    onText(trimmed);
  };

  useEffect(() => {
    const trimmed = text.trim().replace(/\s+/g, " ");
    if (trimmed === committed.current) return;
    if (trimmed.length > 0 && trimmed.length < MIN_CHARS) return;
    const timer = window.setTimeout(() => commit(trimmed), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // commit har renderda yangi, lekin faqat matn o'zgarganda qayta rejalashtirish kerak
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const busy = pending && committed.current !== "";

  const regionOptions = [
    { value: "", label: s.allRegions },
    ...(region.length > 1 ? [{ value: MULTI, label: s.multiple(region.length), hidden: true }] : []),
    ...REGIONS.map((r) => ({ value: r.slug, label: regionName(locale, r.slug) })),
  ];
  const workOptions = [
    { value: "", label: s.allWorkTypes },
    ...(workType.length > 1 ? [{ value: MULTI, label: s.multiple(workType.length), hidden: true }] : []),
    ...WORK_TYPES.map((w) => ({ value: w, label: t.vacanciesPage.workTypes[w] })),
  ];

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        commit(text);
      }}
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,14rem)_auto]"
    >
      <div className="col-span-2 flex h-14 min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface pl-4 pr-2 shadow-card transition-colors focus-within:border-signal focus-within:ring-4 focus-within:ring-signal/10 sm:col-span-3 lg:col-span-1">
        <label htmlFor={`${id}-text`} className="sr-only">
          {s.label}
        </label>
        <IconSearch size={20} className="shrink-0 text-dusk" />
        <input
          ref={inputRef}
          id={`${id}-text`}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          value={text}
          maxLength={100}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && text) {
              e.preventDefault();
              setText("");
              commit("");
            }
          }}
          placeholder={s.placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-dusk focus:outline-none"
        />
        {busy && (
          <span className="flex shrink-0 items-center text-signal" role="status">
            <Spinner size={18} />
            <span className="sr-only">{s.searching}</span>
          </span>
        )}
        {text && (
          <button
            type="button"
            onClick={() => {
              setText("");
              commit("");
              inputRef.current?.focus();
            }}
            aria-label={s.clear}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-dusk transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <IconX size={17} />
          </button>
        )}
      </div>

      <FieldSelect
        id={`${id}-region`}
        label={s.region}
        value={region.length === 1 ? region[0] : region.length > 1 ? MULTI : ""}
        options={regionOptions}
        onChange={(v) => v !== MULTI && onRegion(v)}
        icon={<IconPin size={17} />}
      />
      <FieldSelect
        id={`${id}-work`}
        label={s.workType}
        value={workType.length === 1 ? workType[0] : workType.length > 1 ? MULTI : ""}
        options={workOptions}
        onChange={(v) => v !== MULTI && onWorkType(v as WorkType | "")}
        icon={<IconBriefcase size={17} />}
      />

      <button
        type="submit"
        className="col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-signal px-8 text-[15px] font-semibold text-white shadow-xs transition-colors hover:bg-signal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:col-span-1 sm:h-14"
      >
        <IconSearch size={18} />
        {s.submit}
      </button>
    </form>
  );
}
