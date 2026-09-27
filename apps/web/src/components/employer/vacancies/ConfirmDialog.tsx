import React, { useId, useRef } from "react";
import { useDialog } from "../../../lib/useDialog.js";
import { IconAlert, IconTrash, Spinner } from "./icons.js";

/**
 * Qaytarib bo'lmaydigan amal oynasi (`role="alertdialog"`): fokus ichida aylanadi,
 * birinchi fokus — xavfsiz "Bekor qilish", Esc va fonga bosish yopadi (bajarilayotganda emas).
 */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
  icon = "trash",
}: {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** "trash" — o'chirish; "alert" — saqlanmagan o'zgarishlar kabi ogohlantirish. */
  icon?: "trash" | "alert";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const textId = useId();
  const cancel = () => {
    if (!busy) onCancel();
  };
  useDialog(open, panelRef, cancel);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 backdrop-blur-[2px] sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        tabIndex={-1}
        data-testid="confirm-dialog"
        className="w-full max-w-md animate-pop rounded-2xl border border-line bg-surface p-5 shadow-pop focus:outline-none sm:p-6"
      >
        {icon === "trash" ? (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
            <IconTrash size={22} />
          </span>
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold-deep">
            <IconAlert size={22} />
          </span>
        )}
        <h2 id={titleId} className="mt-4 font-display text-lg font-bold text-ink">
          {title}
        </h2>
        <p id={textId} className="mt-1.5 text-[14px] leading-relaxed text-dusk">
          {text}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            data-autofocus
            onClick={cancel}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-danger px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:text-[#0B0F1A]"
          >
            {busy ? <Spinner size={16} /> : icon === "trash" ? <IconTrash size={16} /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
