import React from "react";
import { useT } from "../../../lib/i18n/index.js";
import type { TocItem } from "../../../lib/articles/content.js";
import { IconToc } from "../icons.js";
import { SIDE_CARD, SIDE_TITLE } from "./styles.js";

function TocList({ items }: { items: TocItem[] }) {
  return (
    <ol className="space-y-0.5">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="flex gap-2.5 rounded-lg px-2 py-1.5 text-[14px] leading-snug text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <span aria-hidden className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-dusk/60" />
            <span className="min-w-0">{item.text}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * Mundarija — faqat uzun maqolada (kamida 3 ta H2). Desktop'da yon panel
 * kartasi, kichik ekranda matn oldidan yig'iladigan blok.
 */
export function ArticleToc({ items, variant }: { items: TocItem[]; variant: "card" | "inline" }) {
  const d = useT().articles.detail;
  if (variant === "inline") {
    return (
      <details className="group mt-6 rounded-2xl border border-line bg-surface px-4 py-3 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[14.5px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <IconToc size={17} className="text-dusk" />
          {d.toc}
          <span aria-hidden className="ml-auto text-dusk transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <nav aria-label={d.toc} className="mt-2">
          <TocList items={items} />
        </nav>
      </details>
    );
  }
  return (
    <nav aria-label={d.toc} className={`${SIDE_CARD} hidden lg:block`}>
      <p className={SIDE_TITLE}>
        <IconToc size={17} className="text-dusk" />
        {d.toc}
      </p>
      <div className="mt-3">
        <TocList items={items} />
      </div>
    </nav>
  );
}
