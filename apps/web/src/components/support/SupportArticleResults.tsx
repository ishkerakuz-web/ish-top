import React, { useId } from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import type { ArticleMatchesState } from "../../lib/support/hooks.js";
import { SupportErrorState } from "./SupportErrorState.js";
import { SupportSkeleton } from "./SupportSkeleton.js";
import { IconArrowRight, IconArticle } from "./icons.js";

/**
 * Qidiruvda mavzuga oid maqolalar (mavjud maqolalar API'si). Qidiruv yo'q yoki
 * mos maqola topilmasa — bo'lim chizilmaydi; yuklanishda skelet, xatoda qayta urinish.
 */
export function SupportArticleResults({ q, state, onRetry }: { q: string; state: ArticleMatchesState; onRetry: () => void }) {
  const t = useT();
  const s = t.support;
  const l = useHref();
  const headingId = useId();

  if (state.status === "idle") return null;
  if (state.status === "error") {
    return (
      <div className="mt-10">
        <SupportErrorState onRetry={onRetry} />
      </div>
    );
  }
  if (state.status === "loading") {
    return (
      <section className="mt-10" aria-busy="true">
        <span role="status" className="sr-only">
          {s.searchingArticles}
        </span>
        <SupportSkeleton />
      </section>
    );
  }
  if (state.items.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="mt-10" data-testid="support-articles">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="font-display text-xl font-bold tracking-tight text-ink">
          {s.articlesTitle}
        </h2>
        {state.total > state.items.length && (
          <a
            href={l(`/articles?q=${encodeURIComponent(q)}`)}
            className="group inline-flex items-center gap-1 rounded-md text-[13.5px] font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-indigo-300"
          >
            {s.articlesAll}
            <IconArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        )}
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state.items.map((article) => (
          <li key={article.slug}>
            <a
              href={l(`/articles/${article.slug}`)}
              className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-signal dark:text-indigo-300">
                <IconArticle size={15} />
                {t.articles.breadcrumb}
              </span>
              <span className="mt-2 line-clamp-2 font-display text-[15px] font-bold leading-snug text-ink transition-colors group-hover:text-signal">{article.title}</span>
              {article.excerpt && <span className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-dusk">{article.excerpt}</span>}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
