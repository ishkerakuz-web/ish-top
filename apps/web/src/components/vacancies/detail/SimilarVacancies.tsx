import React, { useId } from "react";
import type { Vacancy } from "../../../lib/types.js";
import type { Messages } from "../../../lib/i18n/messages.js";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { regionName } from "../../../lib/i18n/regions.js";
import { formatRelativeDays } from "../../../lib/format.js";
import { toMillions } from "../../../lib/salaries/format.js";
import { CompanyLogo } from "../../companies/CompanyLogo.js";
import { IconArrowRight } from "./icons.js";

/** Tor ustun uchun ixcham maosh: "12 – 20 mln so'm". Yashirilgan/kiritilmagan — `null`. */
function compactSalary(v: Vacancy, t: Messages, locale: string): string | null {
  if (v.isSalaryHidden || (!v.salaryMin && !v.salaryMax)) return null;
  const unit = t.salaries.distribution.unit;
  const m = (n: number) => toMillions(n, locale);
  if (v.salaryMin && v.salaryMax) return t.fmt.salaryRange(m(v.salaryMin), `${m(v.salaryMax)} ${unit}`);
  if (v.salaryMin) return t.fmt.salaryFrom(`${m(v.salaryMin)} ${unit}`);
  return t.fmt.salaryTo(`${m(v.salaryMax!)} ${unit}`);
}

/**
 * "O'xshash vakansiyalar" — backend `GET /api/vacancies/:slug/similar`
 * (shu soha, hudud/tajriba mosi oldinda). Ro'yxat bo'sh bo'lsa blok umuman yo'q.
 */
export function SimilarVacancies({ items, categorySlug }: { items: Vacancy[]; categorySlug: string | null }) {
  const t = useT();
  const d = t.vacancyDetail.similar;
  const l = useHref();
  const { locale } = useLocale();
  const headingId = useId();
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="min-w-0 font-display text-[17px] font-bold tracking-tight text-ink">
          {d.title}
        </h2>
        <a
          href={l(categorySlug ? `/vacancies?category=${encodeURIComponent(categorySlug)}` : "/vacancies")}
          className="group inline-flex shrink-0 items-center gap-1 rounded-md text-[13px] font-semibold text-signal hover:underline"
        >
          {d.all}
          <IconArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>

      <ul className="mt-2 divide-y divide-line">
        {items.map((v) => {
          const region = v.regionSlug ? regionName(locale, v.regionSlug, v.regionName) : v.regionName;
          const salary = compactSalary(v, t, locale);
          const posted = formatRelativeDays(v.publishedAt, t.fmt);
          return (
            <li key={v.id}>
              <a
                href={l(`/vacancies/${v.slug}`)}
                className="group -mx-2 flex gap-3 rounded-2xl px-2 py-3.5 transition-colors hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                <CompanyLogo name={v.companyName} src={v.companyLogoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink transition-colors group-hover:text-signal">{v.title}</p>
                  <p className="mt-0.5 truncate text-[13px] text-dusk">
                    {v.companyName}
                    {region ? ` · ${region}` : ""}
                  </p>
                  {(salary || posted) && (
                    <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      {salary && <span className="text-[13.5px] font-bold tabular-nums text-growth">{salary}</span>}
                      {posted && (
                        <span className="ml-auto text-[12.5px] text-dusk" suppressHydrationWarning>
                          {posted}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
