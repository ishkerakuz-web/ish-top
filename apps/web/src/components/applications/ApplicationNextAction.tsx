import React from "react";
import { useT } from "../../lib/i18n/index.js";
import type { ApplicationStatus } from "../../lib/types.js";
import { STATUS_TONE } from "./ApplicationStatus.js";
import { IconInfo, IconInterview, IconSend, IconTrophy } from "./icons.js";

type Icon = (p: { size?: number; className?: string }) => React.ReactElement;

const NEXT_ICON: Record<ApplicationStatus, Icon> = {
  sent: IconSend,
  viewed: IconInfo,
  invited: IconInterview,
  accepted: IconTrophy,
  rejected: IconInfo,
};

/**
 * Kartadagi "keyingi qadam" satri. Matn faqat backend'dagi haqiqiy holatdan
 * tanlanadi — suhbat sanasi, ish beruvchi izohi kabi bazada yo'q ma'lumot yozilmaydi.
 * Rang badge bilan bir xil ohangda (kontrast AA), ma'no ikonka + matnda.
 */
export function ApplicationNextAction({ status }: { status: ApplicationStatus }) {
  const text = useT().applicationsPage.card.next[status];
  const Icon = NEXT_ICON[status];
  return (
    <p className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[13px] leading-snug ring-1 ring-inset ${STATUS_TONE[status].badge}`}>
      <Icon size={15} className="mt-px shrink-0" />
      <span>{text}</span>
    </p>
  );
}
