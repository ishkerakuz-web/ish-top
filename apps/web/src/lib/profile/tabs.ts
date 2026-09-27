import { useCallback, useEffect, useState } from "react";
import { navigate } from "vike/client/router";
import { usePageContext } from "vike-react/usePageContext";

export const PROFILE_TABS = [
  "overview",
  "personal",
  "resume",
  "experience",
  "education",
  "skills",
  "applications",
  "saved",
  "telegram",
  "settings",
] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

export function parseTab(value: unknown): ProfileTab {
  return PROFILE_TABS.includes(value as ProfileTab) ? (value as ProfileTab) : "overview";
}

/** `/profile?tab=resume&step=6` ko'rinishidagi manzil (joriy til prefiksi saqlanadi). */
export function profileTabHref(pathname: string, tab: ProfileTab, step?: number): string {
  const params = new URLSearchParams();
  if (tab !== "overview") params.set("tab", tab);
  if (step) params.set("step", String(step));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * Faol bo'lim URL'da saqlanadi: orqaga tugmasi ishlaydi, havolani ulashsa
 * shu bo'lim ochiladi. Almashtirish Vike routeri orqali — sahifa qayta
 * yuklanmaydi, React holati saqlanadi.
 *
 * Mahalliy holat darhol yangilanadi (tugma bosilishi bilan kontent almashadi),
 * URL esa orqadan yetib keladi; orqaga/oldinga bosilganda URL'dan sinxronlanadi.
 */
export function useProfileTab() {
  const pageContext = usePageContext();
  const search = (pageContext.urlParsed?.search ?? {}) as Record<string, string | undefined>;
  const urlTab = parseTab(search.tab);
  const urlStep = Number(search.step) || undefined;

  const [tab, setTabState] = useState<ProfileTab>(urlTab);
  const [step, setStep] = useState<number | undefined>(urlStep);

  useEffect(() => {
    setTabState(urlTab);
    setStep(urlStep);
  }, [urlTab, urlStep]);

  const setTab = useCallback((next: ProfileTab, nextStep?: number) => {
    setTabState(next);
    setStep(nextStep);
    if (typeof window === "undefined") return;
    const href = profileTabHref(window.location.pathname, next, nextStep);
    if (href !== window.location.pathname + window.location.search) {
      void navigate(href, { keepScrollPosition: true });
    }
  }, []);

  return { tab, step, setTab };
}
