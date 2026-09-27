import React from "react";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { CTA_PRIMARY } from "./styles.js";
import { IconPlus } from "./icons.js";

/** "Vakansiyalarim" + tavsif; o'ngda asosiy CTA (kompaniya profili bo'lsa). */
export function VacanciesHeader({ showCta }: { showCta: boolean }) {
  const t = useT();
  const l = useHref();
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[32px]">{t.empVacancies.title}</h1>
        <p className="mt-1 text-[15px] text-dusk">{t.empVacancies.subtitle}</p>
      </div>
      {showCta && (
        <a href={l("/employer/vacancies/new")} data-testid="vacancies-new" className={`${CTA_PRIMARY} w-full sm:w-auto`}>
          <IconPlus size={18} />
          {t.empVacancies.newButton}
        </a>
      )}
    </header>
  );
}
