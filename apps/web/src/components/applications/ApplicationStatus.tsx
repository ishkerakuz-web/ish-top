import React from "react";
import { useT } from "../../lib/i18n/index.js";
import type { ApplicationStatus } from "../../lib/types.js";
import { IconCheckCircle, IconEye, IconInterview, IconSend, IconXCircle } from "./icons.js";

/**
 * Holat rangi — faqat qo'shimcha belgi: har doim ikonka + matn bilan birga.
 * Yuborilgan — ko'k, ko'rib chiqilmoqda — amber, suhbat — binafsha,
 * qabul — yashil, rad — qizil. Tungi rejimda matn ochroq ohangga o'tadi (kontrast).
 */
export const STATUS_TONE: Record<ApplicationStatus, { badge: string; soft: string; dot: string }> = {
  sent: {
    badge: "bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:bg-blue-400/15 dark:text-blue-300 dark:ring-blue-400/25",
    soft: "bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  viewed: {
    // Kunduzgi rejimda /15 fonda kontrast 4.48 edi — /10 bilan 4.6+ (AA)
    badge: "bg-gold/10 text-gold-deep ring-gold/30 dark:bg-gold/15",
    soft: "bg-gold/15 text-gold-deep",
    dot: "bg-gold",
  },
  invited: {
    badge:
      "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:bg-violet-400/15 dark:text-violet-300 dark:ring-violet-400/25",
    soft: "bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  accepted: {
    badge: "bg-growth/10 text-growth ring-growth/25",
    soft: "bg-growth/10 text-growth",
    dot: "bg-growth",
  },
  rejected: {
    badge: "bg-danger/10 text-danger ring-danger/25",
    soft: "bg-danger/10 text-danger",
    dot: "bg-danger",
  },
};

const STATUS_ICON: Record<ApplicationStatus, (p: { size?: number; className?: string }) => React.ReactElement> = {
  sent: IconSend,
  viewed: IconEye,
  invited: IconInterview,
  accepted: IconCheckCircle,
  rejected: IconXCircle,
};

export function StatusIcon({ status, size = 14 }: { status: ApplicationStatus; size?: number }) {
  const Icon = STATUS_ICON[status];
  return <Icon size={size} />;
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const label = useT().applicationsPage.status[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-inset ${STATUS_TONE[status].badge}`}
    >
      <StatusIcon status={status} size={14} />
      {label}
    </span>
  );
}
