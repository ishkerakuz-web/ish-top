import React, { memo } from "react";
import type { Company } from "../../lib/types.js";
import { useT, useHref, useLocale } from "../../lib/i18n/index.js";
import { regionDisplayName } from "../../lib/format.js";
import { CompanyLogo } from "./CompanyLogo.js";
import { IconArrowRight, IconBriefcase, IconHeart, IconPin, IconStar, IconUsers, IconVerified } from "./icons.js";

export type CardView = "grid" | "list";

/** 1234 -> "1.2K" (sharhlar soni uchun ixcham ko'rinish). */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  const value = n / 1000;
  return `${value >= 10 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, "")}K`;
}

interface CardProps {
  company: Company;
  view?: CardView;
  /** `undefined` — saqlash imkoni yo'q (masalan ish beruvchi). */
  saved?: boolean;
  onToggleSave?: (company: Company) => void;
}

/**
 * Katalog kartasi. Butun karta bosiladi (sarlavhadagi havola "cho'zilgan"),
 * yurakcha esa uning ustida alohida tugma. Pastdagi "Kompaniyani ko'rish"
 * vizual ishora — ekran o'quvchida havola ikki marta o'qilmasin deb yashirilgan.
 */
export const CompanyCard = memo(function CompanyCard({ company, view = "grid", saved, onToggleSave }: CardProps) {
  const t = useT();
  const l = useHref();
  const { locale } = useLocale();
  const p = t.companiesPage.card;
  const href = l(`/companies/${company.slug}`);
  const meta = company.industry ?? "";
  // Audit R3, i18n-4: katalog kartasida hudud nomi joriy tilda
  const region = regionDisplayName(locale, company.regionName);

  const title = (
    <h3 className="min-w-0 font-display text-[16px] font-bold leading-snug text-ink">
      {/* Uzun nom 2 qatorga sinadi (kesib tashlanmaydi); belgi nom oxiriga yopishadi */}
      <a
        href={href}
        className="line-clamp-2 break-words transition-colors after:absolute after:inset-0 after:rounded-3xl after:content-[''] focus:outline-none group-hover:text-signal"
      >
        {company.name}
        {company.isVerified && (
          <span className="ml-1 inline-block align-[-3px] text-signal" title={t.company.verified}>
            <IconVerified size={17} />
            <span className="sr-only">{t.company.verified}</span>
          </span>
        )}
      </a>
    </h3>
  );

  const stats = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
      {company.reviewCount > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          <IconStar size={15} className="text-gold" />
          <span className="font-semibold text-ink" aria-hidden>
            {company.rating.toFixed(1)}
          </span>
          <span className="sr-only">{p.rating(company.rating.toFixed(1))}</span>
          <span className="text-dusk">({p.reviews(company.reviewCount, compactCount(company.reviewCount))})</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-dusk">
          <IconStar size={15} className="text-line" />
          {p.noReviews}
        </span>
      )}
      <span className={`inline-flex items-center gap-1.5 ${company.activeVacancyCount > 0 ? "font-medium text-ink" : "text-dusk"}`}>
        <IconBriefcase size={15} className="text-dusk" />
        {company.activeVacancyCount > 0 ? p.vacancies(company.activeVacancyCount) : p.noVacancies}
      </span>
    </div>
  );

  const save =
    onToggleSave && saved !== undefined ? (
      <button
        type="button"
        aria-pressed={saved}
        aria-label={saved ? p.unsave(company.name) : p.save(company.name)}
        title={saved ? p.unsave(company.name) : p.save(company.name)}
        onClick={() => onToggleSave(company)}
        className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
          saved ? "bg-signal-soft text-signal" : "text-dusk hover:bg-surface-2 hover:text-signal"
        }`}
      >
        <IconHeart size={19} filled={saved} />
      </button>
    ) : null;

  // Hudud va xodimlar soni alohida bo'laklar — tor kartada kesilmasdan keyingi qatorga o'tadi
  const location =
    region || company.employeeCount ? (
      <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px] text-dusk">
        {region && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <IconPin size={14} className="shrink-0" />
            {region}
          </span>
        )}
        {company.employeeCount && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <IconUsers size={14} className="shrink-0" />
            {p.employees(company.employeeCount)}
          </span>
        )}
      </span>
    ) : null;

  const cta = (
    <span
      aria-hidden
      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-signal-soft px-4 py-2.5 text-[13px] font-semibold text-signal transition-colors group-hover:bg-signal group-hover:text-white"
    >
      {p.view}
      <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
    </span>
  );

  const shell =
    "group relative rounded-3xl border border-line bg-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-card-hover focus-within:border-signal focus-within:ring-2 focus-within:ring-signal/30";

  if (view === "list") {
    return (
      <article className={`${shell} flex items-center gap-4 p-4 sm:p-5`}>
        <CompanyLogo name={company.name} src={company.logoUrl} size="md" />
        <div className="min-w-0 flex-1">
          {title}
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {meta && <span className="truncate text-[13px] text-dusk">{meta}</span>}
            {location}
          </div>
          <div className="mt-2">{stats}</div>
        </div>
        <div className="hidden shrink-0 md:block">{cta}</div>
        {save}
      </article>
    );
  }

  return (
    <article className={`${shell} flex h-full flex-col p-5`}>
      <div className="flex items-start gap-3.5">
        <CompanyLogo name={company.name} src={company.logoUrl} size="md" />
        <div className="min-w-0 flex-1 pt-0.5">
          {title}
          {meta && <p className="mt-0.5 truncate text-[13px] text-dusk">{meta}</p>}
          <div className="mt-1">{location}</div>
        </div>
        {save}
      </div>

      {company.description && (
        <p className="mt-4 line-clamp-2 text-[14px] leading-relaxed text-ink/75">{company.description}</p>
      )}

      <div className="mt-4">{stats}</div>
      <div className="mt-auto pt-5 [&>span]:w-full">{cta}</div>
    </article>
  );
});
