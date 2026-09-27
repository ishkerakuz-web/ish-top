import React, { useRef, useState } from "react";

/** Ko'rsatish uchun — kasrli (masalan 4.3) yulduzlarni to'ldirib ko'rsatadi. */
export function StarRating({ value, className = "text-base" }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span
      className={`relative inline-block select-none leading-none ${className}`}
      aria-label={`${value.toFixed(1)} / 5`}
      role="img"
    >
      {/* Bo'sh "yo'l" — dekorativ (butun widget aria-label bilan o'qiladi) */}
      <span className="text-line" aria-hidden>★★★★★</span>
      <span
        className="absolute inset-0 overflow-hidden whitespace-nowrap text-gold"
        style={{ width: `${pct}%` }}
        aria-hidden
      >
        ★★★★★
      </span>
    </span>
  );
}

const KEYS_NEXT = ["ArrowRight", "ArrowDown"];
const KEYS_PREV = ["ArrowLeft", "ArrowUp"];

/**
 * Kiritish uchun — 1..5 yulduz tanlash.
 *
 * audit R3, D-060 (a11y-ui-8): radiogroup semantikasi — har yulduz
 * `role="radio"` + `aria-checked`, nomi "3 / 5" ko'rinishida (til-neytral).
 * Fokus roving tabindex bilan bitta elementda; ←/→/↑/↓, Home/End tanlaydi.
 * Tanlangan/tanlanmagan holat faqat rang bilan emas, shakl bilan ham
 * farqlanadi (to'la ★ va kontur ☆) — WCAG 1.4.1.
 */
export function StarInput({
  value,
  onChange,
  className = "text-2xl",
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Fokus uchun: tanlanmagan bo'lsa birinchi yulduz tab tartibida qoladi
  const focusIndex = value >= 1 && value <= 5 ? value - 1 : 0;

  function select(next: number) {
    const clamped = Math.max(1, Math.min(5, next));
    onChange(clamped);
    refs.current[clamped - 1]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
    if (KEYS_NEXT.includes(e.key)) {
      e.preventDefault();
      select((value || 0) + 1 > 5 ? 1 : (value || 0) + 1);
    } else if (KEYS_PREV.includes(e.key)) {
      e.preventDefault();
      select((value || 1) - 1 < 1 ? 5 : (value || 1) - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      select(1);
    } else if (e.key === "End") {
      e.preventDefault();
      select(5);
    }
  }

  return (
    <span
      role="radiogroup"
      onKeyDown={onKeyDown}
      className={`inline-flex leading-none ${className}`}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = active >= i;
        return (
          <button
            type="button"
            key={i}
            ref={(el) => {
              refs.current[i - 1] = el;
            }}
            role="radio"
            aria-checked={value === i}
            tabIndex={i - 1 === focusIndex ? 0 : -1}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
            aria-label={`${i} / 5`}
            className={`px-0.5 leading-none transition-colors ${
              filled ? "text-gold" : "text-dusk hover:text-gold/70"
            }`}
          >
            <span aria-hidden>{filled ? "★" : "☆"}</span>
          </button>
        );
      })}
    </span>
  );
}
