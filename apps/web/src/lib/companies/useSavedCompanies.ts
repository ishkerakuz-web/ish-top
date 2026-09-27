import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSavedCompanyIdsStrict, saveCompany, unsaveCompany } from "../apiExtra.js";
import { useAuth } from "../../components/AuthContext.js";

/**
 * Saqlangan kompaniyalar (ID to'plami) — kartalardagi yurakchalar uchun.
 * Vakansiyalar sevimlilari (useFavorites) bilan bir xil naqsh: bir marta
 * yuklanadi, bosilganda optimistik almashadi, server rad etsa qaytariladi.
 *
 * Audit R3, api-errors-7: ro'yxatni yuklab bo'lmasa bu "hech narsa saqlanmagan"
 * degani emas — `ready` false qoladi va bosilganda avval haqiqiy holat so'raladi
 * (aks holda saqlangan kompaniya qayta "qo'shilgan" bo'lib ko'rinardi).
 */
export function useSavedCompanies() {
  const { status, user, accessToken } = useAuth();
  const enabled = status === "authed" && user?.role === "job_seeker" && Boolean(accessToken);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || !accessToken) {
      setIds(new Set());
      setReady(false);
      return;
    }
    let cancelled = false;
    fetchSavedCompanyIdsStrict(accessToken)
      .then((list) => {
        if (cancelled) return;
        setIds(new Set(list));
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, accessToken]);

  // toggle barqaror bo'lsin (kartalar memo) — joriy to'plam ref orqali o'qiladi
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const toggle = useCallback(
    async (companyId: string) => {
      if (!enabled || !accessToken) return;
      if (!readyRef.current) {
        // Haqiqiy holat noma'lum — avval so'raymiz, aks holda noto'g'ri yo'nalishda o'zgaradi
        try {
          const current = new Set(await fetchSavedCompanyIdsStrict(accessToken));
          idsRef.current = current;
          setIds(current);
          setReady(true);
        } catch {
          return;
        }
      }
      const wasSaved = idsRef.current.has(companyId);
      const flip = (add: boolean) =>
        setIds((prev) => {
          const next = new Set(prev);
          if (add) next.add(companyId);
          else next.delete(companyId);
          return next;
        });

      flip(!wasSaved);
      try {
        if (wasSaved) await unsaveCompany(accessToken, companyId);
        else await saveCompany(accessToken, companyId);
      } catch {
        flip(wasSaved);
      }
    },
    [enabled, accessToken]
  );

  return {
    /** Faqat ish izlovchi saqlay oladi; mehmonga kirish taklif qilinadi. */
    enabled,
    /** ID'lar haqiqatan yuklandimi (xatoda false — "bo'sh" bilan aralashmasin). */
    ready,
    authLoading: status === "loading",
    accessToken,
    isSaved: useCallback((id: string) => ids.has(id), [ids]),
    toggle,
  };
}
