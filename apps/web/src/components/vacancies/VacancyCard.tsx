import React, { memo } from "react";
import type { Vacancy } from "../../lib/types.js";
import { formatRelativeDays, formatSalary } from "../../lib/format.js";
import { useT, useHref, useLocale } from "../../lib/i18n/index.js";
import { regionName } from "../../lib/i18n/regions.js";
import { CompanyLogo } from "../companies/CompanyLogo.js";
import { IconArrowRight, IconBookmark, IconBriefcase, IconCalendar, IconClock, IconVerified } from "./icons.js";
import { IconBuilding } from "../companies/icons.js";

const MAX_SKILLS = 4;

/**
 * Vakansiya kartasi (ro'yxat). Butun karta bosiladi — sarlavha havolasiga
 * "stretched link"; kompaniya havolasi va saqlash tugmasi uning ustida
 * (`relative z-10`), shuning uchun HTML'da havola ichida tugma bo'lmaydi.
 * Maosh — eng ko'zga tashlanadigan ma'lumot (yashil, katta).
 */
export const VacancyCard = memo(function VacancyCard({
  vacancy,
  saved,
  onToggleSave,
}: {
  vacancy: Vacancy;
  /** `undefined` — saqlash tugmasi ko'rsatilmaydi. */
  saved?: boolean;
  onToggleSave?: (vacancyId: string) => void;
}) {
  const t = useT();
  const v = t.vacanciesPage;
  const l = useHref();
  const { locale } = useLocale();
  const href = l(`/vacancies/${vacancy.slug}`);
  const hasSalary = !vacancy.isSalaryHidden && Boolean(vacancy.salaryMin || vacancy.salaryMax);
  const salary = formatSalary(vacancy.salaryMin, vacancy.salaryMax, t.fmt, vacancy.isSalaryHidden, locale);
  const posted = formatRelativeDays(vacancy.publishedAt, t.fmt);
  const region = vacancy.regionSlug ? regionName(locale, vacancy.regionSlug, vacancy.regionName) : vacancy.regionName;
  const skills = vacancy.skills ?? [];
  const shownSkills = skills.slice(0, MAX_SKILLS);
  const moreSkills = skills.length - shownSkills.length;

  const workplace = vacancy.workplaceType ?? null;
  const meta = [
    ...(workplace ? [{ key: "workplace", icon: <IconBuilding size={15} />, label: t.enums.workplace[workplace] }] : []),
    { key: "experience", icon: <IconClock size={15} />, label: t.enums.experience[vacancy.experienceRequired] },
    // Eski masofaviy e'londa bandlik turi ham "Masofaviy" — takrorlanmaydi
    ...(vacancy.employmentType === "remote" && workplace === "remote"
      ? []
      : [{ key: "employment", icon: <IconBriefcase size={15} />, label: t.enums.employment[vacancy.employmentType] }]),
    ...(vacancy.scheduleType ? [{ key: "schedule", icon: <IconCalendar size={15} />, label: v.schedule[vacancy.scheduleType] }] : []),
  ];

  return (
    <article className="group relative flex gap-4 rounded-3xl border border-line bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/30 hover:shadow-card-hover sm:gap-5 sm:p-5">
      <span className="sm:hidden">
        <CompanyLogo name={vacancy.companyName} src={vacancy.companyLogoUrl} size="md" />
      </span>
      <span className="hidden sm:block">
        <CompanyLogo name={vacancy.companyName} src={vacancy.companyLogoUrl} size="lg" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {(vacancy.isPremium || vacancy.isUrgent) && (
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {vacancy.isPremium && (
                  <span className="rounded-md bg-gold px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#231A05]">
                    {v.card.premium}
                  </span>
                )}
                {vacancy.isUrgent && (
                  <span className="rounded-md bg-signal px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                    {v.card.urgent}
                  </span>
                )}
              </div>
            )}
            {/* Audit R3, a11y-ui-11: juda uzun nom kesilmasin, qatorga boʻlinsin */}
            <h3 className="line-clamp-2 font-display text-[16.5px] font-bold leading-snug tracking-tight text-ink [overflow-wrap:anywhere] sm:text-lg">
              <a
                href={href}
                className="rounded-sm transition-colors after:absolute after:inset-0 after:rounded-3xl after:content-[''] group-hover:text-signal focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-signal"
              >
                {vacancy.title}
              </a>
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[14px] text-dusk">
              <a
                href={l(`/companies/${vacancy.companySlug}`)}
                className="relative z-10 inline-flex items-center gap-1 font-medium text-ink/80 transition-colors hover:text-signal hover:underline"
              >
                {vacancy.companyName}
                {vacancy.companyVerified && (
                  <span className="text-signal">
                    <IconVerified size={15} />
                    <span className="sr-only">{v.card.verified}</span>
                  </span>
                )}
              </a>
              {/* Ajratkich hudud bilan birga ko'chadi — qator oxirida yolg'iz "·" qolmasin */}
              {region && (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden>·</span>
                  {region}
                </span>
              )}
            </p>
          </div>

          <div className="hidden shrink-0 flex-col items-end text-right sm:flex">
            <p className={hasSalary ? "whitespace-nowrap font-display text-[17px] font-extrabold tabular-nums text-growth" : "whitespace-nowrap text-[14px] font-semibold text-dusk"}>
              {salary}
            </p>
            {posted && <p className="mt-1 text-[12.5px] text-dusk">{posted}</p>}
          </div>

          {onToggleSave && (
            <button
              type="button"
              aria-pressed={Boolean(saved)}
              aria-label={saved ? v.card.unsave : v.card.save}
              title={saved ? v.card.unsave : v.card.save}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSave(vacancy.id);
              }}
              className={`relative z-10 -mr-1.5 -mt-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
                saved ? "text-signal hover:bg-signal-soft" : "text-dusk hover:bg-surface-2 hover:text-signal"
              }`}
            >
              <IconBookmark size={20} filled={Boolean(saved)} />
            </button>
          )}
        </div>

        {/* Telefonda maosh sarlavha ostida */}
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 sm:hidden">
          <span className={hasSalary ? "font-display text-[16px] font-extrabold tabular-nums text-growth" : "text-[13.5px] font-semibold text-dusk"}>
            {salary}
          </span>
          {posted && <span className="text-[12.5px] text-dusk">{posted}</span>}
        </p>

        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-dusk">
          {meta.map((m) => (
            <li key={m.key} className="inline-flex items-center gap-1.5">
              <span className="text-dusk/80">{m.icon}</span>
              {m.label}
            </li>
          ))}
        </ul>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          {shownSkills.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label={v.card.skills}>
              {shownSkills.map((skill) => (
                <li key={skill} className="rounded-lg border border-line bg-surface-2/70 px-2.5 py-1 text-[12px] font-medium text-ink/80">
                  {skill}
                </li>
              ))}
              {moreSkills > 0 && (
                <li className="rounded-lg border border-line bg-surface px-2 py-1 text-[12px] font-semibold text-dusk" aria-label={`+${moreSkills}`}>
                  +{moreSkills}
                </li>
              )}
            </ul>
          ) : (
            <span />
          )}
          <span aria-hidden className="hidden items-center gap-1 text-[13px] font-semibold text-signal transition-transform group-hover:translate-x-0.5 sm:inline-flex">
            {v.card.details}
            <IconArrowRight size={14} />
          </span>
        </div>
      </div>
    </article>
  );
});
