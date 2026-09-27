import React from "react";
import { useT } from "../../lib/i18n/index.js";
import { IconAlert, IconRefresh } from "./icons.js";

/** API xatosi (maqolalar bo'yicha qidiruv): "Yordam ma'lumotlarini yuklab bo'lmadi." + haqiqiy qayta so'rov. */
export function SupportErrorState({ onRetry }: { onRetry: () => void }) {
  const s = useT().support;
  return (
    <div role="alert" data-testid="support-error" className="flex flex-col items-start gap-4 rounded-2xl border border-danger/25 bg-danger/5 p-5 sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <IconAlert size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-bold text-ink">{s.errorTitle}</p>
        <p className="mt-0.5 text-[13.5px] text-dusk">{s.errorText}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:w-auto"
      >
        <IconRefresh size={16} />
        {s.retry}
      </button>
    </div>
  );
}
