import React, { memo, useState } from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import type { ArticleCardVM } from "../../lib/articles/adapter.js";
import { ArticleMeta } from "./ArticleMeta.js";
import { IconArrowRight } from "./icons.js";

/**
 * Grid kartasi. Muqova bo'lmasa (yoki yuklanmasa) karta matnli bo'lib qoladi —
 * bo'sh rasm to'rtburchagi chizilmaydi. Butun karta bosiladi (sarlavha havolasi
 * kartani qoplaydi), fokus halqasi kartada ko'rinadi.
 */
export const ArticleCard = memo(function ArticleCard({ article }: { article: ArticleCardVM }) {
  const t = useT();
  const l = useHref();
  const [coverOk, setCoverOk] = useState(true);
  const showCover = article.hasCover && coverOk;

  return (
    <article
      data-article-card
      data-has-cover={showCover ? "true" : "false"}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition-all duration-200 focus-within:ring-2 focus-within:ring-signal/50 hover:-translate-y-0.5 hover:border-signal/30 hover:shadow-card-hover"
    >
      {showCover && (
        <div className="aspect-[16/10] overflow-hidden bg-surface-2">
          <img
            src={article.coverUrl!}
            alt=""
            width={440}
            height={275}
            loading="lazy"
            decoding="async"
            onError={() => setCoverOk(false)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <ArticleMeta article={article} />
        <h3 className="mt-3 font-display text-[17px] font-bold leading-snug tracking-tight text-ink transition-colors first:mt-0 group-hover:text-signal">
          <a href={l(`/articles/${article.slug}`)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {article.title}
          </a>
        </h3>
        {article.excerpt && (
          <p className={`mt-2 text-[14px] leading-relaxed text-dusk ${showCover ? "line-clamp-3" : "line-clamp-5"}`}>{article.excerpt}</p>
        )}
        <span aria-hidden className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[13.5px] font-semibold text-signal dark:text-indigo-300">
          {t.articles.readMore}
          <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
});
