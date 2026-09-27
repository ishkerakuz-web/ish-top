import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { useHistoryQuery } from "../../../lib/useHistoryQuery.js";
import { ApiError, startConversation } from "../../../lib/api.js";
import { emitInboxChanged } from "../../../lib/messages/events.js";
import {
  employerApplicationParams,
  fetchEmployerApplication,
  fetchEmployerApplicationList,
  updateApplicationStatus,
  type EmployerApplicationList,
} from "../../../lib/employer/applications/api.js";
import {
  mapStatusCounts,
  regionFilterOptions,
  type EmployerApplicationVM,
  type FilterOption,
  type SettableStatus,
} from "../../../lib/employer/applications/adapter.js";
import {
  employerApplicationSearch,
  hasApplicationFilters,
  panelFilterCount,
  parseEmployerApplicationQuery,
  type EmployerApplicationQuery,
} from "../../../lib/employer/applications/query.js";
import { isPhoneGateError } from "../../PhoneGateNotice.js";
import { VacancyNotice, type NoticeState } from "../vacancies/VacancyNotice.js";
import { ApplicationsHeader } from "./ApplicationsHeader.js";
import { ApplicationsFilters } from "./ApplicationsFilters.js";
import { StatusTabs } from "./StatusTabs.js";
import { ApplicationList } from "./ApplicationList.js";
import { ApplicationDetail } from "./ApplicationDetail.js";
import { ApplicationSidebar, type QuickAction } from "./ApplicationSidebar.js";
import { ApplicationStatusDialog } from "./ApplicationStatusDialog.js";
import {
  ApplicationsEmpty,
  ApplicationsError,
  ApplicationsNoResults,
  ApplicationsSkeleton,
  DetailError,
  DetailSkeleton,
  SelectPrompt,
} from "./ApplicationsStates.js";
import { IconX } from "./icons.js";

/** Tanlangan arizaning tafsiloti — alohida so'rov bilan (audit R3, D-061). */
type DetailState = { kind: "idle" } | { kind: "loading" } | { kind: "error" } | { kind: "ready"; application: EmployerApplicationVM };

const ACTION_STATUS: Record<QuickAction, SettableStatus> = { invite: "invited", accept: "accepted", reject: "rejected" };
const EMPTY_COUNTS = mapStatusCounts(null);

/**
 * Telefon tasdig'i gate'i: 403 PHONE_NOT_VERIFIED va bot ishlamaganda 503 TELEGRAM_UNAVAILABLE
 * (audit R3, D-072 / employer-flows-13 — izohli holat o'zgarishi ham shu gate ostida).
 * 503 umumiy "xatolik" bo'lib ko'rinmasin: PhoneGateNotice aniq sababni ko'rsatadi.
 */
const isGateError = (err: unknown) => isPhoneGateError(err) || (err instanceof ApiError && err.code === "TELEGRAM_UNAVAILABLE");

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Auth hali aniqlanmaganda — sarlavha va skelet (layout sakramasin). */
export function EmployerApplicationsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-6 lg:pt-8">
      <ApplicationsHeader q="" onSearch={() => undefined} showTools={false} filtersOpen={false} filterCount={0} onToggleFilters={() => undefined} filtersButtonRef={{ current: null }} />
      <ApplicationsSkeleton />
    </div>
  );
}

/**
 * `/employer/applications` — "Murojaatlar" ish maydoni: CHAP — arizalar, MARKAZ — tanlangan ariza,
 * O'NG — holat, tezkor amallar, vakansiya.
 *
 * Audit R3 (D-061): qidiruv, filtr, saralash, sahifalash va holat sonlari SERVERDA
 * (`GET /api/employer/applications`), tanlangan arizaning to'liq ma'lumoti esa
 * `GET /api/employer/applications/:id` da. Amallar: `PATCH /api/applications/:id/status`,
 * `POST /api/conversations/start`. Holat URL'da; yangi so'rov ketayotganda eski ro'yxat
 * ekranda qoladi (qidiruv maydoni fokusni yo'qotmaydi).
 */
