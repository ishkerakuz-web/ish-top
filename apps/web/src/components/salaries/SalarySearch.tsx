import React, { useEffect, useId, useRef, useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import { EXPERIENCE_KEYS, type ExperienceKey } from "../../lib/salaries/query.js";
import type { Region } from "../../lib/types.js";
import { IconChevronDown, IconSearch, IconX, Spinner } from "./icons.js";

const DEBOUNCE_MS = 400;
/** Yozish paytida qidiruv 2 harfdan boshlanadi; Enter esa har doim darhol qidiradi. */
const MIN_CHARS = 2;

/**
 * Qidiruv qatori: kasb/lavozim matni + hudud + tajriba + "Qidirish".
 * - Matn: yozish to'xtagach ~400ms o'tib avtomatik; Enter / tugma — darhol;
 *   Esc yoki × — tozalash. URL o'zgarsa (orqaga tugmasi) maydon moslashadi.
 * - Hudud va tajriba — tanlanishi bilan qo'llanadi. Oddiy `<select>`:
 *   klaviatura, ekran o'quvchi va telefon tanlagichi o'z-o'zidan ishlaydi.
 */
export function SalarySearch({
  text: value,
  region,
  experience,
  regions,
  pending,
  onText,
  onRegion,
  onExperience,
}: {
  text: string;
  region: string;
  experience: ExperienceKey | "";
  regions: Region[];
  pending: boolean;
  onText: (text: string) => void;
  onRegion: (region: string) => void;
  onExperience: (experience: ExperienceKey | "") => void;
}) {
  const s = useT().salaries;
  const id = useId();
  const [text, setText] = useState(value);
  const committed = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tashqaridan (URL, kasb tugmasi) kelgan o'zgarish — yozilayotgan matnni bosib ketmaslik uchun
  // faqat oxirgi yuborilgan qiymatdan farq qilsa
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

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        commit(text);
      }}
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_minmax(0,10rem)_minmax(0,10rem)_auto] xl:grid-cols-[minmax(0,1fr)_minmax(0,11.5rem)_minmax(0,11.5rem)_auto]"
    >
      <div className="col-span-2 flex h-14 min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface pl-4 pr-2 shadow-card transition-colors focus-within:border-signal focus-within:ring-4 focus-within:ring-signal/10 sm:col-span-3 lg:col-span-1">
        <label htmlFor={`${id}-text`} className="sr-only">
          {s.search.label}
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
          placeholder={s.search.placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-dusk focus:outline-none lg:text-[14px] xl:text-[15px]"
        />
        {busy && (
          <span className="flex shrink-0 items-center text-signal" role="status">
            <Spinner size={18} />
            <span className="sr-only">{s.search.searching}</span>
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
            aria-label={s.search.clear}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-dusk transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <IconX size={17} />
          </button>
        )}
      </div>

      <FieldSelect
        id={`${id}-region`}
        label={s.search.region}
        value={region}
        onChange={onRegion}
        options={[{ value: "", label: s.search.allRegions }, ...regions.map((r) => ({ value: r.slug, label: r.name }))]}
      />
      <FieldSelect
        id={`${id}-experience`}
        label={s.search.experience}
        value={experience}
        onChange={(v) => onExperience(v as ExperienceKey | "")}
        options={[
          { value: "", label: s.search.allLevels },
          ...EXPERIENCE_KEYS.map((key) => ({ value: key, label: `${s.levels[key].label} (${s.levels[key].years})` })),
        ]}
      />

      <button
        type="submit"
        className="col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-signal px-6 text-[15px] font-semibold text-white shadow-xs transition-colors hover:bg-signal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:col-span-1 sm:h-14 xl:px-7"
      >
        <IconSearch size={18} />
        {s.search.submit}
      </button>
    </form>
  );
}

function FieldSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative min-w-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-12 w-full cursor-pointer appearance-none truncate rounded-2xl border border-line bg-surface pl-4 pr-10 text-[14.5px] shadow-card lg:pl-3.5 lg:pr-8 lg:text-[14px] xl:pl-4 xl:pr-10 xl:text-[14.5px] transition-colors hover:border-signal/40 focus:border-signal focus:outline-none focus:ring-4 focus:ring-signal/10 sm:h-14 dark:[color-scheme:dark] ${
          value ? "font-medium text-ink" : "text-ink/80"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <IconChevronDown size={17} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-dusk lg:right-2.5 xl:right-3.5" />
    </div>
  );
}
