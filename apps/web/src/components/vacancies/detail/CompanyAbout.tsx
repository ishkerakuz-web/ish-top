import React, { useId } from "react";
import type { VacancyCompanyVM } from "../../../lib/vacancies/detail.js";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { regionName } from "../../../lib/i18n/regions.js";
import { CompanyLogo } from "../../companies/CompanyLogo.js";
import { StarRating } from "../../StarRating.js";
import { websiteHost } from "./CompanyCard.js";
import { SECTION_TITLE } from "./VacancyDescription.js";
import { IconArrowRight, IconVerified } from "./icons.js";

/** "Kompaniya" tabi faqat nomdan boshqa kamida bitta ma'lumot bo'lsa ko'rsatiladi. */
export function hasCompanyAbout(company: VacancyCompanyVM): boolean {
  return Boolean(
    company.description || company.industry || company.employeeCount || company.foundedYear || company.website || company.regionName
  );
}

/** "Kompaniya" tabi: to'liq tavsif va faqat mavjud faktlar. */
export function CompanyAbout({ company }: { company: VacancyCompanyVM }) {
  const t = useT();
  const d = t.vacancyDetail.company;
  const l = useHref();
  const { locale } = useLocale();
  const headingId = useId();
  const region = company.regionSlug ? regionName(locale, company.regionSlug, company.regionName) : company.regionName;

  const facts: { key: string; label: string; value: React.ReactNode }[] = [];
  if (company.industry) facts.push({ key: "industry", label: d.industry, value: company.industry });
  if (company.employeeCount) facts.push({ key: "employees", label: d.employeesLabel, value: company.employeeCount });
  if (company.foundedYear) facts.push({ key: "founded", label: d.foundedLabel, value: company.foundedYear });
  if (region) facts.push({ key: "region", label: d.region, value: region });
  if (company.website) {
    facts.push({
      key: "website",
      label: d.website,
      value: (
        <a href={company.website} target="_blank" rel="noopener noreferrer nofollow" className="text-signal hover:underline [overflow-wrap:anywhere]">
          {websiteHost(company.website)}
        </a>
      ),
    });
  }

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className={SECTION_TITLE}>
        {d.about}
      </h2>

      <div className="mt-4 flex items-center gap-3.5">
        <CompanyLogo name={company.name} src={company.logoUrl} size="md" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-display text-[17px] font-bold text-ink">
            <span className="[overflow-wrap:anywhere]">{company.name}</span>
            {company.isVerified && (
              <span className="shrink-0 text-signal">
                <IconVerified size={17} />
                <span className="sr-only">{d.verified}</span>
              </span>
            )}
          </p>
          {company.rating !== null && (
            <p className="mt-1 flex items-center gap-2 text-[13.5px] text-dusk">
              <StarRating value={company.rating} className="text-[15px]" />
              <span className="font-semibold text-ink">{company.rating.toFixed(1)}</span>
              <span>· {d.reviews(company.reviewCount)}</span>
            </p>
          )}
        </div>
      </div>

      {company.description && (
        <p className="mt-4 whitespace-pre-line text-[15px] leading-[1.75] text-ink/80 [overflow-wrap:anywhere]">{company.description}</p>
      )}

      {facts.length > 0 && (
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.key} className="rounded-2xl border border-line bg-surface-2/40 px-4 py-3">
              <dt className="text-[12.5px] text-dusk">{fact.label}</dt>
              <dd className="mt-0.5 font-semibold text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={l(`/companies/${company.slug}`)}
          className="group inline-flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-[14px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal"
        >
          {d.view}
          <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </a>
        {company.activeVacancyCount > 1 && (
          <a
            href={l(`/vacancies?company=${encodeURIComponent(company.slug)}`)}
            className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-[14px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal"
          >
            {d.vacancies(company.activeVacancyCount)}
          </a>
        )}
      </div>
    </section>
  );
}
