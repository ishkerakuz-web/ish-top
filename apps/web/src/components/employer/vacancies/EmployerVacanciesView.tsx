import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { useHistoryQuery } from "../../../lib/useHistoryQuery.js";
import { PAGE_SIZES } from "../../../lib/list.js";
import { deleteVacancy, setVacancyStatus } from "../../../lib/api.js";
import { ListPagination } from "../../ListPagination.js";
import {
  categoryFilterOptions,
  regionFilterOptions,
  type EmployerVacancyPage,
  type EmployerVacancyStatus,
  type EmployerVacancyVM,
} from "../../../lib/employer/vacancies/adapter.js";
import { fetchEmployerVacancyPage, fetchHasEmployerCompany, vacancyActionErrorKind } from "../../../lib/employer/vacancies/api.js";
import {
  employerVacancySearch,
  hasEmployerVacancyFilters,
  parseEmployerVacancyQuery,
  type EmployerVacancyQuery,
} from "../../../lib/employer/vacancies/query.js";
import { VacanciesHeader } from "./VacanciesHeader.js";
import { VacancyStats } from "./VacancyStats.js";
import { VacancyToolbar } from "./VacancyToolbar.js";
import { VacancyList } from "./VacancyList.js";
import { NeedCompanyState, VacanciesEmpty, VacanciesError, VacanciesNoResults, VacanciesSkeleton } from "./VacanciesStates.js";
import { VacancyNotice, type NoticeState } from "./VacancyNotice.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { PhoneGateNotice } from "../../PhoneGateNotice.js";

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; hasCompany: boolean; page: EmployerVacancyPage };

/** Auth hali aniqlanmaganda — sarlavha va skelet (layout sakramasin). */
export function EmployerVacanciesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-6 lg:pt-8">
      <VacanciesHeader showCta={false} />
      <VacanciesSkeleton />
    </div>
  );
}

/**
 * `/employer/vacancies` — ish beruvchining "Vakansiyalarim" dashboard'i.
 *
 * Ma'lumot: `GET /api/employer/vacancies` — qidiruv, filtr, saralash va sahifalash SERVERDA
 * (audit R3, db-perf-8 / employer-flows-4 / scale-10k-13); ilgari butun ro'yxat (1000 tagacha
 * to'liq hujjat) yuklanib, filtrlash brauzerda bo'lardi. Amallar: `PATCH /api/vacancies/:id/status`,
 * `DELETE /api/vacancies/:id`. Holat URL'da (`useHistoryQuery`). Tarif/obuna ma'lumoti ko'rsatilmaydi.
 */
