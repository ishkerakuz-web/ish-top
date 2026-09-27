import React from "react";
import { timelineOf } from "../../lib/applications/query.js";
import { formatDate } from "../../lib/format.js";
import { useLocale, useT } from "../../lib/i18n/index.js";
import type { MyApplication } from "../../lib/types.js";
import { STATUS_TONE, StatusIcon } from "./ApplicationStatus.js";

/**
 * Ariza tarixi — faqat haqiqiy bosqichlar (yuborilgan vaqt + holat tarixi).
 * Hali bo'lmagan bosqichlar ("Natija") ko'rsatilmaydi.
 */
export function ApplicationTimeline({ app }: { app: MyApplication }) {
  const a = useT().applicationsPage;
  const { locale } = useLocale();
  const steps = timelineOf(app);

  return (
    <ol className="relative">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={`${step.status}-${i}`} className="relative flex gap-3 pb-5 last:pb-0" aria-current={last ? "step" : undefined}>
            {!last && <span aria-hidden className="absolute bottom-0 left-[15px] top-9 w-px bg-line" />}
            <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${STATUS_TONE[step.status].soft}`}>
              <StatusIcon status={step.status} size={15} />
            </span>
            <div className="min-w-0 pt-1">
              <p className={`text-[14px] leading-snug ${last ? "font-semibold text-ink" : "font-medium text-ink/85"}`}>
                {a.timeline[step.status]}
              </p>
              <p className="mt-0.5 text-[12.5px] text-dusk">
                {step.at && <time dateTime={step.at}>{formatDate(step.at, locale)}</time>}
                {step.at && last && <span aria-hidden> · </span>}
                {last && a.detail.current}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
