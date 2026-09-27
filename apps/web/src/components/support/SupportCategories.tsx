import React, { useId } from "react";
import { useT } from "../../lib/i18n/index.js";
import type { SupportCategoryKey } from "../../lib/i18n/types.js";
import type { SupportCategoryVM } from "../../lib/support/faq.js";
import { SupportCategoryCard } from "./SupportCategoryCard.js";

// Kartalar soni kam bo'lsa desktop'da bo'sh katak qolmasin
const LG_COLUMNS: Record<number, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3" };

/** Kategoriyalar — faqat savoli bor kategoriyalar (bo'sh bo'lsa bo'lim umuman chizilmaydi). */
export function SupportCategories({
  categories,
  active,
  onSelect,
}: {
  categories: SupportCategoryVM[];
  active: SupportCategoryKey | null;
  onSelect: (key: SupportCategoryKey | null) => void;
}) {
  const s = useT().support;
  const headingId = useId();
  if (categories.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="mt-10" data-testid="support-categories">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={headingId} className="font-display text-xl font-bold tracking-tight text-ink">
            {s.categoriesTitle}
          </h2>
          <p className="mt-1 text-[14px] text-dusk">{s.categoriesSubtitle}</p>
        </div>
        {active && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="rounded-md text-[13.5px] font-semibold text-signal transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-indigo-300"
          >
            {s.showAll}
          </button>
        )}
      </div>
      <ul className={`mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 ${LG_COLUMNS[categories.length] ?? "lg:grid-cols-4"}`}>
        {categories.map((category) => (
          <li key={category.key}>
            <SupportCategoryCard category={category} active={active === category.key} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </section>
  );
}
