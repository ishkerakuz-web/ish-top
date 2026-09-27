import React, { useId } from "react";
import { useT } from "../../lib/i18n/index.js";

/** "Masalan:" tezkor so'zlari — faqat savollar ichida natija beradiganlari keladi (bo'sh bo'lsa chizilmaydi). */
export function SupportSearchSuggestions({ terms, active, onPick }: { terms: string[]; active: string; onPick: (term: string) => void }) {
  const s = useT().support;
  const labelId = useId();
  if (terms.length === 0) return null;
  const current = active.toLocaleLowerCase();
  return (
    <div role="group" aria-labelledby={labelId} className="mt-3 flex flex-wrap items-center gap-2" data-testid="support-suggestions">
      <span id={labelId} className="text-[13px] text-dusk">
        {s.suggestionsLabel}
      </span>
      {terms.map((term) => {
        const on = current === term.toLocaleLowerCase();
        return (
          <button
            key={term}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? "" : term)}
            className={`rounded-lg border px-2.5 py-1 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
              on ? "border-signal bg-signal-soft text-signal dark:text-indigo-300" : "border-line bg-surface text-ink/80 hover:border-signal/40 hover:text-signal"
            }`}
          >
            {term}
          </button>
        );
      })}
    </div>
  );
}
