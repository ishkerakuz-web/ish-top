import React, { useEffect, useId, useRef, useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import { IconSearch, IconX, Spinner } from "./icons.js";

const DEBOUNCE_MS = 400;
/** Yozish paytida qidiruv 2 harfdan boshlanadi; Enter esa har doim darhol qidiradi. */
const MIN_CHARS = 2;

/**
 * Katalog qidiruvi.
 * - Yozish to'xtagach ~400ms o'tib avtomatik qidiradi (har harfga so'rov emas).
 * - Enter / "Qidirish" — darhol. Esc yoki × — tozalash.
 * - URL o'zgarsa (orqaga tugmasi) maydon unga moslashadi.
 */
export function CompanySearch({
  value,
  pending,
  onSearch,
}: {
  value: string;
  pending: boolean;
  onSearch: (text: string) => void;
}) {
  const t = useT().companiesPage.search;
  const id = useId();
  const [text, setText] = useState(value);
  const committed = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tashqaridan (URL) kelgan o'zgarish — foydalanuvchi yozayotgan matnni bosib ketmaslik uchun
  // faqat oxirgi yuborilgan qiymatdan farq qilsa
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(value);
    }
  }, [value]);

  const commit = (next: string) => {
    const trimmed = next.trim();
    if (trimmed === committed.current) return;
    committed.current = trimmed;
    onSearch(trimmed);
  };

  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed === committed.current) return;
    if (trimmed.length > 0 && trimmed.length < MIN_CHARS) return;
    const timer = window.setTimeout(() => commit(trimmed), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // commit har renderda yangi, lekin faqat matn o'zgarganda qayta rejalashtirish kerak
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const busy = pending && text.trim() === committed.current && committed.current !== "";

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        commit(text);
      }}
      className="flex w-full flex-col gap-2 sm:flex-row"
    >
      <label htmlFor={id} className="sr-only">
        {t.label}
      </label>
      {/* flex-1 faqat qatorda: ustun rejimida (mobil) u balandlikni 0 ga siqib qo'yardi */}
      <div className="flex h-14 min-w-0 items-center gap-3 sm:flex-1 rounded-2xl border border-line bg-surface pl-4 pr-2 shadow-card transition-colors focus-within:border-signal focus-within:ring-4 focus-within:ring-signal/10">
        <IconSearch size={20} className="shrink-0 text-dusk" />
        <input
          ref={inputRef}
          id={id}
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
          placeholder={t.placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-dusk focus:outline-none"
        />
        {busy && (
          <span className="flex shrink-0 items-center text-signal" role="status">
            <Spinner size={18} />
            <span className="sr-only">{t.searching}</span>
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
            aria-label={t.clear}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-dusk transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <IconX size={17} />
          </button>
        )}
      </div>
      <button
        type="submit"
        className="h-12 shrink-0 rounded-2xl bg-signal px-8 sm:h-14 text-[15px] font-semibold text-white shadow-xs transition-colors hover:bg-signal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        {t.submit}
      </button>
    </form>
  );
}
