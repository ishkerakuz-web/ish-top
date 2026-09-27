import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addFavorite, removeFavorite } from "../../lib/apiExtra.js";
import type { SavedVacancy } from "../../lib/favorites/adapter.js";
import {
  TYPE_ORDER,
  countByType,
  favoritesSearch,
  matchSearchAndRegion,
  regionOptions,
  sortFavorites,
} from "../../lib/favorites/query.js";
import { useFavoritesQuery } from "../../lib/favorites/useFavoritesQuery.js";
import { useHref, useT } from "../../lib/i18n/index.js";
import { PAGE_SIZES, paginate } from "../../lib/list.js";
import type { ProfileCompletionState } from "../../lib/profile/useProfileCompletion.js";
import type { RemoteList } from "../../lib/profile/useProfileData.js";
import { FavoritesFilters } from "./FavoritesFilters.js";
import { FavoritesHeader } from "./FavoritesHeader.js";
import { FavoritesList, FavoritesPagination } from "./FavoritesList.js";
import { FavoritesNotice, type FavoritesNoticeState } from "./FavoritesNotice.js";
import { FavoritesSidebar } from "./FavoritesSidebar.js";
import {
  FAVORITES_LAYOUT,
  FavoritesEmptyState,
  FavoritesErrorState,
  FavoritesFilterEmptyState,
  FavoritesMainSkeleton,
  FavoritesSidebarSkeleton,
} from "./FavoritesStates.js";
import { FAVORITES_PANEL_ID, FavoritesTabs, favoritesTabId } from "./FavoritesTabs.js";

const NONE: SavedVacancy[] = [];

/**
 * `/favorites` — saqlangan vakansiyalar paneli: qidiruv + filtr + saqlanganlarni boshqarish.
 * `list === null` — seans hali aniqlanmoqda (skelet). Olib tashlash optimistik:
 * karta darhol yo'qoladi, "Qaytarish" bor; server rad etsa karta joyiga qaytadi.
 */
