import { useCallback, useEffect, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

type Search = Record<string, string | undefined>;

/**
 * Klient tomonida filtrlanadigan ro'yxat holati URL'da (arizalar, saqlanganlar).
 *
 * Vike `navigate` o'rniga `history.pushState`: foydalanuvchi qo'ygan yozuvda Vike
 * sahifani qayta render qilmaydi, ro'yxat qayta so'ralmaydi. Orqaga/oldinga —
 * `popstate` orqali holat URL'dan qayta o'qiladi. (`+data` bilan ishlaydigan
 * sahifalar uchun — `useUrlQuery`.)
 *
 * `parse` va `toSearch` modul darajasidagi barqaror funksiyalar bo'lsin;
 * `toSearch` standart qiymatlarni tashlab `"?a=b"` yoki `""` qaytaradi.
 */
export function useHistoryQuery<Q>(
  parse: (source: URLSearchParams | Search) => Q,
  toSearch: (query: Q) => string,
  options: { onPop?: () => void } = {}
) {
  const pageContext = usePageContext();
  const [query, setQuery] = useState<Q>(() =>
    parse(typeof window !== "undefined" ? new URLSearchParams(window.location.search) : ((pageContext.urlParsed?.search ?? {}) as Search))
  );
  const queryRef = useRef(query);
  queryRef.current = query;
  const onPopRef = useRef(options.onPop);
  onPopRef.current = options.onPop;

  useEffect(() => {
    const onPop = () => {
      onPopRef.current?.();
      const next = parse(new URLSearchParams(window.location.search));
      queryRef.current = next;
      setQuery(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [parse]);

  const commit = useCallback(
    (next: Q, replace = false) => {
      queryRef.current = next;
      setQuery(next);
      const href = window.location.pathname + toSearch(next) + window.location.hash;
      if (href === window.location.pathname + window.location.search + window.location.hash) return;
      if (replace) window.history.replaceState(null, "", href);
      else window.history.pushState(null, "", href);
    },
    [toSearch]
  );

  return { query, queryRef, commit };
}
