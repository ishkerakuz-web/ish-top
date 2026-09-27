import React, { createContext, useContext, useCallback, useEffect } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { getMessages, type Messages } from "./messages.js";
import { localizeHref, type Locale } from "./config.js";
import { pageLocale } from "./pageLocale.js";

interface I18nState {
  locale: Locale;
  t: Messages;
}

const I18nContext = createContext<I18nState | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  // Til URL'dan (onBeforeRoute) keladi. pageContext navigatsiyada yangilanadi —
  // shuning uchun til almashtirilganda butun daraxt yangi tilda qayta render bo'ladi.
  const { locale } = pageLocale(pageContext);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  const value: I18nState = { locale, t: getMessages(locale) };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n faqat LocaleProvider ichida ishlatilishi kerak");
  return ctx;
}

/** Joriy til lug'atini qaytaradi: `const t = useT(); t.nav.vacancies`. */
export function useT(): Messages {
  return useI18n().t;
}

/** Joriy til. */
export function useLocale(): { locale: Locale } {
  return { locale: useI18n().locale };
}

/**
 * Ichki havolalar uchun: joriy tilga mos yo'l qaytaradi.
 * `const l = useHref(); <a href={l("/companies")}>` — ru'da "/ru/companies" bo'ladi.
 */
export function useHref(): (href: string) => string {
  const { locale } = useI18n();
  return useCallback((href: string) => localizeHref(href, locale), [locale]);
}
