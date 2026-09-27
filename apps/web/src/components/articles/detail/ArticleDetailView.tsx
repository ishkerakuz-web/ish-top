import React, { useMemo } from "react";
import { useHref, useT } from "../../../lib/i18n/index.js";
import type { ArticleCardVM, ArticleDetailVM } from "../../../lib/articles/adapter.js";
import { TOC_MIN_HEADINGS, parseArticleContent, tableOfContents } from "../../../lib/articles/content.js";
import { PRIMARY_BUTTON } from "../ArticleStatePanel.js";
import { IconArrowRight } from "../icons.js";
import { ArticleDetailHeader } from "./ArticleDetailHeader.js";
import { ArticleHero } from "./ArticleHero.js";
import { ArticleContent } from "./ArticleContent.js";
import { ArticleToc } from "./ArticleToc.js";
import { RelatedArticles } from "./RelatedArticles.js";
import { ArticleFeedback } from "./ArticleFeedback.js";
import { ArticleTags } from "./ArticleTags.js";

/**
 * Maqola sahifasi (va admin preview) — bir xil ko'rinish. Desktop: matn + yon
 * panel; telefon: avval maqola, keyin yon bo'limlar. Ma'lumoti yo'q bo'lim
 * (muqova, muallif, teglar, mavzuga oid) umuman chizilmaydi.
 *
 * `preview` — kontent jamoasi ko'rinishi: ulashish, ovoz berish, havolali teglar
 * va "Vakansiyalar" chaqiruvi yo'q (qoralama hali saytda emas).
 */
export function ArticleDetailView({
  article,
  related,
  preview = false,
}: {
  article: ArticleDetailVM;
  related: ArticleCardVM[];
  preview?: boolean;
}) {
  const t = useT();
  const cta = t.articles.detail.cta;
  const l = useHref();
  const blocks = useMemo(() => parseArticleContent(article.content), [article.content]);
  const toc = useMemo(() => tableOfContents(blocks), [blocks]);
  const longRead = toc.length >= TOC_MIN_HEADINGS;
  const hasAside = longRead || related.length > 0 || !preview || article.hasTags;

  return (
    <div className={`mt-5 grid gap-10 ${hasAside ? "lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_330px] xl:gap-14" : ""}`}>
      <article className="min-w-0 max-w-3xl" data-article-slug={article.slug}>
        <ArticleDetailHeader article={article} preview={preview} />
        {article.coverUrl && <ArticleHero key={article.coverUrl} src={article.coverUrl} />}
        {longRead && <ArticleToc items={toc} variant="inline" />}
        <ArticleContent blocks={blocks} className="mt-8" />

        {!preview && (
          <section className="mt-12 flex flex-col items-start gap-4 rounded-3xl border border-signal/15 bg-gradient-to-br from-signal-soft to-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="min-w-0">
              <h2 className="font-display text-[19px] font-bold text-ink">{cta.title}</h2>
              <p className="mt-1 text-[14.5px] text-dusk">{cta.text}</p>
            </div>
            <a href={l("/vacancies")} className={`${PRIMARY_BUTTON} shrink-0`}>
              {cta.action}
              <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </section>
        )}
      </article>

      {hasAside && (
        <aside className="min-w-0 space-y-5">
          {longRead && <ArticleToc items={toc} variant="card" />}
          <RelatedArticles articles={related} />
          {!preview && <ArticleFeedback slug={article.slug} />}
          <ArticleTags tags={article.tags} linkable={!preview} />
        </aside>
      )}
    </div>
  );
}
