import React from "react";
import type { SupportItemVM } from "../../lib/support/faq.js";
import { SupportAnswer } from "./SupportAnswer.js";
import { IconChat, IconChevronDown } from "./icons.js";

/**
 * WAI-ARIA accordion bandi: sarlavha ichidagi tugma (`aria-expanded`, `aria-controls`),
 * javob — `role="region"`. Yopiq javob DOM'da `hidden` bilan qoladi (qidiruv tizimi ko'radi).
 * Panel ID'si `faq-<id>` — `/support#faq-password` havolasi shu savolni ochadi.
 */
export function SupportFaqItem({ item, open, onToggle }: { item: SupportItemVM; open: boolean; onToggle: () => void }) {
  const buttonId = `faq-${item.id}-button`;
  const panelId = `faq-${item.id}`;
  return (
    <li data-faq-item={item.id} className={`rounded-2xl border bg-surface transition-colors ${open ? "border-signal/30 shadow-card" : "border-line"}`}>
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:px-5 sm:py-4"
        >
          <span
            aria-hidden
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
              open ? "bg-signal-soft text-signal dark:text-indigo-300" : "bg-surface-2 text-dusk"
            }`}
          >
            <IconChat size={16} />
          </span>
          <span className="min-w-0 flex-1 font-display text-[15px] font-semibold leading-snug text-ink">{item.question}</span>
          <IconChevronDown size={18} className={`shrink-0 text-dusk transition-transform duration-200 ${open ? "rotate-180 text-signal" : ""}`} />
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className="scroll-mt-28 px-4 pb-4 pl-[3.75rem] sm:px-5 sm:pb-5 sm:pl-16">
        <SupportAnswer paragraphs={item.answer} />
      </div>
    </li>
  );
}
