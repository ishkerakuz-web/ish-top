import React from "react";
import { useT } from "../../../lib/i18n/index.js";
import type { ArticleStatus } from "../../../lib/admin/articles.js";

const TONE: Record<ArticleStatus, { badge: string; dot: string }> = {
  draft: { badge: "bg-surface-2 text-dusk", dot: "bg-dusk" },
  in_review: { badge: "bg-amber-100 text-amber-800 dark:bg-gold/15 dark:text-gold-deep", dot: "bg-gold" },
  published: { badge: "bg-growth/10 text-growth", dot: "bg-growth" },
  archived: { badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", dot: "bg-violet-500" },
};

/** Maqola holati belgisi: Qoralama / Ko'rib chiqilmoqda / Chop etilgan / Arxivda. */
export function AdminArticleStatus({ status, className = "" }: { status: ArticleStatus; className?: string }) {
  const label = useT().contentAdmin.articles.status[status];
  const tone = TONE[status];
  return (
    <span data-status={status} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${tone.badge} ${className}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {label}
    </span>
  );
}
