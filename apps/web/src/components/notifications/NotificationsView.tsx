import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_ORDER, type NotificationView } from "../../lib/notifications/adapter.js";
import { countByCategory, filterNotifications, notificationsSearch } from "../../lib/notifications/query.js";
import type { NotificationCenter } from "../../lib/notifications/useNotificationCenter.js";
import { useNotificationsQuery } from "../../lib/notifications/useNotificationsQuery.js";
import { NOTIFICATIONS_LIMIT } from "../../lib/notifications/api.js";
import { useHref, useT } from "../../lib/i18n/index.js";
import { PAGE_SIZES, paginate } from "../../lib/list.js";
import { ListPagination } from "../ListPagination.js";
import { NotificationActions } from "./NotificationActions.js";
import { NotificationCard } from "./NotificationCard.js";
import { NotificationSettings } from "./NotificationSettings.js";
import { NotificationTabs, notificationsPanelId, notificationsTabId } from "./NotificationTabs.js";
import { NotificationsHeader } from "./NotificationsHeader.js";
import { NotificationsSidebar } from "./NotificationsSidebar.js";
import {
  NOTIFICATIONS_LAYOUT,
  NotificationsEmptyState,
  NotificationsErrorState,
  NotificationsFilterEmptyState,
  NotificationsLoadMore,
  NotificationsMainSkeleton,
  NotificationsSidebarSkeleton,
} from "./NotificationsStates.js";
import { IconX } from "./icons.js";

type Notice = { kind: "success" | "error"; message: string };

/**
 * `/notifications` — bildirishnomalar markazi. `center === null` — seans hali aniqlanmoqda.
 * O'qildi / hammasi o'qildi / o'chirish — optimistik, xato bo'lsa qaytadi va xabar chiqadi.
 * Havola bosilsa (o'qilmagan bo'lsa) avval o'qilgan deb belgilanadi, keyin o'tiladi.
 */
