import React, { useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import { INDUSTRY_SLUGS, QUICK_INDUSTRIES, toggleIn, type CompanyQuery } from "../../lib/companies/query.js";
import { IconChevronRight } from "./icons.js";

const pill = (active: boolean) =>
  `inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
    active
      ? "border-signal bg-signal text-white shadow-xs"
      : "border-line bg-surface text-ink/80 hover:border-signal/40 hover:text-ink"
  }`;

/**
 * Tezkor filtrlar — yon paneldagi "Soha" va "Ish turi" bilan AYNAN bir holat
 * (bu yerda bosilgani panelda ham belgilangan chiqadi). Mobil ekranda qator
 * gorizontal aylanadi.
 */
export function QuickCompanyFilters({ query, onChange }: { query: CompanyQuery; onChange: (patch: Partial<CompanyQuery>) => void }) {
  const t = useT().companiesPage;
  const [expanded, setExpanded] = useState(false);
  const extra = INDUSTRY_SLUGS.filter((slug) => !QUICK_INDUSTRIES.includes(slug));
  // Tanlangan "qo'shimcha" soha yashirin qolib ketmasin
  const visible = expanded ? [...QUICK_INDUSTRIES, ...extra] : [...QUICK_INDUSTRIES, ...extra.filter((s) => query.industry.includes(s))];
  const remote = query.work.includes("remote");
  const nothing = query.industry.length === 0 && !remote;

  return (
    <div className="relative -mx-4 sm:mx-0">
      <div
        role="group"
        aria-label={t.quick.label}
        className="scrollbar-none flex gap-2 overflow-x-auto px-4 py-1 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        <button type="button" aria-pressed={nothing} onClick={() => onChange({ industry: [], work: query.work.filter((w) => w !== "remote") })} className={pill(nothing)}>
          {t.quick.all}
        </button>
        {visible.map((slug) => {
          const active = query.industry.includes(slug);
          return (
            <button key={slug} type="button" aria-pressed={active} onClick={() => onChange({ industry: toggleIn(query.industry, slug) })} className={pill(active)}>
              {t.industries[slug]}
            </button>
          );
        })}
        <button type="button" aria-pressed={remote} onClick={() => onChange({ work: toggleIn(query.work, "remote") })} className={pill(remote)}>
          {t.quick.remote}
        </button>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-semibold text-signal transition-colors hover:bg-signal-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          {expanded ? t.quick.less : t.quick.more}
          <IconChevronRight size={15} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>
    </div>
  );
}
