import React, { useRef } from "react";
import { useT } from "../../../lib/i18n/index.js";
import type { StatusCounts } from "../../../lib/employer/applications/adapter.js";
import type { ApplicationStatus } from "../../../lib/types.js";

const TABS = ["all", "sent", "viewed", "invited", "accepted", "rejected"] as const;
type TabKey = (typeof TABS)[number];

/**
 * Holat tablari — sonlar haqiqiy arizalardan (joriy qidiruv/filtr bo'yicha, holatdan tashqari).
 * WAI-ARIA tablist: ←/→, Home/End bilan yuriladi. Telefonda gorizontal scroll.
 */
export function StatusTabs({
  active,
  counts,
  onSelect,
  panelId,
}: {
  active: ApplicationStatus | null;
  counts: StatusCounts;
  onSelect: (status: ApplicationStatus | null) => void;
  /** `aria-controls` faqat ro'yxat chizilgan bo'lsa (audit R3, gap5-4). */
  panelId?: string;
}) {
  const p = useT().employerApplicationsPage;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current: TabKey = active ?? "all";

  const move = (index: number) => {
    const next = (index + TABS.length) % TABS.length;
    refs.current[next]?.focus();
    const key = TABS[next];
    onSelect(key === "all" ? null : key);
  };

  return (
    <div
      role="tablist"
      aria-label={p.tabsLabel}
      data-testid="applications-tabs"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((key, i) => {
        const selected = key === current;
        return (
          <button
            key={key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            data-tab={key}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(key === "all" ? null : key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") move(i + 1);
              else if (e.key === "ArrowLeft") move(i - 1);
              else if (e.key === "Home") move(0);
              else if (e.key === "End") move(TABS.length - 1);
              else return;
              e.preventDefault();
            }}
            className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
              selected ? "border-signal/50 bg-signal-soft/70 font-semibold text-signal shadow-xs dark:text-indigo-300" : "border-line bg-surface font-medium text-ink/80 hover:border-signal/40 hover:text-ink"
            }`}
          >
            {p.tabs[key]}
            <span
              data-count
              className={`flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-[12px] font-semibold tabular-nums ${selected ? "bg-signal text-white" : "bg-surface-2 text-dusk"}`}
            >
              {counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
