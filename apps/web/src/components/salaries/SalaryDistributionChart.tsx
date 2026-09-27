import React, { memo } from "react";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { bucketRange } from "../../lib/salaries/format.js";
import type { SalaryBucket } from "../../lib/types.js";
import { SalaryPanel } from "./SalaryPanel.js";

/** Vakansiya sonlari uchun "chiroyli" o'q: 22 → 0, 10, 20, 30. Tepada yorliqlarga joy qoladi. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const target = max * 1.15;
  const raw = target / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, Math.ceil([1, 2, 2.5, 5, 10].map((m) => m * pow).find((v) => v >= raw) ?? raw));
  const top = Math.ceil(target / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

const COLUMNS = "flex justify-around gap-1.5 px-1 sm:gap-4 sm:px-2";
const COLUMN = "flex min-w-0 max-w-[56px] flex-1 justify-center";

/**
 * Taqsimot ustunlari (HTML/CSS — kutubxonasiz). Mediana tushgan oraliq
 * yorqinroq. Ekran o'quvchi uchun ko'rinmas jadval ham bor.
 */
export const SalaryDistributionChart = memo(function SalaryDistributionChart({
  buckets,
  median,
}: {
  buckets: SalaryBucket[];
  median: number;
}) {
  const t = useT();
  const s = t.salaries.distribution;
  const { locale } = useLocale();
  const ticks = niceTicks(Math.max(0, ...buckets.map((b) => b.count)));
  const top = ticks[ticks.length - 1] || 1;
  const medianIndex = buckets.findIndex((b) => median >= b.from && (b.to === null || median < b.to));
  const pct = (v: number) => `${(v / top) * 100}%`;

  return (
    <SalaryPanel id="salary-distribution-title" title={s.title} subtitle={s.subtitle}>
      <figure className="mt-auto pt-8">
        <div className="flex gap-3" aria-hidden>
          <div className="relative h-[210px] w-6 shrink-0 text-right text-[11px] tabular-nums text-dusk">
            {ticks.map((v) => (
              <span key={v} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: pct(v) }}>
                {v}
              </span>
            ))}
          </div>
          <div className="relative h-[210px] min-w-0 flex-1">
            {ticks.map((v) => (
              <span
                key={v}
                className={`absolute inset-x-0 border-t ${v === 0 ? "border-line" : "border-dashed border-line/80"}`}
                style={{ bottom: pct(v) }}
              />
            ))}
            <div className={`absolute inset-0 items-end ${COLUMNS}`}>
              {buckets.map((b, i) => (
                <div key={b.from} className={`${COLUMN} h-full items-end`}>
                  <span
                    className={`relative block w-full origin-bottom animate-bar-grow rounded-t-lg motion-reduce:animate-none ${
                      i === medianIndex
                        ? "bg-gradient-to-t from-signal to-[#8B5CF6] shadow-[0_8px_20px_-10px_rgba(79,70,229,0.7)]"
                        : "bg-gradient-to-t from-signal/75 to-signal/40"
                    }`}
                    style={{ height: pct(b.count), minHeight: b.count ? 4 : 0, animationDelay: `${i * 45}ms` }}
                  >
                    <span className="absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 text-[12px] font-semibold tabular-nums text-ink">
                      {b.count}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={`ml-9 mt-2 ${COLUMNS}`} aria-hidden>
          {buckets.map((b) => (
            <span key={b.from} className={`${COLUMN} text-center text-[11.5px] leading-tight text-dusk`}>
              {bucketRange(b.from, b.to, locale)}
              <br />
              {s.unit}
            </span>
          ))}
        </div>
        {medianIndex >= 0 && (
          <figcaption className="mt-4 flex items-center gap-2 text-[12.5px] text-dusk">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-signal to-[#8B5CF6]" />
            {s.medianBucket}
          </figcaption>
        )}
        {/* `sr-only` jadvalga emas, o'ramaga: jadval 1px kenglikka siqilmaydi va sahifani kengaytiradi */}
        <div className="sr-only">
          <table>
            <caption>{s.title}</caption>
            <thead>
              <tr>
                <th scope="col">{s.colRange}</th>
                <th scope="col">{s.colCount}</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.from}>
                  <td>
                    {bucketRange(b.from, b.to, locale)} {s.unit}
                  </td>
                  <td>{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>
    </SalaryPanel>
  );
});
