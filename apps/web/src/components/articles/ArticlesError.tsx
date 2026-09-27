import React from "react";
import { useT } from "../../lib/i18n/index.js";
import { ArticleStatePanel, PRIMARY_BUTTON } from "./ArticleStatePanel.js";
import { IconAlert, IconRefresh, Spinner } from "./icons.js";

/** API xatosi — "Maqolalarni yuklab bo'lmadi." + haqiqiy qayta so'rov. Bo'sh holat bilan aralashmaydi. */
export function ArticlesError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const e = useT().articles.error;
  return (
    <ArticleStatePanel testId="articles-error" role="alert" tone="danger" icon={<IconAlert size={26} />} title={e.title} text={e.text}>
      <button type="button" onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined} className={PRIMARY_BUTTON}>
        {retrying ? <Spinner size={16} /> : <IconRefresh size={16} />}
        {e.retry}
      </button>
    </ArticleStatePanel>
  );
}
