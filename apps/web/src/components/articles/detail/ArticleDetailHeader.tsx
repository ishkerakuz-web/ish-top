import React from "react";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { formatDate } from "../../../lib/format.js";
import type { ArticleDetailVM } from "../../../lib/articles/adapter.js";
import { Skeleton } from "../../Skeleton.js";
import { CategoryBadge } from "../ArticleMeta.js";
import { IconCalendar, IconClock } from "../icons.js";
import { ArticleAuthor } from "./ArticleAuthor.js";
import { ArticleShare } from "./ArticleShare.js";

/** Bosh sahifa / Maqolalar / [sarlavha]. */
export function ArticleBreadcrumb({ title, loading }: { title: string | null; loading: boolean }) {
  const t = useT();
  const l = useHref();
  return (
    <nav aria-label={t.companyDetail.breadcrumb} className="text-[13.5px] text-dusk">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <a href={l("/")} className="rounded-sm transition-colors hover:text-signal">
            {t.search.breadcrumbHome}
          </a>
        </li>
        <li aria-hidden>/</li>
        <li>
          <a href={l("/articles")} className="rounded-sm transition-colors hover:text-signal">
            {t.articles.breadcrumb}
          </a>
        </li>
        {(title || loading) && <li aria-hidden>/</li>}
        {title && (
          <li aria-current="page" className="min-w-0 max-w-[14rem] truncate font-medium text-ink sm:max-w-md">
            {title}
          </li>
        )}
        {!title && loading && (
          <li aria-hidden>
            <Skeleton className="h-4 w-28" />
          </li>
        )}
      </ol>
    </nav>
  );
}

/**
 * Kategoriya, H1, qisqa tavsif, muallif · sana · o'qish vaqti va ulashish.
 * Har bir element faqat ma'lumot bo'lsa chiziladi; ko'rib chiqish (preview)
 * rejimida ulashish yo'q.
 */
export function ArticleDetailHeader({ article, preview }: { article: ArticleDetailVM; preview: boolean }) {
  const t = useT();
  const d = t.articles.detail;
  const l = useHref();
  const { locale } = useLocale();
  const hasMeta = article.hasAuthor || article.hasDate || article.hasReadingTime;

  return (
    <header>
      {article.category && (
        <CategoryBadge category={article.category} href={preview ? undefined : l(`/articles?category=${article.category}`)} />
      )}
      <h1 className="mt-4 font-display text-[28px] font-bold leading-[1.15] tracking-tight text-ink [overflow-wrap:anywhere] first:mt-0 sm:text-[36px] lg:text-[42px]">
        {article.title}
      </h1>
      {article.excerpt && <p className="mt-4 text-[17px] leading-relaxed text-dusk sm:text-[18.5px]">{article.excerpt}</p>}

      {(hasMeta || !preview) && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-line py-4">
          {hasMeta && (
            <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
              {article.author && <ArticleAuthor author={article.author} />}
              {(article.hasDate || article.hasReadingTime) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13.5px] text-dusk">
                  {article.publishedAt && (
                    <time dateTime={article.publishedAt} className="inline-flex items-center gap-1.5 tabular-nums">
                      <IconCalendar size={15} />
                      <span className="sr-only">{d.published}: </span>
                      {formatDate(article.publishedAt, locale)}
                    </time>
                  )}
                  {article.readingMinutes && (
                    <span className="inline-flex items-center gap-1.5">
                      <IconClock size={15} />
                      {t.articles.readMinutes(article.readingMinutes)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          {!preview && <ArticleShare title={article.title} slug={article.slug} />}
        </div>
      )}
    </header>
  );
}
