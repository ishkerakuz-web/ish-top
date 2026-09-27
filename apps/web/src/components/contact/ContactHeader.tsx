import React from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import { ContactIllustration } from "./ContactIllustration.js";

/** Ixcham sarlavha: yo'l ko'rsatkichi, "Biz bilan bog'laning", tavsif; o'ngda illyustratsiya. */
export function ContactHeader() {
  const t = useT();
  const c = t.contact;
  const l = useHref();
  return (
    <header className="flex items-center justify-between gap-8">
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
              {c.breadcrumb}
            </li>
          </ol>
        </nav>
        <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{c.title}</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-dusk">{c.subtitle}</p>
      </div>
      <ContactIllustration />
    </header>
  );
}
