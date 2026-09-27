import React from "react";
import type { VacancyDetailVM } from "../../../lib/vacancies/detail.js";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { regionName } from "../../../lib/i18n/regions.js";
import { formatRelativeDays, formatSalary } from "../../../lib/format.js";
import { CompanyLogo } from "../../companies/CompanyLogo.js";
import { VacancyMeta } from "./VacancyMeta.js";
import { VacancySkills } from "./VacancySkills.js";
import { IconCalendar, IconEye, IconVerified } from "./icons.js";

/**
 * Sahifa boshi: logo, sarlavha va belgilar, kompaniya, hudud, maosh, shartlar,
 * ko'nikmalar. Har bir element ixtiyoriy — yo'q bo'lsa joy qoldirmasdan tushib
 * qoladi (masalan maosh ko'rsatilmagan bo'lsa maosh qatori umuman yo'q).
 * `actions` (saqlash/ulashish) md+ da o'ngda, telefonda pastki qatorda.
 */
export function VacancyDetailHeader({ vacancy, actions }: { vacancy: VacancyDetailVM; actions: React.ReactNode }) {
  const t = useT();
  const d = t.vacancyDetail;
  const card = t.vacanciesPage.card;
  const l = useHref();
  const { locale } = useLocale();
  const { company } = vacancy;

  const region = vacancy.regionSlug ? regionName(locale, vacancy.regionSlug, vacancy.regionName) : vacancy.regionName;
  const salary = vacancy.salary ? formatSalary(vacancy.salary.min, vacancy.salary.max, t.fmt, false, locale) : null;
  const posted = formatRelativeDays(vacancy.publishedAt, t.fmt);
  const hasFootnote = Boolean(posted) || vacancy.viewsCount > 0;

  return (
    <header className="animate-fade-up">
      <div className="flex items-start gap-4 sm:gap-5">
        <span className="sm:hidden">
          <CompanyLogo name={company.name} src={company.logoUrl} size="lg" />
        </span>
        <span className="hidden sm:block">
          <CompanyLogo name={company.name} src={company.logoUrl} size="xl" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="min-w-0 font-display text-[1.55rem] font-extrabold leading-[1.18] tracking-tight text-ink [overflow-wrap:anywhere] sm:text-[2rem]">
              {vacancy.title}
            </h1>
            {vacancy.isPremium && (
              <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#231A05]">
                {card.premium}
              </span>
            )}
            {vacancy.isUrgent && (
              <span className="rounded-md bg-signal px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                {card.urgent}
              </span>
            )}
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
            <a
              href={l(`/companies/${company.slug}`)}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-sm font-semibold text-signal transition-colors hover:text-signal-dark hover:underline"
            >
              <span className="[overflow-wrap:anywhere]">{company.name}</span>
              {company.isVerified && (
                <span className="shrink-0">
                  <IconVerified size={17} />
                  <span className="sr-only">{d.company.verified}</span>
                </span>
              )}
            </a>
            {region && (
              <span className="inline-flex items-center gap-2 text-dusk">
                <span aria-hidden>·</span>
                {region}
              </span>
            )}
          </p>

          {salary && (
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-display text-[1.15rem] font-extrabold tabular-nums text-growth sm:text-[1.3rem]">{salary}</span>
              {vacancy.salary?.type && <span className="text-[13px] font-medium text-dusk">{d.salaryType[vacancy.salary.type]}</span>}
            </p>
          )}
        </div>

        <div className="hidden shrink-0 md:block">{actions}</div>
      </div>

      <VacancyMeta vacancy={vacancy} className="mt-5" />
      <VacancySkills skills={vacancy.skills} className="mt-4" />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 empty:hidden md:mt-3">
        {hasFootnote && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-dusk">
            {posted && (
              <span className="inline-flex items-center gap-1.5" suppressHydrationWarning>
                <IconCalendar size={15} />
                {d.postedAgo(posted)}
              </span>
            )}
            {vacancy.viewsCount > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <IconEye size={15} />
                {d.views(vacancy.viewsCount)}
              </span>
            )}
          </p>
        )}
        <div className="md:hidden">{actions}</div>
      </div>
    </header>
  );
}
