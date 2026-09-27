import React, { useEffect, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { useT, useHref } from "../lib/i18n/index.js";
import { canModerate, isStaffRole } from "../lib/admin/roles.js";
import { fetchAdminCounters } from "../lib/apiExtra.js";
import type { AdminCounters } from "../lib/types.js";
import { pageLocale } from "../lib/i18n/pageLocale.js";
import { useAuth } from "./AuthContext.js";

/**
 * Admin sahifalarining umumiy qobig'i: rol tekshiruvi + yon navigatsiya.
 *
 * Rol tekshiruvi ikki qavatli — bu yerda UI yashiriladi, serverda esa har bir
 * `/api/admin/*` yo'li `requireAuth` + `requireStaff(...)` bilan himoyalangan: rol va blok
 * holati TOKENDAN emas, har so'rovda BAZADAN o'qiladi (audit R3, admin-staff-16; ISSUE-035).
 * Bu yerdagi tekshiruv faqat ko'rinish uchun — xavfsizlikni server hal qiladi.
 *
 * `allow="staff"` — maqolalar bo'limi: SUPER_ADMIN, muharrir va muallif. Qolgan
 * bo'limlar faqat `admin`. Kontent jamoasi a'zosi `/admin` ga kirsa — maqolalarga.
 */
/**
 * Monetizatsiya bayrog'i (audit R3, D-065). Server uni `GET /api/admin/overview` da beradi;
 * admin bosh sahifasi qiymatni shu yerga yozadi, qobiq esa to'lovlar bo'limini shunga qarab
 * ko'rsatadi. Bayroq noma'lum bo'lsa bo'lim YASHIRIN — platforma bepul (standart holat).
 */
const BILLING_KEY = "admin:billingEnabled";
const BILLING_EVENT = "admin:billingEnabled";

export function rememberAdminBilling(enabled: boolean): void {
  try {
    window.sessionStorage.setItem(BILLING_KEY, enabled ? "1" : "0");
  } catch {
    /* sessionStorage yopiq bo'lsa — e'tiborsiz */
  }
  window.dispatchEvent(new Event(BILLING_EVENT));
}

function readAdminBilling(): boolean {
  try {
    return window.sessionStorage.getItem(BILLING_KEY) === "1";
  } catch {
    return false;
  }
}

/** Monetizatsiya yoqilganmi — tarif/tushum ustunlari shu bo'yicha chiziladi (audit R3, D-065). */
export function useAdminBilling(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const sync = () => setEnabled(readAdminBilling());
    sync();
    window.addEventListener(BILLING_EVENT, sync);
    return () => window.removeEventListener(BILLING_EVENT, sync);
  }, []);
  return enabled;
}

