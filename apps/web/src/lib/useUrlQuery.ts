import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "vike/client/router";
import { usePageContext } from "vike-react/usePageContext";

type Search = Record<string, string | undefined>;

/**
 * URL'dagi sahifa holati va uni o'zgartirish (kompaniyalar katalogi, maoshlar).
 *
 * - `query` — foydalanuvchi ko'rayotgan holat. O'zgartirish bosilishi bilan
 *   darhol yangilanadi (optimistik), URL va ma'lumot esa orqadan yetib keladi.
 * - `update()` Vike routeri orqali yangi URL'ga o'tadi: sahifa qayta
 *   yuklanmaydi, `+data` yangi ma'lumotni olib keladi, orqaga/oldinga
 *   tugmalari ishlaydi. Vike ketma-ket navigatsiyalarda faqat oxirgisini
 *   chizadi — eskirgan javob yangisining ustiga yozilmaydi.
 * - `pending` — yangi URL uchun ma'lumot hali kelmagan.
 *
 * `parse` va `serialize` modul darajasidagi barqaror funksiyalar bo'lsin;
 * `serialize` standart qiymatlarni tashlab yuborishi kerak (kalit bir xil chiqsin).
 */
export function useUrlQuery<Q extends object>(parse: (search: Search) => Q, serialize: (query: Q) => URLSearchParams) {
  const pageContext = usePageContext();
  const search = (pageContext.urlParsed?.search ?? {}) as Search;
  const urlKey = serialize(parse(search)).toString();
  // urlKey barqaror satr — obyekt har renderda yangidan yasalmasin
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const urlQuery = useMemo(() => parse(search), [urlKey]);

  const [optimistic, setOptimistic] = useState<Q | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const latest = useRef<Q>(urlQuery);

  useEffect(() => {
    // URL o'zgardi: yoki kutilgan navigatsiya yakunlandi, yoki foydalanuvchi
    // orqaga/oldinga bosdi. Vike oraliq navigatsiyalarni chizmaydi, shuning
    // uchun ikkala holatda ham URL — haqiqat manbai.
    latest.current = urlQuery;
    setOptimistic(null);
    setPendingKey(null);
  }, [urlKey, urlQuery]);

  const update = useCallback(
    (patch: Partial<Q> | ((current: Q) => Q), options: { replace?: boolean } = {}) => {
      const draft = typeof patch === "function" ? (patch as (current: Q) => Q)(latest.current) : { ...latest.current, ...patch };
      // Normallashtirish (tartib, noto'g'ri qiymatlar) — kalit har doim bir xil chiqsin
      const next = parse(Object.fromEntries(serialize(draft)));
      const nextKey = serialize(next).toString();
      if (nextKey === serialize(latest.current).toString()) return;

      latest.current = next;
      setOptimistic(next);
      setPendingKey(nextKey);
      if (typeof window === "undefined") return;
      const href = window.location.pathname + (nextKey ? `?${nextKey}` : "");
      void navigate(href, { keepScrollPosition: true, overwriteLastHistoryEntry: options.replace });
    },
    [parse, serialize]
  );

  return {
    query: optimistic ?? urlQuery,
    /** Ma'lumoti yuklangan (URL'dagi) holat — natijalar shunga bog'lanadi. */
    urlQuery,
    urlKey,
    pending: pendingKey !== null && pendingKey !== urlKey,
    update,
  };
}
