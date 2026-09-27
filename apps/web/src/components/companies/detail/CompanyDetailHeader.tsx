import React, { useMemo } from "react";
import type { CompanyDetailVM, CompanyReviewVM } from "../../../lib/companies/detail.js";
import { companyRatingSummary } from "../../../lib/companies/detail.js";
import { useLocale, useT } from "../../../lib/i18n/index.js";
import { regionName } from "../../../lib/i18n/regions.js";
import { CompanyLogo } from "../CompanyLogo.js";
import { StarRating } from "../../StarRating.js";
import { CompanyActions } from "./CompanyActions.js";
import { IconBuilding, IconCalendar, IconPin, IconUsers, IconVerified } from "./icons.js";

/**
 * Kompaniya sarlavhasi (muqova rasmisiz): logo, nom va tasdiq, reyting,
 * soha, hudud, xodimlar, tashkil topgan yil. Har bir qator faqat ma'lumot
 * bo'lsa chiqadi — faqat nomi bor kompaniya ham to'g'ri ko'rinadi.
 */
export function CompanyDetailHeader({
  company,
  reviews,
  onShare,
}: {
  company: CompanyDetailVM;
  reviews: CompanyReviewVM[];
  onShare: () => void;
}) {
  const t = useT();
  const d = t.companyDetail;
  const { locale } = useLocale();
  // Ro'yxat cheklangan bo'lsa (ko'p sharh) — o'rtacha serverdan, son mahalliy o'zgarish bilan; aks holda jonli
  // ro'yxatdan. "Cheklangan" dastlabki server ro'yxatidan aniqlanadi — o'chirishdan keyin eski son qolmaydi (audit PHASE 6, U24)
  const summary = useMemo(() => companyRatingSummary(company, reviews), [company, reviews]);
  const region = company.regionSlug ? regionName(locale, company.regionSlug, company.regionName) : company.regionName;

  const meta: { key: string; icon: React.ReactNode; text: string }[] = [];
  if (region) meta.push({ key: "region", icon: <IconPin size={18} />, text: `${region}, ${d.country}` });
  if (company.employeeCount) meta.push({ key: "employees", icon: <IconUsers size={18} />, text: d.employees(company.employeeCount) });
  if (company.foundedYear) meta.push({ key: "founded", icon: <IconCalendar size={18} />, text: d.founded(company.foundedYear) });

  return (
    <header className="animate-fade-up rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-7">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-4 sm:gap-6">
          <span className="sm:hidden">
            <CompanyLogo name={company.name} src={company.logoUrl} size="lg" />
          </span>
          <span className="hidden sm:block">
            <CompanyLogo name={company.name} src={company.logoUrl} size="xl" />
          </span>

          <div className="min-w-0">
            <h1 className="font-display text-[1.6rem] font-extrabold leading-tight tracking-tight text-ink [overflow-wrap:anywhere] sm:text-[2.1rem]">
              {company.name}
              {company.isVerified && (
                <span className="ml-2 inline-block align-[-0.12em] text-signal" title={d.verified}>
                  <IconVerified size={26} />
                  <span className="sr-only">{d.verified}</span>
                </span>
              )}
            </h1>

            {summary.rating !== null && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
                <StarRating value={summary.rating} className="text-[17px]" />
                <span className="font-semibold text-ink">{summary.rating.toFixed(1)}</span>
                <span className="text-dusk">· {d.reviewsCount(summary.count)}</span>
              </p>
            )}

            {company.industries.length > 0 && (
              <p className="mt-2 flex items-start gap-2 text-[14.5px] text-dusk">
                <IconBuilding size={18} className="mt-px shrink-0" />
                <span className="min-w-0 [overflow-wrap:anywhere]">{company.industries.join(" · ")}</span>
              </p>
            )}

            {meta.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-[14.5px] text-ink/80">
                {meta.map((item) => (
                  <li key={item.key} className="inline-flex items-center gap-2">
                    <span className="shrink-0 text-dusk">{item.icon}</span>
                    {item.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <CompanyActions company={company} onShare={onShare} />
      </div>
    </header>
  );
}
