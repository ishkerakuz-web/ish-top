import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  PAGE_SIZES,
  applicationsSearch,
  countByStatus,
  matchSearchAndDate,
  paginate,
  sortApplications,
} from "../../lib/applications/query.js";
import { useApplicationsQuery } from "../../lib/applications/useApplicationsQuery.js";
import type { ProfileCompletionState } from "../../lib/profile/useProfileCompletion.js";
import { useHref, useT } from "../../lib/i18n/index.js";
import type { RemoteList } from "../../lib/profile/useProfileData.js";
import type { MyApplication } from "../../lib/types.js";
import { ApplicationDetail } from "./ApplicationDetail.js";
import { ApplicationFilters } from "./ApplicationFilters.js";
import { ApplicationList, ApplicationsPagination } from "./ApplicationList.js";
import { ApplicationSummary } from "./ApplicationSummary.js";
import { APPLICATIONS_PANEL_ID, ApplicationTabs, applicationsTabId } from "./ApplicationTabs.js";
import { ApplicationsHeader } from "./ApplicationsHeader.js";
import { ApplicationsSidebar } from "./ApplicationsSidebar.js";
import {
  APPLICATIONS_LAYOUT,
  ApplicationsEmptyState,
  ApplicationsErrorState,
  ApplicationsFilterEmptyState,
  ApplicationsMainSkeleton,
  ApplicationsSidebarSkeleton,
} from "./ApplicationsStates.js";

const NONE: MyApplication[] = [];

/**
 * `/applications` — nomzodning arizalarini kuzatish paneli.
 * `list === null` — seans hali aniqlanmoqda (skelet).
 * `completion` — "Faol bo'ling!" kartasi uchun profil to'liqligi (100% bo'lsa karta yo'q).
 */
export function ApplicationsView({
  list,
  completion,
}: {
  list: RemoteList<MyApplication> | null;
  completion: ProfileCompletionState;
}) {
  const a = useT().applicationsPage;
  const l = useHref();
  const { query, update, openDetail, closeDetail, reset } = useApplicationsQuery();
  const ready = list?.status === "ready";
  const items = ready ? list.items : NONE;

  const totals = useMemo(() => countByStatus(items), [items]);
  const { q, date, status, sort, size } = query;
  const scoped = useMemo(() => matchSearchAndDate(items, { ...query, q, date }), [items, q, date]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabCounts = useMemo(() => countByStatus(scoped), [scoped]);
  const filtered = useMemo(
    () => sortApplications(status === "all" ? scoped : scoped.filter((item) => item.status === status), sort),
    [scoped, status, sort]
  );
  const slice = paginate(filtered, query.page, size);
  const selected = query.id ? items.find((item) => item.id === query.id) ?? null : null;

  // Mavjud bo'lmagan ariza (`?id=` noto'g'ri yoki boshqa foydalanuvchiniki) — URL tozalanadi
  useEffect(() => {
    if (ready && query.id && !selected) closeDetail();
  }, [ready, query.id, selected, closeDetail]);

  // `?page=` ro'yxatdan katta bo'lsa — haqiqiy oxirgi sahifa
  useEffect(() => {
    if (ready && filtered.length > 0 && slice.page !== query.page) update({ page: slice.page }, { replace: true });
  }, [ready, filtered.length, slice.page, query.page, update]);

  const panelRef = useRef<HTMLDivElement>(null);
  const scrollToList = useCallback(() => {
    const el = panelRef.current;
    if (el && el.getBoundingClientRect().top < 90) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const goPage = useCallback(
    (page: number) => {
      update({ page });
      scrollToList();
    },
    [update, scrollToList]
  );
  const hrefFor = (page: number) => l("/applications") + applicationsSearch({ ...query, page, id: null });

  let main: React.ReactNode;
  if (!list || list.status === "loading") main = <ApplicationsMainSkeleton />;
  else if (list.status === "error") main = <ApplicationsErrorState onRetry={() => void list.reload()} />;
  else if (items.length === 0) {
    main = (
      <div className="space-y-5">
        <ApplicationSummary counts={totals} total={0} />
        <ApplicationsEmptyState />
      </div>
    );
  } else {
    main = (
      <div className="space-y-5">
        <ApplicationSummary counts={totals} total={items.length} active={status} onSelect={(next) => update({ status: next })} />

        <section aria-label={a.filters.label} className="rounded-3xl border border-line bg-surface shadow-card">
          <ApplicationTabs active={status} counts={tabCounts} total={scoped.length} onChange={(next) => update({ status: next })} />
          <ApplicationFilters query={query} onChange={update} />
        </section>

        <div ref={panelRef} id={APPLICATIONS_PANEL_ID} role="tabpanel" aria-labelledby={applicationsTabId(status)} className="scroll-mt-28">
          <h2 className="sr-only">{a.list.label}</h2>
          <p className="sr-only" aria-live="polite">
            {a.list.results(filtered.length)}
          </p>
          {filtered.length === 0 ? (
            <ApplicationsFilterEmptyState onClear={reset} />
          ) : (
            <>
              <ApplicationList items={slice.items} onOpen={openDetail} />
              {filtered.length > PAGE_SIZES[0] && (
                <ApplicationsPagination
                  page={slice.page}
                  pageCount={slice.pageCount}
                  from={slice.from}
                  to={slice.to}
                  total={filtered.length}
                  size={size}
                  hrefFor={hrefFor}
                  onPage={goPage}
                  onSize={(next) => {
                    update({ size: next });
                    scrollToList();
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 sm:pt-7">
      <div className={APPLICATIONS_LAYOUT}>
        <div className="min-w-0">
          <ApplicationsHeader />
          <div className="mt-6">{main}</div>
        </div>
        {!list || list.status === "loading" ? (
          <ApplicationsSidebarSkeleton />
        ) : (
          <ApplicationsSidebar items={items} counts={totals} completion={completion} />
        )}
      </div>
      <ApplicationDetail app={selected} onClose={closeDetail} />
    </div>
  );
}
