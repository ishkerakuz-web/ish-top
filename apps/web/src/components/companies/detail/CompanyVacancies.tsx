import React, { useCallback, useId } from "react";
import type { Vacancy } from "../../../lib/types.js";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { parseVacancyQuery } from "../../../lib/vacancies/query.js";
import { useAuth } from "../../AuthContext.js";
import { useFavorites } from "../../../lib/useFavorites.js";
import { loginHrefWithReturn } from "../../../lib/auth/returnTo.js";
import { VacancyList } from "../../vacancies/VacancyList.js";
import { CARD, CARD_TITLE, LINK_BUTTON, OUTLINE_BUTTON } from "./styles.js";
import { IconArrowRight, IconBriefcase } from "./icons.js";

/**
 * Faol vakansiyalar — `/vacancies` ro'yxatidagi karta (maosh, hudud, tajriba,
 * bandlik, sana, belgilar, saqlash). Asosiy tabda birinchi `limit` tasi va
 * "Barchasini ko'rish", "Vakansiyalar" tabida hammasi. Bo'sh bo'lsa — toza holat.
 * `total` — API'dagi haqiqiy faol vakansiyalar soni: sahifadagi ro'yxat cheklangan bo'lsa,
 * to'liq ro'yxatda kompaniya filtri bilan qidiruvga havola chiqadi (audit PHASE 6, U27).
 */
export function CompanyVacancies({
  vacancies,
  total,
  companySlug,
  limit,
  onShowAll,
}: {
  vacancies: Vacancy[];
  total?: number;
  companySlug?: string;
  limit?: number;
  onShowAll?: () => void;
}) {
  const t = useT();
  const d = t.companyDetail.vacancies;
  const l = useHref();
  const headingId = useId();
  const { status } = useAuth();
  const { enabled, toggle, isFavorite } = useFavorites();

  const onToggleSave = useCallback(
    (id: string) => {
      if (enabled) void toggle(id);
      // Audit R3, candidate-flows-12: kirishdan keyin shu sahifaga qaytadi
      else window.location.assign(loginHrefWithReturn(l("/login")));
    },
    [enabled, toggle, l]
  );
  const canSave = enabled || status === "guest";
  const loaded = vacancies.length;
  // Sarlavhadagi son — haqiqiy faol vakansiyalar, yuklangan (cheklangan) ro'yxat uzunligi emas (audit PHASE 6, U27)
  const count = Math.max(total ?? 0, loaded);
  const shown = limit ? vacancies.slice(0, limit) : vacancies;
  // To'liq ro'yxatda yuklanmagan qism bo'lsa — `/vacancies?company=`. Slugni qidiruv sahifasi qabul qilmasa havola
  // chiqmaydi: filtrsiz ro'yxat "shu kompaniyaning barcha vakansiyalari" bo'lib ko'rinmasin
  const searchHref =
    !limit && companySlug && count > loaded && parseVacancyQuery({ company: companySlug }).company[0] === companySlug
      ? l(`/vacancies?company=${encodeURIComponent(companySlug)}`)
      : null;

  return (
    <section aria-labelledby={headingId} className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className={CARD_TITLE}>
          {loaded > 0 ? d.title(count) : t.companyDetail.tabs.vacancies(0)}
        </h2>
        {limit && onShowAll && loaded > limit && (
          <button type="button" onClick={onShowAll} className={LINK_BUTTON}>
            {d.all}
            <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>

      {loaded > 0 ? (
        <div className="mt-4">
          <VacancyList items={shown} isSaved={canSave ? isFavorite : undefined} onToggleSave={canSave ? onToggleSave : undefined} />
          {searchHref && (
            <div className="mt-4 flex justify-center">
              <a href={searchHref} data-testid="company-vacancies-search" className={`group w-full sm:w-auto ${OUTLINE_BUTTON}`}>
                {d.viewAllCount(count)}
                <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
          <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-soft text-signal">
            <IconBriefcase size={24} />
          </span>
          <p className="mt-4 font-display text-[16px] font-bold text-ink">{d.emptyTitle}</p>
          <p className="mt-1 max-w-sm text-[14px] text-dusk">{d.emptyText}</p>
          <a
            href={l("/vacancies")}
            className="group mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-signal px-5 text-[14px] font-semibold text-white transition-colors hover:bg-signal-dark"
          >
            {d.browse}
            <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      )}
    </section>
  );
}
