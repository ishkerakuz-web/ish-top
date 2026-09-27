import React, { useEffect, useId, useMemo, useState } from "react";
import type { CompanyReviewVM } from "../../../lib/companies/detail.js";
import { isMyReview, ratingSummary } from "../../../lib/companies/detail.js";
import { loginHrefWithReturn } from "../../../lib/auth/returnTo.js";
import { ApiError, deleteReview, submitReview } from "../../../lib/api.js";
import { formatDate } from "../../../lib/format.js";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { useAuth } from "../../AuthContext.js";
import { StarInput, StarRating } from "../../StarRating.js";
import { PhoneGateNotice, isPhoneGateError } from "../../PhoneGateNotice.js";
import { CARD, CARD_TITLE, LINK_BUTTON } from "./styles.js";
import { IconArrowRight, IconStar, IconX, Spinner } from "./icons.js";

type FormError = "rating" | "forbidden" | "failed" | null;

/**
 * "Xodimlar nima deydi?" — tasdiqlangan sharhlar: umumiy baho, 5→1 taqsimot
 * (haqiqiy sonlar), sharhlar ro'yxati. Yozish/tahrirlash/o'chirish — mavjud
 * `POST /api/companies/:slug/reviews` va `DELETE /api/reviews/:id` (backend
 * faqat shu kompaniyaga ariza yuborgan nomzodga ruxsat beradi).
 * `limit` berilsa (asosiy tab) — birinchi sharhlar va "Barchasini ko'rish";
 * forma faqat to'liq ro'yxatda yoki sharh hali yo'q bo'lsa chiqadi.
 */
