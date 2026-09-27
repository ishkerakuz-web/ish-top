import React, { useId } from "react";
import { SECTION_TITLE } from "./VacancyDescription.js";
import { IconCheck } from "./icons.js";

/**
 * Bandlar ro'yxati bo'limi — "Talablar" (yashil belgi) va "Ish sharoitlari".
 * Bandlar vakansiyaning o'z matnidan (har qator — bitta band); bo'sh bo'lsa
 * bo'lim render qilinmaydi, standart/to'qima bandlar qo'shilmaydi.
 */
export function VacancyChecklist({
  title,
  items,
  icon,
  tone = "growth",
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
  tone?: "growth" | "signal";
}) {
  const headingId = useId();
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className={`flex items-center gap-3 ${SECTION_TITLE}`}>
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal">
          {icon}
        </span>
        {title}
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink/80">
            <span
              aria-hidden
              className={`mt-[0.2em] flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                tone === "growth" ? "bg-growth text-white dark:text-paper" : "bg-signal-soft text-signal"
              }`}
            >
              <IconCheck size={13} className="[stroke-width:2.8]" />
            </span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
