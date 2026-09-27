import React, { useEffect, useRef, useState } from "react";
import { useT, useHref } from "../../../lib/i18n/index.js";
import { useAuth } from "../../../components/AuthContext.js";
import { Skeleton } from "../../../components/Skeleton.js";
import { ApiError, fetchCandidates, startConversation } from "../../../lib/api.js";
import { StarRating } from "../../../components/StarRating.js";
import { PhoneGateNotice, isPhoneGateError } from "../../../components/PhoneGateNotice.js";
import { ErrorState } from "../../../components/profile/ui.js";
import { useRequireRole } from "../../../lib/useRoleGuard.js";
import type { Candidate, ApplicantResume } from "../../../lib/types.js";

const fmtYm = (iso: string) => iso.slice(0, 7).replace("-", ".");

function candName(c: Candidate) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "—";
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  // API 400 COMPANY_REQUIRED — tarmoq xatosi emas, qayta urinish yordam bermaydi (audit PHASE 6, U5)
  | { kind: "needCompany" }
  // 403 PHONE_NOT_VERIFIED yoki 503 TELEGRAM_UNAVAILABLE — nomzodlar bazasi telefon tasdig'ini
  // talab qiladi (audit R3, D-071); sabab PhoneGateNotice ichida ko'rsatiladi
  | { kind: "gated" }
  // 429 — soatlik kvota tugadi (audit R3, D-071): server xabari ko'rsatiladi
  | { kind: "quota"; message: string }
  | { kind: "ready"; items: Candidate[]; page: number; hasMore: boolean };

/** API xatosi → sahifa holati. Xato hech qachon "nomzod topilmadi" bo'lib ko'rinmaydi. */
function errorState(err: unknown): LoadState {
  if (err instanceof ApiError) {
    if (err.code === "COMPANY_REQUIRED") return { kind: "needCompany" };
    if (isPhoneGateError(err) || err.code === "TELEGRAM_UNAVAILABLE") return { kind: "gated" };
    if (err.status === 429) return { kind: "quota", message: err.message && err.message !== "Xatolik" ? err.message : "" };
  }
  return { kind: "error" };
}

/** Keyingi sahifa holati — birinchi sahifa xatosidan alohida (audit PHASE 6, U25). */
type MoreState = "idle" | "loading" | "error";

/**
 * Nomzodlar bazasi (platforma bepul — tarif cheklovi yo'q).
 * Audit ISSUE-023: qidiruv so'rovlari poygasi (eski javob yangisini yozardi) AbortController bilan
 * yopildi; API xatosi "nomzod topilmadi" bo'lib ko'rinmaydi; "Xabar yozish" takroriy bosishdan himoyalangan.
 * Audit PHASE 6: U25 — API sahifalaydi, "Yana ko'rsatish" keyingi sahifani qo'shadi; U5 — kompaniya profili
 * yo'q bo'lsa (COMPANY_REQUIRED) umumiy tarmoq xatosi o'rniga profilga yo'naltiruvchi holat.
 */
