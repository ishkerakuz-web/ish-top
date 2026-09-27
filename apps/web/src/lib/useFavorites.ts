import { useCallback, useEffect, useRef, useState } from "react";
import { addFavorite, fetchFavoriteIdsStrict, removeFavorite } from "./apiExtra.js";
import { useAuth } from "../components/AuthContext.js";

/**
 * Sevimli vakansiyalar to'plami (ID'lar) va ularni almashtirish.
 *
 * Ro'yxat va qidiruv sahifalarida yuraklarni bo'yash uchun bir marta yuklanadi.
 * Bosilganda UI darrov o'zgaradi (optimistik), server javobi kelmasa oldingi
 * holatga qaytadi — sekin internetda ham tugma "o'lik" bo'lib qolmaydi.
 *
 * Audit ISSUE-022: ID'lar yuklanmasa bu "saqlanganlar yo'q" degani emas — `ready` false qoladi va
 * bosilganda avval haqiqiy holat so'raladi (aks holda saqlangan e'lon qayta "qo'shilgan" bo'lib ko'rinardi).
 */
export function useFavorites() {
  const { status, user, accessToken } = useAuth();
  const enabled = status === "authed" && user?.role === "job_seeker" && Boolean(accessToken);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => {
    if (!enabled || !accessToken) {
      setIds(new Set());
      setReady(false);
      return;
    }
    let cancelled = false;
    fetchFavoriteIdsStrict(accessToken)
      .then((list) => {
        if (!cancelled) {
          setIds(new Set(list));
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, accessToken]);

  const toggle = useCallback(
    async (vacancyId: string) => {
      if (!enabled || !accessToken) return false;
      let current = idsRef.current;
      if (!readyRef.current) {
        try {
          current = new Set(await fetchFavoriteIdsStrict(accessToken));
          idsRef.current = current;
          setIds(current);
          setReady(true);
        } catch {
          // Haqiqiy holat noma'lum — noto'g'ri yo'nalishda o'zgartirmaymiz
          return false;
        }
      }
      const wasFavorite = current.has(vacancyId);

      setIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(vacancyId);
        else next.add(vacancyId);
        return next;
      });

      try {
        if (wasFavorite) await removeFavorite(accessToken, vacancyId);
        else await addFavorite(accessToken, vacancyId);
        return !wasFavorite;
      } catch {
        // Server rad etdi — belgini orqaga qaytaramiz
        setIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(vacancyId);
          else next.delete(vacancyId);
          return next;
        });
        return wasFavorite;
      }
    },
    [enabled, accessToken]
  );

  return {
    /** Faqat ish izlovchi kirgan bo'lsa yuraklar ko'rsatiladi. */
    enabled,
    ready,
    ids,
    isFavorite: useCallback((id: string) => ids.has(id), [ids]),
    toggle,
  };
}
