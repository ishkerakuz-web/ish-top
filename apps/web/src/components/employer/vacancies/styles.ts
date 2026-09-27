/** Dashboard tugmalari — bir xil balandlik va fokus halqasi. */
const BASE =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export const BTN_PRIMARY = `${BASE} bg-signal text-white shadow-xs hover:bg-signal-dark`;
export const BTN_OUTLINE = `${BASE} border border-line bg-surface text-ink hover:border-signal/40 hover:text-signal`;
export const BTN_SIGNAL_OUTLINE = `${BASE} border border-signal/25 bg-signal-soft/60 text-signal hover:border-signal/50 dark:text-indigo-300`;

export const CTA_PRIMARY =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-signal px-5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-signal-dark hover:shadow-card-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper";
export const CTA_SECONDARY =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";
