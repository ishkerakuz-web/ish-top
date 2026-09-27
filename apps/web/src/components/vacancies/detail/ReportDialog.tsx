import React, { useEffect, useId, useRef, useState } from "react";
import { ApiError } from "../../../lib/api.js";
import { reportVacancy } from "../../../lib/apiExtra.js";
import { useAuth } from "../../AuthContext.js";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { useDialog } from "../../../lib/useDialog.js";
import { IconCheckCircle, IconX, Spinner } from "./icons.js";

type Reason = "outdated" | "wrong" | "fraud" | "other";
const REASONS: Reason[] = ["outdated", "wrong", "fraud", "other"];
type Status = "idle" | "sending" | "done" | "offline" | "error";

/**
 * "Noto'g'ri ma'lumot?" oynasi. Shikoyat `POST /api/vacancies/:slug/report` orqali
 * vakansiyaga bog'lanib admin paneldagi "Murojaatlar" qutisiga tushadi (sabab, izoh,
 * ixtiyoriy email); Telegram sozlangan bo'lsa admin chatiga ham uzatiladi.
 */
export function ReportDialog({
  open,
  onClose,
  vacancyTitle,
  companyName,
  vacancySlug,
}: {
  open: boolean;
  onClose: () => void;
  vacancyTitle: string;
  companyName: string;
  vacancySlug: string;
}) {
  const { accessToken } = useAuth();
  const t = useT();
  const r = t.vacancyDetail.report;
  const l = useHref();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const fieldId = useId();
  const [reason, setReason] = useState<Reason>("outdated");
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  useDialog(open, panelRef, onClose);

  useEffect(() => {
    if (open) {
      setStatus("idle");
      setEmailError(false);
    }
  }, [open]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mail = email.trim();
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setEmailError(true);
      return;
    }
    setStatus("sending");
    try {
      await reportVacancy(
        vacancySlug,
        { reason, ...(comment.trim() ? { comment: comment.trim().slice(0, 2000) } : {}), ...(mail ? { email: mail } : {}) },
        accessToken ?? null
      );
      setStatus("done");
    } catch (err) {
      setStatus(err instanceof ApiError && err.status === 503 ? "offline" : "error");
    }
  }

  const input =
    "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-dusk/80 focus:border-signal focus:outline-none focus:ring-4 focus:ring-signal/10";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full animate-sheet-in flex-col overflow-hidden rounded-t-3xl bg-surface shadow-pop outline-none sm:max-w-md sm:animate-pop sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-bold text-ink">
              {r.title}
            </h2>
            <p id={descId} className="mt-0.5 text-[13px] text-dusk">
              {r.subtitle}
            </p>
          </div>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label={r.close}
            className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <IconX size={20} />
          </button>
        </div>

        {status === "done" ? (
          <div role="status" className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-growth/10 text-growth">
              <IconCheckCircle size={28} />
            </span>
            <p className="mt-4 max-w-xs text-[15px] font-semibold text-ink">{r.done}</p>
            <button type="button" onClick={onClose} className="mt-6 h-11 rounded-xl bg-signal px-6 text-[14px] font-semibold text-white hover:bg-signal-dark">
              {r.close}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
              <fieldset>
                <legend className="text-[13.5px] font-semibold text-ink">{r.reason}</legend>
                <div className="mt-2 space-y-2">
                  {REASONS.map((key) => {
                    const checked = reason === key;
                    return (
                      <label
                        key={key}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-[14px] transition-colors ${
                          checked ? "border-signal bg-signal-soft font-semibold text-ink" : "border-line text-ink/85 hover:border-signal/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${fieldId}-reason`}
                          value={key}
                          checked={checked}
                          onChange={() => setReason(key)}
                          className="h-4 w-4 accent-signal"
                        />
                        {r.reasons[key]}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <label htmlFor={`${fieldId}-comment`} className="text-[13.5px] font-semibold text-ink">
                  {r.comment}
                </label>
                <textarea
                  id={`${fieldId}-comment`}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={1500}
                  placeholder={r.commentPlaceholder}
                  className={`${input} mt-1.5 resize-none`}
                />
              </div>

              <div>
                <label htmlFor={`${fieldId}-email`} className="text-[13.5px] font-semibold text-ink">
                  {r.email}
                </label>
                <input
                  id={`${fieldId}-email`}
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(false);
                  }}
                  autoComplete="email"
                  aria-invalid={emailError || undefined}
                  aria-describedby={emailError ? `${fieldId}-email-error` : undefined}
                  className={`${input} mt-1.5`}
                />
                {emailError && (
                  <p id={`${fieldId}-email-error`} className="mt-1 text-[12.5px] text-danger">
                    {r.invalidEmail}
                  </p>
                )}
              </div>

              {(status === "offline" || status === "error") && (
                <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
                  {status === "offline" ? r.offline : r.error}{" "}
                  <a href={l("/support")} className="font-semibold underline">
                    {r.support}
                  </a>
                </p>
              )}
            </div>

            <div className="flex gap-3 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-xl border border-line px-5 text-[14px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal"
              >
                {r.cancel}
              </button>
              <button
                type="submit"
                disabled={status === "sending"}
                aria-busy={status === "sending" || undefined}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-signal px-5 text-[14px] font-semibold text-white transition-colors hover:bg-signal-dark disabled:opacity-60"
              >
                {status === "sending" && <Spinner size={16} />}
                {status === "sending" ? r.sending : r.submit}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
