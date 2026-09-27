import React, { useState } from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import type { ArticleCardVM } from "../../lib/articles/adapter.js";
import { ArticleMeta } from "./ArticleMeta.js";
import { IconArrowRight } from "./icons.js";

/**
 * Birinchi sahifadagi eng tepadagi maqola — katta karta. Muqova bo'lsa: rasm +
 * matn yonma-yon (telefonda ustma-ust). Muqova yo'q bo'lsa: matnga asoslangan
 * keng karta (yumshoq indigo fon) — bo'sh rasm joyi qoldirilmaydi.
 */
export function ArticleFeatured({ article }: { article: ArticleCardVM }) {
  const t = useT();
  const a = t.articles;
  const l = useHref();
  const [coverOk, setCoverOk] = useState(true);
  const showCover = article.hasCover && coverOk;

  const body = (
    <>
      <p className="inline-flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-dusk">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
        {a.featured}
      </p>
      <ArticleMeta article={article} className="mt-3" />
      <h2
        className={`mt-3 font-display font-bold leading-tight tracking-tight text-ink transition-colors group-hover:text-signal ${
          showCover ? "text-[22px] sm:text-[26px] lg:text-[30px]" : "max-w-3xl text-[24px] sm:text-[30px] lg:text-[36px]"
        }`}
      >
        <a href={l(`/articles/${article.slug}`)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
          {article.title}
        </a>
      </h2>
      {article.excerpt && (
        <p className={`mt-3 text-[15px] leading-relaxed text-dusk ${showCover ? "line-clamp-3 lg:line-clamp-4" : "max-w-2xl line-clamp-4"}`}>
          {article.excerpt}
        </p>
      )}
      <span aria-hidden className="mt-6 inline-flex items-center gap-2 text-[14.5px] font-semibold text-signal dark:text-indigo-300">
        {a.readMore}
        <IconArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
      </span>
    </>
  );

  if (!showCover) {
    return (
      <article
        data-featured
        data-has-cover="false"
        className="group relative overflow-hidden rounded-3xl border border-signal/15 bg-gradient-to-br from-signal-soft via-surface to-surface p-6 shadow-card transition-all duration-200 focus-within:ring-2 focus-within:ring-signal/50 hover:border-signal/30 hover:shadow-card-hover sm:p-9 lg:p-11"
      >
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-signal/10 blur-3xl" />
        <div className="relative">{body}</div>
      </article>
    );
  }

  return (
    <article
      data-featured
      data-has-cover="true"
      className="group relative grid overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition-all duration-200 focus-within:ring-2 focus-within:ring-signal/50 hover:border-signal/30 hover:shadow-card-hover md:grid-cols-[1.12fr_1fr]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2 md:aspect-auto md:min-h-[300px] lg:min-h-[340px]">
        <img
          src={article.coverUrl!}
          alt=""
          width={880}
          height={550}
          decoding="async"
          onError={() => setCoverOk(false)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
        />
      </div>
      <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">{body}</div>
    </article>
  );
}
