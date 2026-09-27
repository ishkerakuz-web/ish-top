import React, { useEffect, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { BrandLogo } from "./BrandLogo.js";
import { ThemeToggle } from "./ThemeToggle.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { NotificationBell } from "./NotificationBell.js";
import { useT, useHref } from "../lib/i18n/index.js";
import { useAuth } from "./AuthContext.js";
import { useClickOutside } from "../lib/useClickOutside.js";
import { useInboxSummary } from "../lib/useInboxSummary.js";
import { isStaffRole } from "../lib/admin/roles.js";
import { pageLocale } from "../lib/i18n/pageLocale.js";

interface NavLink {
  label: string;
  href: string;
  badge?: number;
}

interface AccountLink {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: number;
}

export default function Header() {
  const t = useT();
  const l = useHref();
  const { status, user, accessToken, logout } = useAuth();
  const pageContext = usePageContext();
  // Xato sahifasida (render(404)) server pageContext'ida localePathname yo'q — URL'dan olinadi
  const pathname = pageLocale(pageContext).pathname;
  const search = (pageContext.urlParsed?.search ?? {}) as Record<string, string | undefined>;
  const { summary } = useInboxSummary(status === "authed" ? accessToken : null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(userRef, () => setUserOpen(false), userOpen);

  // audit R3, D-060 (a11y-ui-2, a11y-ui-9): popover/menyu klaviaturasi —
  // Escape yopadi va fokusni ochgan tugmaga qaytaradi, ↑/↓ bandlar bo'ylab
  // yuradi (useClickOutside faqat yopardi, fokus <body> ga tushardi).
  function menuItems(box: HTMLElement | null): HTMLElement[] {
    if (!box) return [];
    return Array.from(box.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
  }

  function moveFocus(box: HTMLElement | null, step: number) {
    const items = menuItems(box);
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = current < 0 ? (step > 0 ? 0 : items.length - 1) : (current + step + items.length) % items.length;
    items[next]?.focus();
  }

  function closeUserMenu(returnFocus: boolean) {
    setUserOpen(false);
    if (returnFocus) userButtonRef.current?.focus();
  }

  function onUserMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Ichki vidjet (til tanlagich) tugmani o'zi ishlatgan bo'lsa aralashmaymiz
    if (!userOpen || e.defaultPrevented) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      closeUserMenu(true);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus(userMenuRef.current, e.key === "ArrowDown" ? 1 : -1);
    }
  }

  function onMobileMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!menuOpen || e.defaultPrevented) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      setMenuOpen(false);
      menuButtonRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus(mobileMenuRef.current, e.key === "ArrowDown" ? 1 : -1);
    }
  }
  // Client-side navigatsiyadan keyin mobil va akkaunt menyulari yopiladi (audit ISSUE-074)
  const urlOriginal = pageContext.urlOriginal;
  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);
  }, [urlOriginal]);

  const isEmployer = status === "authed" && user?.role === "employer";
  const isSeeker = status === "authed" && user?.role === "job_seeker";
  const isAdmin = status === "authed" && user?.role === "admin";
  const isModerator = status === "authed" && user?.role === "moderator";
  // Jamoa (muharrir, muallif, moderator): profil/xabarlar yo'q — faqat o'z paneli
  const isContentStaff = status === "authed" && (isStaffRole(user?.role) || isModerator) && !isAdmin;
  const adminHref = isAdmin ? "/admin" : isModerator ? "/admin/vacancies" : "/admin/articles";
  // Asosiy navigatsiya — ochiq bo'limlar. Akkaunt sahifalari (arizalar,
  // saqlanganlar, sozlamalar) bu yerda emas, avatar menyusida.
  const navLinks: NavLink[] = isEmployer
    ? [
        { label: t.nav.myVacancies, href: "/employer/vacancies" },
        { label: t.nav.candidates, href: "/employer/candidates" },
        { label: t.nav.applications, href: "/employer/applications", badge: summary.newApplications },
        { label: t.nav.messages, href: "/messages", badge: summary.unreadMessages },
      ]
    : [
        { label: t.nav.vacancies, href: "/vacancies" },
        { label: t.nav.companies, href: "/companies" },
        { label: t.navExtra.salaries, href: "/salaries" },
        { label: t.nav.articles, href: "/articles" },
        ...(isSeeker
          ? [{ label: t.nav.messages, href: "/messages", badge: summary.unreadMessages }]
          : []),
        ...(isAdmin || isContentStaff ? [{ label: t.navExtra.admin, href: adminHref }] : []),
      ];

  // Ish beruvchining "bosh sahifasi" — xodim qidirish (ish izlovchiniki — ish qidirish)
  const homeHref = isEmployer ? "/employer/candidates" : "/";
  const displayName = user?.firstName || user?.email?.split("@")[0] || "";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || displayName;
  const initial = displayName.charAt(0).toUpperCase();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const onSettings = pathname === "/profile" && search.tab === "settings";

  // Nomzod akkaunt menyusi — qat'iy tartib: Profil, Arizalarim, Saqlanganlar,
  // Bildirishnomalar, Xabarlar, Sozlamalar | Chiqish.
  const messagesLink: AccountLink = {
    key: "messages",
    label: t.nav.messages,
    href: "/messages",
    icon: <ChatIcon />,
    active: isActive("/messages"),
    badge: summary.unreadMessages,
  };
  const adminLink: AccountLink = { key: "admin", label: t.navExtra.admin, href: adminHref, icon: <ShieldIcon />, active: isActive("/admin") };
  const accountLinks: AccountLink[] = isSeeker
    ? [
        { key: "profile", label: t.nav.profile, href: "/profile", icon: <UserIcon />, active: pathname === "/profile" && !onSettings },
        { key: "applications", label: t.navExtra.applications, href: "/applications", icon: <FileIcon />, active: isActive("/applications") },
        { key: "favorites", label: t.navExtra.favorites, href: "/favorites", icon: <HeartIcon />, active: isActive("/favorites") },
        { key: "notifications", label: t.navExtra.notifications, href: "/notifications", icon: <BellIcon />, active: isActive("/notifications") },
        messagesLink,
        { key: "settings", label: t.navExtra.settings, href: "/profile?tab=settings", icon: <GearIcon />, active: onSettings },
      ]
    : isContentStaff
      ? [adminLink]
      : [
          { key: "profile", label: isEmployer ? t.nav.companyProfile : t.nav.profile, href: "/profile", icon: <UserIcon />, active: isActive("/profile") },
          messagesLink,
          // Tariflar havolasi yo'q — platforma hozircha bepul (monetizatsiya UI'si ko'rsatilmaydi)
          ...(isAdmin ? [adminLink] : []),
        ];
  // Mobil menyuda asosiy navigatsiyadagi bandlar takrorlanmaydi (nomzoddan tashqari)
  const mobileAccountLinks: AccountLink[] = isSeeker
    ? accountLinks
    : isContentStaff
      ? []
      : [
        accountLinks[0],
        ...(!isEmployer ? [messagesLink] : []),
        { key: "notifications", label: t.navExtra.notifications, href: "/notifications", icon: <BellIcon />, active: isActive("/notifications") },
      ];
  // Avatar tugmasi akkaunt sahifalarida (xabarlar asosiy navigatsiyada) belgilanadi
  const accountActive = accountLinks.some((link) => link.active && link.key !== "messages" && link.key !== "admin");

  // Breakpointlar: mobil < 768, planshet 768–1023, desktop >= 1024.
  // To'liq navigatsiya faqat `lg` dan: 768–1023 oralig'ida bir qatorga
  // sig'maydi (header viewportdan toshardi) — planshet ixcham menyuni oladi.
  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4">
      <div className="mx-auto max-w-7xl rounded-2xl border border-line bg-surface/92 shadow-card backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-8 lg:gap-4 xl:gap-8">
          <a href={l(homeHref)} className="group flex shrink-0 items-center gap-2.5 text-ink">
            <BrandLogo variant="nav" />
            <span className="whitespace-nowrap font-display text-lg font-bold tracking-tight">
              ISH <span className="text-signal">BOR</span>
              {/* Dekorativ "!" — kontrast auditidan chiqadi, ma'no yo'qolmaydi */}
              <span className="text-gold" aria-hidden>!</span>
            </span>
          </a>

          <nav aria-label={t.nav.menu} className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={l(link.href)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`nav-underline relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:px-2.5 xl:px-3 ${
                  isActive(link.href)
                    ? "nav-underline-active text-ink"
                    : "text-dusk hover:text-ink"
                }`}
              >
                {link.label}
                {link.badge ? <NavBadge count={link.badge} /> : null}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          {status === "authed" && <NotificationBell token={accessToken} />}
          <ThemeToggle className="hidden sm:flex" />
          <LanguageSwitcher className="hidden sm:block" />

          <div className="mx-1 hidden h-6 w-px bg-line sm:block" />

          {status === "authed" ? (
            <div ref={userRef} onKeyDown={onUserMenuKeyDown} className="relative hidden lg:block">
              <button
                ref={userButtonRef}
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowDown" || userOpen) return;
                  e.preventDefault();
                  setUserOpen(true);
                  // Menyu ochilgandan keyin birinchi bandga fokus
                  window.setTimeout(() => moveFocus(userMenuRef.current, 1), 0);
                }}
                aria-haspopup="true"
                aria-expanded={userOpen}
                aria-controls="account-menu"
                aria-label={`${t.navExtra.accountMenu}: ${displayName}`}
                className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-surface-2 ${
                  accountActive ? "bg-signal-soft" : ""
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full bg-signal font-display text-sm font-bold text-white ${
                    accountActive ? "ring-2 ring-signal/30 ring-offset-2 ring-offset-surface" : ""
                  }`}
                >
                  {initial}
                </span>
                {/* 1024–1279: nav + o'ng tugmalar sig'ishi uchun faqat avatar */}
                <span className="hidden max-w-[120px] truncate text-sm font-medium text-ink xl:block">
                  {displayName}
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={`text-dusk transition-transform duration-200 ${userOpen ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {userOpen && (
                <div
                  id="account-menu"
                  ref={userMenuRef}
                  className="absolute right-0 z-50 mt-2 w-64 max-h-[calc(100dvh-6rem)] origin-top-right animate-pop overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface shadow-pop"
                >
                  <div className="border-b border-line px-4 py-3">
                    <p className="truncate text-sm font-semibold text-ink">{fullName}</p>
                    {user?.email && <p className="mt-0.5 truncate text-xs text-dusk">{user.email}</p>}
                  </div>
                  <nav aria-label={t.navExtra.accountMenu}>
                    <ul className="py-1">
                      {accountLinks.map((link) => (
                        <li key={link.key}>
                          <a
                            href={l(link.href)}
                            aria-current={link.active ? "page" : undefined}
                            onClick={() => closeUserMenu(false)}
                            className={`flex items-center justify-between gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-surface-2 ${
                              link.active ? "bg-signal-soft font-semibold text-signal" : "text-ink"
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              {link.icon} {link.label}
                            </span>
                            {link.badge ? <NavBadge count={link.badge} /> : null}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                  <div className="border-t border-line py-1">
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                    >
                      <LogoutIcon /> {t.nav.logout}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-1 lg:flex xl:gap-2">
              {/* 1024–1279 da nav bilan ustma-ust tushardi — bu oraliqda footer va ro'yxatdan o'tish orqali */}
              <a
                href={l("/employer")}
                className="hidden whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-dusk transition-colors hover:text-ink xl:block xl:px-3"
              >
                {t.nav.forEmployers}
              </a>
              <a
                href={l("/login")}
                className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-2 xl:px-3"
              >
                {t.nav.login}
              </a>
              <a
                href={l("/signup")}
                className="whitespace-nowrap rounded-lg bg-signal px-3.5 py-2 xl:px-4 text-sm font-semibold text-white shadow-xs transition-all duration-200 hover:bg-signal-dark hover:shadow-sm active:scale-[0.98]"
              >
                {t.nav.signup}
              </a>
            </div>
          )}

          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key !== "Escape" || !menuOpen) return;
              e.stopPropagation();
              e.preventDefault();
              setMenuOpen(false);
            }}
            aria-label={menuOpen ? t.ui.closeMenu : t.ui.openMenu}
            aria-haspopup="true"
            aria-controls="mobile-menu"
            aria-expanded={menuOpen}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface-2 lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
            {!menuOpen && status === "authed" && summary.unreadMessages + summary.newApplications > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-signal ring-2 ring-paper" />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          id="mobile-menu"
          ref={mobileMenuRef}
          onKeyDown={onMobileMenuKeyDown}
          className="max-h-[calc(100dvh-6.5rem)] animate-slide-down overflow-y-auto overscroll-contain border-t border-line px-4 py-4 lg:hidden"
        >
          <nav aria-label={t.nav.menu} className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={l(link.href)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(link.href) ? "bg-surface-2 font-semibold text-ink" : "text-ink hover:bg-surface-2"
                }`}
              >
                {link.label}
                {link.badge ? <NavBadge count={link.badge} /> : null}
              </a>
            ))}
          </nav>

          <div className="mt-3 flex items-center gap-2 px-1">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>

          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
            {status === "authed" ? (
              <>
                {mobileAccountLinks.length > 0 && (
                  <>
                    <nav aria-label={t.navExtra.accountMenu} className="flex flex-col gap-1">
                      {mobileAccountLinks.map((link) => (
                        <a
                          key={link.key}
                          href={l(link.href)}
                          aria-current={link.active ? "page" : undefined}
                          className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-surface-2 ${
                            link.active ? "bg-signal-soft font-semibold text-signal" : "font-medium text-ink"
                          }`}
                        >
                          {link.label}
                          {link.badge ? <NavBadge count={link.badge} /> : null}
                        </a>
                      ))}
                    </nav>
                    <div className="h-px bg-line" aria-hidden />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => logout()}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-2"
                >
                  {t.nav.logout}
                </button>
              </>
            ) : (
              <>
                <a href={l("/employer")} className="rounded-lg px-3 py-2.5 text-sm font-medium text-dusk hover:bg-surface-2">
                  {t.nav.forEmployers}
                </a>
                <a href={l("/login")} className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface-2">
                  {t.nav.login}
                </a>
                <a
                  href={l("/signup")}
                  className="rounded-lg bg-signal px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-signal-dark"
                >
                  {t.nav.signup}
                </a>
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </header>
  );
}

function NavBadge({ count }: { count: number }) {
  return (
    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-signal px-1 text-[10px] font-bold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-dusk" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20a7 7 0 0114 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-dusk" aria-hidden>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v5h5M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-dusk" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-dusk" aria-hidden>
      <path d="M14 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 12h10m0 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-dusk" aria-hidden>
      <path d="M4 5h16v11H8l-4 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-dusk" aria-hidden>
      <path
        d="M12 20.5l-1.45-1.32C5.4 14.5 2 11.4 2 7.6 2 4.8 4.2 2.6 7 2.6c1.6 0 3.1.74 4 1.93.9-1.19 2.4-1.93 4-1.93 2.8 0 5 2.2 5 5 0 3.8-3.4 6.9-8.55 11.6L12 20.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-dusk" aria-hidden>
      <path
        d="M18 8.5a6 6 0 10-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M13.7 19a2 2 0 01-3.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-dusk" aria-hidden>
      <path
        d="M12 3l7 3v5.5c0 4.2-2.9 7.9-7 9.5-4.1-1.6-7-5.3-7-9.5V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
