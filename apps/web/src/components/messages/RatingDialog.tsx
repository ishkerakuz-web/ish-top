import React, { useEffect, useRef, useState } from "react";
import { useDialog } from "../../lib/useDialog.js";
import { useT } from "../../lib/i18n/index.js";
import type { ConversationRating } from "../../lib/types.js";
import { StarInput } from "../StarRating.js";
import { IconX } from "./icons.js";

const OUTLINE =
  "inline-flex h-10 items-center rounded-xl border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink transition-colors hover:border-signal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

/**
 * Mavjud o'zaro baho funksiyasi (`POST /api/conversations/:id/rating`) — endi "⋮" menyusidan.
 * Ikkala tomon yozmagan bo'lsa sabab ko'rsatiladi; baho bir marta beriladi.
 */
export function RatingDialog({
  open,
  rating,
  name,
  onClose,
  onSubmit,
}: {
  open: boolean;
  rating: ConversationRating | null;
  name: string;
  onClose: () => void;
  onSubmit: (score: number, comment?: string) => Promise<void>;
}) {
  const t = useT();
  const c = t.chat;
  const m = t.messagesPage;
  const panelRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDialog(open && rating !== null, panelRef, onClose);

  useEffect(() => {
    if (!open) return;
    setScore(0);
    setComment("");
    setSaving(false);
    setError(null);
  }, [open]);

  if (!open || !rating) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!score || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(score, comment.trim() || undefined);
      onClose();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error && err.message ? err.message : m.error.title);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div aria-hidden className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-dialog-title"
        tabIndex={-1}
        className="relative w-full max-w-md animate-sheet-in rounded-t-3xl border border-line bg-surface p-5 shadow-pop focus:outline-none sm:animate-pop sm:rounded-3xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="rating-dialog-title" className="font-display text-[18px] font-bold text-ink">
              {m.rating.dialogTitle}
            </h2>
            <p className="mt-0.5 truncate text-[13.5px] text-dusk">{name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={m.details.close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <IconX size={18} />
          </button>
        </div>

        {!rating.eligible ? (
          <>
            <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-[13.5px] leading-relaxed text-dusk">{c.rateLocked}</p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={onClose} className={OUTLINE}>
                {m.rating.cancel}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="mt-4">
            <fieldset>
              <legend className="text-[13.5px] font-medium text-ink">{c.rateTitle}</legend>
              <div className="mt-2">
                <StarInput
                  value={score}
                  onChange={(value) => {
                    setScore(value);
                    setError(null);
                  }}
                  className="text-3xl"
                />
              </div>
            </fieldset>
            <label htmlFor="rating-dialog-comment" className="sr-only">
              {c.rateCommentPlaceholder}
            </label>
            <textarea
              id="rating-dialog-comment"
              value={comment}
              rows={3}
              maxLength={1000}
              placeholder={c.rateCommentPlaceholder}
              onChange={(event) => setComment(event.target.value)}
              className="mt-4 w-full resize-none rounded-xl border border-line bg-surface-2/50 px-3 py-2.5 text-[16px] text-ink placeholder:text-dusk focus:border-signal/60 focus:outline-none focus:ring-2 focus:ring-signal/20 sm:text-[14px]"
            />
            <p className="mt-2 text-[12px] text-dusk">{c.rateOnce}</p>
            {error && (
              <p role="alert" className="mt-2 text-[13px] text-danger">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className={OUTLINE}>
                {m.rating.cancel}
              </button>
              <button
                type="submit"
                disabled={!score || saving}
                className="inline-flex h-10 items-center rounded-xl bg-signal px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-signal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {saving ? c.rateSaving : c.rateSubmit}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
