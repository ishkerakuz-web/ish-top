import { useCallback, useRef } from "react";
import { useHistoryQuery } from "../useHistoryQuery.js";
import { DEFAULT_QUERY, applicationsSearch, parseApplicationsQuery, type ApplicationsQuery } from "./query.js";

export type QueryPatch = Partial<ApplicationsQuery>;

/**
 * `/applications` holati URL'da (`useHistoryQuery` — pushState, ro'yxat qayta so'ralmaydi).
 *
 * - filtr/tab/saralash/sahifa/sahifadagi soni — yangi yozuv (orqaga tugmasi oldingi holatga qaytaradi);
 * - qidiruv matni — birinchi harf yangi yozuv, keyingilari o'rnini almashtiradi
 *   (har harf tarixni to'ldirmasin);
 * - tafsilot (`?id=`) sahifa ichida ochilgan bo'lsa, yopish = `history.back()`.
 */
export function useApplicationsQuery() {
  const openedInPage = useRef(false);
  const { query, queryRef, commit } = useHistoryQuery(parseApplicationsQuery, applicationsSearch, {
    onPop: () => {
      openedInPage.current = false;
    },
  });

  /** Filtr yoki sahifadagi soni o'zgarsa sahifa 1 ga qaytadi (aniq `page` berilmagan bo'lsa). */
  const update = useCallback(
    (patch: QueryPatch, options: { replace?: boolean } = {}) => {
      const current = queryRef.current;
      const filtersChanged = (["status", "q", "date", "sort", "size"] as const).some(
        (key) => key in patch && patch[key] !== current[key]
      );
      const next: ApplicationsQuery = {
        ...current,
        ...patch,
        page: patch.page ?? (filtersChanged ? 1 : current.page),
      };
      commit(next, Boolean(options.replace));
    },
    [commit, queryRef]
  );

  const openDetail = useCallback(
    (id: string) => {
      openedInPage.current = true;
      commit({ ...queryRef.current, id });
    },
    [commit, queryRef]
  );

  const closeDetail = useCallback(() => {
    if (!queryRef.current.id) return;
    if (openedInPage.current) {
      openedInPage.current = false;
      window.history.back();
      return;
    }
    commit({ ...queryRef.current, id: null }, true);
  }, [commit, queryRef]);

  /** "Filtrlarni tozalash": holat, qidiruv va sana; saralash va sahifadagi soni saqlanadi. */
  const reset = useCallback(() => {
    commit({ ...DEFAULT_QUERY, sort: queryRef.current.sort, size: queryRef.current.size });
  }, [commit, queryRef]);

  return { query, update, openDetail, closeDetail, reset };
}
