import React, { useEffect, useId, useState } from "react";
import type { VacancyCompanyVM } from "../../../lib/vacancies/detail.js";
import type { CompanyReviewItem } from "../../../lib/types.js";
import { fetchCompany } from "../../../lib/api.js";
import { formatDate } from "../../../lib/format.js";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { Skeleton } from "../../Skeleton.js";
import { StarRating } from "../../StarRating.js";
import { SECTION_TITLE } from "./VacancyDescription.js";
import { IconArrowRight, IconRefresh } from "./icons.js";

const SHOWN = 5;

type ReviewsState = { kind: "idle" } | { kind: "loading" } | { kind: "error" } | { kind: "ok"; reviews: CompanyReviewItem[] };

/**
 * "Sharhlar" tabi — kompaniyaning tasdiqlangan sharhlari mavjud
 * `GET /api/companies/:slug` dan, tab birinchi ochilganda yuklanadi (sahifa
 * ochilishini sekinlashtirmaydi). Tab faqat sharhlar soni > 0 bo'lsa bor.
 */
export function CompanyReviewsPanel({ company, active }: { company: VacancyCompanyVM; active: boolean }) {
  const t = useT();
  const r = t.vacancyDetail.reviews;
  const l = useHref();
  const { locale } = useLocale();
  const headingId = useId();
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<ReviewsState>({ kind: "idle" });

  useEffect(() => {
    if (active && request === 0) setRequest(1);
  }, [active, request]);

  useEffect(() => {
    if (request === 0) return;
    let cancelled = false;
    setState({ kind: "loading" });
    void fetchCompany(company.slug).then((res) => {
      if (!cancelled) setState(res ? { kind: "ok", reviews: res.reviews } : { kind: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, [request, company.slug]);

  return (
    <section aria-labelledby={headingId} aria-busy={state.kind === "loading"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className={SECTION_TITLE}>
          {r.title}
        </h2>
        {company.rating !== null && (
          <p className="flex items-center gap-2 text-[14px] text-dusk">
            <StarRating value={company.rating} className="text-[16px]" />
            <span className="font-bold text-ink">{company.rating.toFixed(1)}</span>
            <span>· {t.vacancyDetail.company.reviews(company.reviewCount)}</span>
          </p>
        )}
      </div>

      {(state.kind === "idle" || state.kind === "loading") && (
        <div className="mt-5 space-y-3">
          <span className="sr-only">{r.loading}</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {state.kind === "error" && (
        <div role="alert" className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-5 py-8 text-center">
          <p className="text-[14px] text-dusk">{r.error}</p>
          <button
            type="button"
            onClick={() => setRequest((n) => n + 1)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-signal px-4 text-[13.5px] font-semibold text-white hover:bg-signal-dark"
          >
            <IconRefresh size={16} />
            {r.retry}
          </button>
        </div>
      )}

      {state.kind === "ok" &&
        (state.reviews.length === 0 ? (
          <p className="mt-5 text-[14px] text-dusk">{r.empty}</p>
        ) : (
          <>
            <ul className="mt-5 space-y-3">
              {state.reviews.slice(0, SHOWN).map((review) => (
                <li key={review.id} className="rounded-2xl border border-line bg-surface-2/40 p-4">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal-soft font-display text-sm font-bold text-signal"
                    >
                      {review.authorName.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-ink">{review.authorName}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-[12.5px] text-dusk">
                        <StarRating value={review.rating} className="text-[13px]" />
                        {formatDate(review.createdAt, locale)}
                      </p>
                    </div>
                  </div>
                  {review.comment && (
                    <p className="mt-2.5 whitespace-pre-line text-[14px] leading-relaxed text-ink/80 [overflow-wrap:anywhere]">{review.comment}</p>
                  )}
                </li>
              ))}
            </ul>
            <a
              href={l(`/companies/${company.slug}?tab=reviews`)}
              className="group mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-signal hover:underline"
            >
              {r.all}
              <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </>
        ))}
    </section>
  );
}
