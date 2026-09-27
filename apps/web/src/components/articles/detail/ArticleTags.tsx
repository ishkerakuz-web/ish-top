import React, { useId } from "react";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { IconTag } from "../icons.js";
import { SIDE_CARD, SIDE_TITLE } from "./styles.js";

/** Teglar — bosilganda shu teg bo'yicha qidiruv. Teg yo'q bo'lsa bo'lim chizilmaydi. */
export function ArticleTags({ tags, linkable = true }: { tags: string[]; linkable?: boolean }) {
  const d = useT().articles.detail;
  const l = useHref();
  const headingId = useId();
  if (tags.length === 0) return null;

  const chip = "inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-ink";
  return (
    <section aria-labelledby={headingId} className={SIDE_CARD} data-testid="article-tags">
      <h2 id={headingId} className={SIDE_TITLE}>
        <IconTag size={16} className="text-dusk" />
        {d.tags}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li key={tag}>
            {linkable ? (
              <a
                href={l(`/articles?q=${encodeURIComponent(tag)}`)}
                aria-label={d.tagSearch(tag)}
                className={`${chip} transition-colors hover:border-signal/40 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal`}
              >
                <span aria-hidden className="text-dusk">
                  #
                </span>
                {tag}
              </a>
            ) : (
              <span className={chip}>
                <span aria-hidden className="text-dusk">
                  #
                </span>
                {tag}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
