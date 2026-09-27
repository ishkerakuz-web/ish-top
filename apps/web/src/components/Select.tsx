import React, { useEffect, useId, useRef, useState } from "react";
import { useClickOutside } from "../lib/useClickOutside.js";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Premium custom dropdown — native <select> o'rniga (mavzuga moslashuvchi,
 * brend uslubidagi). `name` berilsa, forma uchun yashirin input ham chiqaradi.
 *
 * Klaviatura (audit R3, D-060 — a11y-ui-2): WAI-ARIA combobox+listbox modeli.
 * Fokus har doim tugmada qoladi, faol variant `aria-activedescendant` bilan
 * e'lon qilinadi: ↑/↓ — variantlar bo'ylab, Home/End — chekkalar,
 * Enter/Probel — tanlash, Escape — yopish (fokus tugmada qoladi), Tab — yopib
 * keyingi elementga o'tish.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  name,
  variant = "default",
  className = "",
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Tugmaning doimiy nomi: variantlar hali yuklanmaganda ham nom bo'lishi uchun (audit R3, axe button-name). */
  ariaLabel?: string;
  name?: string;
  variant?: "default" | "bare";
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  // -1 = klaviatura bilan hali hech narsa belgilanmagan
  const [activeIndex, setActiveIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reactId = useId();
  const listId = `${reactId}-listbox`;
  const optionId = (index: number) => `${reactId}-opt-${index}`;
  const selected = options.find((o) => o.value === value);
  const selectedIndex = options.findIndex((o) => o.value === value);
  // Tashqariga bosilganda faqat yopiladi — fokus sichqoncha borgan joyda qoladi
  useClickOutside(ref, () => {
    setOpen(false);
    setActiveIndex(-1);
  }, open);

  // Faol variant ro'yxat ichida ko'rinib tursin (silliq scroll emas — reduced motion)
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openList(index: number) {
    setActiveIndex(index >= 0 ? index : 0);
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    setActiveIndex(-1);
    if (returnFocus) buttonRef.current?.focus();
  }

  function pick(optionValue: string) {
    onChange(optionValue);
    close(true);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (options.length === 0) return;
    const current = activeIndex >= 0 ? activeIndex : selectedIndex;
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
          openList(current);
          return;
        }
        let next = current < 0 ? 0 : current;
        if (e.key === "ArrowDown") next = Math.min(options.length - 1, (current < 0 ? -1 : current) + 1);
        else if (e.key === "ArrowUp") next = Math.max(0, (current < 0 ? 1 : current) - 1);
        else if (e.key === "Home") next = 0;
        else next = options.length - 1;
        setActiveIndex(next);
        return;
      }
      case "Enter":
      case " ":
      case "Spacebar": {
        e.preventDefault();
        if (!open) {
          openList(current);
          return;
        }
        const option = options[activeIndex >= 0 ? activeIndex : selectedIndex];
        if (option) pick(option.value);
        else close(true);
        return;
      }
      default:
    }
  }

  const buttonBase =
    variant === "bare"
      ? `h-12 rounded-xl border border-transparent bg-transparent ${open ? "bg-surface-2" : "hover:bg-surface-2"}`
      : `h-11 rounded-xl border bg-surface-2 ${open ? "border-signal" : "border-line hover:border-signal/50"}`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        id={id}
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close(false) : openList(selectedIndex))}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        className={`flex w-full items-center justify-between gap-2 px-3.5 text-sm transition-colors ${buttonBase}`}
      >
        <span className={`truncate ${selected ? "text-ink" : "text-dusk"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 text-dusk transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className="absolute left-0 z-50 mt-1.5 max-h-64 w-full min-w-full overflow-auto rounded-xl border border-line bg-surface py-1 shadow-pop"
        >
          {options.map((opt, index) => {
            const active = opt.value === value;
            const focused = index === activeIndex;
            return (
              <li
                key={opt.value}
                id={optionId(index)}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(opt.value)}
                onMouseMove={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2 text-left text-sm transition-colors ${
                  active ? "bg-signal-soft font-medium text-signal" : "text-ink"
                } ${focused ? (active ? "bg-signal/15" : "bg-surface-2") : ""}`}
              >
                <span className="truncate">{opt.label}</span>
                {active && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
                    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
