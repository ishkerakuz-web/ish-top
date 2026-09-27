import React from "react";
import type { ConversationVacancy } from "../../lib/messages/adapter.js";
import { formatSalary } from "../../lib/format.js";
import { useT } from "../../lib/i18n/index.js";
import { IconArrowRight, IconBriefcase } from "./icons.js";

/**
 * Chat sarlavhasi ostidagi vakansiya konteksti. Bog'liq vakansiya bo'lmasa — umuman chizilmaydi.
 *
 * "Vakansiya haqida" chatdan OLIB CHIQMAYDI: u kontekst modalini ochadi (vakansiya shartlari,
 * kompaniya, havolalar). To'liq e'lon sahifasiga o'tish havolasi o'sha modal ichida.
 */
export function ConversationVacancyContext({ vacancy, onOpenDetails }: { vacancy: ConversationVacancy; onOpenDetails: () => void }) {
  const t = useT();
  const m = t.messagesPage;
  const salary = vacancy.salary ? formatSalary(vacancy.salary.min, vacancy.salary.max, t.fmt) : null;
  const meta = [
    vacancy.regionName && { key: "region", label: vacancy.regionName, className: "" },
    vacancy.employmentType && { key: "employment", label: t.enums.employment[vacancy.employmentType], className: "" },
    vacancy.experience && { key: "experience", label: t.enums.experience[vacancy.experience], className: "hidden lg:list-item" },
    salary && { key: "salary", label: salary, className: "hidden font-semibold text-growth sm:list-item" },
  ].filter(Boolean) as { key: string; label: string; className: string }[];

  return (
    <div data-testid="vacancy-context" className="border-b border-line px-3 py-2.5 sm:px-5">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/50 px-3 py-2.5">
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal sm:flex">
          <IconBriefcase size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink">
            <span className="sr-only">{m.vacancy.label}: </span>
            {vacancy.title}
          </p>
          {meta.length > 0 && (
            <ul className="mt-0.5 flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-dusk">
              {meta.map((item) => (
                <li key={item.key} className={`whitespace-nowrap ${item.className}`}>
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        {vacancy.isClosed ? (
          <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-dusk">{m.vacancy.closed}</span>
        ) : (
          <button
            type="button"
            onClick={onOpenDetails}
            aria-haspopup="dialog"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-signal transition-colors hover:bg-signal-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {/* Tor chat ustunida (telefon) — faqat strelka, matn ekran o'quvchiga */}
            <span className="hidden sm:inline">{m.vacancy.about}</span>
            <span className="sr-only sm:hidden">{m.vacancy.about}</span>
            <IconArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
