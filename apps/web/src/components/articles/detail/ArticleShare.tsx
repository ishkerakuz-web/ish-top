import React from "react";
import { useLocale, useT } from "../../../lib/i18n/index.js";
import { SITE_ORIGIN, localizeHref } from "../../../lib/i18n/config.js";
import { useShare } from "../../../lib/useShare.js";
import { IconShare } from "../icons.js";

/**
 * Ulashish: qurilmada tizim oynasi bo'lsa (Web Share API) — o'sha, bo'lmasa havola
 * nusxalanadi va qisqa "Havola nusxalandi" xabari e'lon qilinadi.
 */
export function ArticleShare({ title, slug }: { title: string; slug: string }) {
  const d = useT().articles.detail;
  const { locale } = useLocale();
  const { share, notice } = useShare();

  const onShare = () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : `${SITE_ORIGIN}${localizeHref(`/articles/${slug}`, locale)}`;
    void share({ title, url });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={onShare}
        aria-label={d.shareLabel(title)}
        data-testid="article-share"
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        <IconShare size={16} />
        {d.share}
      </button>
      <span role="status" aria-live="polite" className={`text-[13px] font-medium ${notice === "failed" ? "text-danger" : "text-growth"}`}>
        {notice === "copied" ? d.copied : notice === "failed" ? d.copyFailed : ""}
      </span>
    </div>
  );
}
