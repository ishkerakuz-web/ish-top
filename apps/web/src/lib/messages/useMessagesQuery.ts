import { useCallback } from "react";
import { useHistoryQuery } from "../useHistoryQuery.js";
import { messagesSearch, parseMessagesQuery, type MessagesQuery } from "./query.js";

/**
 * `/messages` URL holati. Suhbat tanlash va filtr — tarixga yoziladi (orqaga/oldinga
 * ishlaydi), qidiruv matni — `replace` (har harf alohida tarix yozuvi bo'lmasin).
 */
export function useMessagesQuery() {
  const { query, queryRef, commit } = useHistoryQuery(parseMessagesQuery, messagesSearch);
  const update = useCallback(
    (patch: Partial<MessagesQuery>, options: { replace?: boolean } = {}) => {
      commit({ ...queryRef.current, ...patch }, options.replace ?? false);
    },
    [commit, queryRef]
  );
  return { query, update };
}
