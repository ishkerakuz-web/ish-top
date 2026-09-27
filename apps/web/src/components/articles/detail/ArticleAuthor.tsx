import React, { useState } from "react";
import { useT } from "../../../lib/i18n/index.js";
import type { ArticleAuthorVM } from "../../../lib/articles/adapter.js";

/**
 * Minimal muallif belgisi: avatar (bo'lmasa yoki yuklanmasa — bosh harflar),
 * ism va lavozim (bo'lsa). Jamoa a'zosining ochiq profili yo'q — havola ham yo'q.
 */
export function ArticleAuthor({ author, size = "md" }: { author: ArticleAuthorVM; size?: "sm" | "md" }) {
  const d = useT().articles.detail;
  const [avatarOk, setAvatarOk] = useState(true);
  const box = size === "sm" ? "h-9 w-9 text-[12px]" : "h-11 w-11 text-[14px]";

  return (
    <div className="flex min-w-0 items-center gap-3" data-testid="article-author">
      {author.avatarUrl && avatarOk ? (
        <img src={author.avatarUrl} alt="" width={44} height={44} loading="lazy" onError={() => setAvatarOk(false)} className={`${box} shrink-0 rounded-full object-cover`} />
      ) : (
        <span aria-hidden className={`${box} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-signal to-violet-500 font-display font-bold text-white`}>
          {author.initials}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[14.5px] font-semibold text-ink">
          <span className="sr-only">{d.by}: </span>
          {author.name}
        </p>
        {author.position && <p className="truncate text-[13px] text-dusk">{author.position}</p>}
      </div>
    </div>
  );
}
