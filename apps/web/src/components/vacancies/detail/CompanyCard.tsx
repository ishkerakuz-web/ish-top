import React, { useId } from "react";
import type { VacancyCompanyVM } from "../../../lib/vacancies/detail.js";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { regionName } from "../../../lib/i18n/regions.js";
import { CompanyLogo } from "../../companies/CompanyLogo.js";
import { CompanyGallery } from "./CompanyGallery.js";
import { IconArrowRight, IconCalendar, IconGlobe, IconPin, IconStar, IconUsers, IconVerified } from "./icons.js";

export function websiteHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Yon ustundagi kompaniya kartasi. Majburiy — faqat nom (logo bo'lmasa bosh
 * harfli belgi). Reyting, xodimlar, hudud, tashkil topgan yil, sayt, tavsif va
 * rasmlar — har biri bazada bo'lsagina; bo'sh qator yoki "—" chiqmaydi.
 */
export function CompanyCard({ company }: { company: VacancyCompanyVM }) {
  const t = useT();
  const d = t.vacancyDetail.company;
  const l = useHref();
  const { locale } = useLocale();
  const headingId = useId();
  const companyHref = l(`/companies/${company.slug}`);
  const region = company.regionSlug ? regionName(locale, company.regionSlug, company.regionName) : company.regionName;

  const facts: { key: string; icon: React.ReactNode; content: React.ReactNode }[] = [];
  if (company.employeeCount) facts.push({ key: "employees", icon: <IconUsers size={18} />, content: d.employees(company.employeeCount) });
  if (region) facts.push({ key: "region", icon: <IconPin size={18} />, content: region });
  if (company.foundedYear) facts.push({ key: "founded", icon: <IconCalendar size={18} />, content: d.founded(company.foundedYear) });
  if (company.website) {
    facts.push({
      key: "website",
      icon: <IconGlobe size={18} />,
      content: (
        <a href={company.website} target="_blank" rel="noopener noreferrer nofollow" className="text-signal hover:underline [overflow-wrap:anywhere]">
          {websiteHost(company.website)}
        </a>
      ),
    });
  }

  return (
    <section aria-labelledby={headingId} className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="font-display text-lg font-bold tracking-tight text-ink">
          {d.title}
        </h2>
        {company.activeVacancyCount > 1 && (
          <a
            href={l(`/vacancies?company=${encodeURIComponent(company.slug)}`)}
            className="group inline-flex shrink-0 items-center gap-1 rounded-md text-[13px] font-semibold text-signal hover:underline"
          >
            {d.vacancies(company.activeVacancyCount)}
            <IconArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3.5">
        <CompanyLogo name={company.name} src={company.logoUrl} size="lg" />
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5">
            <a href={companyHref} className="font-display text-[17px] font-bold leading-snug text-ink transition-colors hover:text-signal [overflow-wrap:anywhere]">
              {company.name}
            </a>
            {company.isVerified && (
              <span className="shrink-0 text-signal">
                <IconVerified size={17} />
                <span className="sr-only">{d.verified}</span>
              </span>
            )}
          </p>
          {company.industry && <p className="mt-0.5 text-[13.5px] text-dusk [overflow-wrap:anywhere]">{company.industry}</p>}
          {company.rating !== null && (
            <p className="mt-1 flex items-center gap-1.5 text-[13.5px]">
              <IconStar size={15} className="text-gold" />
              <span className="sr-only">{d.rating(company.rating.toFixed(1))}</span>
              <span aria-hidden className="font-bold text-ink">
                {company.rating.toFixed(1)}
              </span>
              <span className="text-dusk">({d.reviews(company.reviewCount)})</span>
            </p>
          )}
        </div>
      </div>

      {facts.length > 0 && (
        <ul className="mt-4 space-y-2.5 text-[14px] text-ink/80">
          {facts.map((fact) => (
            <li key={fact.key} className="flex items-start gap-2.5">
              <span className="mt-px shrink-0 text-dusk">{fact.icon}</span>
              <span className="min-w-0">{fact.content}</span>
            </li>
          ))}
        </ul>
      )}

      {company.description && (
        <p className="mt-4 line-clamp-4 whitespace-pre-line text-[14px] leading-relaxed text-ink/75">{company.description}</p>
      )}

      <a
        href={companyHref}
        className="group mt-5 flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[14px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        {d.view}
        <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </a>

      <CompanyGallery images={company.images} companyName={company.name} />
    </section>
  );
}
