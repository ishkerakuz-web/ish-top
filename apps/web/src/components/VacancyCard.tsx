import React from "react";
import type { Vacancy } from "../lib/types.js";
import { formatSalary, formatRelativeDays } from "../lib/format.js";
import { useT, useHref } from "../lib/i18n/index.js";
import { FavoriteButton } from "./FavoriteButton.js";

/**
 * Vakansiya kartasi — editorial uslub: pill-to'plami o'rniga nuqta-ajratkichli
 * matn qatorlari, kuchli sarlavha, mono maosh. Oq bo'shliq ierarxiyani chizadi.
 *
 * Butun karta bosiladigan bo'lishi uchun sarlavha havolasiga "stretched link"
 * (`before:absolute before:inset-0`) qo'llanadi — shunda yurakcha tugmasi
 * havola ichida bo'lmaydi (bu HTML'da noto'g'ri) va o'z bosilishini oladi.
 */
export function VacancyCard({
  vacancy,
  index = 0,
  favorite,
  onToggleFavorite,
}: {
  vacancy: Vacancy;
  index?: number;
  /** `undefined` — yurakcha ko'rsatilmaydi (mehmon yoki ish beruvchi). */
  favorite?: boolean;
  onToggleFavorite?: (vacancyId: string) => void | Promise<unknown>;
}) {
  const t = useT();
  const l = useHref();
  const showFavorite = favorite !== undefined && Boolean(onToggleFavorite);

  return (
    <article
      style={{ animationDelay: `${Math.min(index * 50, 250)}ms` }}
      className="group relative flex animate-fade-up flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-card-hover"
    >
      {/* Imzo-detal: hover'da chapdan suzib kiruvchi oltin chiziq ("martaba yo'li") */}
      <span
        aria-hidden
        className="absolute inset-y-4 left-0 w-[3px] origin-top scale-y-0 rounded-r bg-signal transition-transform duration-300 group-hover:scale-y-100"
      />

      {/* Yuqori qator: kompaniya + vaqt */}
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-display text-sm font-bold text-ink ring-1 ring-line">
          {vacancy.companyName.charAt(0)}
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] text-dusk">
          {vacancy.companyName}
          {vacancy.regionName ? ` · ${vacancy.regionName}` : ""}
        </p>
        <span className="shrink-0 whitespace-nowrap text-xs text-dusk/80">
          {formatRelativeDays(vacancy.publishedAt, t.fmt)}
        </span>
      </div>

      {/* Sarlavha */}
      <div className="mt-3 flex items-start gap-2">
        <a
          href={l(`/vacancies/${vacancy.slug}`)}
          className="font-display text-[16px] font-semibold leading-snug tracking-tight text-ink transition-colors before:absolute before:inset-0 before:content-[''] group-hover:text-signal"
        >
          {vacancy.title}
        </a>
        {vacancy.isPremium && (
          <span className="mt-0.5 shrink-0 rounded bg-gold px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#231A05]">
            {t.vacancyCard.premium}
          </span>
        )}
        {vacancy.isUrgent && !vacancy.isPremium && (
          <span className="mt-0.5 shrink-0 rounded border border-gold-deep/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold-deep">
            {t.vacancyCard.urgent}
          </span>
        )}
      </div>

      {/* Pastki qator: maosh + meta + yurakcha */}
      <div className="mt-auto flex items-center gap-3 pt-4">
        <span className="font-mono text-[13.5px] font-semibold tabular-nums text-growth">
          {formatSalary(vacancy.salaryMin, vacancy.salaryMax, t.fmt, vacancy.isSalaryHidden)}
        </span>
        <span className="hidden min-w-0 truncate text-xs text-dusk sm:block">
          {t.enums.experience[vacancy.experienceRequired]}
          {" · "}
          {t.enums.employment[vacancy.employmentType]}
        </span>
        {showFavorite && (
          <FavoriteButton
            active={Boolean(favorite)}
            onToggle={() => onToggleFavorite!(vacancy.id)}
            size="sm"
            className="ml-auto"
          />
        )}
      </div>
    </article>
  );
}