export function NotificationsView({ center, role, token }: { center: NotificationCenter | null; role: string | null; token: string | null }) {
  const t = useT();
  const n = t.notificationsPage;
  const l = useHref();
  const { query, update, reset } = useNotificationsQuery();
  const ready = center?.status === "ready";
  const items = useMemo(() => (ready ? center.items : []), [ready, center?.items]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => countByCategory(items), [items]);
  const categories = CATEGORY_ORDER.filter((category) => counts[category] > 0);
  const read = useMemo(() => items.filter((item) => item.isRead).length, [items]);
  const filtered = useMemo(() => filterNotifications(items, query), [items, query]);
  const slice = paginate(filtered, query.page, query.size);
  const unreadCount = center?.unreadCount ?? 0;

  // `?page=` ro'yxatdan katta (yoki o'chirishdan keyin sahifa bo'shadi) — haqiqiy oxirgi sahifa
  useEffect(() => {
    if (ready && filtered.length > 0 && slice.page !== query.page) update({ page: slice.page }, { replace: true });
  }, [ready, filtered.length, slice.page, query.page, update]);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const noticeRef = useRef<HTMLDivElement>(null);
  const focusNotice = useRef(false);
  useEffect(() => {
    if (notice && focusNotice.current) {
      focusNotice.current = false;
      noticeRef.current?.focus();
    }
  }, [notice]);

  const markRead = useCallback(
    async (item: NotificationView) => {
      if (!center) return;
      const ok = await center.markRead(item.id);
      if (!ok) setNotice({ kind: "error", message: n.notices.markReadError });
    },
    [center, n.notices.markReadError]
  );

  const remove = useCallback(
    async (item: NotificationView) => {
      if (!center) return;
      // O'chirilgan kartadagi tugma yo'qoladi — fokus xabarga o'tadi
      focusNotice.current = true;
      setNotice({ kind: "success", message: n.notices.deleted });
      const ok = await center.remove(item.id);
      if (!ok) setNotice({ kind: "error", message: n.notices.deleteError });
    },
    [center, n.notices.deleted, n.notices.deleteError]
  );

  const markAll = useCallback(async () => {
    if (!center) return;
    setMarkingAll(true);
    const ok = await center.markAllRead();
    setMarkingAll(false);
    setNotice(ok ? { kind: "success", message: n.notices.allMarked } : { kind: "error", message: n.notices.markAllError });
  }, [center, n.notices.allMarked, n.notices.markAllError]);

  const open = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, item: NotificationView, href: string) => {
      if (!center || item.isRead) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        void center.markRead(item.id);
        return;
      }
      event.preventDefault();
      // O'qildi so'rovi tugashini qisqa kutamiz — sekin tarmoqda o'tish kechikmasin
      void Promise.race([center.markRead(item.id), new Promise((resolve) => window.setTimeout(resolve, 1200))]).finally(() => {
        window.location.assign(href);
      });
    },
    [center]
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const scrollToList = useCallback(() => {
    const el = panelRef.current;
    if (el && el.getBoundingClientRect().top < 90) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const hrefFor = (page: number) => l("/notifications") + notificationsSearch({ ...query, page });

  const noticeBlock = notice ? (
    <div
      ref={noticeRef}
      tabIndex={-1}
      role={notice.kind === "error" ? "alert" : "status"}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-[13.5px] focus:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
        notice.kind === "error" ? "border-danger/30 bg-danger/10 text-danger" : "border-signal/20 bg-signal-soft text-ink"
      }`}
    >
      <span className="min-w-0 flex-1">{notice.message}</span>
      <button
        type="button"
        onClick={() => setNotice(null)}
        aria-label={n.notices.dismiss}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        <IconX size={16} />
      </button>
    </div>
  ) : null;

  const tabs = <NotificationTabs active={query.tab} unreadCount={unreadCount} onChange={(tab) => update({ tab })} />;

  let listBody: React.ReactNode;
  if (!center || center.status === "loading") listBody = null;
  else if (center.status === "error") listBody = <NotificationsErrorState onRetry={() => void center.reload()} />;
  else if (items.length === 0) listBody = <NotificationsEmptyState showCta={role === "job_seeker"} />;
  else {
    listBody = (
      <div className="space-y-4">
        <NotificationActions query={query} categories={categories} unreadCount={unreadCount} busy={markingAll} onChange={update} onMarkAll={() => void markAll()} />
        {noticeBlock}
        <h2 className="sr-only">{n.list.label}</h2>
        <p className="sr-only" aria-live="polite">
          {n.list.results(filtered.length)}
        </p>
        {filtered.length === 0 ? (
          <NotificationsFilterEmptyState onClear={reset} />
        ) : (
          <>
            <ul aria-label={n.list.label} className="space-y-3">
              {slice.items.map((item) => (
                <li key={item.id}>
                  <NotificationCard item={item} role={role} onOpen={open} onMarkRead={(x) => void markRead(x)} onDelete={(x) => void remove(x)} />
                </li>
              ))}
            </ul>
            {filtered.length > PAGE_SIZES[0] && (
              <ListPagination
                labels={n.pagination}
                page={slice.page}
                pageCount={slice.pageCount}
                from={slice.from}
                to={slice.to}
                total={filtered.length}
                size={query.size}
                hrefFor={hrefFor}
                onPage={(page) => {
                  update({ page });
                  scrollToList();
                }}
                onSize={(size) => {
                  update({ size });
                  scrollToList();
                }}
              />
            )}
          </>
        )}
        {/* audit R3, D-078: eski bildirishnomalar kursor bilan yuklanadi — yuklanmoqda/xato/oxiri
            holatlari ko'rinadi. Filtr natijasi bo'sh bo'lsa ham tugma qoladi: davomida mos qator bo'lishi mumkin. */}
        <NotificationsLoadMore
          hasMore={center.hasMore}
          status={center.moreStatus}
          reachedEnd={center.reachedEnd}
          truncatedNote={center.truncated && !center.hasMore ? n.list.truncated(NOTIFICATIONS_LIMIT) : null}
          onLoad={() => void center.loadMore()}
        />
      </div>
    );
  }

  const loading = !center || center.status === "loading";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 sm:pt-7">
      <div className={NOTIFICATIONS_LAYOUT}>
        <div className="min-w-0">
          <NotificationsHeader unreadCount={ready ? unreadCount : null} />
          <div className="mt-6">
            {loading && query.tab === "list" ? (
              <NotificationsMainSkeleton />
            ) : (
              <div className="space-y-5">
                {tabs}
                <div
                  ref={panelRef}
                  id={notificationsPanelId(query.tab)}
                  role="tabpanel"
                  aria-labelledby={notificationsTabId(query.tab)}
                  className="scroll-mt-28"
                >
                  {query.tab === "settings" ? token ? <NotificationSettings token={token} role={role} /> : null : listBody}
                </div>
              </div>
            )}
          </div>
        </div>
        {loading ? (
          <NotificationsSidebarSkeleton />
        ) : (
          <NotificationsSidebar
            showList={query.tab === "list" && ready}
            unreadCount={unreadCount}
            total={items.length}
            read={read}
            truncated={center?.truncated ?? false}
            categories={categories}
            counts={counts}
            activeCategory={query.category}
            onCategory={(category) => update({ category, tab: "list" })}
            onSettings={() => update({ tab: "settings" })}
          />
        )}
      </div>
    </div>
  );
}
