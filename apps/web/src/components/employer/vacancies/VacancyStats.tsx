import React from "react";
import { useT } from "../../../lib/i18n/index.js";
import type { EmployerVacancyStats, EmployerVacancyStatus } from "../../../lib/employer/vacancies/adapter.js";
import { IconBriefcase, IconClock, IconFile, IconPlay, IconXCircle } from "./icons.js";

type Icon = React.ComponentType<{ size?: number; className?: string }>;
type CardKey = "total" | "active" | "moderation" | "draft" | "rejected";

const CARDS: { key: CardKey; status: EmployerVacancyStatus | null; icon: Icon; tone: string; iconTone: string }[] = [
  { key: "total", status: null, icon: IconBriefcase, tone: "border-signal/15 bg-signal-soft/60", iconTone: "bg-surface text-signal dark:text-indigo-300" },
  { key: "active", status: "active", icon: IconPlay, tone: "border-growth/20 bg-growth/[0.06]", iconTone: "bg-growth/10 text-growth" },
  { key: "moderation", status: "moderation", icon: IconClock, tone: "border-gold/25 bg-gold/[0.07]", iconTone: "bg-gold/15 text-gold-deep" },
  { key: "draft", status: "draft", icon: IconFile, tone: "border-line bg-surface", iconTone: "bg-surface-2 text-dusk" },
  { key: "rejected", status: "rejected", icon: IconXCircle, tone: "border-danger/20 bg-danger/[0.05]", iconTone: "bg-danger/10 text-danger" },
];

/**
 * Statistika — haqiqiy ro'yxatdan hisoblangan sonlar. Karta bosilsa shu holat
 * bo'yicha filtr (`aria-pressed`), qayta bosilsa yoki "Jami" — filtr olib tashlanadi.
 */
export function VacancyStats({
  stats,
  active,
  onSelect,
}: {
  stats: EmployerVacancyStats;
  active: EmployerVacancyStatus | null;
  onSelect: (status: EmployerVacancyStatus | null) => void;
}) {
  const p = useT().employerVacanciesPage;
  return (
    <section aria-label={p.statsLabel} className="mt-6">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CARDS.map((card, i) => {
          const Icon = card.icon;
          const value = card.status ? stats.byStatus[card.status] : stats.total;
          const pressed = card.status ? active === card.status : active === null;
          return (
            <li key={card.key} className={i === 0 ? "col-span-2 sm:col-span-1" : ""}>
              <button
                type="button"
                data-stat={card.key}
                aria-pressed={pressed}
                onClick={() => onSelect(card.status === null || card.status === active ? null : card.status)}
                className={`flex h-full w-full items-center gap-2.5 rounded-2xl border p-3.5 text-left sm:gap-3 sm:p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${card.tone} ${
                  card.status && pressed ? "ring-2 ring-signal/50" : ""
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-11 sm:w-11 ${card.iconTone}`}>
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-2xl font-bold leading-none tabular-nums text-ink">{value}</span>
                  <span className="mt-1.5 block text-[13px] leading-tight text-dusk">{p.stats[card.key]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
