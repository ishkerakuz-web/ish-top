import React, { useEffect, useId, useRef, useState } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { useDialog } from "../../../lib/useDialog.js";
import { Field, TextArea } from "../vacancies/form/FormControls.js";
import type { QuickAction } from "./ApplicationSidebar.js";
import { IconCheckCircle, IconInterview, IconXCircle, Spinner } from "./icons.js";

const TONE: Record<QuickAction, { tile: string; button: string; Icon: React.ComponentType<{ size?: number }> }> = {
  invite: {
    tile: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    button: "bg-signal text-white hover:bg-signal-dark focus-visible:ring-signal",
    Icon: IconInterview,
  },
  accept: {
    tile: "bg-growth/10 text-growth",
    button: "bg-signal text-white hover:bg-signal-dark focus-visible:ring-signal",
    Icon: IconCheckCircle,
  },
  reject: {
    tile: "bg-danger/10 text-danger",
    button: "bg-danger text-white hover:opacity-90 focus-visible:ring-danger dark:text-[#0B0F1A]",
    Icon: IconXCircle,
  },
};

/**
 * Holatni o'zgartirishni tasdiqlash (nomzodga bildirishnoma boradi): ixtiyoriy izoh — backend
 * uni nomzodga suhbat xabari qilib yuboradi. Fokus ichida, Esc/fon — yopadi (saqlanayotganda emas).
 * Rad etish — `alertdialog`, qizil tugma.
 */
export function ApplicationStatusDialog({
  action,
  name,
  vacancy,
  initialReason,
  busy,
  onConfirm,
  onCancel,
}: {
  action: QuickAction | null;
  name: string;
  vacancy: string;
  initialReason: string;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const p = t.employerApplicationsPage;
  const open = action !== null;
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const textId = useId();
  const [reason, setReason] = useState(initialReason);
  useEffect(() => {
    if (open) setReason(initialReason);
  }, [open, initialReason]);

  const cancel = () => {
    if (!busy) onCancel();
  };
  useDialog(open, panelRef, cancel);
  if (!action) return null;

  const copy = p.dialog[action];
  const tone = TONE[action];
  const Icon = tone.Icon;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 backdrop-blur-[2px] sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      {/* Telefon ekranida ham amal tugmalari ko'rinadi: baland oyna ichida aylanadi (audit R3, a11y-ui-1) */}
      <div
        ref={panelRef}
        role={action === "reject" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        tabIndex={-1}
        data-testid="application-status-dialog"
        data-dialog-action={action}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md animate-pop overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-5 shadow-pop focus:outline-none sm:p-6"
      >
        <span aria-hidden className={`flex h-12 w-12 items-center justify-center rounded-full ${tone.tile}`}>
          <Icon size={22} />
        </span>
        <h2 id={titleId} className="mt-4 font-display text-lg font-bold text-ink">
          {copy.title}
        </h2>
        <p id={textId} className="mt-1.5 text-[14px] leading-relaxed text-dusk [overflow-wrap:anywhere]">
          {copy.text(name, vacancy)}
        </p>
        <Field id="application-dialog-reason" label={p.sidebar.reasonLabel} hint={p.sidebar.reasonHint} className="mt-4">
          <TextArea
            id="application-dialog-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={p.sidebar.reasonPlaceholder}
            aria-describedby="application-dialog-reason-hint"
            className="min-h-[88px]"
          />
        </Field>
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            data-autofocus
            onClick={cancel}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {p.dialog.cancel}
          </button>
          <button
            type="button"
            data-action="confirm-status"
            onClick={() => onConfirm(reason.trim())}
            disabled={busy}
            aria-busy={busy || undefined}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${tone.button}`}
          >
            {busy && <Spinner size={16} />}
            {busy ? p.dialog.busy : copy.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
