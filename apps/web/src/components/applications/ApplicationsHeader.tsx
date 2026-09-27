import React from "react";
import { useHref, useT } from "../../lib/i18n/index.js";

/**
 * Dashboard sarlavhasi: breadcrumb + h1 + qisqa izoh. O'ngda (md+) kichik
 * dekorativ illyustratsiya — berilgan `card.png` dan tayyorlangan shaffof
 * `applications-cards.webp` (marketing banner emas, matn rasmga yopishtirilmagan).
 */
export function ApplicationsHeader() {
  const t = useT();
  const a = t.applicationsPage;
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
              {a.breadcrumb}
            </li>
          </ol>
        </nav>
        <h1 className="mt-3 font-display text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[30px]">{a.title}</h1>
        <p className="mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-dusk">{a.subtitle}</p>
      </div>
      <img
        src="/applications-cards.webp"
        alt=""
        width={352}
        height={220}
        decoding="async"
        className="pointer-events-none hidden w-[150px] shrink-0 select-none drop-shadow-[0_10px_18px_rgba(79,70,229,0.16)] md:block xl:w-[176px]"
      />
    </header>
  );
}
