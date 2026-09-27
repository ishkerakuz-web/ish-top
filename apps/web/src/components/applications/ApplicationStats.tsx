import React from "react";
import { STATUS_ORDER } from "../../lib/applications/query.js";
import { formatRelativeDays } from "../../lib/format.js";
import { useT } from "../../lib/i18n/index.js";
import type { ApplicationStatus, MyApplication } from "../../lib/types.js";
import { STATUS_TONE } from "./ApplicationStatus.js";
import { IconChart } from "./icons.js";

/**
 * "Umumiy statistika" — hammasi haqiqiy ro'yxatdan. "Ko'rib chiqilgan" ulushi
 * backend enum'idan chiqadi: "Yuborilgan"dan keyingi har qanday holat
 * (viewed / invited / accepted / rejected) ish beruvchi arizani ochganini bildiradi.
 */
export function ApplicationStats({ items, counts }: { items: MyApplication[]; counts: Record<ApplicationStatus, number> }) {
  const t = useT();
  const a = t.applicationsPage;
  const s = a.sidebar;
  const total = items.length;
  const reviewed = total - counts.sent;
  const reviewedPct = total ? Math.round((reviewed / total) * 100) : 0;
  const latest = items.reduce((max, item) => (item.createdAt > max ? item.createdAt : max), "");
  const parts = STATUS_ORDER.filter((status) => counts[status] > 0);
  const barLabel = `${s.distribution}: ${parts.map((status) => `${a.status[status]} ${counts[status]}`).join(", ")}`;
  const lastRelative = latest ? formatRelativeDays(latest, t.fmt) : null;

  return (
    <section aria-labelledby="applications-stats-title" className="rounded-3xl border border-line bg-surface p-5 shadow-card">
      <h2 id="applications-stats-title" className="font-display text-[16px] font-bold tracking-tight text-ink">
        {s.statsTitle}
      </h2>
      <p className="mt-3 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-signal-soft text-signal" aria-hidden>
          <IconChart size={22} />
        </span>
        <span className="flex items-baseline gap-2">
          <span className="font-display text-[32px] font-bold leading-none tabular-nums text-ink">{total}</span>
          <span className="text-[13.5px] text-dusk">{s.totalLabel}</span>
        </span>
      </p>

      <div role="img" aria-label={barLabel} className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-2">
        {parts.map((status) => (
          <span key={status} className={STATUS_TONE[status].dot} style={{ width: `${(counts[status] / total) * 100}%` }} />
        ))}
      </div>

      <ul className="mt-4 space-y-2.5">
        {STATUS_ORDER.map((status) => (
          <li key={status} className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className="flex min-w-0 items-center gap-2.5 text-ink/85">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_TONE[status].dot}`} aria-hidden />
              {a.status[status]}
            </span>
            <span className="font-semibold tabular-nums text-ink">{counts[status]}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-2xl bg-surface-2/60 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-ink">{s.reviewed}</span>
          <span className="font-display text-[15px] font-bold tabular-nums text-ink">{reviewedPct}%</span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={reviewedPct}
          aria-label={s.reviewed}
        >
          <div className="h-full rounded-full bg-growth" style={{ width: `${reviewedPct}%` }} />
        </div>
        <p className="mt-2 text-[12.5px] leading-snug text-dusk">{s.reviewedHint(reviewed, total)}</p>
      </div>

      {lastRelative && <p className="mt-3 text-[12.5px] text-dusk">{s.lastApplied(lastRelative)}</p>}
    </section>
  );
}
