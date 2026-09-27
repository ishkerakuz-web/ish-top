import React, { useRef } from "react";
import { useDialog } from "../../lib/useDialog.js";
import { useT } from "../../lib/i18n/index.js";
import { IconX } from "./icons.js";

/**
 * Suhbat konteksti (kompaniya, vakansiya, havolalar) — MODAL.
 *
 * Ilgari bu ma'lumot kengroq ekranlarda chatning yonida doimiy ustun bo'lib turardi:
 * chatni toraytirardi va sahifada ikkinchi, alohida skroll maydoni hosil qilardi.
 * Endi u har qanday ekranda talab bo'yicha ochiladi — sarlavhadagi nom, "i" tugmasi
 * yoki "Vakansiya haqida" tugmasi bilan. Telefonda pastdan chiqadigan varaq,
 * undan kattaroq ekranda markazdagi modal.
 */
export function DetailsDialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const m = useT().messagesPage;
  const panelRef = useRef<HTMLDivElement>(null);
  useDialog(open, panelRef, onClose);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div aria-hidden className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="messages-details-title"
        tabIndex={-1}
        className="relative flex max-h-[85dvh] w-full animate-sheet-in flex-col rounded-t-3xl border border-line bg-paper shadow-pop focus:outline-none sm:max-h-[min(82dvh,760px)] sm:max-w-[540px] sm:animate-pop sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 id="messages-details-title" className="font-display text-[17px] font-bold text-ink">
            {m.details.dialogTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={m.details.close}
            data-autofocus
            className="flex h-10 w-10 items-center justify-center rounded-xl text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
