import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { useT, useHref } from "../lib/i18n/index.js";
import { useAuth } from "./AuthContext.js";
import { useInboxSummary } from "../lib/useInboxSummary.js";
import { pageLocale } from "../lib/i18n/pageLocale.js";

const EMPLOYER_DASH = ["/employer/vacancies", "/employer/applications", "/employer/candidates"];

function shouldHideNav(p: string): boolean {
  if (p === "/login" || p === "/signup") return true;
  if (/^\/(vacancies|vacancy)\/[^/]+/.test(p)) return true;
  if (/^\/companies\/[^/]+/.test(p)) return true;
  if (p.startsWith("/employer/") && !EMPLOYER_DASH.some(d => p.startsWith(d))) return true;
  return false;
}

function getActiveTab(p: string, isEmployer: boolean): number {
  if (p === "/" || (isEmployer && p === "/employer/candidates")) return 0;
  if (p === "/vacancies" || p.startsWith("/search")) return 1;
  if (p.startsWith("/favorites")) return 2;
  if (p.startsWith("/messages")) return 3;
  if (p.startsWith("/profile")) return 4;
  return -1;
}

function domeSvgPath(i: number): string {
  const cx = i * 78 + 39;
  return `M0,30 H${cx - 55} C${cx - 35},30 ${cx - 20},5 ${cx},5 C${cx + 20},5 ${cx + 35},30 ${cx + 55},30 H390 V102 H0 Z`;
}

type Tab = {
  label: string;
  href: string;
  badge?: number;
  icon: (active: boolean, size?: number) => React.ReactNode;
};

function Badge({ count }: { count: number }) {
  return (
    <span className="absolute -right-1 top-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-signal px-1 text-[9px] font-bold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function MobileBottomNav() {
  const t = useT();
  const l = useHref();
  const { status, user, accessToken } = useAuth();
  const pageContext = usePageContext();
  const pathname = pageLocale(pageContext).pathname;
  const { summary } = useInboxSummary(status === "authed" ? accessToken : null);
  const isEmployer = status === "authed" && user?.role === "employer";

  if (shouldHideNav(pathname)) return null;

  const active = getActiveTab(pathname, isEmployer);

  const tabs: Tab[] = [
    {
      label: t.nav.home,
      href: isEmployer ? "/employer/candidates" : "/",
      icon: (a, s = 22) => (
        <svg width={s} height={s} viewBox="0 0 24 24" fill={a ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          {!a && <polyline points="9 22 9 12 15 12 15 22" />}
        </svg>
      ),
    },
    {
      label: t.nav.search,
      href: "/vacancies",
      icon: (a, s = 22) => (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      label: t.navExtra.favorites,
      href: "/favorites",
      icon: (a, s = 22) => (
        <svg width={s} height={s} viewBox="0 0 24 24" fill={a ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
    },
    {
      label: t.nav.messages,
      href: "/messages",
      badge: summary.unreadMessages || undefined,
      icon: (a, s = 22) => (
        <svg width={s} height={s} viewBox="0 0 24 24" fill={a ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      label: t.nav.profile,
      href: "/profile",
      icon: (a, s = 22) => (
        <svg width={s} height={s} viewBox="0 0 24 24" fill={a ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  if (active >= 0) {
    const at = tabs[active];
    return (
      <nav
        aria-label={t.nav.menu}
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="relative h-[102px]">
          <svg
            className="absolute bottom-0 left-0 h-full w-full"
            viewBox="0 0 390 102"
            preserveAspectRatio="none"
            aria-hidden
            style={{ filter: "drop-shadow(0 -1px 3px rgba(15,23,42,0.05))" }}
          >
            <path d={domeSvgPath(active)} className="fill-surface" />
          </svg>

          <div
            className="absolute z-10 flex flex-col items-center"
            style={{ top: 10, left: `calc(${active * 20 + 10}% - 31px)`, width: 62 }}
          >
            <div
              className="dome-glow pointer-events-none absolute -left-[5px] -top-[3px] h-[72px] w-[72px] rounded-full"
              aria-hidden
            />
            <a
              href={l(at.href)}
              aria-current="page"
              className="dome-circle relative z-[1] flex h-14 w-14 items-center justify-center rounded-full text-white"
            >
              {at.icon(true, 24)}
            </a>
            <span className="mt-0.5 text-[10px] font-semibold text-signal">
              {at.label}
            </span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 grid h-16 grid-cols-5 place-items-center pb-2">
            {tabs.map((tab, i) => {
              if (i === active) return <div key={i} />;
              return (
                <a
                  key={i}
                  href={l(tab.href)}
                  className="relative flex flex-col items-center gap-1 text-dusk transition-colors"
                >
                  {tab.icon(false)}
                  <span className="text-[10px] font-medium">{tab.label}</span>
                  {tab.badge ? <Badge count={tab.badge} /> : null}
                </a>
              );
            })}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label={t.nav.menu}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="grid h-16 grid-cols-5 place-items-center">
        {tabs.map((tab, i) => (
          <a
            key={i}
            href={l(tab.href)}
            className="relative flex flex-col items-center gap-1 text-dusk transition-colors"
          >
            {tab.icon(false)}
            <span className="text-[10px] font-medium">{tab.label}</span>
            {tab.badge ? <Badge count={tab.badge} /> : null}
          </a>
        ))}
      </div>
    </nav>
  );
}
