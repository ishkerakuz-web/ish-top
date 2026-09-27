import React, { useRef } from "react";
import { useT } from "../../lib/i18n/index.js";
import { STATUS_ORDER } from "../../lib/applications/query.js";
import type { ApplicationStatus } from "../../lib/types.js";

export const APPLICATIONS_PANEL_ID = "applications-panel";
export const applicationsTabId = (key: string) => `applications-tab-${key}`;

type TabKey = ApplicationStatus | "all";
const KEYS: TabKey[] = ["all", ...STATUS_ORDER];

/**
 * Holat tablari (WAI-ARIA): faqat tanlangan tab Tab bilan fokuslanadi,
 * ←/→, Home/End bilan almashadi. Sonlar — qidiruv va sana filtri qo'llangan
 * ro'yxatdagi haqiqiy miqdor. Telefonda gorizontal aylanadi.
 */
export function ApplicationTabs({
  active,
  counts,
  total,
  onChange,
}: {
  active: TabKey;
  counts: Record<ApplicationStatus, number>;
  total: number;
  onChange: (status: TabKey) => void;
}) {
  const a = useT().applicationsPage;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % KEYS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + KEYS.length) % KEYS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = KEYS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(KEYS[next]);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={a.tabs.label} className="scrollbar-none flex overflow-x-auto border-b border-line px-1.5 sm:px-3">
      {KEYS.map((key, index) => {
        const selected = key === active;
        const count = key === "all" ? total : counts[key];
        return (
          <button
            key={key}
            ref={(el) => {
              refs.current[index] = el;
            }}
            id={applicationsTabId(key)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={APPLICATIONS_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(key)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg px-2.5 py-3.5 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal sm:px-3 ${
              selected ? "text-ink" : "text-dusk hover:text-ink"
            }`}
          >
            {key === "all" ? a.tabs.all : a.status[key]}
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
