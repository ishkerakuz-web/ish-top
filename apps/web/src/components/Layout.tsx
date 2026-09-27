// Shriftlar self-hosted: public/fonts + fonts.css (unicode-range bilan).
// MUHIM: @fontsource CSS'ni to'g'ridan-to'g'ri import qilmang — Vike u holda
// BARCHA subset faylini avtomatik <link rel="preload"> qiladi (~500KB!),
// bu mobil LCP'ni bir necha soniyaga kechiktiradi. public/ fayllarini preload qilmaydi.
// fonts.css global.css ichiga @import bilan kiradi — bitta CSS so'rovi bo'lsin.
import "../styles/global.css";
import React, { useEffect, useRef } from "react";
import Header from "./Header.js";
import Footer from "./Footer.js";
import { AuthProvider } from "./AuthContext.js";
import { LocaleProvider, useT } from "../lib/i18n/index.js";
import { ThemeProvider } from "../lib/theme.js";

// Barcha kirish animatsiyalari CSS'da (animate-fade-up, useReveal) — hidratsiyani
// kutmasdan birinchi paint'dayoq ishlaydi (LCP tez), JS kutubxonasiz.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <AuthProvider>
          <div className="flex min-h-screen flex-col bg-paper font-body text-ink antialiased">
            <SkipLink />
            <ReducedMotionScroll />
            <ScrollProgress />
            <Header />
            {/* audit R3, D-060 (a11y-ui-9): o'tish havolasining nishoni;
                tabIndex=-1 — havoladan keyin fokus shu yerga ko'chadi */}
            <main id="main-content" tabIndex={-1} className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}

/**
 * Klaviatura foydalanuvchisi uchun "asosiy kontentga o'tish" havolasi
 * (audit R3, D-060 — a11y-ui-9, WCAG 2.4.1). Sahifadagi BIRINCHI fokuslanuvchi
 * element; faqat fokusda ko'rinadi, layout o'zgarmaydi.
 */
function SkipLink() {
  const t = useT();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-signal focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-pop"
    >
      {t.ui.skipToContent}
    </a>
  );
}

/**
 * `prefers-reduced-motion: reduce` bo'lsa JS bilan chaqirilgan silliq scroll
 * ham darhol bo'ladi (audit R3, D-060 — a11y-ui-6). CSS'dagi
 * `scroll-behavior: auto` scrollIntoView({behavior:"smooth"}) opsiyasini
 * bosmaydi, shuning uchun opsiya chaqiruv paytida tekshiriladi.
 */
function ReducedMotionScroll() {
  useEffect(() => {
    const w = window as typeof window & { __ishReducedMotionScroll?: boolean };
    if (w.__ishReducedMotionScroll) return;
    w.__ishReducedMotionScroll = true;
    const reduced = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    const plain = (options: unknown) =>
      options && typeof options === "object" && (options as ScrollOptions).behavior === "smooth"
        ? { ...(options as ScrollOptions), behavior: "auto" as ScrollBehavior }
        : options;

    const scrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (arg?: boolean | ScrollIntoViewOptions) {
      return scrollIntoView.call(this, reduced() ? (plain(arg) as ScrollIntoViewOptions) : arg);
    };
    for (const name of ["scrollTo", "scrollBy"] as const) {
      const target = Element.prototype as unknown as Record<string, (...args: unknown[]) => void>;
      const original = target[name];
      if (typeof original === "function") {
        target[name] = function (this: Element, ...args: unknown[]) {
          return original.apply(this, reduced() && args.length === 1 ? [plain(args[0])] : args);
        };
      }
      const win = window as unknown as Record<string, (...args: unknown[]) => void>;
      const originalWin = win[name];
      if (typeof originalWin === "function") {
        win[name] = function (...args: unknown[]) {
          return originalWin.apply(window, reduced() && args.length === 1 ? [plain(args[0])] : args);
        };
      }
    }
  }, []);
  return null;
}

/** Sahifa boshida o'qish jarayonini ko'rsatuvchi ingichka gradient chiziq.
 *  Faqat transform o'zgaradi (GPU), scroll passiv + rAF bilan siyraklashtirilgan. */
function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      el.style.transform = `scaleX(${max > 0 ? h.scrollTop / max : 0})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return <div ref={ref} className="scroll-progress" aria-hidden />;
}
