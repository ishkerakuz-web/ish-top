import React, { useId, useRef, useState } from "react";
import { useT, useHref } from "../lib/i18n/index.js";
import { useClickOutside } from "../lib/useClickOutside.js";
import { useNotifications } from "../lib/useNotifications.js";
import type { NotificationView } from "../lib/notifications/adapter.js";

/**
 * Header'dagi qo'ng'iroq: o'qilmaganlar soni va oxirgi bildirishnomalar ro'yxati.
 * To'liq ro'yxat `/notifications` sahifasida.
 */
export function NotificationBell({ token }: { token: string | null }) {
  const t = useT();
  const l = useHref();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = `${useId()}-notifications`;
  useClickOutside(boxRef, () => setOpen(false), open);

  // audit R3, D-060 (a11y-ui-2): Escape popoverni yopadi va fokusni qo'ng'iroqqa
  // qaytaradi (useClickOutside faqat yopardi — fokus <body> ga tushardi).
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Escape" || !open) return;
    e.stopPropagation();
    setOpen(false);
    buttonRef.current?.focus();
  }

  const { items, unreadCount, loading, failed, refresh, markRead, markAllRead } = useNotifications(token, { limit: 8 });
  // API xatosi "bildirishnoma yo'q" bo'lib ko'rinmasin (audit PHASE 6, U6/U21)
  const [retrying, setRetrying] = useState(false);
  // audit R3, api-errors-4: amal serverda bajarilmasa soxta muvaffaqiyat ko'rsatilmaydi
  const [actionFailed, setActionFailed] = useState(false);
  const hasItems = items.length > 0;
  const pending = !hasItems && (loading || retrying);
  const loadFailed = !hasItems && !pending && failed;
  const retry = () => {
    setRetrying(true);
    setActionFailed(false);
    void refresh().finally(() => setRetrying(false));
  };
  const runAction = (action: Promise<boolean>) => {
    setActionFailed(false);
    void action.then((ok) => setActionFailed(!ok));
  };

  return (
    <div ref={boxRef} onKeyDown={onKeyDown} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `${t.notifications.title} (${unreadCount})` : t.notifications.title}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-dusk transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M18 8.5a6 6 0 10-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M13.7 19a2 2 0 01-3.4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-signal px-1 text-[10px] font-bold leading-none text-white ring-2 ring-paper">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="fixed inset-x-3 top-[5.25rem] z-50 origin-top animate-pop overflow-hidden rounded-xl border border-line bg-surface shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[336px] sm:max-w-[calc(100vw-2rem)] sm:origin-top-right">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <span className="font-display text-sm font-bold text-ink">{t.notifications.title}</span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => runAction(markAllRead())}
                className="text-xs font-medium text-signal transition-colors hover:text-signal-dark"
              >
                {t.notifications.markAllRead}
              </button>
            ) : pending || loadFailed ? null : (
              <span className="text-xs text-dusk">{t.notifications.allRead}</span>
            )}
          </div>

          {actionFailed && (
            <p role="alert" className="border-b border-line bg-danger/10 px-4 py-2 text-[12.5px] text-danger">
              {t.notifications.actionError}
            </p>
          )}

          {pending ? (
            <p role="status" className="px-4 py-8 text-center text-sm text-dusk">
              {t.ui.loading}
            </p>
          ) : loadFailed ? (
            <div role="alert" className="px-4 py-6 text-center">
              <p className="text-sm text-dusk">{t.notifications.loadError}</p>
              <button
                type="button"
                onClick={retry}
                className="mt-3 text-sm font-medium text-signal transition-colors hover:text-signal-dark"
              >
                {t.notifications.retry}
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-dusk">{t.notifications.empty}</p>
          ) : (
            <ul className="max-h-[45vh] overflow-y-auto overscroll-contain sm:max-h-[min(360px,45vh)]">
              {/* audit R3, D-060 (a11y-ui-4): balandlik viewport'ga bog'liq — 740x360
                  landshaftda sm: tarmog'idagi 360px ro'yxat sarlavha va "hammasi"
                  havolasini ekrandan chiqarib yuborardi (panel sticky header ichida,
                  unga scroll qilib bo'lmasdi). */}
              {items.map((n) => (
                <li key={n.id}>
                  <NotificationRow
                    notification={n}
                    href={l(n.url ?? "/notifications")}
                    onOpen={() => {
                      // Xato bo'lsa panel yopilgani uchun ko'rinmaydi — keyingi so'rov holatni tiklaydi
                      if (!n.isRead) void markRead(n.id);
                      setOpen(false);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}

          <a
            href={l("/notifications")}
            className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-signal transition-colors hover:bg-surface-2"
          >
            {t.notifications.viewAll}
          </a>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
  href,
  onOpen,
}: {
  notification: NotificationView;
  href: string;
  onOpen: () => void;
}) {
  const t = useT();
  // Sarlavhasi yo'q bo'lsa matn sarlavha o'rniga chiziladi (model ikkalasi ham bo'sh qatorni bermaydi)
  const heading = notification.title ?? notification.body ?? "";
  const description = notification.title ? notification.body : null;
  return (
    <a
      href={href}
      onClick={onOpen}
      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-surface-2 ${
        notification.isRead ? "" : "bg-signal/[0.06]"
      }`}
    >
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
          notification.isRead ? "bg-transparent" : "bg-signal"
        }`}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{heading}</span>
        {description && <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-dusk">{description}</span>}
        {notification.type && <span className="mt-1 block text-[11px] text-dusk">{t.notifications.types[notification.type]}</span>}
      </span>
    </a>
  );
}