export function EmployerApplicationsView({ token }: { token: string }) {
  const t = useT();
  const p = t.employerApplicationsPage;
  const { locale } = useLocale();
  const l = useHref();
  const { query, queryRef, commit } = useHistoryQuery(parseEmployerApplicationQuery, employerApplicationSearch);
  const wide = useMedia("(min-width: 1024px)");
  const extraWide = useMedia("(min-width: 1280px)");

  const [list, setList] = useState<EmployerApplicationList | null>(null);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [detail, setDetail] = useState<DetailState>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [revision, setRevision] = useState(0);
  /** Har bir ochish (qatorga bosish) — hatto ayni ariza qayta tanlansa ham. */
  const [openSeq, setOpenSeq] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [gated, setGated] = useState(false);
  const [dialog, setDialog] = useState<{ action: QuickAction; reason: string } | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const noticeSeq = useRef(0);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
  const listTopRef = useRef<HTMLDivElement>(null);
  const detailTitleRef = useRef<HTMLHeadingElement>(null);
  const statusHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusDetailRef = useRef(false);
  /** Foydalanuvchi o'zi ochgan ariza — faqat shunda "ko'rildi" qo'yiladi. */
  const openedRef = useRef<string | null>(null);
  /** Vakansiya nomlari — filtr chipi tanlov ro'yxatidan chiqib qolganda ham nomini ko'rsatadi. */
  const vacancyLabels = useRef(new Map<string, string>());

  const showNotice = useCallback((tone: NoticeState["tone"], text: string) => {
    noticeSeq.current += 1;
    setNotice({ tone, text, id: noticeSeq.current });
  }, []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  // Serverga yuboriladigan parametrlar — tanlangan ariza (`?application=`) ro'yxatni qayta so'ratmaydi
  const paramsKey = employerApplicationParams(query).toString();

  useEffect(() => {
    const controller = new AbortController();
    setPhase("loading");
    fetchEmployerApplicationList(tokenRef.current, queryRef.current, controller.signal)
      .then((fresh) => {
        for (const option of fresh.vacancies) vacancyLabels.current.set(option.value, option.label);
        setList(fresh);
        setPhase("ready");
      })
      .catch((err: unknown) => {
        // Xato hech qachon "murojaatlar yo'q" bo'lib ko'rinmaydi
        if ((err as Error)?.name !== "AbortError") setPhase("error");
      });
    return () => controller.abort();
  }, [paramsKey, attempt, revision, queryRef]);

  const selectedId = query.application;

  useEffect(() => {
    if (!selectedId) {
      setDetail({ kind: "idle" });
      return;
    }
    const controller = new AbortController();
    setDetail({ kind: "loading" });
    fetchEmployerApplication(tokenRef.current, selectedId, controller.signal)
      .then((application) => setDetail({ kind: "ready", application }))
      .catch((err: unknown) => {
        if ((err as Error)?.name !== "AbortError") setDetail({ kind: "error" });
      });
    return () => controller.abort();
  }, [selectedId, detailAttempt]);

  const loading = phase === "loading";
  const items = phase === "error" ? [] : list?.items ?? [];
  const counts = phase === "error" ? EMPTY_COUNTS : list?.counts ?? EMPTY_COUNTS;
  const total = list?.total ?? 0;
  const pageSize = list?.pageSize ?? query.size;
  const page = list?.page ?? query.page;
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const from = items.length ? (page - 1) * pageSize + 1 : 0;
  const slice = { page, pageCount, from, to: from ? from + items.length - 1 : 0 };
  const vacancies = list?.vacancies ?? [];
  const regions = useMemo<FilterOption[]>(() => regionFilterOptions(locale), [locale]);
  const selected = detail.kind === "ready" ? detail.application : null;
  const selectedRow = items.find((a) => a.id === selectedId) ?? null;

  /** Ro'yxatni jimgina yangilash — holat o'zgargach sonlar va tartib serverdan keladi. */
  const reload = useCallback(() => setRevision((n) => n + 1), []);

  const markViewed = useCallback(
    (application: EmployerApplicationVM) => {
      const at = new Date().toISOString();
      setDetail((current) =>
        current.kind === "ready" && current.application.id === application.id
          ? { kind: "ready", application: { ...current.application, status: "viewed", history: [...current.application.history, { from: "sent", to: "viewed", at }] } }
          : current
      );
      updateApplicationStatus(tokenRef.current, application.id, "viewed")
        .then(() => emitInboxChanged())
        // Xato bo'lsa holat qaytariladi — "ko'rildi" soxta ko'rinmaydi
        .catch(() =>
          setDetail((current) =>
            current.kind === "ready" && current.application.id === application.id && current.application.status === "viewed"
              ? { kind: "ready", application: { ...current.application, status: "sent", history: current.application.history.filter((h) => h.at !== at) } }
              : current
          )
        )
        .finally(() => reload());
    },
    [reload]
  );

  // "Ko'rildi" — faqat ish beruvchi arizani O'ZI ochganda (avtomatik tanlashda emas)
  useEffect(() => {
    if (detail.kind !== "ready") return;
    const application = detail.application;
    if (application.status !== "sent" || openedRef.current !== application.id) return;
    openedRef.current = null;
    markViewed(application);
  }, [detail, openSeq, markViewed]);

  // Tanlangan ariza tafsiloti ochilganda (telefon/planshet) sarlavhaga fokus (audit R3, gap5-4)
  useEffect(() => {
    if (detail.kind === "ready" && focusDetailRef.current) {
      focusDetailRef.current = false;
      detailTitleRef.current?.focus({ preventScroll: true });
    }
  }, [detail]);

  // Keng ekranda ariza tanlanmagan (yoki ro'yxatdan chiqib qolgan) bo'lsa — joriy sahifaning birinchisi.
  // Holati o'zgartirilmaydi: "ko'rildi" faqat ish beruvchi o'zi ochganda.
  useEffect(() => {
    if (!wide || items.length === 0) return;
    if (selectedId && items.some((a) => a.id === selectedId)) return;
    commit({ ...queryRef.current, application: items[0].id }, true);
  }, [wide, items, selectedId, commit, queryRef]);

  const select = useCallback(
    (id: string) => {
      openedRef.current = id;
      setOpenSeq((n) => n + 1);
      commit({ ...queryRef.current, application: id });
      setGated(false);
      if (!wide) {
        focusDetailRef.current = true;
        window.scrollTo({ top: 0 });
      }
    },
    [commit, queryRef, wide]
  );

  const back = useCallback(() => {
    const previous = queryRef.current.application;
    commit({ ...queryRef.current, application: "" });
    // Fokus ro'yxatdagi o'sha qatorga qaytadi (audit R3, gap5-4)
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-application-row="${previous}"]`)?.focus());
  }, [commit, queryRef]);

  const update = useCallback((patch: Partial<EmployerApplicationQuery>, replace = false) => commit({ ...queryRef.current, page: 1, ...patch }, replace), [commit, queryRef]);
  const resetFilters = useCallback(
    () => commit({ ...queryRef.current, q: "", status: null, vacancy: "", region: "", period: "", sort: "newest", page: 1 }),
    [commit, queryRef]
  );
  const closeFilters = useCallback(() => {
    setFiltersOpen(false);
    filtersButtonRef.current?.focus();
  }, []);

  async function applyStatus(application: EmployerApplicationVM, status: SettableStatus, reason: string) {
    setBusy(true);
    try {
      await updateApplicationStatus(tokenRef.current, application.id, status, reason || undefined);
      const at = new Date().toISOString();
      setDetail((current) =>
        current.kind === "ready" && current.application.id === application.id
          ? { kind: "ready", application: { ...current.application, status, history: [...current.application.history, { from: current.application.status, to: status, at }] } }
          : current
      );
      setDialog(null);
      showNotice("success", p.notices.updated);
      emitInboxChanged();
      reload();
      // Dialog yopilgach fokus yo'qolmasin — holat kartasi sarlavhasiga qaytadi (audit R3, gap5-4)
      window.requestAnimationFrame(() => statusHeadingRef.current?.focus({ preventScroll: true }));
    } catch (err) {
      setDialog(null);
      if (isGateError(err)) setGated(true);
      const known = err instanceof ApiError && err.status >= 400 && err.status < 500 && err.message && err.message !== "Xatolik";
      showNotice("error", known ? p.notices.failedWithReason((err as ApiError).message) : p.notices.failed);
    } finally {
      setBusy(false);
    }
  }

  async function openChat(application: EmployerApplicationVM) {
    setMessageBusy(true);
    setGated(false);
    try {
      const id = await startConversation(tokenRef.current, { candidateUserId: application.candidate.userId });
      window.location.assign(l(`/messages?c=${encodeURIComponent(id)}`));
    } catch (err) {
      setMessageBusy(false);
      if (isGateError(err)) setGated(true);
      else showNotice("error", p.notices.chatFailed);
    }
  }

  const goToPage = (next: number) => {
    commit({ ...queryRef.current, page: next, application: "" });
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const hrefFor = (id: string) => l(`/employer/applications${employerApplicationSearch({ ...query, application: id })}`);
  const pageHref = (next: number) => l(`/employer/applications${employerApplicationSearch({ ...query, page: next, application: "" })}`);

  const filtered = hasApplicationFilters(query);
  // Umuman ariza yo'q (xato ham, filtr natijasi ham emas)
  const accountEmpty = phase === "ready" && list !== null && !filtered && total === 0 && counts.all === 0;
  const hasTools = phase !== "error" && list !== null && !accountEmpty;
  // Telefon/planshet (<1024): ariza tanlansa — ro'yxat o'rniga tafsilot ("← Murojaatlar")
  const mobileDetail = !wide && Boolean(selectedId);

  // Faol filtrlar — olib tashlanadigan chiplar (vakansiya chipi "Vakansiyalarim"dagi havoladan ham keladi)
  const chips: { key: string; label: string; clear: Partial<EmployerApplicationQuery> }[] = [];
  if (query.vacancy) {
    const label = vacancies.find((o) => o.value === query.vacancy)?.label ?? vacancyLabels.current.get(query.vacancy) ?? "—";
    chips.push({ key: "vacancy", label: `${p.filters.vacancy}: ${label}`, clear: { vacancy: "" } });
  }
  if (query.region) chips.push({ key: "region", label: `${p.filters.region}: ${regions.find((o) => o.value === query.region)?.label ?? query.region}`, clear: { region: "" } });
  if (query.period) chips.push({ key: "period", label: `${p.filters.period}: ${query.period === "7d" ? p.filters.period7 : p.filters.period30}`, clear: { period: "" } });

  const sidebar = selected && (
    <ApplicationSidebar
      key={selected.id}
      application={selected}
      busy={busy}
      messageBusy={messageBusy}
      gated={gated}
      headingRef={statusHeadingRef}
      onUpdate={(status, reason) => (status === "rejected" ? setDialog({ action: "reject", reason }) : void applyStatus(selected, status, reason))}
      onQuick={(action) => setDialog({ action, reason: "" })}
      onMessage={() => void openChat(selected)}
      onFilterVacancy={(vacancyId) => update({ vacancy: vacancyId })}
    />
  );

  const detailPanel =
    detail.kind === "loading" ? (
      <DetailSkeleton />
    ) : detail.kind === "error" ? (
      <DetailError onRetry={() => setDetailAttempt((n) => n + 1)} onBack={back} />
    ) : selected ? (
      <>
        <div className="min-w-0">
          <ApplicationDetail key={selected.id} application={selected} token={token} titleRef={detailTitleRef} onBack={back} onMessage={() => void openChat(selected)} />
          {!extraWide && <div className="mt-5">{sidebar}</div>}
        </div>
        {extraWide && <div className="min-w-0">{sidebar}</div>}
      </>
    ) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-6 lg:pt-8">
      <div className={mobileDetail ? "hidden" : ""}>
        <ApplicationsHeader
          q={query.q}
          onSearch={(next) => update({ q: next }, true)}
          showTools={hasTools}
          filtersOpen={filtersOpen}
          filterCount={panelFilterCount(query)}
          onToggleFilters={() => (filtersOpen ? closeFilters() : setFiltersOpen(true))}
          filtersButtonRef={filtersButtonRef}
        />
        {hasTools && filtersOpen && (
          <ApplicationsFilters query={query} vacancies={vacancies} regions={regions} onChange={(patch) => update(patch)} onReset={resetFilters} onClose={closeFilters} />
        )}
      </div>
      {notice && <VacancyNotice notice={notice} onDismiss={dismissNotice} />}

      {loading && list === null && <ApplicationsSkeleton />}
      {phase === "error" && <ApplicationsError onRetry={() => setAttempt((n) => n + 1)} />}
      {accountEmpty && <ApplicationsEmpty />}

      {hasTools && (
        <>
          <div className={`mt-5 space-y-3 ${mobileDetail ? "hidden" : ""}`}>
            <StatusTabs active={query.status} counts={counts} onSelect={(status) => update({ status })} panelId={items.length > 0 ? "applications-list" : undefined} />
            {chips.length > 0 && (
              <ul data-testid="applications-active-filters" className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <li key={chip.key}>
                    <button
                      type="button"
                      data-testid={chip.key === "vacancy" ? "applications-vacancy-filter" : undefined}
                      onClick={() => update(chip.clear)}
                      aria-label={`${chip.label} — ${p.filters.reset}`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-signal/25 bg-signal-soft/60 py-1 pl-3 pr-2 text-[12.5px] font-medium text-signal transition-colors hover:border-signal/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-indigo-300"
                    >
                      <span className="truncate">{chip.label}</span>
                      <IconX size={13} className="shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length === 0 && !mobileDetail ? (
            <div className="mt-5" aria-busy={loading || undefined}>
              {loading ? <ApplicationsSkeleton /> : <ApplicationsNoResults onReset={resetFilters} />}
            </div>
          ) : (
            <div
              ref={listTopRef}
              aria-busy={loading || undefined}
              className="mt-5 grid scroll-mt-28 items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_300px]"
            >
              {!mobileDetail && items.length > 0 && (
                <ApplicationList items={items} slice={slice} total={total} selectedId={selectedId || null} hrefFor={hrefFor} pageHref={pageHref} onSelect={select} onPage={goToPage} />
              )}
              {selectedId ? (
                detailPanel
              ) : (
                wide && (
                  <div className="xl:col-span-2">
                    <SelectPrompt />
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}

      <ApplicationStatusDialog
        action={dialog?.action ?? null}
        name={selected?.candidate.name ?? selectedRow?.candidate.name ?? ""}
        vacancy={selected?.vacancy.title ?? selectedRow?.vacancy.title ?? ""}
        initialReason={dialog?.reason ?? ""}
        busy={busy}
        onConfirm={(reason) => {
          if (selected && dialog) void applyStatus(selected, ACTION_STATUS[dialog.action], reason);
        }}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
