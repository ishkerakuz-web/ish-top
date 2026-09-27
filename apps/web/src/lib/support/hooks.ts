import { useCallback, useEffect, useState } from "react";
import type { ArticleCardVM } from "../articles/adapter.js";
import { fetchArticleMatches, fetchSupportContacts } from "./api.js";
import type { SupportContactsVM } from "./contacts.js";

export const ARTICLE_MATCHES_LIMIT = 3;
const MIN_QUERY = 2;

export type ArticleMatchesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; items: ArticleCardVM[]; total: number }
  | { status: "error" };

/**
 * Qidiruv so'ziga mos maqolalar. `q` URL'dan keladi (qidiruv maydoni o'zi debounce
 * qiladi); so'z o'zgarsa eski so'rov bekor qilinadi. "Qayta urinish" — haqiqiy yangi so'rov.
 */
export function useArticleMatches(q: string) {
  const [state, setState] = useState<ArticleMatchesState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < MIN_QUERY) {
      setState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchArticleMatches(term, ARTICLE_MATCHES_LIMIT, controller.signal)
      .then((page) => setState({ status: "ready", ...page }))
      .catch((err: unknown) => {
        if ((err as Error)?.name !== "AbortError") setState({ status: "error" });
      });
    return () => controller.abort();
  }, [q, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}

export type SupportContactsState = { kind: "ok"; contacts: SupportContactsVM } | { kind: "loading" } | { kind: "error" };

/**
 * Aloqa kanallari: asosiy yo'l — server (`+data`). Server javob bermagan bo'lsa
 * brauzer bir marta o'zi so'raydi (skelet), "Qayta urinish" — yana so'rov.
 */
export function useSupportContacts(initial: SupportContactsVM | null) {
  const [state, setState] = useState<SupportContactsState>(() => (initial ? { kind: "ok", contacts: initial } : { kind: "loading" }));
  const [attempt, setAttempt] = useState(initial ? 0 : 1);

  useEffect(() => {
    if (attempt === 0) return;
    const controller = new AbortController();
    setState({ kind: "loading" });
    fetchSupportContacts(controller.signal)
      .then((contacts) => setState({ kind: "ok", contacts }))
      .catch((err: unknown) => {
        if ((err as Error)?.name !== "AbortError") setState({ kind: "error" });
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
