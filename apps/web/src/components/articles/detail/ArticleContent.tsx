import React, { memo } from "react";
import { useHref, useT } from "../../../lib/i18n/index.js";
import type { ContentBlock, Inline } from "../../../lib/articles/content.js";
import { IconLightbulb } from "../icons.js";

const LINK =
  "font-medium text-signal underline decoration-signal/30 underline-offset-[3px] transition-colors hover:decoration-signal dark:text-indigo-300 dark:decoration-indigo-300/40";

/**
 * Maqola matni: parser bloklari (lib/articles/content.ts) React elementlariga
 * aylanadi — HTML sifatida hech narsa kiritilmaydi. O'qish uchun qulay kenglik
 * (~70 belgi), keng qator oralig'i, sarlavhalarning aniq iyerarxiyasi.
 */
export const ArticleContent = memo(function ArticleContent({ blocks, className = "" }: { blocks: ContentBlock[]; className?: string }) {
  const d = useT().articles.detail;
  const l = useHref();

  const inline = (nodes: Inline[]): React.ReactNode =>
    nodes.map((node, i) => {
      switch (node.kind) {
        case "text":
          return <React.Fragment key={i}>{node.text}</React.Fragment>;
        case "strong":
          return (
            <strong key={i} className="font-semibold text-ink">
              {inline(node.children)}
            </strong>
          );
        case "em":
          return <em key={i}>{inline(node.children)}</em>;
        case "link": {
          if (!node.external) {
            return (
              <a key={i} href={l(node.href)} className={LINK}>
                {inline(node.children)}
              </a>
            );
          }
          const web = /^https?:/i.test(node.href);
          return (
            <a key={i} href={node.href} className={LINK} {...(web ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>
              {inline(node.children)}
              {web && <span className="sr-only"> {d.newTab}</span>}
            </a>
          );
        }
      }
    });

  return (
    <div data-testid="article-content" className={`space-y-5 text-[17px] leading-[1.8] text-ink/85 ${className}`}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "p":
            return (
              <p key={i} className="[overflow-wrap:anywhere]">
                {inline(block.inlines)}
              </p>
            );
          case "h2":
            return (
              <h2 key={i} id={block.id} className="scroll-mt-28 pt-5 font-display text-[23px] font-bold leading-snug tracking-tight text-ink sm:text-[26px]">
                {inline(block.inlines)}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} id={block.id} className="scroll-mt-28 pt-2 font-display text-[19px] font-bold leading-snug text-ink">
                {inline(block.inlines)}
              </h3>
            );
          case "ul":
            return (
              <ul key={i} className="space-y-2.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-3">
                    <span aria-hidden className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-signal dark:bg-indigo-300" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{inline(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-2.5 pl-6 marker:font-semibold marker:text-signal dark:marker:text-indigo-300">
                {block.items.map((item, j) => (
                  <li key={j} className="pl-1.5 [overflow-wrap:anywhere]">
                    {inline(item)}
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote key={i} className="space-y-3 rounded-r-2xl border-l-4 border-signal bg-signal-soft/70 px-5 py-4 text-[16.5px] italic text-ink/90 dark:border-indigo-400">
                {block.paragraphs.map((p, j) => (
                  <p key={j}>{inline(p)}</p>
                ))}
              </blockquote>
            );
          case "tip":
            return (
              <aside key={i} role="note" aria-label={d.tip} className="flex gap-3.5 rounded-2xl border border-gold/35 bg-gold/10 px-4 py-4 sm:px-5 dark:bg-gold/[0.07]">
                <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-amber-700 dark:text-gold">
                  <IconLightbulb size={19} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-amber-800 dark:text-gold-deep">{d.tip}</p>
                  <div className="mt-1 space-y-2 text-[16px] leading-relaxed text-ink/90">
                    {block.paragraphs.map((p, j) => (
                      <p key={j}>{inline(p)}</p>
                    ))}
                  </div>
                </div>
              </aside>
            );
          case "img":
            return (
              <figure key={i} className="py-1">
                {/* Tavsif figcaption'da — alt takrorlanmasin */}
                <img src={block.src} alt="" loading="lazy" decoding="async" className="w-full rounded-2xl border border-line object-cover" />
                {block.alt && <figcaption className="mt-2 text-center text-[13.5px] text-dusk">{block.alt}</figcaption>}
              </figure>
            );
          case "hr":
            return <hr key={i} className="!my-9 border-line" />;
        }
      })}
    </div>
  );
});
