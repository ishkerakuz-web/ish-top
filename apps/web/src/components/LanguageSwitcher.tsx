import React, { useEffect, useId, useRef, useState } from "react";
import { navigate } from "vike/client/router";
import { usePageContext } from "vike-react/usePageContext";
import { useLocale, useT } from "../lib/i18n/index.js";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, localizeHref, type Locale } from "../lib/i18n/config.js";
import { pageLocale } from "../lib/i18n/pageLocale.js";
import { useClickOutside } from "../lib/useClickOutside.js";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale } = useLocale();
  const t = useT();
  const pageContext = usePageContext();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reactId = useId();
  const listId = `${reactId}-listbox`;
  const optionId = (index: number) => `${reactId}-opt-${index}`;
  const currentIndex = LOCALES.indexOf(locale);
  useClickOutside(ref, () => {
    setOpen(false);
    setActiveIndex(-1);
  }, open);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function close(returnFocus: boolean) {
    setOpen(false);
    setActiveIndex(-1);
    if (returnFocus) buttonRef.current?.focus();
  }

  function choose(next: Locale) {
    close(true);
    if (next === locale) return;
    // Til almashtirish = shu sahifaning boshqa tildagi URL'iga o'tish (SPA).
    // Xato sahifasida (render(404)) pageContext.localePathname yo'q — audit R3,
    // i18n-11: pageLocale() URL'dan hisoblaydi, shunda yo'l yo'qolmaydi.
    const logical = pageLocale(pageContext).pathname || "/";
    const suffix = typeof window !== "undefined" ? window.location.search + window.location.hash : "";
    navigate(localizeHref(logical, next) + suffix);
  }

  // Klaviatura: listbox modeli (audit R3, D-060 — a11y-ui-2)
  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const current = activeIndex >= 0 ? activeIndex : currentIndex;
    switch (e.key) {
      case "Escape":
        if (open) {
          e.preventDefault();
          close(true);
        }
        return;
      case "Tab":
        if (open) {
          setOpen(false);
          setActiveIndex(-1);
        }
        return;
      case "ArrowDown":
      case "ArrowUp":
      case "Home":
      case "End": {
        e.preventDefault();
        if (!open) {
          setActiveIndex(current < 0 ? 0 : current);
          setOpen(true);
          return;
        }
        let next = current < 0 ? 0 : current;
        if (e.key === "ArrowDown") next = Math.min(LOCALES.length - 1, next + 1);
        else if (e.key === "ArrowUp") next = Math.max(0, next - 1);
        else if (e.key === "Home") next = 0;
        else next = LOCALES.length - 1;
        setActiveIndex(next);
        return;
      }
      case "Enter":
      case " ":
      case "Spacebar": {
        e.preventDefault();
        if (!open) {
          setActiveIndex(current < 0 ? 0 : current);
          setOpen(true);
          return;
        }
        const next = LOCALES[activeIndex >= 0 ? activeIndex : currentIndex];
        if (next) choose(next);
        else close(true);
        return;
      }
      default:
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (open) {
            close(false);
            return;
          }
          setActiveIndex(currentIndex);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-label={`${t.ui.language}: ${LOCALE_LABELS[locale]}`}
        className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-dusk transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
        {LOCALE_SHORT[locale]}
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop"
        >
          {LOCALES.map((l, index) => {
            const current = l === locale;
            const focused = index === activeIndex;
            return (
              <li
                key={l}
                id={optionId(index)}
                role="option"
                lang={l}
                aria-selected={current}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(l)}
                onMouseMove={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                  current ? "font-semibold text-signal" : "text-ink"
                } ${focused ? "bg-surface-2" : ""}`}
              >
                {LOCALE_LABELS[l]}
                <span className="text-xs text-dusk">{LOCALE_SHORT[l]}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
