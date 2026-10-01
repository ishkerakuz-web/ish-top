import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
  /** Ro'yxatda ko'rinmaydi, lekin tanlanganda yozuvi tugmada chiqadi ("3 ta tanlangan"). */
  hidden?: boolean;
}

/** Variantlar shuncha yoki undan ko'p bo'lsa `searchable="auto"` qidiruvni o'zi yoqadi. */
const AUTO_SEARCH_MIN = 10;

/** Harf terib qidirish buferi shuncha jimlikdan keyin tozalanadi. */
const TYPEAHEAD_RESET_MS = 700;

const FIELD_SIZES = {
  lg: "h-12 rounded-2xl text-[14.5px] shadow-card sm:h-14",
  md: "h-11 rounded-xl text-[14px]",
  sm: "h-10 rounded-xl text-[13.5px]",
} as const;

export type SelectSize = keyof typeof FIELD_SIZES;

/** Serverda `useLayoutEffect` ogohlantirish beradi — SSR'da oddiy effektga tushamiz. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface Position {
  left: number;
  width: number;
  maxHeight: number;
  /** Tugmaning ostida ochilsa — `top`, ustida ochilsa — `bottom` ishlatiladi. */
  top?: number;
  bottom?: number;
}

const POPUP_GAP = 6;
const VIEWPORT_PADDING = 8;
const POPUP_MAX_HEIGHT = 320;
const POPUP_MIN_HEIGHT = 160;
/**
 * Ro'yxatning eng kichik eni. Tugma tor bo'lishi mumkin (telefonda filtr
 * maydonlari yonma-yon turadi), lekin variant yozuvlari — "Toshkent viloyati"
 * kabi — to'liq o'qilishi kerak. Ekranga sig'masa chekkagacha kengayadi.
 */
const POPUP_MIN_WIDTH = 220;

