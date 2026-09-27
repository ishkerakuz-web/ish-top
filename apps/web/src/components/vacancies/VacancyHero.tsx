import React from "react";
import { useT, useHref } from "../../lib/i18n/index.js";
import { VacancyPromoBanner } from "./VacancyPromoBanner.js";

/**
 * Sahifa boshi: breadcrumb, sarlavha, jonli natijalar soni; o'ngda (lg+)
 * portfelli banner; ostida — butun kenglikdagi qidiruv qatori (children).
 */
export function VacancyHero({ total, children }: { total: number | null; children: React.ReactNode }) {
  const t = useT();
  const l = useHref();

  return (
    <section className="relative pt-6 sm:pt-8">
      {/* juda yengil indigo dog' — sahifa "tekis oq" bo'lib qolmasin */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[min(1100px,100%)] -translate-x-1/2 rounded-full bg-signal/[0.07] blur-3xl"
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 self-center">
          <nav aria-label="Breadcrumb" className="text-sm text-dusk">
            <ol className="flex items-center gap-1.5">
              <li>
                <a href={l("/")} className="transition-colors hover:text-signal">
                  {t.search.breadcrumbHome}
                </a>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="font-medium text-ink">
                {t.search.breadcrumbVacancies}
              </li>
            </ol>
          </nav>
          <h1 className="mt-3 font-display text-[1.9rem] font-extrabold leading-[1.12] tracking-tight text-ink sm:text-[2.4rem] xl:text-[2.6rem]">
            {t.search.titleAll}
          </h1>
          <p className="mt-2 text-[15px] text-dusk sm:text-base">
            {t.vacanciesPage.subtitle}{" "}
            {total !== null && <span className="font-semibold text-ink/80">{t.search.found(total)}</span>}
          </p>
        </div>
        <VacancyPromoBanner />
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
