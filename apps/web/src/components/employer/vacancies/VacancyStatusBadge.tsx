import React from "react";
import { useT } from "../../../lib/i18n/index.js";
import type { EmployerVacancyStatus } from "../../../lib/employer/vacancies/adapter.js";
import { IconClock, IconFile, IconPause, IconXCircle } from "./icons.js";

const TONES: Record<EmployerVacancyStatus, string> = {
  active: "bg-growth/10 text-growth",
  moderation: "bg-gold/15 text-gold-deep",
  draft: "bg-surface-2 text-dusk ring-1 ring-inset ring-line",
  rejected: "bg-danger/10 text-danger",
  archived: "bg-surface-2 text-dusk ring-1 ring-inset ring-line",
};

/** Holat belgisi — rang yagona belgi emas: ikonka va matn ham bor. */
export function VacancyStatusBadge({ status }: { status: EmployerVacancyStatus }) {
  const p = useT().employerVacanciesPage;
  const icon =
    status === "active" ? (
      <span aria-hidden className="h-2 w-2 rounded-full bg-growth" />
    ) : status === "moderation" ? (
      <IconClock size={13} />
    ) : status === "draft" ? (
      <IconFile size={13} />
    ) : status === "rejected" ? (
      <IconXCircle size={13} />
    ) : (
      <IconPause size={12} />
    );
  return (
    <span data-status-badge={status} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-wide ${TONES[status]}`}>
      {icon}
      {p.status[status]}
    </span>
  );
}