export function EmployerVacanciesView({ token }: { token: string }) {
  const t = useT();
  const p = t.employerVacanciesPage;
  const { locale } = useLocale();
  const l = useHref();
  const { query, queryRef, commit } = useHistoryQuery(parseEmployerVacancyQuery, employerVacancySearch);

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<EmployerVacancyVM | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  // Amal telefon tasdiqlanmagani uchun rad etildi — tasdiqlash havolasi ko'rsatiladi (audit PHASE 6, U4)
  const [phoneGated, setPhoneGated] = useState(false);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const noticeSeq = useRef(0);
  const listTopRef = useRef<HTMLDivElement>(null);
  // Kompaniya profili bir marta tekshiriladi — har filtrda qayta so'ralmaydi
  const hasCompanyRef = useRef<boolean | null>(null);

  const showNotice = useCallback((tone: NoticeState["tone"], text: string) => {
    noticeSeq.current += 1;
    setNotice({ tone, text, id: noticeSeq.current });
  }, []);
  const dismissNotice = useCallback(() => {
    setNotice(null);
    setPhoneGated(false);
  }, []);

  const queryKey = employerVacancySearch(query);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    // Ro'yxat qayta so'ralayotganda oldingi natija ekranda qoladi (skelet faqat birinchi yuklashda)
    setState((current) => (current.kind === "ready" ? current : { kind: "loading" }));
    const load = async () => {
      const current = queryRef.current;
      const [hasCompany, page] = await Promise.all([
        hasCompanyRef.current === null
          ? fetchHasEmployerCompany(tokenRef.current, controller.signal)
          : Promise.resolve(hasCompanyRef.current),
        fetchEmployerVacancyPage(tokenRef.current, current, controller.signal),
      ]);
      hasCompanyRef.current = hasCompany;
      if (!alive) return;
      setState({ kind: "ready", hasCompany, page });
      // Oxirgi sahifadagi yagona e'lon o'chirilsa bo'sh sahifada qolib ketmaslik uchun
      if (page.items.length === 0 && page.total > 0 && current.page > page.pageCount) {
        commit({ ...current, page: Math.max(1, page.pageCount) }, true);
      }
    };
    void load().catch((err: unknown) => {
      if (!alive || (err as Error)?.name === "AbortError") return;
      setState({ kind: "error" });
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [attempt, queryKey, queryRef, commit]);

  // Forma sahifasidan qaytganda (`?notice=created|updated`) — xabar, parametr URL'dan olib tashlanadi
  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get("notice");
    if (flag !== "created" && flag !== "submitted" && flag !== "updated" && flag !== "draft") return;
    showNotice(
      "success",
      flag === "created" ? p.notices.created : flag === "submitted" ? p.notices.submitted : flag === "draft" ? p.notices.draft : p.notices.updated
    );
    window.history.replaceState(null, "", window.location.pathname + employerVacancySearch(queryRef.current) + window.location.hash);
    // faqat birinchi ochilishda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const page = state.kind === "ready" ? state.page : null;
  const items = page?.items ?? [];
  const stats = page?.stats ?? { total: 0, applications: null, byStatus: { active: 0, moderation: 0, draft: 0, rejected: 0, archived: 0 } };
  const regions = useMemo(() => regionFilterOptions(page?.regions ?? [], locale), [page, locale]);
  const categories = useMemo(() => categoryFilterOptions(page?.categories ?? [], locale), [page, locale]);
  const filtersActive = hasEmployerVacancyFilters(query);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const update = useCallback(
    (patch: Partial<EmployerVacancyQuery>, replace = false) => commit({ ...queryRef.current, page: 1, ...patch }, replace),
    [commit, queryRef]
  );
  const resetFilters = useCallback(() => commit({ ...queryRef.current, q: "", status: null, region: "", category: "", page: 1 }), [commit, queryRef]);

  const errorText = (err: unknown) => {
    const kind = vacancyActionErrorKind(err);
    if (kind === "transition") return p.errors.transition;
    if (kind === "hasApplications") return p.errors.hasApplications;
    if (kind === "incomplete") return p.errors.incomplete;
    if (kind === "phoneGate") return p.errors.phoneGate;
    return p.errors.generic;
  };

  const showActionError = (err: unknown) => {
    setPhoneGated(vacancyActionErrorKind(err) === "phoneGate");
    showNotice("error", errorText(err));
  };

  async function changeStatus(vacancy: EmployerVacancyVM, next: "active" | "archived") {
    setBusyId(vacancy.id);
    try {
      const result = await setVacancyStatus(tokenRef.current, vacancy.id, next);
      setPhoneGated(false);
      // Qoralamani birinchi marta chiqarish tasdiqlanmagan kompaniyada moderatsiyaga tushadi
      showNotice(
        "success",
        next === "active" ? (result?.status === "moderation" ? p.notices.submitted : p.notices.activated) : p.notices.closed
      );
      // Sonlar va holat filtri serverdan keladi — qayta so'raladi
      reload();
    } catch (err) {
      showActionError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteVacancy(tokenRef.current, deleting.id);
      setDeleting(null);
      setPhoneGated(false);
      showNotice("success", p.notices.deleted);
      reload();
    } catch (err) {
      setDeleting(null);
      showActionError(err);
    } finally {
      setDeleteBusy(false);
    }
  }

  const goToPage = (nextPage: number) => {
    commit({ ...queryRef.current, page: nextPage });
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const ready = state.kind === "ready";
  const hasCompany = ready && state.hasCompany;
  const hasAnyVacancy = stats.total > 0;
  const from = items.length ? (query.page - 1) * (page?.pageSize ?? query.size) + 1 : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-6 lg:pt-8">
      <VacanciesHeader showCta={hasCompany} />
      {notice && <VacancyNotice notice={notice} onDismiss={dismissNotice} />}
      {phoneGated && <PhoneGateNotice className="mt-3" />}

      {state.kind === "loading" && <VacanciesSkeleton />}
      {state.kind === "error" && <VacanciesError onRetry={reload} />}
      {ready && !state.hasCompany && <NeedCompanyState />}
      {hasCompany && !hasAnyVacancy && !filtersActive && <VacanciesEmpty />}

      {hasCompany && (hasAnyVacancy || filtersActive) && (
        <>
          <VacancyStats stats={stats} active={query.status} onSelect={(status: EmployerVacancyStatus | null) => update({ status })} />
          <VacancyToolbar query={query} stats={stats} regions={regions} categories={categories} onChange={update} />

          <div ref={listTopRef} className="mt-5 flex scroll-mt-28 flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p role="status" className="text-[13.5px] text-dusk" data-testid="vacancies-summary">
              {p.summary(page?.total ?? 0, stats.applications ?? 0)}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-md text-[13.5px] font-semibold text-signal transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-indigo-300"
              >
                {p.filters.reset}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <VacanciesNoResults onReset={resetFilters} />
          ) : (
            <div className="mt-3">
              <VacancyList items={items} busyId={busyId} onStatus={(v, next) => void changeStatus(v, next)} onDelete={setDeleting} />
              {(page?.total ?? 0) > PAGE_SIZES[0] && (
                <ListPagination
                  labels={p.pagination}
                  page={page?.page ?? query.page}
                  pageCount={page?.pageCount ?? 1}
                  from={from}
                  to={from + items.length - 1}
                  total={page?.total ?? 0}
                  size={query.size}
                  hrefFor={(n) => l(`/employer/vacancies${employerVacancySearch({ ...query, page: n })}`)}
                  onPage={goToPage}
                  onSize={(size) => commit({ ...queryRef.current, size, page: 1 })}
                />
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={p.deleteDialog.title}
        text={deleting ? p.deleteDialog.text(deleting.title) : ""}
        confirmLabel={p.deleteDialog.confirm}
        cancelLabel={p.deleteDialog.cancel}
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
