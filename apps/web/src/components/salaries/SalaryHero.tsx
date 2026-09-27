import React from "react";
import { useT, useHref } from "../../lib/i18n/index.js";
import { formatNumber } from "../../lib/format.js";
import { SalaryPromoCard } from "./SalaryPromoCard.js";
import { IconChartBars } from "./icons.js";

/**
 * Sahifa boshi: breadcrumb, sarlavha, qidiruv qatori (children).
 * O'ngda (lg+) — "To'g'ri maosh" banneri; keng ekranda (xl+) sarlavha
 * yonida bozordagi maoshli vakansiyalar soni (real raqam, filtrsiz).
 */
export function SalaryHero({ marketCount, children }: { marketCount: number | null; children: React.ReactNode }) {
  const t = useT();
  const l = useHref();
  const s = t.salaries;

  return (
    <section className="relative pt-6 sm:pt-8">
      {/* juda yengil indigo dog' — sahifa "tekis oq" bo'lib qolmasin */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[min(1100px,100%)] -translate-x-1/2 rounded-full bg-signal/[0.07] blur-3xl"
      />
      <nav aria-label="Breadcrumb" className="text-sm text-dusk">
        <ol className="flex items-center gap-1.5">
          <li>
            <a href={l("/")} className="transition-colors hover:text-signal">
              {t.search.breadcrumbHome}
            </a>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-medium text-ink">
            {s.breadcrumb}
          </li>
        </ol>
      </nav>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_248px] xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-7">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="font-display text-[1.85rem] font-extrabold leading-[1.14] tracking-tight text-ink sm:text-[2.35rem] lg:text-[2.2rem] xl:text-[2.05rem] 2xl:text-[2.2rem]">
                {s.title}
              </h1>
              <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-dusk sm:text-base">{s.subtitle}</p>
            </div>
            {marketCount !== null && marketCount > 0 && (
              <div className="hidden shrink-0 items-center gap-3 rounded-2xl border border-line bg-surface py-3 pl-3.5 pr-5 shadow-card xl:flex">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-signal-soft text-signal">
                  <IconChartBars size={22} />
                </span>
                <span className="leading-tight">
                  <span className="block text-[11.5px] font-medium text-dusk">{s.marketStat.label}</span>
                  <span className="mt-0.5 block font-display text-[22px] font-extrabold tabular-nums text-signal">
                    {formatNumber(marketCount)}
                  </span>
                  <span className="block text-[11.5px] text-dusk">{s.marketStat.caption}</span>
                </span>
              </div>
            )}
          </div>
          <div className="mt-6">{children}</div>
        </div>

        <SalaryPromoCard />
      </div>
    </section>
  );
}
