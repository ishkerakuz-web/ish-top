import React, { useState } from "react";
import { useT } from "../lib/i18n/index.js";

/**
 * Vakansiyani saqlash tugmasi (yurakcha).
 *
 * Kartaning ichida "stretched link" ustida turadi — shuning uchun `relative z-10`
 * va `stopPropagation`: yurakchani bosganda vakansiya sahifasi ochilmasligi kerak.
 */
export function FavoriteButton({
  active,
  onToggle,
  size = "md",
  className = "",
}: {
  active: boolean;
  onToggle: () => void | Promise<unknown>;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useT();
  const [pulse, setPulse] = useState(false);
  const px = size === "sm" ? 16 : 18;

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? t.favorites.remove : t.favorites.add}
      title={active ? t.favorites.remove : t.favorites.add}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setPulse(true);
        window.setTimeout(() => setPulse(false), 240);
        void onToggle();
      }}
      className={`relative z-10 flex shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
        size === "sm" ? "h-8 w-8" : "h-9 w-9"
      } ${
        active
          ? "text-signal hover:bg-signal/10"
          : "text-dusk hover:bg-surface-2 hover:text-signal"
      } ${pulse ? "scale-125" : "scale-100"} ${className}`}
    >
      <svg width={px} height={px} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} aria-hidden>
        <path
          d="M12 20.5l-1.45-1.32C5.4 14.5 2 11.4 2 7.6 2 4.8 4.2 2.6 7 2.6c1.6 0 3.1.74 4 1.93.9-1.19 2.4-1.93 4-1.93 2.8 0 5 2.2 5 5 0 3.8-3.4 6.9-8.55 11.6L12 20.5z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