export function AdminShell({
  children,
  allow = "admin",
  wide = false,
}: {
  children: React.ReactNode;
  /** "moderation" — admin va moderator (vakansiya, sharh, kompaniya, murojaatlar, jurnal). */
  allow?: "admin" | "staff" | "moderation";
  wide?: boolean;
}) {
  const t = useT();
  const c = t.contentAdmin;
  const l = useHref();
  const { status, user, accessToken } = useAuth();
  const pageContext = usePageContext();
  const pathname = pageLocale(pageContext).pathname;

  const isAdmin = status === "authed" && user?.role === "admin";
  const isStaff = status === "authed" && isStaffRole(user?.role);
  const isModerator = status === "authed" && user?.role === "moderator";
  const allowed = allow === "staff" ? isStaff : allow === "moderation" ? canModerate(user?.role) && status === "authed" : isAdmin;
  const redirectToArticles = status === "authed" && isStaff && !isAdmin && pathname === "/admin";
  // Moderatorning bosh sahifasi — vakansiyalar navbati (umumiy statistika va xizmat amallari faqat adminda)
  const redirectToQueue = isModerator && pathname === "/admin";
  const counters = useAdminCounters(isAdmin || isModerator ? accessToken : null, pathname);

  const [showPayments, setShowPayments] = useState(false);

  useEffect(() => {
    if (redirectToArticles) window.location.replace(l("/admin/articles"));
    else if (redirectToQueue) window.location.replace(l("/admin/vacancies?status=moderation"));
  }, [redirectToArticles, redirectToQueue, l]);

  useEffect(() => {
    const sync = () => setShowPayments(readAdminBilling());
    sync();
    window.addEventListener(BILLING_EVENT, sync);
    return () => window.removeEventListener(BILLING_EVENT, sync);
  }, []);

  // Badge — navbatda kutayotganlar soni (admin/moderator e'tiborini talab qiladi)
  const moderationLinks: NavItem[] = [
    { href: "/admin/vacancies", label: t.admin.nav.vacancies, badge: counters?.vacancies },
    { href: "/admin/companies", label: t.admin.nav.companies, badge: counters?.companies },
    { href: "/admin/reviews", label: t.admin.nav.reviews, badge: counters?.reviews },
    { href: "/admin/support", label: t.admin.nav.support, badge: counters?.support },
    { href: "/admin/moderation-log", label: t.admin.nav.log },
  ];
  const links: NavItem[] = isAdmin
    ? [
        { href: "/admin", label: t.admin.nav.overview },
        { href: "/admin/users", label: t.admin.nav.users, badge: counters?.recovery },
        ...moderationLinks,
        // Monetizatsiya o'chiq bo'lsa to'lovlar bo'limi ko'rsatilmaydi (audit R3, D-065)
        ...(showPayments ? [{ href: "/admin/payments", label: t.admin.nav.payments }] : []),
        { href: "/admin/articles", label: c.nav.articles },
        { href: "/admin/team", label: c.nav.team },
      ]
    : isModerator
      ? moderationLinks
      : [{ href: "/admin/articles", label: c.nav.articles }];
  const width = wide ? "max-w-7xl" : "max-w-6xl";

  if (status === "loading" || redirectToArticles || redirectToQueue) {
    return (
      <div className={`mx-auto ${width} px-4 py-8 sm:px-6`} aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-2" />
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6" data-testid="admin-access-denied">
        <h1 className="font-display text-xl font-bold text-ink">{allow === "staff" ? c.accessDenied : t.admin.common.accessDenied}</h1>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {isModerator ? (
            <a
              href={l("/admin/vacancies")}
              className="inline-block rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark"
            >
              {t.admin.nav.vacancies}
            </a>
          ) : isStaff ? (
            <a
              href={l("/admin/articles")}
              className="inline-block rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark"
            >
              {c.toArticles}
            </a>
          ) : status === "guest" ? (
            <a href={l("/login")} className="inline-block rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark">
              {t.nav.login}
            </a>
          ) : null}
          <a
            href={l("/")}
            className="inline-block rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-signal hover:text-signal"
          >
            {t.search.breadcrumbHome}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto ${width} px-4 py-8 sm:px-6`}>
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t.admin.title}</h1>

      <nav aria-label={t.admin.title} className="-mx-1 mt-5 flex gap-1.5 overflow-x-auto border-b border-line px-1 pb-3 scrollbar-none sm:flex-wrap">
        {links.map((link) => {
          const active = link.href === "/admin" ? pathname === "/admin" : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <a
              key={link.href}
              href={l(link.href)}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-signal/10 text-signal dark:text-indigo-300" : "text-dusk hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {link.label}
              {link.badge ? (
                <span className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-signal px-1.5 text-[10.5px] font-bold leading-[18px] text-white">
                  {link.badge > 99 ? "99+" : link.badge}
                </span>
              ) : null}
            </a>
          );
        })}
      </nav>

      <div className="mt-6">{children}</div>
    </div>
  );
}

type NavItem = { href: string; label: string; badge?: number };

/**
 * Menyu hisoblagichlari: sahifa ochilganda va har daqiqada yangilanadi. Xatoda badge'lar
 * shunchaki ko'rinmaydi — panel ishlashiga ta'sir qilmaydi.
 */
function useAdminCounters(token: string | null, pathname: string): AdminCounters | null {
  const [counters, setCounters] = useState<AdminCounters | null>(null);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const controller = new AbortController();
    const load = () =>
      fetchAdminCounters(token, controller.signal).then(
        (data) => alive && setCounters(data),
        () => undefined
      );
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    // Boshqa sahifadagi amal (tasdiqlash) sonlarni o'zgartiradi — bo'lim almashganda ham yangilanadi
    const refresh = () => void load();
    window.addEventListener(COUNTERS_EVENT, refresh);
    return () => {
      alive = false;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener(COUNTERS_EVENT, refresh);
    };
  }, [token, pathname]);
  return counters;
}

const COUNTERS_EVENT = "admin:counters";

/** Moderatsiya amalidan keyin menyu badge'larini darhol yangilash. */
export function refreshAdminCounters(): void {
  window.dispatchEvent(new Event(COUNTERS_EVENT));
}

/** Admin jadvallari uchun bir xil ko'rinishdagi konteyner. */
export function AdminTable({
  head,
  children,
  minWidth = 720,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-dusk">
            {head}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Sahifalar orasida o'tish (oldingi / keyingi). */
export function Pager({
  page,
  pageCount,
  total,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const t = useT();
  if (total === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-dusk">{t.admin.common.total(total)}</span>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-dusk transition-colors hover:text-ink disabled:opacity-40"
          >
            {t.admin.common.prev}
          </button>
          <span className="font-mono text-sm text-dusk">{t.admin.common.page(page, pageCount)}</span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => onChange(page + 1)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-dusk transition-colors hover:text-ink disabled:opacity-40"
          >
            {t.admin.common.next}
          </button>
        </div>
      )}
    </div>
  );
}

/** Jadval ustidagi qidiruv/filtr qatori. */
export function AdminFilters({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2.5">{children}</div>;
}

export function AdminSearchInput({
  value,
  onChange,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 focus-within:border-signal"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-dusk" aria-hidden>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {/* Ko'rinadigan yorliq yo'q — maqsad `aria-label` bilan beriladi (audit R3, gap5-6, WCAG 3.3.2) */}
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full bg-transparent text-sm text-ink placeholder:text-dusk focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
    </form>
  );
}

export function AdminSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-signal focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Amallar ustuni sarlavhasi: bo'sh `<th>` o'rniga ekran o'quvchi uchun nom (audit R3, gap5-6).
 */
export function AdminActionsHeader({ label }: { label: string }) {
  return (
    <th className="px-4 py-2.5 text-right font-semibold">
      <span className="sr-only">{label}</span>
    </th>
  );
}

/** Jadvaldagi kichik amal tugmasi. */
export function RowButton({
  onClick,
  children,
  tone = "neutral",
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: "neutral" | "primary" | "danger";
  /** Amal bajarilayotganda takroriy bosishning oldini oladi (audit R3, admin-staff-12). */
  disabled?: boolean;
}) {
  const toneClass = {
    neutral: "border-line text-dusk hover:text-ink",
    primary: "border-signal/40 text-signal hover:bg-signal/10",
    danger: "border-line text-dusk hover:border-signal hover:text-signal",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={disabled || undefined}
      className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      {children}
    </button>
  );
}
