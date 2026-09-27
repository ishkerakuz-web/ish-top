import React from "react";
import { useT } from "../../lib/i18n/index.js";
import type { ArticleCategory } from "../../lib/articles/categories.js";

/**
 * Kategoriya chiplari — faqat maqolasi bor (haqiqiy) kategoriyalar, sonlari
 * bilan. Chiplar haqiqiy havolalar (qidiruv tizimi ko'radi, yangi tabda ochiladi);
 * oddiy bosishda sahifa qayta yuklanmaydi. Telefonda gorizontal aylanadi.
 */
export function ArticleCategories({
  categories,
  active,
  total,
  hrefFor,
  onSelect,
}: {
  categories: { key: ArticleCategory; count: number }[];
  active: ArticleCategory | null;
  total: number;
  hrefFor: (category: ArticleCategory | null) => string;
  onSelect: (category: ArticleCategory | null) => void;
}) {
  const a = useT().articles;
  const chips: { key: ArticleCategory | null; label: string; count: number | null }[] = [
    { key: null, label: a.all, count: total > 0 ? total : null },
    ...categories.map((c) => ({ key: c.key, label: a.categories[c.key], count: c.count })),
  ];
  // URL'dagi kategoriyada hozircha maqola yo'q — tanlov baribir ko'rinib tursin
  if (active && !categories.some((c) => c.key === active)) chips.push({ key: active, label: a.categories[active], count: null });

  return (
    <nav aria-label={a.categoriesLabel}>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 py-0.5 scrollbar-none sm:flex-wrap sm:overflow-visible">
        {chips.map((chip) => {
          const current = chip.key === active;
          return (
            <li key={chip.key ?? "all"} className="shrink-0">
              <a
                href={hrefFor(chip.key)}
                aria-current={current ? "true" : undefined}
                data-category={chip.key ?? "all"}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  if (!current) onSelect(chip.key);
                }}
                className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                  current ? "border-signal bg-signal text-white shadow-xs" : "border-line bg-surface text-ink hover:border-signal/40 hover:text-signal"
                }`}
              >
                {chip.label}
                {chip.count !== null && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[11.5px] leading-none tabular-nums ${current ? "bg-white/20 text-white" : "bg-surface-2 text-dusk"}`}>
                    {chip.count}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