export function FavoritesView({
  list,
  completion,
  token,
}: {
  list: RemoteList<SavedVacancy> | null;
  completion: ProfileCompletionState;
  token: string | null;
}) {
  const f = useT().favoritesPage;
  const l = useHref();
  const { query, update, reset } = useFavoritesQuery();
  const ready = list?.status === "ready";
  const items = ready ? list.items : NONE;

  const { type, q, region, sort, size } = query;
  const totals = useMemo(() => countByType(items), [items]);
  const regions = useMemo(() => regionOptions(items), [items]);
  const closed = useMemo(() => items.filter((item) => item.isClosed).length, [items]);
  const scoped = useMemo(() => matchSearchAndRegion(items, { q, region }), [items, q, region]);
  const tabCounts = useMemo(() => countByType(scoped), [scoped]);
  const filtered = useMemo(
    () => sortFavorites(type === "all" ? scoped : scoped.filter((item) => item.employmentType === type), sort),
    [scoped, type, sort]
  );
  const slice = paginate(filtered, query.page, size);
  const types = TYPE_ORDER.filter((key) => totals[key] > 0 || key === type);

  // `?page=` ro'yxatdan katta (yoki olib tashlashdan keyin sahifa bo'shadi) — haqiqiy oxirgi sahifa
  useEffect(() => {
    if (ready && filtered.length > 0 && slice.page !== query.page) update({ page: slice.page }, { replace: true });
  }, [ready, filtered.length, slice.page, query.page, update]);

  // ---- Olib tashlash / qaytarish (mavjud POST/DELETE /api/favorites/:id) ----
  const [notice, setNotice] = useState<FavoritesNoticeState | null>(null);
  const lastRemoved = useRef<SavedVacancy | null>(null);
  const pending = useRef(new Map<string, Promise<unknown>>());
  const noticeRef = useRef<HTMLDivElement>(null);
  const focusNotice = useRef(false);

  useEffect(() => {
    if (notice && focusNotice.current) {
      focusNotice.current = false;
      noticeRef.current?.focus();
    }
  }, [notice]);

  const remove = useCallback(
    (item: SavedVacancy) => {
      if (!token || !list) return;
      lastRemoved.current = item;
      list.setItems((prev) => prev.filter((x) => x.id !== item.id));
      focusNotice.current = true;
      setNotice({ kind: "removed", title: item.title });
      const request = removeFavorite(token, item.id)
        .catch(() => {
          // Server rad etdi — karta joyiga qaytadi
          list.setItems((prev) => (prev.some((x) => x.id === item.id) ? prev : [...prev, item]));
          lastRemoved.current = null;
          setNotice({ kind: "error", message: f.removed.error });
        })
        .finally(() => pending.current.delete(item.id));
      pending.current.set(item.id, request);
    },
    [token, list, f.removed.error]
  );

  const undo = useCallback(async () => {
    const item = lastRemoved.current;
    if (!token || !list || !item) return;
    lastRemoved.current = null;
    setNotice(null);
    // Qayta saqlash — server yangi saqlangan vaqtni yozadi, UI ham shuni ko'rsatadi
    const restored: SavedVacancy = { ...item, savedAt: new Date().toISOString() };
    list.setItems((prev) => (prev.some((x) => x.id === item.id) ? prev : [...prev, restored]));
    try {
      await pending.current.get(item.id);
      await addFavorite(token, item.id);
    } catch {
      list.setItems((prev) => prev.filter((x) => x.id !== item.id));
      setNotice({ kind: "error", message: f.removed.restoreError });
    }
  }, [token, list, f.removed.restoreError]);

  const panelRef = useRef<HTMLDivElement>(null);
  const scrollToList = useCallback(() => {
    const el = panelRef.current;
    if (el && el.getBoundingClientRect().top < 90) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const hrefFor = (page: number) => l("/favorites") + favoritesSearch({ ...query, page });

  const noticeBlock = notice ? (
    <FavoritesNotice ref={noticeRef} notice={notice} onUndo={() => void undo()} onDismiss={() => setNotice(null)} />
  ) : null;

  let main: React.ReactNode;
  if (!list || list.status === "loading") main = <FavoritesMainSkeleton />;
  else if (list.status === "error") main = <FavoritesErrorState onRetry={() => void list.reload()} />;
  else if (items.length === 0) {
    main = (
      <div className="space-y-4">
        {noticeBlock}
        <FavoritesEmptyState />
      </div>
    );
  } else {
    main = (
      <div className="space-y-5">
        <section aria-label={f.filters.label} className="rounded-3xl border border-line bg-surface shadow-card">
          <FavoritesTabs types={types} active={type} counts={tabCounts} total={scoped.length} onChange={(next) => update({ type: next })} />
          <FavoritesFilters query={query} regions={regions} types={types} onChange={update} />
        </section>

        {noticeBlock}

        <div ref={panelRef} id={FAVORITES_PANEL_ID} role="tabpanel" aria-labelledby={favoritesTabId(type)} className="scroll-mt-28">
          <h2 className="sr-only">{f.list.label}</h2>
          <p className="sr-only" aria-live="polite">
            {f.list.results(filtered.length)}
          </p>
          {filtered.length === 0 ? (
            <FavoritesFilterEmptyState onClear={reset} />
          ) : (
            <>
              <FavoritesList items={slice.items} onRemove={remove} />
              {filtered.length > PAGE_SIZES[0] && (
                <FavoritesPagination
                  page={slice.page}
                  pageCount={slice.pageCount}
                  from={slice.from}
                  to={slice.to}
                  total={filtered.length}
                  size={size}
                  hrefFor={hrefFor}
                  onPage={(page) => {
                    update({ page });
                    scrollToList();
                  }}
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
      <div className={FAVORITES_LAYOUT}>
        <div className="min-w-0">
          <FavoritesHeader count={ready ? items.length : null} />
          <div className="mt-6">{main}</div>
        </div>
        {!list || list.status === "loading" ? (
          <FavoritesSidebarSkeleton />
        ) : (
          <FavoritesSidebar
            total={items.length}
            closed={closed}
            types={types}
            counts={totals}
            activeType={type}
            onType={(next) => update({ type: next })}
            completion={completion}
          />
        )}
      </div>
    </div>
  );
}
