import React, { useRef } from "react";
import { useT } from "../../lib/i18n/index.js";
import type { EmploymentType } from "../../lib/types.js";
import { EmploymentIcon } from "./icons.js";

export const FAVORITES_PANEL_ID = "favorites-panel";
export const favoritesTabId = (key: string) => `favorites-tab-${key}`;

type TabKey = EmploymentType | "all";

/**
 * Ish turi tablari (WAI-ARIA): "Barchasi" + saqlanganlar orasida bor turlar (backend enum'i).
 * Faqat tanlangan tab Tab bilan fokuslanadi, ←/→, Home/End bilan almashadi.
 * Sonlar — qidiruv va joylashuv filtri qo'llangan ro'yxatdan. Telefonda gorizontal aylanadi.
 */
export function FavoritesTabs({
  types,
  active,
  counts,
  total,
  onChange,
}: {
  types: EmploymentType[];
  active: TabKey;
  counts: Record<EmploymentType, number>;
  total: number;
  onChange: (key: TabKey) => void;
}) {
  const t = useT();
  const f = t.favoritesPage;
  const keys: TabKey[] = ["all", ...types];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % keys.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + keys.length) % keys.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = keys.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(keys[next]);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={f.tabs.label} className="scrollbar-none flex overflow-x-auto border-b border-line px-1.5 sm:px-3">
      {keys.map((key, index) => {
        const selected = key === active;
        const count = key === "all" ? total : counts[key];
        return (
          <button
            key={key}
            ref={(el) => {
              refs.current[index] = el;
            }}
            id={favoritesTabId(key)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={FAVORITES_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(key)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg px-2.5 py-3.5 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal sm:px-3 ${
              selected ? "text-ink" : "text-dusk hover:text-ink"
            }`}
          >
            {key !== "all" && <EmploymentIcon type={key} size={16} className={selected ? "text-signal" : "text-dusk"} />}
            {key === "all" ? f.tabs.all : t.enums.employment[key]}
            <span
              className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11.5px] font-semibold tabular-nums ${
                selected ? "bg-signal-soft text-signal" : "bg-surface-2 text-dusk"
              }`}
            >
              {count}
            </span>
            <span
              aria-hidden
              className={`absolute inset-x-2.5 -bottom-px h-[2.5px] origin-center rounded-full bg-signal transition-transform duration-200 ${
                selected ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
