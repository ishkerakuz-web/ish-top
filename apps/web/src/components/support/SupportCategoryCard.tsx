import React from "react";
import { useT } from "../../lib/i18n/index.js";
import type { SupportCategoryKey } from "../../lib/i18n/types.js";
import type { SupportCategoryVM } from "../../lib/support/faq.js";
import { IconArrowRight, IconBriefcase, IconBuilding, IconFile, IconHelp, IconSettings, IconShield, IconUser, IconWallet } from "./icons.js";

type Icon = React.ComponentType<{ size?: number; className?: string }>;

const ICONS: Record<SupportCategoryKey, Icon> = {
  account: IconUser,
  resume: IconFile,
  applications: IconBriefcase,
  companies: IconBuilding,
  payments: IconWallet,
  security: IconShield,
  technical: IconSettings,
  other: IconHelp,
};

const INDIGO = "bg-signal-soft text-signal dark:text-indigo-300";
const TONES: Record<SupportCategoryKey, string> = {
  account: INDIGO,
  resume: INDIGO,
  applications: "bg-gold/15 text-gold-deep",
  companies: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  payments: INDIGO,
  security: "bg-growth/10 text-growth",
  technical: INDIGO,
  other: "bg-growth/10 text-growth",
};

/** Kategoriya kartasi — bosilganda savollar shu kategoriya bo'yicha filtrlanadi (`aria-pressed`). */
export function SupportCategoryCard({
  category,
  active,
  onSelect,
}: {
  category: SupportCategoryVM;
  active: boolean;
  onSelect: (key: SupportCategoryKey | null) => void;
}) {
  const s = useT().support;
  const Icon = ICONS[category.key];
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-controls="support-faq"
      data-support-category={category.key}
      onClick={() => onSelect(active ? null : category.key)}
      className={`group flex h-full w-full flex-col items-start rounded-2xl border bg-surface p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:p-5 ${
        active ? "border-signal ring-1 ring-signal" : "border-line hover:border-signal/40"
      }`}
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${TONES[category.key]}`}>
        <Icon size={22} />
      </span>
      <span className="mt-3.5 font-display text-[15px] font-bold text-ink">{category.title}</span>
      {category.description && <span className="mt-1 text-[13px] leading-snug text-dusk">{category.description}</span>}
      <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] font-semibold text-signal dark:text-indigo-300">
        {s.categoryCount(category.count)}
        <IconArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}
