import { useCallback, useEffect, useState } from "react";
import type { ArticleListPage } from "./adapter.js";
import { fetchArticlePage } from "./api.js";
import type { ArticlesQuery } from "./query.js";

/** `+data` natijasi: `page === null` — server javob bermadi (bo'sh ro'yxat emas). */
export interface ArticlesPageData {
  key: string;
  page: ArticleListPage | null;
}

/**
 * Asosiy yo'l — `+data` (server). Bu hook faqat server javob bermagan holatni
 * boshqaradi (vakansiyalar sahifasidagi naqsh): brauzer bir marta o'zi qayta
 * so'raydi, "Qayta urinish" — yana bir marta. So'rov URL o'zgarsa bekor bo'ladi.
 */
export function useArticleList(initial: ArticlesPageData, urlKey: string, urlQuery: ArticlesQuery) {
  const [override, setOverride] = useState<{ key: string; page: ArticleListPage } | null>(null);
  // Birinchi chizishda xato paneli "miltillamasin" — server javob bermagan bo'lsa darhol yuklanish
  const [retrying, setRetrying] = useState(initial.page === null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => setOverride(null), [initial]);

  const needsFetch = initial.page === null && initial.key === urlKey;

  useEffect(() => {
    if (!needsFetch) {
      setRetrying(false);
      return;
    }
    const ctrl = new AbortController();
    setRetrying(true);
    fetchArticlePage(urlQuery, ctrl.signal)
      .then((page) => {
        if (!ctrl.signal.aborted) setOverride({ key: urlKey, page });
      })
      .catch(() => undefined) // xato holati ko'rinishda qoladi
      .finally(() => {
        if (!ctrl.signal.aborted) setRetrying(false);
      });
    return () => ctrl.abort();
  }, [needsFetch, urlKey, urlQuery, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const page = override && override.key === urlKey ? override.page : initial.page;
  return { page, retrying, retry };
}
