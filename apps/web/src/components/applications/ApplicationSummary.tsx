import React from "react";
import { useT } from "../../lib/i18n/index.js";
import type { ApplicationStatus } from "../../lib/types.js";
import { STATUS_TONE, StatusIcon } from "./ApplicationStatus.js";
import { IconMore, IconStack } from "./icons.js";

type Selected = ApplicationStatus | "all";

/** E'tibor talab qiladigan holatlar oldinda: ko'rib chiqilmoqda, suhbat, qabul. */
const DISPLAY_ORDER: ApplicationStatus[] = ["viewed", "invited", "accepted", "sent", "rejected"];

/** Kartalar soniga qarab to'r: telefon 2 ustun, bo'sh katak qolmaydi (klasslar to'liq yozilgan). */
export const SUMMARY_GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-6 xl:grid-cols-5",
};

/** Toq sonli to'rda "Barchasi" telefonda ikki ustun; 5 ta kartada sm: 3 + 2 qator. */
export function summaryCellClass(index: number, count: number): string {
  if (count === 5) {
    if (index === 0) return "col-span-2 xl:col-span-1";
    return index < 3 ? "sm:col-span-2 xl:col-span-1" : "sm:col-span-3 xl:col-span-1";
  }
  return count === 3 && index === 0 ? "col-span-2 sm:col-span-1" : "";
}

/**
 * Yuqoridagi statistika: "Barchasi" + soni noldan katta holatlar (backend'dagi
 * haqiqiy sonlar, ulushi foizda). Beshala holat bo'lsa oxirgi ikkitasi
 * "Yana 2 ta holat" kartasida. Karta bosilsa — shu holat bo'yicha filtr (tablar bilan bir xil).
 */
export function ApplicationSummary({
  counts,
  total,
  active = "all",
  onSelect,
}: {
  counts: Record<ApplicationStatus, number>;
  total: number;
  active?: Selected;
  onSelect?: (status: Selected) => void;
}) {
  const a = useT().applicationsPage;
  const statuses = DISPLAY_ORDER.filter((status) => counts[status] > 0);
  const collapsed = statuses.length > 4 ? statuses.slice(3) : [];
  const shown = collapsed.length > 0 ? statuses.slice(0, 3) : statuses;
  const count = 1 + shown.length + (collapsed.length > 0 ? 1 : 0);
  const interactive = Boolean(onSelect) && total > 0;
  const share = (n: number) => Math.round((n / total) * 100);

  const frame = (selected: boolean) =>
    `flex h-full w-full flex-col rounded-2xl border bg-surface p-4 text-left shadow-card transition-[border-color,box-shadow] duration-200 ${
      selected ? "border-signal/70 ring-1 ring-signal/30" : "border-line"
    }`;
  const clickable = "hover:border-signal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

  const tile = (key: Selected, icon: React.ReactNode, tone: string, label: string, value: number, hint: string) => {
    const selected = interactive && active === key;
    const body = (
      <>
        <span className="flex min-h-[28px] items-center gap-2 text-[12.5px] font-semibold leading-tight text-ink/80">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
          {label}
        </span>
        <span className="mt-3 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-display text-[26px] font-bold leading-none tabular-nums text-ink">{value}</span>
          <span className="text-[12.5px] text-dusk">{hint}</span>
        </span>
      </>
    );
    return interactive ? (
      <button type="button" aria-pressed={selected} onClick={() => onSelect?.(key)} className={`${frame(selected)} ${clickable}`}>
        {body}
      </button>
    ) : (
      <div className={frame(false)}>{body}</div>
    );
  };

  const collapsedActive = interactive && collapsed.includes(active as ApplicationStatus);

  return (
    <section aria-labelledby="applications-summary-title">
      <h2 id="applications-summary-title" className="sr-only">
        {a.summary.label}
      </h2>
      <ul className={`grid gap-3 ${SUMMARY_GRID[count]}`}>
        <li className={summaryCellClass(0, count)}>
          {tile("all", <IconStack size={15} />, "bg-signal-soft text-signal", a.summary.total, total, a.summary.totalHint)}
        </li>
        {shown.map((status, i) => (
          <li key={status} className={summaryCellClass(i + 1, count)}>
            {tile(status, <StatusIcon status={status} size={15} />, STATUS_TONE[status].soft, a.status[status], counts[status], `${share(counts[status])}%`)}
          </li>
        ))}
        {collapsed.length > 0 && (
          <li className={summaryCellClass(count - 1, count)}>
            <div className={frame(collapsedActive)}>
              <span className="flex min-h-[28px] items-center gap-2 text-[12.5px] font-semibold leading-tight text-ink/80">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-dusk">
                  <IconMore size={15} />
                </span>
                {a.summary.more(collapsed.length)}
              </span>
              <ul className="-mx-1.5 mt-2 space-y-0.5">
                {collapsed.map((status) => (
                  <li key={status}>
                    <button
                      type="button"
                      aria-pressed={active === status}
                      onClick={() => onSelect?.(status)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-[12.5px] text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal aria-pressed:bg-signal-soft aria-pressed:font-semibold aria-pressed:text-signal"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_TONE[status].dot}`} aria-hidden />
                        {a.status[status]}
                      </span>
                      <span className="font-semibold tabular-nums text-ink">{counts[status]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        )}
      </ul>
    </section>
  );
}
