import React from "react";
import { useT, useHref } from "../../lib/i18n/index.js";
import { formatNumber } from "../../lib/format.js";
import { vacancySearchHref, type SalaryQuery } from "../../lib/salaries/query.js";
import type { SalarySummary } from "../../lib/types.js";
import { IconArrowRight } from "./icons.js";

/**
 * Statistikadan harakatga: joriy tanlov + asosiy maosh oralig'i (25–75%)
 * bilan vakansiya qidiruviga o'tadi (`/vacancies?q=&salaryFrom=&salaryTo=`).
 */
export function RelatedVacanciesCTA({ query, summary }: { query: SalaryQuery; summary: SalarySummary }) {
  const t = useT();
  const l = useHref();
  const s = t.salaries.cta;
  const hasRange = summary.count > 0 && summary.p25 > 0 && summary.p75 >= summary.p25;

  return (
    <section
      aria-labelledby="salary-cta-title"
      className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-r from-signal-soft via-surface to-surface p-6 shadow-card sm:p-8"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gold" />
      <span aria-hidden className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-signal/[0.06] dark:bg-signal/[0.12]" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 id="salary-cta-title" className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
            {s.title}
          </h2>
          <p className="mt-1.5 max-w-xl text-[14.5px] leading-relaxed text-dusk">
            {hasRange ? s.text(formatNumber(summary.p25), formatNumber(summary.p75)) : s.textAll}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
          <a
            href={l(vacancySearchHref(query, hasRange ? { from: summary.p25, to: summary.p75 } : undefined))}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-signal px-6 text-[15px] font-semibold text-white shadow-xs transition-colors hover:bg-signal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            {s.primary}
            <IconArrowRight size={17} />
          </a>
          <a
            href={l("/vacancies")}
            className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-5 text-[15px] font-semibold text-ink transition-colors hover:border-signal/50 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {s.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}
