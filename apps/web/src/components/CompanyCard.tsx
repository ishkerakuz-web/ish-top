import React from "react";
import type { Company } from "../lib/types.js";
import { useT, useHref } from "../lib/i18n/index.js";

export function CompanyCard({ company, index = 0 }: { company: Company; index?: number }) {
  const t = useT();
  const l = useHref();
  return (
    <a
      href={l(`/companies/${company.slug}`)}
      style={{ animationDelay: `${Math.min(index * 50, 250)}ms` }}
      className="group flex animate-fade-up gap-4 rounded-2xl border border-line bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-card-hover"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2 font-display text-xl font-bold text-ink">
        {company.logoUrl ? (
          <img src={company.logoUrl} alt="" width={56} height={56} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          company.name.charAt(0)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-display text-[15px] font-semibold text-ink transition-colors group-hover:text-signal">
            {company.name}
          </p>
          {company.isVerified && <VerifiedBadge title={t.company.verified} />}
        </div>
        <p className="mt-0.5 truncate text-sm text-dusk">
          {[company.industry, company.regionName].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-2.5 flex items-center gap-3 text-xs text-dusk">
          {company.reviewCount > 0 && (
            <span className="flex items-center gap-1">
              {/* Yulduz dekorativ (yonida raqamli reyting bor) — kontrast auditidan chiqadi */}
              <span className="text-gold" aria-hidden>★</span>
              <span className="font-medium text-ink">{company.rating.toFixed(1)}</span>
            </span>
          )}
          <span>{t.fmt.vacanciesCount(company.activeVacancyCount)}</span>
        </div>
      </div>
    </a>
  );
}

function VerifiedBadge({ title }: { title: string }) {
  return (
    <span title={title} className="shrink-0 text-growth" aria-label={title}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 2l2.4 1.8 3 .2.2 3L19.4 9.6 21 12l-1.6 2.4.2 3-3 .2L14.4 19.4 12 21l-2.4-1.6-3-.2.2-3L5.6 12 4 9.6l1.6-2.4-.2-3 3-.2L9.6 2.6 12 2z"
          fill="currentColor"
          opacity="0.18"
        />
        <path d="M8.5 12.5l2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
