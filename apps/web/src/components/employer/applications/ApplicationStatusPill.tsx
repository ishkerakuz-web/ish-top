import React from "react";
import { useT } from "../../../lib/i18n/index.js";
import type { ApplicationStatus } from "../../../lib/types.js";
import { STATUS_TONE, StatusIcon } from "../../applications/ApplicationStatus.js";

/**
 * Ariza holati (ish beruvchi nuqtayi nazaridan: "Yangi", "Ko'rib chiqilmoqda"...). Ranglar nomzod
 * sahifasidagi bilan bir xil; rang yagona belgi emas — ikonka va matn ham bor. `sm` — ro'yxat qatori.
 */
export function ApplicationStatusPill({ status, size = "md" }: { status: ApplicationStatus; size?: "sm" | "md" }) {
  const p = useT().employerApplicationsPage;
  const small = size === "sm";
  return (
    <span
      data-status-pill={status}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${STATUS_TONE[status].badge} ${
        small ? "px-2 py-0.5 text-[11.5px]" : "px-2.5 py-1 text-[12.5px]"
      }`}
    >
      <StatusIcon status={status} size={small ? 12 : 14} />
      {small ? p.tabs[status] : p.status[status]}
    </span>
  );
}
