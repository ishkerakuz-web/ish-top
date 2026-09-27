import React from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import { IconBookmarkFilled } from "./icons.js";

/**
 * Sarlavha: breadcrumb, h1, izoh va saqlanganlar soni. O'ngda (md+) kichik dekorativ
 * illyustratsiya — berilgan `rasm.png` dan shaffof qilib tayyorlangan `favorites-folder.webp`
 * (qayta chizilmagan, matn rasmga yopishtirilmagan, telefonda yashirin).
 */
export function FavoritesHeader({ count }: { count: number | null }) {
  const t = useT();
  const f = t.favoritesPage;
  const l = useHref();
  return (
    <header className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <nav aria-label={t.companyDetail.breadcrumb}>
          <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-dusk">
            <li>
              <a href={l("/")} className="transition-colors hover:text-ink">
                {t.search.breadcrumbHome}
              </a>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="font-medium text-ink">
              {f.breadcrumb}
            </li>
          </ol>
        </nav>
        <h1 className="mt-3 font-display text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[30px]">{f.title}</h1>
        <p className="mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-dusk">{f.subtitle}</p>
        {count !== null && (
          <p data-testid="favorites-count" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-signal-soft px-3 py-1 text-[12.5px] font-semibold text-signal">
            <IconBookmarkFilled size={13} />
            {f.count(count)}
          </p>
        )}
      </div>
      <img
        src="/favorites-folder.webp"
        alt=""
        width={352}
        height={220}
        decoding="async"
        className="pointer-events-none hidden w-[150px] shrink-0 select-none drop-shadow-[0_10px_18px_rgba(79,70,229,0.18)] md:block xl:w-[176px]"
      />
    </header>
  );
}
