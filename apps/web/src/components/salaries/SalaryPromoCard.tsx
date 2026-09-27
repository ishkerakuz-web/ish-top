import React from "react";
import { useT } from "../../lib/i18n/index.js";

/**
 * "To'g'ri maosh — yaxshiroq kelajak!" banneri (lg+).
 * Grafik — berilgan `grafik.png` dan tayyorlangan shaffof `salaries-growth.webp`
 * (qayta chizilmagan). Matn rasmga yopishtirilmagan: tarjima qilinadi va
 * tungi rejimda ham o'qiladi. Sarlavha tepada, rasm pastki o'ng burchakda —
 * ular ustma-ust tushmaydi; tor bannerda (1024–1279) tavsif yashiriladi.
 */
export function SalaryPromoCard() {
  const p = useT().salaries.promo;
  return (
    <aside className="relative hidden min-h-[200px] overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface via-surface to-signal-soft shadow-card lg:block dark:from-surface-2 dark:via-surface dark:to-signal-soft">
      <span aria-hidden className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-signal/[0.07] dark:bg-signal/[0.14]" />
      <span aria-hidden className="absolute -bottom-24 right-8 h-44 w-44 rounded-full bg-[#8B5CF6]/[0.07] dark:bg-[#8B5CF6]/[0.12]" />

      <div className="relative z-10 p-5 xl:p-6">
        <p className="whitespace-pre-line font-display text-[17px] font-extrabold leading-[1.22] tracking-tight text-ink xl:text-[19px]">
          {p.title}
        </p>
        <p className="mt-2 hidden max-w-[58%] text-[13px] leading-snug text-dusk xl:block">{p.text}</p>
      </div>

      <img
        src="/salaries-growth.webp"
        alt=""
        width={520}
        height={433}
        decoding="async"
        className="pointer-events-none absolute bottom-3.5 right-3.5 w-[52%] select-none drop-shadow-[0_10px_18px_rgba(79,70,229,0.18)] xl:w-[40%]"
      />
    </aside>
  );
}