/**
 * Premium dropdown — native `<select>` o'rniga (mavzuga moslashuvchi, brend uslubida).
 * `name` berilsa, forma uchun yashirin input ham chiqaradi.
 *
 * Ro'yxat PORTAL orqali `document.body` ga chiqadi va `position: fixed` bilan
 * joylashadi. Ilgari u oddiy `absolute` edi va ota elementning `overflow-hidden`
 * yoki `transform` i uni qirqib qo'yardi — bosh sahifadagi hudud tanlagichi
 * aynan shu sababli rasm ortida qolib ketgandi. Portal bu turkum xatolarni
 * butunlay yopadi: joylashuv scroll va resize'da qayta hisoblanadi, past joy
 * yetmasa ro'yxat tugmaning USTIDA ochiladi.
 *
 * Katta ro'yxatlarda (`AUTO_SEARCH_MIN` dan ko'p) tepada qidiruv maydoni chiqadi.
 * Qidiruvsiz ro'yxatlarda harf terilsa — o'sha harfdan boshlanadigan birinchi
 * variantga sakraydi (native `<select>` dagi odat).
 *
 * Klaviatura (audit R3, D-060 — a11y-ui-2): WAI-ARIA combobox+listbox modeli.
 * ↑/↓ — variantlar bo'ylab, Home/End — chekkalar, Enter/Probel — tanlash,
 * Escape — yopish (fokus tugmaga qaytadi), Tab — yopib keyingi elementga o'tish.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  name,
  variant = "default",
  size = "md",
  icon,
  searchable = "auto",
  searchPlaceholder = "Qidirish...",
  emptyText = "Topilmadi",
  disabled = false,
  invalid = false,
  required = false,
  describedBy,
  buttonClassName,
  className = "",
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Tugmaning doimiy nomi: variantlar hali yuklanmaganda ham nom bo'lsin (audit R3, axe button-name). */
  ariaLabel?: string;
  name?: string;
  variant?: "default" | "bare" | "field";
  /** Faqat `variant="field"` uchun: maydon balandligi. */
  size?: SelectSize;
  /** Chapdagi ikonka (telefonda yashiriladi — tor ustunda yozuv qirqilmasin). */
  icon?: React.ReactNode;
  /** `"auto"` — variantlar ko'p bo'lsa o'zi yoqiladi. */
  searchable?: boolean | "auto";
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Forma tekshiruvi o'tmadi — chegara qizil, `aria-invalid` qo'yiladi. */
  invalid?: boolean;
  required?: boolean;
  describedBy?: string;
  /** Tayyor variantlar o'rniga to'liq o'z uslubi (admin panel maydonlari uchun). */
  buttonClassName?: string;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  // -1 = klaviatura bilan hali hech narsa belgilanmagan
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<Position | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ buffer: "", at: 0 });

  const reactId = useId();
  const listId = `${reactId}-listbox`;
  const optionId = (index: number) => `${reactId}-opt-${index}`;

  const visible = useMemo(() => options.filter((o) => !o.hidden), [options]);
  const withSearch = searchable === "auto" ? visible.length >= AUTO_SEARCH_MIN : searchable === true;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((o) => o.label.toLowerCase().includes(q));
  }, [visible, query]);

  // Tanlangan yozuv YASHIRIN variantlardan ham qidiriladi ("3 ta tanlangan" kabi)
  const selected = options.find((o) => o.value === value);
  const shownSelectedIndex = shown.findIndex((o) => o.value === value);

  const measure = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - POPUP_GAP - VIEWPORT_PADDING;
    const spaceAbove = rect.top - POPUP_GAP - VIEWPORT_PADDING;
    // Pastda joy yetarli bo'lmasa va tepada ko'proq bo'lsa — tepaga ochamiz
    const below = spaceBelow >= POPUP_MIN_HEIGHT || spaceBelow >= spaceAbove;
    const available = Math.max(POPUP_MIN_HEIGHT, below ? spaceBelow : spaceAbove);
    // Eni: tugmadan tor emas, lekin ekranga sig'adi
    const maxWidth = window.innerWidth - VIEWPORT_PADDING * 2;
    const width = Math.min(maxWidth, Math.max(rect.width, POPUP_MIN_WIDTH));
    // Kengaygan ro'yxat o'ng chekkadan chiqib ketmasin (telefonda eng o'ngdagi filtr)
    const left = Math.max(VIEWPORT_PADDING, Math.min(rect.left, window.innerWidth - VIEWPORT_PADDING - width));
    setPos({
      left,
      width,
      maxHeight: Math.min(POPUP_MAX_HEIGHT, available),
      ...(below ? { top: rect.bottom + POPUP_GAP } : { bottom: window.innerHeight - rect.top + POPUP_GAP }),
    });
  }, []);

  useIsoLayoutEffect(() => {
    if (!open) return;
    measure();
    // `capture` — ichki scroll konteynerlari ham hisobga olinsin
    const onScroll = () => measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, measure]);

  // Tashqariga bosilganda yopiladi. Ro'yxat portalda bo'lgani uchun u ham
  // "ichkari" hisoblanishi kerak — aks holda variantga bosish ro'yxatni yopib yuborardi.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
      setActiveIndex(-1);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  // Qidiruv maydoni ochilishi bilan fokusni oladi
  useEffect(() => {
    if (open && withSearch) inputRef.current?.focus();
  }, [open, withSearch]);

  // Faol variant ko'rinib tursin (silliq scroll emas — reduced motion)
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openList(index: number) {
    if (disabled) return;
    setQuery("");
    setActiveIndex(index);
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    setActiveIndex(-1);
    setQuery("");
    if (returnFocus) buttonRef.current?.focus();
  }

  function pick(optionValue: string) {
    onChange(optionValue);
    close(true);
  }

  /** ↑/↓/Home/End/Enter/Escape — ro'yxat ochiqligida ham, yopiqligida ham bir xil. */
  function navigate(e: React.KeyboardEvent): boolean {
    const current = activeIndex >= 0 ? activeIndex : shownSelectedIndex;
    switch (e.key) {
      case "Escape":
        if (open) {
          e.preventDefault();
          close(true);
        }
        return true;
      case "Tab":
        if (open) close(false);
        return true;
      case "ArrowDown":
      case "ArrowUp":
      case "Home":
      case "End": {
        e.preventDefault();
        if (!open) {
          openList(shownSelectedIndex);
          return true;
        }
        if (shown.length === 0) return true;
        let next: number;
        if (e.key === "ArrowDown") next = Math.min(shown.length - 1, (current < 0 ? -1 : current) + 1);
        else if (e.key === "ArrowUp") next = Math.max(0, (current < 0 ? 1 : current) - 1);
        else if (e.key === "Home") next = 0;
        else next = shown.length - 1;
        setActiveIndex(next);
        return true;
      }
      case "Enter": {
        e.preventDefault();
        if (!open) {
          openList(shownSelectedIndex);
          return true;
        }
        const option = shown[current];
        if (option) pick(option.value);
        else close(true);
        return true;
      }
      default:
        return false;
    }
  }

  /**
   * Qidiruvsiz ro'yxatda harf terish: "s" bosilsa "Samarqand" ga sakraydi,
   * tez-tez "sa" terilsa — aynan shu bilan boshlanadigan birinchi variantga.
   */
  function onButtonKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === " " || e.key === "Spacebar") {
      // Probel: ro'yxat yopiq bo'lsa ochadi, ochiq bo'lsa tanlaydi
      e.preventDefault();
      if (!open) openList(shownSelectedIndex);
      else {
        const option = shown[activeIndex >= 0 ? activeIndex : shownSelectedIndex];
        if (option) pick(option.value);
        else close(true);
      }
      return;
    }
    if (navigate(e)) return;
    if (withSearch) return;
    if (e.key.length !== 1 || e.altKey || e.ctrlKey || e.metaKey) return;

    const now = Date.now();
    const state = typeahead.current;
    state.buffer = now - state.at > TYPEAHEAD_RESET_MS ? e.key : state.buffer + e.key;
    state.at = now;

    const prefix = state.buffer.toLowerCase();
    const index = shown.findIndex((o) => o.label.toLowerCase().startsWith(prefix));
    if (index < 0) return;
    e.preventDefault();
    if (!open) setOpen(true);
    setActiveIndex(index);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    navigate(e);
  }

  const fieldLike = variant === "field";
  const invalidRing = invalid ? "border-danger hover:border-danger" : "";
  const buttonBase = buttonClassName
    ? buttonClassName
    : variant === "bare"
      ? `h-12 rounded-xl border border-transparent bg-transparent ${open ? "bg-surface-2" : "hover:bg-surface-2"}`
      : fieldLike
        ? `border bg-surface ${FIELD_SIZES[size]} ${open ? "border-signal ring-4 ring-signal/10" : "border-line hover:border-signal/40"}`
        : `h-11 rounded-xl border bg-surface-2 ${open ? "border-signal" : "border-line hover:border-signal/50"}`;
  const buttonPadding = icon ? "pl-3.5 pr-3.5 sm:pl-10" : "px-3.5";

  const popup =
    open && pos
      ? createPortal(
          <div
            ref={popupRef}
            style={{
              position: "fixed",
              left: pos.left,
              width: pos.width,
              ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
            }}
            className="z-[90] overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
          >
            {withSearch && (
              <div className="border-b border-line p-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={onInputKeyDown}
                  placeholder={searchPlaceholder}
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                  aria-label={searchPlaceholder}
                  className="h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink outline-none transition-colors placeholder:text-dusk focus:border-signal"
                />
              </div>
            )}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              style={{ maxHeight: pos.maxHeight - (withSearch ? 53 : 0) }}
              className="overflow-auto overscroll-contain py-1"
            >
              {shown.length === 0 && <li className="px-3.5 py-3 text-sm text-dusk">{emptyText}</li>}
              {shown.map((opt, index) => {
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
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      {icon && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 hidden -translate-y-1/2 text-dusk sm:block">{icon}</span>
      )}
      <button
        id={id}
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close(false) : openList(shownSelectedIndex))}
        onKeyDown={onButtonKeyDown}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !withSearch && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        className={`flex w-full items-center justify-between gap-2 text-sm transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-signal/20 disabled:cursor-not-allowed disabled:opacity-60 ${buttonBase} ${invalidRing} ${buttonPadding}`}
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
      {popup}
    </div>
  );
}
