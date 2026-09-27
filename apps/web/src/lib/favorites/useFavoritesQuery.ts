import { useCallback } from "react";
import { useHistoryQuery } from "../useHistoryQuery.js";
import { DEFAULT_QUERY, favoritesSearch, parseFavoritesQuery, type FavoritesQuery } from "./query.js";

export type FavoritesPatch = Partial<FavoritesQuery>;

/**
 * `/favorites` holati URL'da (`useHistoryQuery` — pushState, ro'yxat qayta so'ralmaydi).
 * Tab/filtr/saralash/sahifa — yangi tarix yozuvi; qidiruvning birinchi harfi — yangi
 * yozuv, keyingilari almashtiradi. Filtr o'zgarsa sahifa 1 ga qaytadi.
 */
export function useFavoritesQuery() {
  const { query, queryRef, commit } = useHistoryQuery(parseFavoritesQuery, favoritesSearch);

  const update = useCallback(
    (patch: FavoritesPatch, options: { replace?: boolean } = {}) => {
      const current = queryRef.current;
      const filtersChanged = (["type", "q", "region", "sort", "size"] as const).some((key) => key in patch && patch[key] !== current[key]);
      commit({ ...current, ...patch, page: patch.page ?? (filtersChanged ? 1 : current.page) }, Boolean(options.replace));
    },
    [commit, queryRef]
  );

  /** "Filtrlarni tozalash": ish turi, qidiruv va joylashuv; saralash va sahifadagi soni saqlanadi. */
  const reset = useCallback(() => {
    commit({ ...DEFAULT_QUERY, sort: queryRef.current.sort, size: queryRef.current.size });
  }, [commit, queryRef]);

  return { query, update, reset };
}
