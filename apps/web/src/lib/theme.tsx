import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";
export const THEME_KEY = "ish-top:theme";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* localStorage mavjud bo'lmasligi mumkin */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR va clientning birinchi renderi har doim "light" — bir xil bo'lishi shart.
  // Haqiqiy holatni (inline skript allaqachon <html>'ga qo'ygan) mount'da o'qiymiz.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setThemeState(isDark ? "dark" : "light");
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme faqat ThemeProvider ichida ishlatilishi kerak");
  return ctx;
}

/**
 * Paint'dan oldin <html>'ga `dark` klassini qo'yadigan inline skript matni.
 * `+config.ts`dagi global Head orqali <head>'ga joylanadi — FOUC bo'lmaydi.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;
