import React, { memo, useId } from "react";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { formatNumber } from "../../lib/format.js";
import { EXPERIENCE_KEYS, EXPERIENCE_LEVEL, type ExperienceKey } from "../../lib/salaries/query.js";
import { toMillions } from "../../lib/salaries/format.js";
import type { SalaryLevelStat } from "../../lib/types.js";
import { SalaryPanel } from "./SalaryPanel.js";

/**
 * Tajriba bosqichlari bo'yicha mediana: yumshoq ustunlar + ularning cho'qqisini
 * tutashtiruvchi chiziq va nuqtalar. Chiziq SVG'da (`preserveAspectRatio=none`,
 * qalinlik o'zgarmaydi), yorliq va nuqtalar HTML'da — har qanday kenglikda
 * matn cho'zilmaydi. Ma'lumoti yo'q bosqich tashlab ketiladi.
 */
export const SalaryExperienceChart = memo(function SalaryExperienceChart({
  levels,
  selected,
}: {
  levels: SalaryLevelStat[];
  selected: ExperienceKey | "";
}) {
  const t = useT();
  const s = t.salaries;
  const { locale } = useLocale();
  const gradientId = useId().replace(/:/g, "");

  const points = EXPERIENCE_KEYS.map((key, i) => {
    const stat = levels.find((l) => l.level === EXPERIENCE_LEVEL[key]);
    return { key, x: (i + 0.5) * 25, stat: stat && stat.count > 0 ? stat : null };
  });
  const withData = points.filter((p) => p.stat);
  const max = Math.max(0, ...withData.map((p) => p.stat!.median));
  // Eng baland nuqta ustida yorliqqa joy qolsin
  const top = max > 0 ? Math.ceil((max * 1.2) / 5_000_000) * 5_000_000 : 1;
  const y = (value: number) => 100 - (value / top) * 100;
  const line = withData.map((p) => `${p.x},${y(p.stat!.median)}`).join(" ");
  const unit = s.distribution.unit;

  return (
    <SalaryPanel id="salary-experience-title" title={s.experience.title} subtitle={s.experience.subtitle}>
      {withData.length === 0 ? (
        <p className="mt-auto flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-line px-6 text-center text-sm text-dusk">
          {s.experience.empty}
        </p>
      ) : (
        <figure className="mt-auto pt-10">
          <div className="relative h-[210px] border-l border-line" aria-hidden>
            {[0, 50, 100].map((v) => (
              <span
                key={v}
                className={`absolute inset-x-0 border-t ${v === 100 ? "border-line" : "border-dashed border-line/80"}`}
                style={{ top: `${v}%` }}
              />
            ))}

            {points.map(
              (p) =>
                p.stat && (
                  <span
                    key={`bar-${p.key}`}
                    className={`absolute bottom-0 w-[12%] max-w-[46px] -translate-x-1/2 origin-bottom animate-bar-grow rounded-t-lg motion-reduce:animate-none ${
                      selected === p.key
                        ? "bg-gradient-to-t from-signal/50 to-signal/25"
                        : "bg-gradient-to-t from-signal/30 to-signal/[0.08]"
                    }`}
                    style={{ left: `${p.x}%`, top: `${y(p.stat.median)}%` }}
                  />
                )
            )}

            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">
                  <stop offset="0" stopColor="#818CF8" />
                  <stop offset="1" stopColor="#4F46E5" />
                </linearGradient>
              </defs>
              {withData.length > 1 && (
                <polyline
                  points={line}
                  fill="none"
                  stroke={`url(#${gradientId})`}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {points.map((p) =>
              p.stat ? (
                <React.Fragment key={`point-${p.key}`}>
                  <span
                    className={`absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-signal shadow-[0_0_0_4px_rgba(99,102,241,0.2)] ${
                      selected === p.key ? "scale-125" : ""
                    }`}
                    style={{ left: `${p.x}%`, top: `${y(p.stat.median)}%` }}
                  />
                  <span
                    className="absolute -translate-x-1/2 whitespace-nowrap text-[12.5px] font-bold tabular-nums text-ink"
                    style={{ left: `${p.x}%`, top: `calc(${y(p.stat.median)}% - 30px)` }}
                  >
                    {toMillions(p.stat.median, locale)} {unit}
                  </span>
                </React.Fragment>
              ) : (
                <span
                  key={`empty-${p.key}`}
                  className="absolute bottom-2 -translate-x-1/2 whitespace-nowrap text-[11px] text-dusk"
                  style={{ left: `${p.x}%` }}
                >
                  {s.experience.noData}
                </span>
              )
            )}
          </div>

          <div className="mt-2.5 grid grid-cols-4 text-center" aria-hidden>
            {points.map((p) => (
              <span
                key={p.key}
                className={`px-0.5 text-[12.5px] leading-tight ${selected === p.key ? "font-semibold text-signal" : "text-ink/80"}`}
              >
                {s.levels[p.key].label}
                <span className="mt-0.5 block text-[11.5px] font-normal text-dusk">({s.levels[p.key].years})</span>
              </span>
            ))}
          </div>

          {/* `sr-only` o'ramada: jadval 1px kenglikka siqilmaydi va sahifani kengaytiradi */}
          <div className="sr-only">
          <table>
            <caption>{s.experience.title}</caption>
            <thead>
              <tr>
                <th scope="col">{s.experience.colLevel}</th>
                <th scope="col">{s.experience.colMedian}</th>
                <th scope="col">{s.experience.colCount}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.key}>
                  <td>
                    {s.levels[p.key].label} ({s.levels[p.key].years})
                  </td>
                  <td>{p.stat ? `${formatNumber(p.stat.median)} ${t.fmt.currency}` : s.experience.noData}</td>
                  <td>{p.stat?.count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </figure>
      )}
    </SalaryPanel>
  );
});
