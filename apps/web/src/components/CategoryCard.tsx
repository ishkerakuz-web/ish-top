import React from "react";
import { useT, useHref } from "../lib/i18n/index.js";

export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  it: <path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13 7l-2 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  savdo: <path d="M5 7h14l-1 11a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7zM9 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  marketing: <path d="M3 11l16-6v14L3 13v-2zM3 11v4M9 13v4a2 2 0 004 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  moliya: <path d="M12 3v18M16 7H10a2.5 2.5 0 000 5h4a2.5 2.5 0 010 5H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  qurilish: <path d="M3 21h18M5 21V8l7-4 7 4v13M10 21v-5h4v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  turizm: <path d="M12 3a6 6 0 016 6c0 4-6 12-6 12S6 13 6 9a6 6 0 016-6zM12 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
};

export function CategoryCard({
  name,
  slug,
  count,
  index = 0,
}: {
  name: string;
  slug: string;
  /** Haqiqiy son yuklanmagan bo'lsa — qator chizilmaydi (taxminiy raqam ko'rsatilmaydi). */
  count?: number | null;
  index?: number;
}) {
  const t = useT();
  const l = useHref();
  return (
    <a
      href={l(`/vacancies?category=${slug}`)}
      style={{ animationDelay: `${Math.min(index * 50, 250)}ms` }}
      className="group flex animate-fade-up flex-col rounded-2xl border border-line bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-card-hover"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-ink ring-1 ring-line transition-colors group-hover:text-signal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            {CATEGORY_ICONS[slug] ?? CATEGORY_ICONS.it}
          </svg>
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full text-dusk transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <p className="mt-4 font-display text-[15px] font-semibold leading-snug text-ink transition-colors group-hover:text-signal">
        {name}
      </p>
      {typeof count === "number" && (
        <span className="mt-1 font-mono text-[13px] tabular-nums text-dusk">{t.fmt.vacanciesCount(count)}</span>
      )}
    </a>
  );
}
