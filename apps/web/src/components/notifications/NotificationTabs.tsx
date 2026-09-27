import React, { useRef } from "react";
import type { NotificationsTab } from "../../lib/notifications/query.js";
import { useT } from "../../lib/i18n/index.js";
import { IconBell, IconSettings } from "./icons.js";

export const notificationsTabId = (tab: NotificationsTab) => `notifications-tab-${tab}`;
export const notificationsPanelId = (tab: NotificationsTab) => `notifications-panel-${tab}`;

const TABS: NotificationsTab[] = ["list", "settings"];

/** "Bildirishnomalar [o'qilmaganlar]" / "Sozlamalar" (WAI-ARIA tablar, ←/→ bilan almashadi). */
export function NotificationTabs({
  active,
  unreadCount,
  onChange,
}: {
  active: NotificationsTab;
  unreadCount: number;
  onChange: (tab: NotificationsTab) => void;
}) {
  const n = useT().notificationsPage;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") next = (index + 1) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(TABS[next]);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={n.tabs.label} className="flex gap-2">
      {TABS.map((tab, index) => {
        const selected = tab === active;
        return (
          <button
            key={tab}
            ref={(el) => {
              refs.current[index] = el;
            }}
            id={notificationsTabId(tab)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={notificationsPanelId(tab)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-2xl border px-4 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
              selected ? "border-signal/60 bg-signal-soft text-signal" : "border-line bg-surface text-dusk hover:border-signal/40 hover:text-ink"
            }`}
          >
            {tab === "list" ? <IconBell size={17} /> : <IconSettings size={17} />}
            {tab === "list" ? n.tabs.list : n.tabs.settings}
            {tab === "list" && unreadCount > 0 && (
              <span className="min-w-[22px] rounded-full bg-signal px-1.5 py-0.5 text-center text-[11.5px] font-bold tabular-nums text-white">{unreadCount}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
