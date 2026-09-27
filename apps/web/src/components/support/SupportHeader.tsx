import React from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import { SupportIllustration } from "./SupportIllustration.js";

/** Ixcham sarlavha: yo'l ko'rsatkichi, "Yordam markazi", tavsif, ostida qidiruv; o'ngda illyustratsiya. */
export function SupportHeader({ children }: { children?: React.ReactNode }) {
  const t = useT();
  const s = t.support;
  const l = useHref();
  return (
    <header className="flex items-start justify-between gap-8">
      <div className="min-w-0 flex-1">
        <nav aria-label={t.companyDetail.breadcrumb}>
          <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-dusk">
            <li>
              <a href={l("/")} className="transition-colors hover:text-ink">
                {t.search.breadcrumbHome}
              </a>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="font-medium text-ink">
              {s.breadcrumb}
            </li>
          </ol>
        </nav>
        <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{s.title}</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-dusk">{s.subtitle}</p>
        {children && <div className="mt-5 max-w-2xl">{children}</div>}
      </div>
      <SupportIllustration />
    </header>
  );
}
