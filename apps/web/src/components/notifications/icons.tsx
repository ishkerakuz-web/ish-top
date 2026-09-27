import React from "react";
import type { NotificationCategory } from "../../lib/notifications/adapter.js";
import { IconBell, IconBriefcase, IconFile } from "../profile/icons.js";

/** Bildirishnomalar sahifasi ikonkalari — mavjud to'plamlar bilan bir uslubda (24px grid, 1.8 chiziq, dekorativ). */
export { IconAlert, IconArrowRight, IconBell, IconBriefcase, IconCheck, IconFile, IconRefresh, IconSettings, IconTrash, IconX } from "../profile/icons.js";

type IconProps = { size?: number; className?: string };

function Svg({ size = 20, className = "", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

/** Yangi vakansiyalar — karnay. */
export const IconMegaphone = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7M8 15l1.2 4.2" />
  </Svg>
);

/** Ish beruvchiga yangi ariza — nomzod qo'shildi. */
export const IconUserPlus = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" />
  </Svg>
);

export const IconBulb = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
  </Svg>
);

export const IconFilter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5h16l-6.2 7.4V19l-3.6-1.8v-4.8L4 5z" />
  </Svg>
);

/** Kategoriya ohangi (fon + matn, AA kontrast) va ikonka. */
export const CATEGORY_STYLE: Record<NotificationCategory, { tone: string; Icon: (p: IconProps) => React.ReactElement }> = {
  application: { tone: "bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300", Icon: IconBriefcase },
  vacancy: { tone: "bg-growth/10 text-growth", Icon: IconMegaphone },
  system: { tone: "bg-signal-soft text-signal", Icon: IconFile },
  applicant: { tone: "bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300", Icon: IconUserPlus },
  other: { tone: "bg-surface-2 text-dusk", Icon: IconBell },
};

export function CategoryIcon({ category, size = 20 }: { category: NotificationCategory; size?: number }) {
  const { Icon } = CATEGORY_STYLE[category];
  return <Icon size={size} />;
}
