import React, { useId } from "react";
import type { Company } from "../../../lib/types.js";
import type { CompanyDetailVM } from "../../../lib/companies/detail.js";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { regionName } from "../../../lib/i18n/regions.js";
import { CompanyLogo } from "../CompanyLogo.js";
import { CARD, LINK_BUTTON, SIDE_TITLE } from "./styles.js";
import { IconArrowRight, IconChevronRight, IconLink, IconPin, IconUsers, IconVerified } from "./icons.js";

/** Veb-sayt. Ijtimoiy tarmoq maydonlari bazada yo'q — to'qima havola chiqmaydi. Sayt yo'q — karta yo'q. */
export function CompanyWebsite({ company }: { company: CompanyDetailVM }) {
  const d = useT().companyDetail;
  const headingId = useId();
  if (!company.website) return null;
  const label = company.website.replace(/\/$/, "");
  return (
    <section aria-labelledby={headingId} className={CARD}>
      <h2 id={headingId} className={SIDE_TITLE}>
        {d.links.title}
      </h2>
      <a
        href={company.website}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="group mt-3 flex items-center gap-3 rounded-xl text-[14px] font-medium text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal-soft">
          <IconLink size={17} />
        </span>
        <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
      </a>
    </section>
  );
}

/**
 * Manzil — bazada faqat hudud bor (aniq ko'cha va koordinata yo'q), shuning
 * uchun xarita chizilmaydi: toza manzil kartasi. Hudud yo'q — karta yo'q.
 */
export function CompanyLocation({ company }: { company: CompanyDetailVM }) {
  const d = useT().companyDetail;
  const { locale } = useLocale();
  const headingId = useId();
  if (!company.regionName) return null;
  const region = company.regionSlug ? regionName(locale, company.regionSlug, company.regionName) : company.regionName;
  return (
    <section aria-labelledby={headingId} className={CARD}>
      <h2 id={headingId} className={SIDE_TITLE}>
        {d.location.title}
      </h2>
      <p className="mt-3 flex items-center gap-3 text-[14px] text-ink/85">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal">
          <IconPin size={17} />
        </span>
        {region}, {d.country}
      </p>
    </section>
  );
}

/** Soha bo'laklari chip ko'rinishida. Soha kiritilmagan — karta yo'q. */
export function CompanyIndustries({ company }: { company: CompanyDetailVM }) {
  const d = useT().companyDetail;
  const headingId = useId();
  if (company.industries.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className={CARD}>
      <h2 id={headingId} className={SIDE_TITLE}>
        {d.industries.title}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {company.industries.map((item) => (
          <li key={item} className="rounded-xl border border-line bg-surface-2/60 px-3 py-1.5 text-[13.5px] font-medium text-ink/85">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "O'xshash kompaniyalar" — `GET /api/companies/:slug/similar`. Ro'yxat bo'sh — blok yo'q. */
export function SimilarCompanies({ items }: { items: Company[] }) {
  const t = useT();
  const d = t.companyDetail;
  const l = useHref();
  const headingId = useId();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className={SIDE_TITLE}>
          {d.similar.title}
        </h2>
        <a href={l("/companies")} className={LINK_BUTTON}>
          {d.similar.all}
          <IconArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {items.map((company) => (
          <li key={company.id}>
            <a
              href={l(`/companies/${company.slug}`)}
              className="group -mx-2 flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <CompanyLogo name={company.name} src={company.logoUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[14.5px] font-semibold text-ink transition-colors group-hover:text-signal">
                  <span className="truncate">{company.name}</span>
                  {company.isVerified && (
                    <span className="shrink-0 text-signal">
                      <IconVerified size={15} />
                      <span className="sr-only">{d.verified}</span>
                    </span>
                  )}
                </p>
                {company.industry && <p className="truncate text-[13px] text-dusk">{company.industry}</p>}
                {company.employeeCount && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-dusk">
                    <IconUsers size={14} />
                    {d.employees(company.employeeCount)}
                  </p>
                )}
              </div>
              <IconChevronRight size={18} className="shrink-0 text-dusk transition-transform group-hover:translate-x-0.5" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
