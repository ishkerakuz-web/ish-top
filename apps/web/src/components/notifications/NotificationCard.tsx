import React, { memo } from "react";
import { canOpenTarget, type NotificationView } from "../../lib/notifications/adapter.js";
import { formatDate, formatRelativeDays } from "../../lib/format.js";
import { useHref, useLocale, useT } from "../../lib/i18n/index.js";
import type { Messages } from "../../lib/i18n/types.js";
import { CATEGORY_STYLE, CategoryIcon, IconArrowRight, IconCheck, IconTrash } from "./icons.js";

/** "Hozirgina", "11 daqiqa oldin", "5 soat oldin", keyin kunlar ("Kecha", "3 kun oldin"). */
export function timeAgo(iso: string, t: Messages, now = Date.now()): string {
  const ms = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return t.notificationsPage.time.justNow;
  if (minutes < 60) return t.notificationsPage.time.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.notificationsPage.time.hours(hours);
  return formatRelativeDays(iso, t.fmt);
}

const ACTION =
  "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-[13px] font-medium text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

/**
 * Bildirishnoma kartasi. O'qilmagan: och indigo fon, chegara, nuqta va qalin sarlavha
 * (ekran o'quvchiga "O'qilmagan" matni). Faqat backend'dagi ma'lumot: kategoriya
 * (tur ma'lum bo'lsa), matn, vaqt, havola (ichki va rolga ochiq bo'lsa) — yo'q bo'lsa chizilmaydi.
 */
export const NotificationCard = memo(function NotificationCard({
  item,
  role,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  item: NotificationView;
  role: string | null;
  onOpen: (event: React.MouseEvent<HTMLAnchorElement>, item: NotificationView, href: string) => void;
  onMarkRead: (item: NotificationView) => void;
  onDelete: (item: NotificationView) => void;
}) {
  const t = useT();
  const n = t.notificationsPage;
  const l = useHref();
  const { locale } = useLocale();
  const titleId = `notification-${item.id}-title`;
  const heading = item.title ?? item.body ?? "";
  const description = item.title ? item.body : null;
  const href = item.url && canOpenTarget(item.target, role) ? l(item.url) : null;
  const ago = item.createdAt ? timeAgo(item.createdAt, t) : null;
  const style = CATEGORY_STYLE[item.category];

  return (
    <article
      aria-labelledby={titleId}
      data-unread={item.isRead ? undefined : "true"}
      className={`rounded-3xl border p-4 shadow-card transition-colors sm:p-5 ${
        item.isRead ? "border-line bg-surface" : "border-signal/30 bg-signal/[0.045] dark:bg-signal/[0.1]"
      }`}
    >
      <div className="flex gap-3.5 sm:gap-4">
        <span aria-hidden className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${style.tone}`}>
          <CategoryIcon category={item.category} size={20} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <h3 id={titleId} className={`font-display text-[15.5px] leading-snug tracking-tight text-ink ${item.isRead ? "font-semibold" : "font-bold"}`}>
                {!item.isRead && <span className="sr-only">{n.card.unread}: </span>}
                {heading}
              </h3>
              {item.type && <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${style.tone}`}>{n.categories[item.category]}</span>}
            </div>
            {(ago || !item.isRead) && (
              <div className="flex shrink-0 items-center gap-2.5 pt-0.5">
                {ago && item.createdAt && (
                  <time dateTime={item.createdAt} title={formatDate(item.createdAt, locale)} className="text-[12.5px] text-dusk">
                    {ago}
                  </time>
                )}
                {!item.isRead && <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-signal" />}
              </div>
            )}
          </div>

          {description && <p className="mt-1.5 text-[14px] leading-relaxed text-ink/80">{description}</p>}

          <div className="mt-3.5 flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {href && item.target && (
              <a
                href={href}
                onClick={(e) => onOpen(e, item, href)}
                aria-describedby={titleId}
                className="mr-1.5 inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border border-signal/30 bg-surface px-3.5 text-[13px] font-semibold text-signal transition-colors hover:border-signal hover:bg-signal-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                {n.card.open[item.target]}
                <IconArrowRight size={14} />
              </a>
            )}
            {!item.isRead && (
              <button type="button" onClick={() => onMarkRead(item)} aria-describedby={titleId} className={ACTION}>
                <IconCheck size={15} />
                {n.card.markRead}
              </button>
            )}
            <button type="button" onClick={() => onDelete(item)} aria-describedby={titleId} className={`${ACTION} hover:text-danger`}>
              <IconTrash size={15} />
              {n.card.deleteShort}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
});
