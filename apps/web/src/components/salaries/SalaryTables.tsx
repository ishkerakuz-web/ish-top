import React, { memo, useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import { formatNumber } from "../../lib/format.js";
import type { SalaryGroup } from "../../lib/types.js";
import { SalaryPanel } from "./SalaryPanel.js";
import { IconArrowRight } from "./icons.js";

const LIMIT = 10;

type TableProps = {
  rows: SalaryGroup[];
  /** Tanlangan slug (bo'lsa qator ajratiladi). */
  selected: string;
  /** Qator bosilsa filtr qo'llanadi; tanlangani qayta bosilsa — olib tashlanadi (""). */
  onSelect: (slug: string) => void;
};

/** Kasblar (kategoriyalar) bo'yicha — hudud va tajriba filtri bilan, kategoriya filtrisiz. */
export const SalaryTable = memo(function SalaryTable(props: TableProps) {
  const s = useT().salaries.tables;
  return <SalaryGroupTable id="salary-by-category-title" title={s.byCategory} nameLabel={s.colName} {...props} />;
});

/** Hududlar bo'yicha — kasb va tajriba filtri bilan, hudud filtrisiz. */
export const RegionSalaryTable = memo(function RegionSalaryTable(props: TableProps) {
  const s = useT().salaries.tables;
  return <SalaryGroupTable id="salary-by-region-title" title={s.byRegion} nameLabel={s.colRegion} {...props} />;
});

function SalaryGroupTable({
  id,
  title,
  nameLabel,
  rows,
  selected,
  onSelect,
}: TableProps & { id: string; title: string; nameLabel: string }) {
  const s = useT().salaries.tables;
  const [expanded, setExpanded] = useState(false);

  let visible = expanded ? rows : rows.slice(0, LIMIT);
  // Tanlangan qator qisqartirilgan ro'yxatda yashirinib qolmasin
  const selectedIndex = rows.findIndex((r) => r.slug === selected);
  if (!expanded && selectedIndex >= LIMIT) visible = [...rows.slice(0, LIMIT - 1), rows[selectedIndex]];

  return (
    <SalaryPanel
      id={id}
      title={title}
      action={
        rows.length > LIMIT ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md pt-1 text-[13px] font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {expanded ? s.showLess : s.showAll(rows.length)}
            <IconArrowRight size={14} className={expanded ? "-rotate-90" : ""} />
          </button>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-dusk">{s.empty}</p>
      ) : (
        <div className="-mx-2 mt-4 overflow-x-auto">
          {/* Telefonda: o'rtacha ustuni yashirin, yacheykalar zichroq — asosiy ustunlar aylantirmasdan sig'adi */}
          <table className="w-full border-separate border-spacing-0 text-[13px] sm:text-[13.5px]">
            <thead>
              <tr className="text-left text-[12px] text-dusk sm:text-[12.5px]">
                <th scope="col" className="w-7 px-1.5 pb-2.5 font-medium sm:w-8 sm:px-2">
                  #
                </th>
                <th scope="col" className="px-1.5 pb-2.5 font-medium sm:px-2">
                  {nameLabel}
                </th>
                <th scope="col" className="px-1.5 pb-2.5 text-right font-medium sm:px-2">
                  {s.colMedian}
                </th>
                <th scope="col" className="hidden px-2 pb-2.5 text-right font-medium sm:table-cell">
                  {s.colAverage}
                </th>
                <th scope="col" className="px-1.5 pb-2.5 text-right font-medium sm:px-2">
                  {s.colCount}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const on = row.slug === selected;
                const cell = `border-t border-line px-1.5 py-2.5 sm:px-2 ${on ? "bg-signal-soft" : "group-hover:bg-surface-2/70"}`;
                return (
                  <tr key={row.slug} aria-current={on ? "true" : undefined} className="group">
                    <td className={`${cell} tabular-nums text-dusk`}>{rows.indexOf(row) + 1}</td>
                    <td className={cell}>
                      <button
                        type="button"
                        aria-pressed={on}
                        title={on ? s.unselect(row.name) : s.select(row.name)}
                        onClick={() => onSelect(on ? "" : row.slug)}
                        className={`rounded text-left font-medium transition-colors hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
                          on ? "text-signal" : "text-ink"
                        }`}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td className={`${cell} whitespace-nowrap text-right font-mono text-[12px] font-semibold tabular-nums text-growth sm:text-[13px]`}>
                      {formatNumber(row.median)}
                    </td>
                    <td className={`${cell} hidden whitespace-nowrap text-right font-mono text-[13px] tabular-nums text-dusk sm:table-cell`}>
                      {formatNumber(row.average)}
                    </td>
                    <td className={`${cell} text-right tabular-nums text-ink/80`}>{row.count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SalaryPanel>
  );
}
