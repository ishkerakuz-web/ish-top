import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Company } from "../../lib/types.js";
import { useT, useHref } from "../../lib/i18n/index.js";
import { CompanyLogo } from "./CompanyLogo.js";
import { FeaturedSkeleton } from "./CompanySkeleton.js";
import { IconChevronLeft, IconChevronRight, IconStar, IconVerified } from "./icons.js";

/**
 * "Top kompaniyalar" — tasdiqlangan va hozir ishga olayotgan kompaniyalar,
 * mashhurlik bo'yicha. Gorizontal lenta: sichqoncha bilan strelkalar,
 * sensorli ekranda surish (scroll-snap). Ro'yxat bo'sh bo'lsa blok chiqmaydi.
 */
export function FeaturedCompanies({ items }: { items: Company[] | null }) {
  const t = useT();
  const l = useHref();
  const f = t.companiesPage.featured;
  const railRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setEdges({
      start: rail.scrollLeft <= 4,
      end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    measure();
    rail.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      rail.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure, items]);

  if (items && items.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: dir * Math.max(240, rail.clientWidth * 0.8), behavior: "smooth" });
  };

  const arrow = "flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-ink transition-colors hover:border-signal hover:text-signal disabled:cursor-default disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink";

  return (
    <section aria-labelledby="featured-companies-title" className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id="featured-companies-title" className="flex items-center gap-2 font-display text-xl font-bold text-ink">
            <IconStar size={20} className="text-gold" />
            {f.title}
          </h2>
          <p className="mt-0.5 text-sm text-dusk">{f.subtitle}</p>
        </div>
        {items && (
          <div className="hidden shrink-0 gap-2 sm:flex">
            <button type="button" className={arrow} onClick={() => scrollBy(-1)} disabled={edges.start} aria-label={f.prev}>
              <IconChevronLeft size={18} />
            </button>
            <button type="button" className={arrow} onClick={() => scrollBy(1)} disabled={edges.end} aria-label={f.next}>
              <IconChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {items === null ? (
        <FeaturedSkeleton />
      ) : (
        // `relative` SHART: ichidagi `sr-only` (absolute) matnlar aks holda lenta
        // qirqimidan chiqib, butun sahifani gorizontal kengaytirardi
        <ul ref={railRef} className="scrollbar-none relative -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {items.map((company) => (
            <li key={company.id} className="w-[236px] shrink-0 snap-start">
              <a
                href={l(`/companies/${company.slug}`)}
                className="group flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                <CompanyLogo name={company.name} src={company.logoUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate font-display text-[14.5px] font-bold text-ink group-hover:text-signal">{company.name}</span>
                    {company.isVerified && (
                      <span className="shrink-0 text-signal">
                        <IconVerified size={15} />
                        <span className="sr-only">{t.company.verified}</span>
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[12.5px] text-dusk">
                    <span className="font-medium text-growth">{t.companiesPage.card.vacancies(company.activeVacancyCount)}</span>
                    {company.reviewCount > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <IconStar size={12} className="text-gold" />
                        {company.rating.toFixed(1)}
                      </span>
                    )}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
