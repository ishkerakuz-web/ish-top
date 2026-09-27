import React, { memo } from "react";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { formatNumber } from "../../lib/format.js";
import { formatRatio } from "../../lib/salaries/format.js";
import { EXPERIENCE_KEYS, EXPERIENCE_LEVEL } from "../../lib/salaries/query.js";
import type { SalaryStats } from "../../lib/types.js";
import { SalaryPanel } from "./SalaryPanel.js";
import { IconBuilding, IconCap, IconPin } from "./icons.js";

/** Bitta vakansiyali guruh tasodifan "eng yuqori" bo'lib chiqmasin. */
const MIN_GROUP = 2;
/** Bundan kichik farq "farq" deb aytilmaydi. */
const MIN_RATIO = 1.05;

const TONES = {
  growth: "bg-growth/10 text-growth",
  signal: "bg-signal-soft text-signal",
  violet: "bg-[#8B5CF6]/10 text-[#7C3AED] dark:text-[#A78BFA]",
};

/**
 * "Muhim ma'lumotlar" — tayyor matn emas, joriy tanlov raqamlaridan
 * chiqariladi. Ma'lumot kam bo'lsa — halol zaxira matn.
 */
export const SalaryInsights = memo(function SalaryInsights({ stats }: { stats: SalaryStats }) {
  const t = useT();
  const s = t.salaries.insights;
  const { locale } = useLocale();
  const diff = (ratio: number) => (ratio >= 1.95 ? s.times(formatRatio(ratio, locale)) : s.percent(Math.round((ratio - 1) * 100)));

  const levels = EXPERIENCE_KEYS.flatMap((key) => {
    const stat = stats.byExperience.find((l) => l.level === EXPERIENCE_LEVEL[key]);
    return stat && stat.count > 0 && stat.median > 0 ? [{ key, median: stat.median }] : [];
  });
  let experience = s.experienceFallback;
  if (levels.length >= 2) {
    const base = levels[0];
    const top = levels[levels.length - 1];
    const ratio = top.median / base.median;
    if (ratio >= MIN_RATIO) experience = s.experienceText(t.salaries.levels[top.key].label, t.salaries.levels[base.key].label, diff(ratio));
  }

  // byRegion/byCategory serverda mediana bo'yicha kamayish tartibida keladi
  const regions = stats.byRegion.filter((r) => r.count >= MIN_GROUP && r.median > 0);
  let region = s.regionFallback;
  if (regions.length >= 2) {
    const top = regions[0];
    const bottom = regions[regions.length - 1];
    const ratio = top.median / bottom.median;
    if (ratio >= MIN_RATIO) region = s.regionText(top.name, bottom.name, diff(ratio));
  }

  const industries = stats.byCategory.filter((c) => c.count >= MIN_GROUP && c.median > 0);
  const industry =
    industries.length >= 2 ? s.industryText(industries[0].name, `${formatNumber(industries[0].median)} ${t.fmt.currency}`) : s.industryFallback;

  const items = [
    { key: "experience", tone: "growth" as const, icon: <IconCap size={22} />, title: s.experienceTitle, text: experience },
    { key: "region", tone: "signal" as const, icon: <IconPin size={22} />, title: s.regionTitle, text: region },
    { key: "industry", tone: "violet" as const, icon: <IconBuilding size={22} />, title: s.industryTitle, text: industry },
  ];

  return (
    <SalaryPanel id="salary-insights-title" title={s.title} subtitle={s.subtitle}>
      <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        {items.map((item) => (
          <li key={item.key} className="flex gap-4 rounded-2xl border border-line bg-surface-2/40 p-4 sm:p-5">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${TONES[item.tone]}`}>{item.icon}</span>
            <div className="min-w-0">
              <h3 className="font-display text-[15px] font-bold text-ink">{item.title}</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-dusk">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </SalaryPanel>
  );
});
