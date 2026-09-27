import React from "react";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { ArticleStatePanel, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../ArticleStatePanel.js";
import { IconAlert, IconArrowRight, IconArticle, IconRefresh, Spinner } from "../icons.js";

/** API xatosi — "Maqolani yuklab bo'lmadi." + haqiqiy qayta so'rov. */
export function ArticleError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const e = useT().articles.detail.error;
  const l = useHref();
  return (
    <div className="mt-6">
      <ArticleStatePanel testId="article-error" role="alert" tone="danger" headingLevel={1} icon={<IconAlert size={26} />} title={e.title} text={e.text}>
        <button type="button" onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined} className={PRIMARY_BUTTON}>
          {retrying ? <Spinner size={16} /> : <IconRefresh size={16} />}
          {e.retry}
        </button>
        <a href={l("/articles")} className={SECONDARY_BUTTON}>
          {e.back}
        </a>
      </ArticleStatePanel>
    </div>
  );
}

/** Maqola yo'q, chop etilmagan yoki arxivda (404). Server 404 holatida `_error` sahifasi ham shuni chizadi. */
export function ArticleNotFound() {
  const n = useT().articles.detail.notFound;
  const l = useHref();
  return (
    <div className="mt-6">
      <ArticleStatePanel testId="article-not-found" headingLevel={1} icon={<IconArticle size={26} />} title={n.title} text={n.text}>
        <a href={l("/articles")} className={PRIMARY_BUTTON}>
          {n.back}
          <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </a>
      </ArticleStatePanel>
    </div>
  );
}
