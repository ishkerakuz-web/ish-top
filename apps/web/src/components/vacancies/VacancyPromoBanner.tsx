import React from "react";
import { useT } from "../../lib/i18n/index.js";

/**
 * "Yaxshiroq kelajak shu yerdan boshlanadi!" banneri (lg+).
 * Rasm — berilgan `case.png` dan tayyorlangan shaffof `vacancies-briefcase.webp`
 * (qayta chizilmagan). Matn rasmga yopishtirilmagan: tarjima qilinadi, tungi
 * rejimda ham o'qiladi; matn chapda, portfel o'ngda — ustma-ust tushmaydi.
 */
export function VacancyPromoBanner() {
  const p = useT().vacanciesPage.promo;
  return (
    <aside className="relative hidden min-h-[124px] overflow-hidden rounded-3xl border border-line bg-gradient-to-r from-signal-soft via-surface to-[#EDE9FE] shadow-card lg:block dark:from-surface-2 dark:via-surface dark:to-signal-soft">
      <span aria-hidden className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-signal/[0.08] dark:bg-signal/[0.16]" />
      <span aria-hidden className="absolute -bottom-20 right-24 h-32 w-32 rounded-full bg-[#8B5CF6]/[0.07] dark:bg-[#8B5CF6]/[0.12]" />

      <div className="relative z-10 flex h-full max-w-[58%] flex-col justify-center py-4 pl-5 xl:pl-6">
        <p className="whitespace-pre-line font-display text-[15px] font-extrabold leading-[1.22] tracking-tight text-ink xl:text-[16px]">
          {p.title}
        </p>
        <p className="mt-1.5 text-[12.5px] leading-snug text-dusk">{p.text}</p>
      </div>

      <img
        src="/vacancies-briefcase.webp"
        alt=""
        width={560}
        height={385}
        decoding="async"
        className="pointer-events-none absolute right-1 top-1/2 w-[39%] -translate-y-1/2 select-none drop-shadow-[0_12px_22px_rgba(79,70,229,0.28)]"
      />
    </aside>
  );
}
