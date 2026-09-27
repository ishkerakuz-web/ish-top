import React from "react";
import type { ProfileCompletionState } from "../../lib/profile/useProfileCompletion.js";
import { useT } from "../../lib/i18n/index.js";
import type { EmploymentType } from "../../lib/types.js";
import { HelpCard, SIDEBAR_CARD, SIDEBAR_TITLE, TipsCard, type Tip } from "../dashboard/SidebarCards.js";
import { EmploymentIcon, IconBell, IconBookmarkFilled, IconFile, IconHeart, IconUser } from "./icons.js";

/** Saqlanganlar statistikasi — jami, ochiq/yopilgan (yopilgan bo'lsagina). */
export function FavoritesStats({ total, closed }: { total: number; closed: number }) {
  const s = useT().favoritesPage.sidebar;
  return (
    <section aria-labelledby="favorites-stats-title" className={SIDEBAR_CARD}>
      <h2 id="favorites-stats-title" className={`${SIDEBAR_TITLE} flex items-center gap-2.5`}>
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal">
          <IconBookmarkFilled size={17} />
        </span>
        {s.statsTitle}
      </h2>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="font-display text-[32px] font-bold leading-none tabular-nums text-ink">{total}</span>
        <span className="text-[13.5px] text-dusk">{s.totalLabel}</span>
      </p>
      {closed > 0 && (
        <ul className="mt-4 space-y-2.5">
          <li className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className="flex items-center gap-2.5 text-ink/85">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-growth" />
              {s.open}
            </span>
            <span className="font-semibold tabular-nums text-ink">{total - closed}</span>
          </li>
          <li className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className="flex items-center gap-2.5 text-ink/85">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-danger" />
              {s.closed}
            </span>
            <span className="font-semibold tabular-nums text-ink">{closed}</span>
          </li>
        </ul>
      )}
      <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-signal-soft p-3.5 text-[12.5px] leading-snug text-ink/80">
        <IconHeart size={16} className="mt-px shrink-0 text-signal" />
        {closed > 0 ? s.closedHint(closed) : s.hint}
      </p>
    </section>
  );
}

/** Tezkor filtrlar — saqlanganlar orasidagi ish turlari (2 va undan ko'p tur bo'lsa). */
export function FavoritesQuickFilters({
  types,
  counts,
  active,
  onSelect,
}: {
  types: EmploymentType[];
  counts: Record<EmploymentType, number>;
  active: EmploymentType | "all";
  onSelect: (type: EmploymentType | "all") => void;
}) {
  const t = useT();
  const s = t.favoritesPage.sidebar;
  if (types.length < 2) return null;
  return (
    <section aria-labelledby="favorites-quick-title" className={SIDEBAR_CARD}>
      <h2 id="favorites-quick-title" className={SIDEBAR_TITLE}>
        {s.quickTitle}
      </h2>
      <ul className="mt-3 space-y-2">
        {types.map((type) => (
          <li key={type}>
            <button
              type="button"
              aria-pressed={active === type}
              onClick={() => onSelect(active === type ? "all" : type)}
              className="flex w-full items-center gap-3 rounded-2xl bg-surface-2/70 px-3 py-2.5 text-left text-[13.5px] font-medium text-ink transition-colors hover:bg-signal-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal aria-pressed:bg-signal-soft aria-pressed:text-signal"
            >
              <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface text-signal">
                <EmploymentIcon type={type} size={16} />
              </span>
              <span className="min-w-0 flex-1">{t.enums.employment[type]}</span>
              <span className="font-semibold tabular-nums text-dusk">{counts[type]}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * O'ng panel (telefonda ro'yxatdan keyin): statistika, tezkor filtrlar (saqlanganlar
 * bo'lsa), maslahatlar va yordam. Profil maslahati faqat to'liqlik < 100% bo'lsa
 * (`computeCompletion`); foiz noma'lum bo'lsa — ko'rsatilmaydi.
 */
export function FavoritesSidebar({
  total,
  closed,
  types,
  counts,
  activeType,
  onType,
  completion,
}: {
  total: number;
  closed: number;
  types: EmploymentType[];
  counts: Record<EmploymentType, number>;
  activeType: EmploymentType | "all";
  onType: (type: EmploymentType | "all") => void;
  completion: ProfileCompletionState;
}) {
  const s = useT().favoritesPage.sidebar;
  const ready = completion.status === "ready" ? completion : null;
  const tips: Tip[] = [
    { key: "alerts", href: "/alerts", icon: <IconBell size={18} />, ...s.tips.alerts },
    { key: "resume", href: "/profile?tab=resume", icon: <IconFile size={18} />, ...(ready && !ready.resumeReady ? s.tips.resumeFill : s.tips.resume) },
    ...(ready && ready.percent < 100 ? [{ key: "profile", href: "/profile", icon: <IconUser size={18} />, ...s.tips.profile }] : []),
  ];

  return (
    <aside className="flex min-w-0 flex-col gap-5 lg:self-start">
      {total > 0 && <FavoritesStats total={total} closed={closed} />}
      {total > 0 && <FavoritesQuickFilters types={types} counts={counts} active={activeType} onSelect={onType} />}
      <TipsCard id="favorites-tips-title" title={s.tipsTitle} allLabel={s.tipsAll} allHref="/articles" tips={tips} />
      <HelpCard id="favorites-help-title" title={s.help.title} text={s.help.text} cta={s.help.cta} />
    </aside>
  );
}
