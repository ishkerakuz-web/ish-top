import React, { useId } from "react";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { formatDate } from "../../../lib/format.js";
import type { ArticleCardVM } from "../../../lib/articles/adapter.js";
import { SIDE_CARD, SIDE_TITLE } from "./styles.js";

/** "Mavzuga oid" — backend kategoriya va teglar bo'yicha tanlagan 3–4 maqola. 0 bo'lsa chizilmaydi. */
export function RelatedArticles({ articles }: { articles: ArticleCardVM[] }) {
  const t = useT();
  const l = useHref();
  const { locale } = useLocale();
  const headingId = useId();
  if (articles.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={SIDE_CARD} data-testid="related-articles">
      <h2 id={headingId} className={SIDE_TITLE}>
        {t.articles.detail.related}
      </h2>
      <ul className="mt-3 divide-y divide-line">
        {articles.map((article) => {
          const meta = [article.publishedAt ? formatDate(article.publishedAt, locale) : null, article.readingMinutes ? t.articles.readMinutes(article.readingMinutes) : null].filter(Boolean);
          return (
            <li key={article.id} className="py-3 first:pt-1 last:pb-0">
              <a href={l(`/articles/${article.slug}`)} className="group flex gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                {article.hasCover && (
                  <img src={article.coverUrl!} alt="" width={80} height={56} loading="lazy" decoding="async" className="h-14 w-20 shrink-0 rounded-xl object-cover" />
                )}
                <span className="min-w-0">
                  <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-ink transition-colors group-hover:text-signal">{article.title}</span>
                  {meta.length > 0 && <span className="mt-1 block text-[12.5px] text-dusk">{meta.join(" · ")}</span>}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
