import React from "react";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { formatNumber } from "../../lib/format.js";
import { percentDelta, toMillions } from "../../lib/salaries/format.js";
import type { SalarySummary } from "../../lib/types.js";
import { IconArrowUp, IconRange, IconTrendUp, IconWallet } from "./icons.js";

const TONES = {
  growth: "bg-growth/10 text-growth",
  signal: "bg-signal-soft text-signal",
  violet: "bg-[#8B5CF6]/10 text-[#7C3AED] dark:text-[#A78BFA]",
};

/**
 * 3 ta asosiy ko'rsatkich. Kichik indikatorlar faqat real ma'lumotdan:
 * filtr tanlanganda — butun bozorga nisbatan farq (%), oraliq kartasida —
 * eng past/eng yuqori shkalasi ustida 25–75% va mediana belgisi.
 */
export function SalaryInsightCards({
  summary,
  market,
  filtered,
}: {
  summary: SalarySummary;
  market: { median: number; average: number };
  filtered: boolean;
}) {
  const t = useT();
  const s = t.salaries.cards;
  const money = (n: number) => `${formatNumber(n)} ${t.fmt.currency}`;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <InsightCard
        tone="growth"
        icon={<IconTrendUp size={22} />}
        label={s.median}
        value={money(summary.median)}
        hint={s.medianHint}
        delta={filtered ? percentDelta(summary.median, market.median) : null}
      />
      <InsightCard
        tone="signal"
        icon={<IconWallet size={22} />}
        label={s.average}
        value={money(summary.average)}
        hint={s.averageHint}
        delta={filtered ? percentDelta(summary.average, market.average) : null}
      />
      <InsightCard
        tone="violet"
        className="sm:col-span-2 lg:col-span-1"
        icon={<IconRange size={22} />}
        label={s.range}
        value={`${formatNumber(summary.p25)} – ${money(summary.p75)}`}
        hint={s.rangeHint}
      >
        <RangeScale summary={summary} />
      </InsightCard>
    </div>
  );
}

function InsightCard({
  tone,
  icon,
  label,
  value,
  hint,
  delta = null,
  className = "",
  children,
}: {
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  delta?: number | null;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className={`flex gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card ${className}`}>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${TONES[tone]}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="pt-0.5 text-[13.5px] font-semibold text-ink/80">{label}</h3>
          {delta !== null && <DeltaBadge value={delta} />}
        </div>
        <p className="mt-1.5 font-display text-[20px] font-extrabold leading-tight tracking-tight text-ink tabular-nums xl:text-[22px]">
          {value}
        </p>
        {children}
        <p className="mt-2 text-[13px] leading-relaxed text-dusk">{hint}</p>
      </div>
    </article>
  );
}

function DeltaBadge({ value }: { value: number }) {
  const label = useT().salaries.cards.vsMarket;
  const flat = value === 0;
  const up = value > 0;
  return (
    <span
      title={label}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums ${
        flat ? "bg-surface-2 text-dusk" : up ? "bg-growth/10 text-growth" : "bg-danger/10 text-danger"
      }`}
    >
      {!flat && <IconArrowUp size={12} className={up ? "" : "rotate-180"} />}
      {up ? "+" : ""}
      {value}%<span className="sr-only"> — {label}</span>
    </span>
  );
}

/** Eng past — eng yuqori shkala: 25–75% oralig'i to'ldirilgan, mediana — chiziqcha. */
function RangeScale({ summary }: { summary: SalarySummary }) {
  const t = useT();
  const { locale } = useLocale();
  const { min, max, p25, p75, median } = summary;
  const span = max - min;
  if (span <= 0) return null;
  const pos = (v: number) => ((v - min) / span) * 100;
  const unit = t.salaries.distribution.unit;
  const minLabel = `${toMillions(min, locale)} ${unit}`;
  const maxLabel = `${toMillions(max, locale)} ${unit}`;

  return (
    <div className="mt-3">
      <div className="relative h-2 rounded-full bg-surface-2 ring-1 ring-inset ring-line" aria-hidden>
        <span
          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[#8B5CF6] to-signal"
          style={{ left: `${pos(p25)}%`, width: `${Math.max(2, pos(p75) - pos(p25))}%` }}
        />
        <span className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: `${pos(median)}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] tabular-nums text-dusk" aria-hidden>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      <span className="sr-only">{t.salaries.cards.scale(minLabel, maxLabel)}</span>
    </div>
  );
}
