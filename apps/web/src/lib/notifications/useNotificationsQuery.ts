import { useCallback } from "react";
import { useHistoryQuery } from "../useHistoryQuery.js";
import { DEFAULT_QUERY, notificationsSearch, parseNotificationsQuery, type NotificationsQuery } from "./query.js";

export type NotificationsPatch = Partial<NotificationsQuery>;

/**
 * `/notifications` holati URL'da (`useHistoryQuery` — pushState, ro'yxat qayta so'ralmaydi).
 * Tab/filtr/sahifa — yangi tarix yozuvi (orqaga/oldinga ishlaydi); filtr o'zgarsa sahifa 1.
 */
export function useNotificationsQuery() {
  const { query, queryRef, commit } = useHistoryQuery(parseNotificationsQuery, notificationsSearch);

  const update = useCallback(
    (patch: NotificationsPatch, options: { replace?: boolean } = {}) => {
      const current = queryRef.current;
      const filtersChanged = (["unread", "category", "size", "tab"] as const).some((key) => key in patch && patch[key] !== current[key]);
      commit({ ...current, ...patch, page: patch.page ?? (filtersChanged ? 1 : current.page) }, Boolean(options.replace));
    },
    [commit, queryRef]
  );

  /** "Filtrlarni tozalash": o'qilmaganlar va kategoriya; sahifadagi soni saqlanadi. */
  const reset = useCallback(() => {
    commit({ ...DEFAULT_QUERY, size: queryRef.current.size });
  }, [commit, queryRef]);

  return { query, update, reset };
}