export function CompanyReviews({
  slug,
  reviews,
  onChange,
  limit,
  onShowAll,
}: {
  slug: string;
  reviews: CompanyReviewVM[];
  onChange: (next: CompanyReviewVM[]) => void;
  limit?: number;
  onShowAll?: () => void;
}) {
  const t = useT();
  const d = t.companyDetail.reviews;
  const r = t.reviews;
  const l = useHref();
  const { locale } = useLocale();
  const headingId = useId();
  const formId = useId();
  const { status, user, accessToken } = useAuth();

  const summary = useMemo(() => ratingSummary(reviews), [reviews]);
  const isSeeker = status === "authed" && user?.role === "job_seeker" && Boolean(accessToken);
  const isAdmin = status === "authed" && user?.role === "admin";
  // Audit R3, D-075: "meniki" serverdagi `mine` bayrog'idan (eski javobda userId)
  const mine = reviews.find((x) => isMyReview(x, user?.id));
  const notMine = (x: CompanyReviewVM) => !isMyReview(x, user?.id);
  const shown = limit ? reviews.slice(0, limit) : reviews;
  const showForm = !limit || reviews.length === 0;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError>(null);
  const [gated, setGated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  // Audit R3, candidate-flows-12: kirishdan keyin shu kompaniya sahifasiga qaytadi
  const loginHref = l("/login");
  const [guestLogin, setGuestLogin] = useState(loginHref);
  useEffect(() => {
    setGuestLogin(loginHrefWithReturn(loginHref));
  }, [loginHref]);

  // Oldin yozilgan sharh bo'lsa forma o'sha qiymatlar bilan to'ladi (tahrirlash)
  useEffect(() => {
    setRating(mine?.rating ?? 0);
    setComment(mine?.comment ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine?.id]);

  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(id);
  }, [saved]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    if (rating < 1) {
      setError("rating");
      return;
    }
    setBusy(true);
    setError(null);
    setGated(false);
    try {
      const result = await submitReview(accessToken, slug, { rating, comment: comment.trim() || undefined });
      if (result.status === "pending") {
        // Moderatsiyadagi sharh ochiq ro'yxatda ko'rinmaydi — foydalanuvchiga holati aytiladi
        onChange(reviews.filter((x) => x.id !== result.id && notMine(x)));
        setSaved(false);
        setPending(true);
        return;
      }
      const item: CompanyReviewVM = {
        id: result.id,
        rating: result.rating,
        comment: result.comment?.trim() || null,
        createdAt: result.createdAt,
        authorName: result.authorName || null,
        mine: true,
        userId: user?.id ?? null,
      };
      onChange([item, ...reviews.filter((x) => x.id !== item.id && notMine(x))]);
      setPending(false);
      setSaved(true);
    } catch (err) {
      if (isPhoneGateError(err)) setGated(true);
      else setError(err instanceof ApiError && err.status === 403 ? "forbidden" : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!accessToken || !window.confirm(r.deleteConfirm)) return;
    try {
      await deleteReview(accessToken, id);
      onChange(reviews.filter((x) => x.id !== id));
    } catch {
      setError("failed");
    }
  }

  const max = Math.max(1, summary.count);

  return (
    <section aria-labelledby={headingId} className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className={CARD_TITLE}>
          {d.title}
        </h2>
        {limit && onShowAll && reviews.length > limit && (
          <button type="button" onClick={onShowAll} className={LINK_BUTTON}>
            {d.all}
            <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>

      {summary.rating !== null ? (
        <div className="mt-4 grid items-center gap-5 rounded-2xl border border-line p-4 sm:grid-cols-[minmax(0,190px)_minmax(0,1fr)] sm:p-5">
          <div className="flex items-center gap-4 sm:flex-col sm:items-start sm:gap-1">
            <p className="font-display text-[2.6rem] font-extrabold leading-none tabular-nums text-ink">{summary.rating.toFixed(1)}</p>
            <div>
              <StarRating value={summary.rating} className="text-[19px]" />
              <p className="mt-1 text-[13px] text-dusk">{d.summary(summary.count)}</p>
            </div>
          </div>
          <ul aria-label={d.distribution} className="space-y-1.5">
            {summary.distribution.map((row) => (
              <li key={row.stars} aria-label={d.starsRow(row.stars, row.count)} className="flex items-center gap-3 text-[12.5px] text-dusk">
                <span aria-hidden className="inline-flex w-7 shrink-0 items-center gap-0.5 tabular-nums">
                  {row.stars}
                  <IconStar size={12} className="text-gold" />
                </span>
                <span aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-signal" style={{ width: `${(row.count / max) * 100}%` }} />
                </span>
                <span aria-hidden className="w-8 shrink-0 text-right tabular-nums">
                  {row.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-9 text-center">
          <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/15 text-gold">
            <IconStar size={24} />
          </span>
          <p className="mt-4 font-display text-[16px] font-bold text-ink">{d.emptyTitle}</p>
          <p className="mt-1 max-w-sm text-[14px] text-dusk">{d.emptyText}</p>
        </div>
      )}

      {shown.length > 0 && (
        <ul className="mt-4 space-y-3">
          {shown.map((review) => {
            const name = review.authorName ?? d.anonymous;
            const isMine = isMyReview(review, user?.id);
            return (
              <li key={review.id} className="rounded-2xl border border-line p-4">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-signal-soft font-display text-[15px] font-bold text-signal">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-[14.5px] font-semibold text-ink [overflow-wrap:anywhere]">{name}</span>
                      {isMine && <span className="rounded-md bg-signal-soft px-1.5 py-0.5 text-[11px] font-semibold text-signal">{d.mine}</span>}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-dusk">
                      <StarRating value={review.rating} className="text-[14px]" />
                      {review.createdAt && <span>{formatDate(review.createdAt, locale)}</span>}
                    </p>
                  </div>
                  {(isMine || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => void onDelete(review.id)}
                      aria-label={r.delete}
                      title={r.delete}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-dusk transition-colors hover:bg-surface-2 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                    >
                      <IconX size={16} />
                    </button>
                  )}
                </div>
                {review.comment && <p className="mt-2.5 whitespace-pre-line text-[14.5px] leading-relaxed text-ink/80 [overflow-wrap:anywhere]">{review.comment}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {showForm && isSeeker && (
        <form onSubmit={onSubmit} className="mt-5 rounded-2xl border border-line bg-surface-2/40 p-4 sm:p-5" noValidate>
          <p className="text-[14.5px] font-semibold text-ink">{mine ? r.editReview : r.writeReview}</p>
          <p className="mt-0.5 text-[12.5px] text-dusk">{d.writeHint}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span id={`${formId}-rating`} className="text-[13.5px] text-dusk">
              {r.yourRating}:
            </span>
            <span role="group" aria-labelledby={`${formId}-rating`}>
              <StarInput
                value={rating}
                onChange={(v) => {
                  setRating(v);
                  setError(null);
                }}
              />
            </span>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={2000}
            aria-label={r.commentPlaceholder}
            placeholder={r.commentPlaceholder}
            className="mt-3 w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-dusk/80 focus:border-signal focus:outline-none focus:ring-4 focus:ring-signal/10"
          />
          {gated && <PhoneGateNotice className="mt-2" />}
          {error && (
            <p role="alert" className="mt-2 text-[13px] text-danger">
              {error === "rating" ? r.ratingRequired : error === "forbidden" ? d.writeHint : t.vacancyDetail.report.error}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy || undefined}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-signal px-5 text-[14px] font-semibold text-white transition-colors hover:bg-signal-dark disabled:opacity-60"
            >
              {busy && <Spinner size={15} />}
              {busy ? r.submitting : r.submit}
            </button>
            <span role="status" className="text-[13.5px] font-medium text-growth">
              {saved ? r.saved : pending ? r.pendingModeration : ""}
            </span>
          </div>
        </form>
      )}

      {showForm && status === "guest" && (
        <a
          href={guestLogin}
          className="group mt-5 inline-flex items-center gap-1.5 rounded-md text-[14px] font-semibold text-signal hover:underline"
        >
          {d.loginToWrite}
          <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </a>
      )}
    </section>
  );
}
