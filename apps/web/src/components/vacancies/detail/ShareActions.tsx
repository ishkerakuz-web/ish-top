import React, { useEffect, useState } from "react";
import { useLocale, useT } from "../../../lib/i18n/index.js";
import { SITE_ORIGIN, localizeHref } from "../../../lib/i18n/config.js";
import { VacancyActions } from "./VacancyActions.js";
import { IconFacebook, IconFlag, IconLink, IconLinkedIn, IconTelegram, IconXBrand } from "./icons.js";

const ROUND =
  "flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-dusk transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

/**
 * Tavsif oxiridagi qator: tarmoqlarga ulashish havolalari, havolani nusxalash,
 * saqlash/ulashish va "Noto'g'ri ma'lumot?" (shikoyat oynasi).
 * Havola serverda kanonik manzildan, brauzerda joriy manzildan olinadi.
 */
export function ShareActions({
  title,
  path,
  saved,
  onToggleSave,
  onShare,
  onCopy,
  onReport,
}: {
  title: string;
  path: string;
  saved: boolean;
  onToggleSave?: () => void;
  onShare: () => void;
  onCopy: (url: string) => void;
  onReport: () => void;
}) {
  const t = useT();
  const s = t.vacancyDetail.share;
  const { locale } = useLocale();
  const [url, setUrl] = useState(() => `${SITE_ORIGIN}${localizeHref(path, locale)}`);
  useEffect(() => setUrl(`${window.location.origin}${window.location.pathname}`), []);

  const u = encodeURIComponent(url);
  const text = encodeURIComponent(title);
  const networks = [
    { key: "telegram", label: s.telegram, href: `https://t.me/share/url?url=${u}&text=${text}`, icon: <IconTelegram size={17} />, hover: "hover:border-[#229ED9] hover:bg-[#229ED9] hover:text-white" },
    { key: "facebook", label: s.facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, icon: <IconFacebook size={17} />, hover: "hover:border-[#1877F2] hover:bg-[#1877F2] hover:text-white" },
    { key: "linkedin", label: s.linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, icon: <IconLinkedIn size={16} />, hover: "hover:border-[#0A66C2] hover:bg-[#0A66C2] hover:text-white" },
    { key: "x", label: s.x, href: `https://twitter.com/intent/tweet?url=${u}&text=${text}`, icon: <IconXBrand size={15} />, hover: "hover:border-ink hover:bg-ink hover:text-paper" },
  ];

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div role="group" aria-label={s.label} className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="mr-1 text-[13.5px] font-semibold text-ink/80">
          {s.label}:
        </span>
        {networks.map((n) => (
          <a key={n.key} href={n.href} target="_blank" rel="noopener noreferrer" aria-label={n.label} title={n.label} className={`${ROUND} ${n.hover}`}>
            {n.icon}
          </a>
        ))}
        <button type="button" onClick={() => onCopy(url)} aria-label={s.copy} title={s.copy} className={`${ROUND} hover:border-signal/40 hover:text-signal`}>
          <IconLink size={17} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <VacancyActions saved={saved} onToggleSave={onToggleSave} onShare={onShare} />
        <button
          type="button"
          onClick={onReport}
          className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-[13px] font-medium text-dusk transition-colors hover:text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          <IconFlag size={15} />
          {t.vacancyDetail.report.link}
        </button>
      </div>
    </div>
  );
}
