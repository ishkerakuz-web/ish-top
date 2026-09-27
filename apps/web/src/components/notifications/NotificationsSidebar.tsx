import React from "react";
import type { NotificationCategory } from "../../lib/notifications/adapter.js";
import { useHref, useT } from "../../lib/i18n/index.js";
import { HelpCard, SIDEBAR_CARD, SIDEBAR_TITLE } from "../dashboard/SidebarCards.js";
import { CATEGORY_STYLE, CategoryIcon, IconArrowRight, IconBell, IconBulb, IconSettings } from "./icons.js";

/** O'qilmaganlar (serverdagi aniq son) va o'qilgan/o'qilmagan ulushi (yuklangan ro'yxatdan). */
export function NotificationStats({ unreadCount, total, read, truncated }: { unreadCount: number; total: number; read: number; truncated: boolean }) {
  const s = useT().notificationsPage.sidebar;
  const pct = total ? Math.round((read / total) * 100) : 0;
  return (
    <section aria-labelledby="notifications-stats-title" className={SIDEBAR_CARD}>
      <h2 id="notifications-stats-title" className={`${SIDEBAR_TITLE} flex items-center gap-2.5`}>
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal">
          <IconBell size={17} />
        </span>
        {s.statsTitle}
      </h2>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="font-display text-[32px] font-bold leading-none tabular-nums text-ink">{unreadCount}</span>
        <span className="text-[13.5px] text-dusk">{s.unreadLabel}</span>
      </p>
      {total > 0 && (
        <>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={s.readShare(read, total)}
            className="mt-4 h-2 overflow-hidden rounded-full bg-signal/15"
          >
            <div className="h-full rounded-full bg-signal" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[12.5px] text-dusk">{s.readShare(read, total)}</p>
        </>
      )}
      <p className="mt-1 text-[12.5px] text-dusk">{s.totalLabel(truncated ? `${total}+` : String(total))}</p>
    </section>
  );
}

/** Kategoriyalar bo'yicha — faqat ro'yxatda uchraganlari; bosilsa shu kategoriya filtri. */
export function NotificationCategories({
  categories,
  counts,
  active,
  onSelect,
}: {
  categories: NotificationCategory[];
  counts: Record<NotificationCategory, number>;
  active: NotificationCategory | "all";
  onSelect: (category: NotificationCategory | "all") => void;
}) {
  const n = useT().notificationsPage;
  if (categories.length === 0) return null;
  return (
    <section aria-labelledby="notifications-categories-title" className={SIDEBAR_CARD}>
      <h2 id="notifications-categories-title" className={SIDEBAR_TITLE}>
        {n.sidebar.categoriesTitle}
      </h2>
      <ul className="-mx-2 mt-3 space-y-1">
        {categories.map((category) => (
          <li key={category}>
            <button
              type="button"
              aria-pressed={active === category}
              onClick={() => onSelect(active === category ? "all" : category)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left text-[13.5px] font-medium text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal aria-pressed:bg-signal-soft aria-pressed:text-signal"
            >
              <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${CATEGORY_STYLE[category].tone}`}>
                <CategoryIcon category={category} size={17} />
              </span>
              <span className="min-w-0 flex-1">{n.categories[category]}</span>
              <span className="font-semibold tabular-nums text-dusk">{counts[category]}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * O'ng panel: statistika va kategoriyalar (ro'yxat tabida, ma'lumot bo'lsa), sozlamalar,
 * maslahat va yordam. Telefonda asosiy kontentdan keyin.
 */
export function NotificationsSidebar({
  showList,
  unreadCount,
  total,
  read,
  truncated,
  categories,
  counts,
  activeCategory,
  onCategory,
  onSettings,
}: {
  showList: boolean;
  unreadCount: number;
  total: number;
  read: number;
  truncated: boolean;
  categories: NotificationCategory[];
  counts: Record<NotificationCategory, number>;
  activeCategory: NotificationCategory | "all";
  onCategory: (category: NotificationCategory | "all") => void;
  onSettings: () => void;
}) {
  const s = useT().notificationsPage.sidebar;
  const l = useHref();
  return (
    <aside className="flex min-w-0 flex-col gap-5 lg:self-start">
      {showList && <NotificationStats unreadCount={unreadCount} total={total} read={read} truncated={truncated} />}
      {showList && <NotificationCategories categories={categories} counts={counts} active={activeCategory} onSelect={onCategory} />}

      {showList && (
        <section aria-labelledby="notifications-settings-card-title" className={SIDEBAR_CARD}>
          <div className="flex items-start gap-3.5">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-signal-soft text-signal">
              <IconSettings size={20} />
            </span>
            <div className="min-w-0">
              <h2 id="notifications-settings-card-title" className={SIDEBAR_TITLE}>
                {s.settingsTitle}
              </h2>
              <p className="mt-1 text-[13.5px] leading-snug text-dusk">{s.settingsText}</p>
            </div>
          </div>
          <a
            href={l("/notifications?tab=settings")}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              onSettings();
            }}
            className="group mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl border border-signal/40 bg-surface px-4 text-[13.5px] font-semibold text-signal transition-colors hover:border-signal hover:bg-signal-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {s.settingsCta}
            <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        </section>
      )}

      <section aria-labelledby="notifications-tip-title" className={SIDEBAR_CARD}>
        <div className="flex items-start gap-3.5">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold-deep">
            <IconBulb size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="notifications-tip-title" className={SIDEBAR_TITLE}>
              {s.tipTitle}
            </h2>
            <p className="mt-2 text-[14px] font-semibold text-ink">{s.tipHeading}</p>
            <p className="mt-1 text-[13.5px] leading-snug text-dusk">{s.tipText}</p>
          </div>
        </div>
      </section>

      <HelpCard id="notifications-help-title" title={s.help.title} text={s.help.text} cta={s.help.cta} />
    </aside>
  );
}
