import React, { useId } from "react";
import type { NotificationCategory } from "../../lib/notifications/adapter.js";
import type { NotificationsQuery } from "../../lib/notifications/query.js";
import type { NotificationsPatch } from "../../lib/notifications/useNotificationsQuery.js";
import { useT } from "../../lib/i18n/index.js";
import { FieldSelect } from "../vacancies/FieldSelect.js";
import { IconCheck, IconFilter } from "./icons.js";

/**
 * Ro'yxat ustidagi amallar: "Faqat o'qilmaganlar" (almashtirgich), kategoriya
 * (faqat ro'yxatda bor kategoriyalar) va "Hammasini o'qilgan deb belgilash".
 * O'qilmagan yo'q bo'lsa tugma o'rnida "Hammasi o'qilgan" holati.
 */
export function NotificationActions({
  query,
  categories,
  unreadCount,
  busy,
  onChange,
  onMarkAll,
}: {
  query: NotificationsQuery;
  categories: NotificationCategory[];
  unreadCount: number;
  busy: boolean;
  onChange: (patch: NotificationsPatch) => void;
  onMarkAll: () => void;
}) {
  const n = useT().notificationsPage;
  const id = useId();
  const pill =
    "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3.5 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

  return (
    <div role="group" aria-label={n.actions.label} className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      <button
        type="button"
        aria-pressed={query.unread}
        onClick={() => onChange({ unread: !query.unread })}
        className={`${pill} ${query.unread ? "border-signal/60 bg-signal-soft text-signal" : "border-line bg-surface text-ink hover:border-signal/40"}`}
      >
        <IconFilter size={16} />
        {n.actions.unreadOnly}
      </button>
      {categories.length > 1 && (
        <FieldSelect
          id={`${id}-category`}
          label={n.actions.category}
          size="sm"
          value={query.category}
          options={[{ value: "all", label: n.actions.allCategories }, ...categories.map((c) => ({ value: c, label: n.categories[c] }))]}
          onChange={(value) => onChange({ category: value as NotificationsQuery["category"] })}
          className="sm:w-56"
        />
      )}
      <div className="sm:ml-auto">
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={onMarkAll}
            disabled={busy}
            className={`${pill} w-full border-signal/40 bg-surface text-signal hover:border-signal hover:bg-signal-soft disabled:opacity-60 sm:w-auto`}
          >
            <IconCheck size={16} />
            {n.actions.markAllRead}
          </button>
        ) : (
          <span className="inline-flex h-10 items-center gap-1.5 text-[13.5px] font-medium text-dusk">
            <IconCheck size={16} />
            {n.actions.allReadDone}
          </span>
        )}
      </div>
    </div>
  );
}