export default function Page() {
  const t = useT();
  const l = useHref();
  const { status, accessToken, user } = useAuth();
  useRequireRole("employer", "/");
  const allowed = status === "authed" && user?.role === "employer" && Boolean(accessToken);

  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [more, setMore] = useState<MoreState>("idle");
  const moreRef = useRef<AbortController | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [gated, setGated] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed || !accessToken) return;
    const controller = new AbortController();
    // Yangi qidiruv yoki qayta urinish — eski "keyingi sahifa" so'rovi bekor qilinadi (audit PHASE 6, U25)
    moreRef.current?.abort();
    moreRef.current = null;
    setMore("idle");
    setState({ kind: "loading" });
    setActiveId(null);
    fetchCandidates(accessToken, { text: submitted || undefined }, controller.signal).then(
      (res) => {
        if (!controller.signal.aborted) setState({ kind: "ready", items: res.items, page: 1, hasMore: res.hasMore });
      },
      (err: unknown) => {
        if (controller.signal.aborted || (err as Error)?.name === "AbortError") return;
        setState(errorState(err));
      }
    );
    return () => controller.abort();
  }, [allowed, accessToken, submitted, attempt]);

  // Sahifadan chiqilganda tugamagan "keyingi sahifa" so'rovi to'xtatiladi
  useEffect(() => () => moreRef.current?.abort(), []);

  function loadMore() {
    // moreRef sinxron o'rnatiladi — tez ikki marta bosish ikkinchi so'rov yubormaydi
    if (!accessToken || state.kind !== "ready" || !state.hasMore || moreRef.current) return;
    const controller = new AbortController();
    moreRef.current = controller;
    const nextPage = state.page + 1;
    setMore("loading");
    fetchCandidates(accessToken, { text: submitted || undefined, page: nextPage }, controller.signal).then(
      (res) => {
        if (controller.signal.aborted) return;
        moreRef.current = null;
        setState((current) => {
          if (current.kind !== "ready" || current.page >= nextPage) return current;
          // Sahifalar orasida ro'yxat o'zgarsa, takror kelgan nomzod ikki marta chiqmaydi
          const seen = new Set(current.items.map((c) => c.userId));
          const fresh = res.items.filter((c) => !seen.has(c.userId));
          return { kind: "ready", items: [...current.items, ...fresh], page: nextPage, hasMore: res.hasMore && res.items.length > 0 };
        });
        setMore("idle");
      },
      (err: unknown) => {
        if (controller.signal.aborted || (err as Error)?.name === "AbortError") return;
        moreRef.current = null;
        setMore("error");
      }
    );
  }

  function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const next = q.trim();
    if (next === submitted) setAttempt((n) => n + 1);
    else setSubmitted(next);
  }

  async function openChat(candidateUserId: string) {
    if (!accessToken || chatBusy) return;
    setChatBusy(true);
    setChatError(null);
    setGated(false);
    try {
      const id = await startConversation(accessToken, { candidateUserId });
      window.location.assign(l(`/messages?c=${id}`));
    } catch (err) {
      if (isPhoneGateError(err)) setGated(true);
      else setChatError(err instanceof ApiError && err.status === 403 ? t.candidatesPage.chatUnavailable : t.admin.common.failed);
      setChatBusy(false);
    }
  }

  const items = state.kind === "ready" ? state.items : [];
  const hasMore = state.kind === "ready" && state.hasMore;
  const active = items.find((c) => c.userId === activeId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t.candidatesPage.title}</h1>
        <p className="mt-1 text-sm text-dusk">{t.candidatesPage.subtitle}</p>
      </div>

      {gated && <PhoneGateNotice className="mb-5" />}

      <form role="search" onSubmit={runSearch} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dusk"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
            aria-label={t.candidatesPage.searchPlaceholder}
            placeholder={t.candidatesPage.searchPlaceholder}
            className="h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-sm text-ink placeholder:text-dusk focus:border-signal focus:outline-none focus:ring-4 focus:ring-signal/10"
          />
        </div>
        <button
          type="submit"
          className="h-12 shrink-0 rounded-xl bg-signal px-6 text-sm font-semibold text-white transition-all hover:bg-signal-dark hover:shadow-sm active:scale-[0.98]"
        >
          {t.candidatesPage.searchButton}
        </button>
      </form>

      {state.kind === "loading" ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : state.kind === "error" ? (
        <ErrorState onRetry={() => setAttempt((n) => n + 1)} />
      ) : state.kind === "gated" ? (
        <PhoneGateNotice />
      ) : state.kind === "quota" ? (
        <div role="alert" className="flex flex-col items-center rounded-2xl border border-danger/20 bg-danger/5 px-6 py-10 text-center">
          <p className="font-display text-[15px] font-bold text-ink">{t.profileHub.states.loadError}</p>
          {state.message && <p className="mt-1 max-w-md text-[13.5px] text-dusk">{state.message}</p>}
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-4 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            {t.profileHub.states.retry}
          </button>
        </div>
      ) : state.kind === "needCompany" ? (
        <div className="animate-fade-up rounded-2xl border border-line bg-surface px-6 py-12 text-center sm:p-12">
          <p className="font-display text-lg font-semibold text-ink">{t.candidatesPage.needCompanyTitle}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-dusk">{t.candidatesPage.needCompanyText}</p>
          <a
            href={l("/profile")}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-signal px-6 text-sm font-semibold text-white transition-all hover:bg-signal-dark hover:shadow-sm active:scale-[0.98]"
          >
            {t.candidatesPage.needCompanyAction}
          </a>
        </div>
      ) : items.length === 0 ? (
        <div className="animate-fade-up rounded-2xl border border-line bg-surface p-12 text-center">
          <p className="font-display text-lg font-semibold text-ink">{t.candidatesPage.empty}</p>
          <p className="mt-1 text-sm text-dusk">{t.candidatesPage.emptyHint}</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p role="status" className="text-xs font-semibold uppercase tracking-wide text-dusk">
              {t.candidatesPage.resultsCount(items.length)}
            </p>
            {/* Yana sahifa bor — son to'liq emas, qidiruvni aniqlashtirish taklifi (audit PHASE 6, U25) */}
            {hasMore && <p className="text-xs text-dusk">{t.candidatesPage.refineHint}</p>}
          </div>
          <div className="grid min-h-[60vh] grid-cols-1 overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-[minmax(300px,360px)_1fr]">
            {/* Ro'yxat */}
            <div className={`flex-col border-line md:flex md:border-r ${activeId ? "hidden" : "flex"}`}>
              <div className="max-h-[70vh] flex-1 overflow-y-auto">
                {items.map((c) => {
                  const name = candName(c);
                  return (
                    <button
                      key={c.userId}
                      onClick={() => {
                        setActiveId(c.userId);
                        setChatError(null);
                      }}
                      className={`flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors hover:bg-surface-2 ${
                        c.userId === activeId ? "bg-surface-2" : ""
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-sm font-bold text-ink">
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-ink">{name}</span>
                          {c.ratingAvg !== null && c.ratingCount > 0 && (
                            <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-gold-deep">
                              <span aria-hidden className="text-gold">★</span>
                              {c.ratingAvg.toFixed(1)}
                            </span>
                          )}
                        </span>
                        {c.headline && <span className="block truncate text-xs text-dusk">{c.headline}</span>}
                        {c.regionName && <span className="block truncate text-[11px] text-dusk">{c.regionName}</span>}
                      </span>
                    </button>
                  );
                })}
                {hasMore && (
                  <div className="px-4 py-3">
                    {more === "error" ? (
                      <div role="alert" className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-danger">{t.candidatesPage.loadMoreError}</p>
                        <button
                          type="button"
                          onClick={loadMore}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2"
                        >
                          {t.profileHub.states.retry}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={more === "loading"}
                        aria-busy={more === "loading" || undefined}
                        className="h-10 w-full rounded-xl border border-line text-sm font-semibold text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {more === "loading" ? t.ui.loading : t.candidatesPage.loadMore}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Detal */}
            <div className={`flex-col ${activeId ? "flex" : "hidden md:flex"}`}>
              {active ? (
                <CandidateDetail
                  c={active}
                  onBack={() => setActiveId(null)}
                  onChat={() => void openChat(active.userId)}
                  chatBusy={chatBusy}
                  chatError={chatError}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-10 text-sm text-dusk">
                  {t.candidatesPage.selectHint}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CandidateDetail({
  c,
  onBack,
  onChat,
  chatBusy,
  chatError,
}: {
  c: Candidate;
  onBack: () => void;
  onChat: () => void;
  chatBusy: boolean;
  chatError: string | null;
}) {
  const t = useT();
  const name = candName(c);
  const hasContact = Boolean(c.email || c.phone);
  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-dusk transition-colors hover:bg-surface-2 md:hidden"
          aria-label={t.empApplications.back}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-signal font-display text-base font-bold text-white">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-base font-bold text-ink">{name}</span>
            {c.ratingAvg !== null && c.ratingCount > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-xs text-dusk">
                <StarRating value={c.ratingAvg} className="text-xs" />
                {c.ratingAvg.toFixed(1)} ({c.ratingCount})
              </span>
            )}
          </div>
          {c.headline && <p className="truncate text-sm text-dusk">{c.headline}</p>}
        </div>
        <button
          onClick={onChat}
          disabled={chatBusy}
          aria-busy={chatBusy || undefined}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-signal px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-signal-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 5h16v11H8l-4 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          {t.candidatesPage.message}
        </button>
      </div>
      {chatError && (
        <p role="alert" className="border-b border-line bg-danger/5 px-4 py-2 text-sm text-danger sm:px-6">
          {chatError}
        </p>
      )}

      <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        <section className="rounded-xl border border-line bg-surface-2/40 p-4">
          <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-wide text-dusk">
            {t.empApplications.contactInfo}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {c.email && (
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-dusk">Email</div>
                <a href={`mailto:${c.email}`} className="block truncate text-sm font-medium text-ink hover:text-signal">
                  {c.email}
                </a>
              </div>
            )}
            {c.phone && (
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-dusk">{t.profile.phone}</div>
                <a href={`tel:${c.phone}`} className="block truncate text-sm font-medium text-ink hover:text-signal">
                  {c.phone}
                </a>
              </div>
            )}
            {c.regionName && (
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-dusk">{t.empApplications.regionLabel}</div>
                <div className="truncate text-sm font-medium text-ink">{c.regionName}</div>
              </div>
            )}
          </div>
          {/* Kontaktlar faqat shu kompaniyaga ariza yuborgan nomzodda ko'rinadi (audit ISSUE-008) */}
          {!hasContact && <p className="mt-2 text-sm text-dusk">{t.candidatesPage.contactHidden}</p>}
          {c.isOpenToWork && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-growth/10 px-2.5 py-1 text-xs font-semibold text-growth">
              <span className="h-1.5 w-1.5 rounded-full bg-growth" />
              {t.empApplications.openToWork}
            </span>
          )}
        </section>

        {c.resume ? (
          <ResumeView resume={c.resume} />
        ) : (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-dusk">
            {t.empApplications.noResume}
          </p>
        )}
      </div>
    </div>
  );
}

function ResumeView({ resume }: { resume: ApplicantResume }) {
  const t = useT();
  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface-2/40 p-4 text-sm">
      {resume.summary && (
        <div>
          <h3 className="font-semibold text-ink">{t.empApplications.resumeSummary}</h3>
          <p className="mt-1 whitespace-pre-wrap text-dusk">{resume.summary}</p>
        </div>
      )}
      {resume.desiredSalary ? (
        <p className="text-dusk">
          {t.empApplications.desiredSalary}:{" "}
          <span className="font-mono font-semibold text-growth">
            {new Intl.NumberFormat("ru-RU").format(resume.desiredSalary)}
          </span>
        </p>
      ) : null}
      {resume.skills.length > 0 && (
        <div>
          <h3 className="font-semibold text-ink">{t.empApplications.resumeSkills}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {resume.skills.map((s) => (
              <span key={s.skillName} className="rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-ink">
                {s.skillName}
              </span>
            ))}
          </div>
        </div>
      )}
      {resume.experience.length > 0 && (
        <div>
          <h3 className="font-semibold text-ink">{t.empApplications.resumeExperience}</h3>
          <ul className="mt-1.5 space-y-2">
            {resume.experience.map((e, i) => (
              <li key={i} className="text-dusk">
                <span className="font-medium text-ink">{e.position}</span> · {e.companyName}
                <span className="ml-1 text-xs">
                  ({fmtYm(e.startDate)} – {e.endDate ? fmtYm(e.endDate) : "..."})
                </span>
                {e.description && <p className="mt-0.5 text-xs">{e.description}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {resume.education.length > 0 && (
        <div>
          <h3 className="font-semibold text-ink">{t.empApplications.resumeEducation}</h3>
          <ul className="mt-1.5 space-y-1.5">
            {resume.education.map((e, i) => (
              <li key={i} className="text-dusk">
                <span className="font-medium text-ink">{e.institution}</span>
                {e.field ? ` · ${e.field}` : ""}
                <span className="ml-1 text-xs">
                  ({e.startYear}–{e.endYear ?? "..."})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
