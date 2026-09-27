import React, { forwardRef } from "react";
import { useT } from "../../lib/i18n/index.js";
import { IconX } from "./icons.js";

export type FavoritesNoticeState = { kind: "removed"; title: string } | { kind: "error"; message: string };

/**
 * Olib tashlashdan keyingi xabar: "«…» olib tashlandi. Qaytarish" yoki xato
 * (serverdan rad — karta joyiga qaytgan). Fokus shu yerga o'tadi — olib tashlangan
 * kartadagi tugma yo'qolgach klaviatura foydalanuvchisi joyini yo'qotmasin.
 */
export const FavoritesNotice = forwardRef<HTMLDivElement, { notice: FavoritesNoticeState; onUndo: () => void; onDismiss: () => void }>(
  function FavoritesNotice({ notice, onUndo, onDismiss }, ref) {
    const t = useT();
    const r = t.favoritesPage.removed;
    const error = notice.kind === "error";
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role={error ? "alert" : "status"}
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-[13.5px] focus:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
          error ? "border-danger/30 bg-danger/10 text-danger" : "border-signal/20 bg-signal-soft text-ink"
        }`}
      >
        <span className="min-w-0 flex-1">{error ? notice.message : r.text(notice.title)}</span>
        {!error && (
          <button
            type="button"
            onClick={onUndo}
            className="shrink-0 rounded-lg px-2 py-1 font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {r.undo}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t.applicationsPage.detail.close}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-current opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          <IconX size={16} />
        </button>
      </div>
    );
  }
);
