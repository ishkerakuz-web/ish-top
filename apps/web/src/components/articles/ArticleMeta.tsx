import React from "react";
import { useLocale, useT } from "../../lib/i18n/index.js";
import { formatDate } from "../../lib/format.js";
import type { ArticleCategory } from "../../lib/articles/categories.js";
import type { ArticleCardVM } from "../../lib/articles/adapter.js";
import { IconCalendar, IconClock } from "./icons.js";

/** Kategoriya rangi — ikkala mavzuda AA kontrast (kichik qalin matn). */
const CATEGORY_TONE: Record<ArticleCategory, string> = {
  career: "bg-signal-soft text-signal dark:text-indigo-300",
  resume: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  interview: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  salary: "bg-growth/10 text-growth",
  job_search: "bg-amber-100 text-amber-800 dark:bg-gold/15 dark:text-gold-deep",
  tips: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
};

export function CategoryBadge({ category, href, className = "" }: { category: ArticleCategory; href?: string; className?: string }) {
  const label = useT().articles.categories[category];
  const cls = `inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none ${CATEGORY_TONE[category]} ${className}`;
  return href ? (
    <a href={href} className={`${cls} transition-opacity hover:opacity-80`}>
      {label}
    </a>
  ) : (
    <span className={cls}>{label}</span>
  );
}

/**
 * Kategoriya · sana · o'qish vaqti. Har biri faqat mavjud bo'lsa chiziladi;
 * hech biri bo'lmasa qator umuman yo'q (bo'sh joy qolmaydi).
 */
export function ArticleMeta({
  article,
  showCategory = true,
  categoryHref,
  className = "",
}: {
  article: Pick<ArticleCardVM, "category" | "publishedAt" | "readingMinutes">;
  showCategory?: boolean;
  categoryHref?: string;
  className?: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const hasCategory = showCategory && article.category !== null;
  if (!hasCategory && !article.publishedAt && !article.readingMinutes) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-dusk ${className}`}>
      {hasCategory && <CategoryBadge category={article.category!} href={categoryHref} />}
      {article.publishedAt && (
        <time dateTime={article.publishedAt} className="inline-flex items-center gap-1.5 tabular-nums">
          <IconCalendar size={14} />
          {formatDate(article.publishedAt, locale)}
        </time>
      )}
      {article.readingMinutes && (
        <span className="inline-flex items-center gap-1.5">
          <IconClock size={14} />
          {t.articles.readMinutes(article.readingMinutes)}
        </span>
      )}
    </div>
  );
}
