import React from "react";
import { useT } from "../../lib/i18n/index.js";
import { ArticleStatePanel, SECONDARY_BUTTON } from "./ArticleStatePanel.js";
import { IconArticle, IconSearch } from "./icons.js";

/** Saytda chop etilgan maqola umuman yo'q. */
export function ArticlesEmpty() {
  const e = useT().articles.empty;
  return <ArticleStatePanel testId="articles-empty" icon={<IconArticle size={26} />} title={e.title} text={e.text} />;
}

/** Qidiruv yoki kategoriya bo'yicha natija yo'q. */
export function ArticlesNoResults({ onReset }: { onReset: () => void }) {
  const n = useT().articles.noResults;
  return (
    <ArticleStatePanel testId="articles-no-results" icon={<IconSearch size={26} />} title={n.title} text={n.text}>
      <button type="button" onClick={onReset} className={SECONDARY_BUTTON}>
        {n.reset}
      </button>
    </ArticleStatePanel>
  );
}
