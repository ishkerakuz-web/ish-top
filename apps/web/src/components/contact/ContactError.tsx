import React from "react";
import { useT } from "../../lib/i18n/index.js";
import { IconAlert, IconRefresh, Spinner } from "../support/icons.js";

export type ContactSendErrorKind = "generic" | "rate" | "offline";

/** Yuborish xatosi — forma ichida, yozilgan matn saqlanadi. "Qayta yuborish" aynan shu xabarni qayta jo'natadi. */
export function ContactError({
  kind,
  offlineText,
  sending,
  onRetry,
}: {
  kind: ContactSendErrorKind;
  offlineText: string;
  sending: boolean;
  onRetry: () => void;
}) {
  const c = useT().contact;
  return (
    <div role="alert" data-testid="contact-send-error" className="flex flex-col gap-3 rounded-2xl border border-danger/25 bg-danger/5 p-4 sm:flex-row sm:items-center">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
        <IconAlert size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">{kind === "offline" ? c.offlineTitle : c.sendErrorTitle}</p>
        <p className="mt-0.5 text-[13px] text-dusk">{kind === "rate" ? c.rateLimited : kind === "offline" ? offlineText : c.sendErrorText}</p>
      </div>
      {kind !== "offline" && (
        <button
          type="button"
          onClick={onRetry}
          disabled={sending}
          className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:w-auto"
        >
          {sending ? <Spinner size={16} /> : <IconRefresh size={16} />}
          {c.resend}
        </button>
      )}
    </div>
  );
}

/** Aloqa kanallarini yuklab bo'lmadi — forma baribir ishlaydi, kanallar uchun qayta urinish. */
export function ContactChannelsError({ onRetry }: { onRetry: () => void }) {
  const c = useT().contact;
  return (
    <div role="alert" data-testid="contact-channels-error" className="rounded-3xl border border-danger/25 bg-danger/5 p-5">
      <p className="flex items-start gap-2 text-[14px] font-semibold text-ink">
        <IconAlert size={18} className="mt-px shrink-0 text-danger" />
        {c.channelsError}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        <IconRefresh size={16} />
        {c.channelsRetry}
      </button>
    </div>
  );
}
