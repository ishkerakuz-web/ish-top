import { useCallback, useEffect, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

export type CompanyTab = "overview" | "vacancies" | "reviews" | "photos";

function parseTab(value: unknown, available: readonly CompanyTab[]): CompanyTab {
  return typeof value === "string" && (available as readonly string[]).includes(value) ? (value as CompanyTab) : "overview";
}

/**
 * Kompaniya sahifasi tabi URL'da: `/companies/:slug?tab=vacancies`.
 * Almashtirish `history.pushState` bilan — Vike foydalanuvchi qo'ygan yozuvda
 * sahifani qayta so'ramaydi (ma'lumot takror yuklanmaydi), orqaga/oldinga esa
 * `popstate` orqali tabni tiklaydi. Mavjud bo'lmagan tab (masalan sharh yo'q
 * bo'lsa `?tab=reviews`) — "Asosiy ma'lumot".
 */
export function useCompanyTab(available: readonly CompanyTab[]) {
  const pageContext = usePageContext();
  const [tab, setTabState] = useState<CompanyTab>(() => parseTab(pageContext.urlParsed?.search?.tab, available));
  const key = available.join(",");

  useEffect(() => {
    const onPop = () => setTabState(parseTab(new URLSearchParams(window.location.search).get("tab"), key.split(",") as CompanyTab[]));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [key]);

  const setTab = useCallback((next: CompanyTab) => {
    setTabState(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    const href = url.pathname + url.search + url.hash;
    if (href !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.pushState(null, "", href);
    }
  }, []);

  return [available.includes(tab) ? tab : "overview", setTab] as const;
}
