import React, { useEffect } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { IconAlert, IconCheckCircle, IconX } from "./icons.js";

export interface NoticeState {
  tone: "success" | "error";
  text: string;
  /** Bir xil matn qayta chiqsa ham taymer yangilansin. */
  id: number;
}

/** Amal natijasi: muvaffaqiyat 5 soniyada o'zi yopiladi (`role="status"`), xato turib qoladi (`role="alert"`). */
export function VacancyNotice({ notice, onDismiss }: { notice: NoticeState; onDismiss: () => void }) {
  const p = useT().employerVacanciesPage;
  useEffect(() => {
    if (notice.tone !== "success") return;
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);

  const success = notice.tone === "success";
  return (
    <div
      role={success ? "status" : "alert"}
      data-testid="vacancies-notice"
      data-tone={notice.tone}
      className={`mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-[14px] text-ink ${success ? "border-growth/25 bg-growth/[0.07]" : "border-danger/25 bg-danger/5"}`}
    >
      <span className={`mt-px shrink-0 ${success ? "text-growth" : "text-danger"}`}>{success ? <IconCheckCircle size={18} /> : <IconAlert size={18} />}</span>
      <p className="min-w-0 flex-1">{notice.text}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={p.notices.dismiss}
        className="-my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        <IconX size={14} />
      </button>
    </div>
  );
}
