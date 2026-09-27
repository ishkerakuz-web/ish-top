import React from "react";
import type { ConversationView } from "../../lib/messages/adapter.js";
import { formatListTime } from "../../lib/messages/format.js";
import { useLocale, useT } from "../../lib/i18n/index.js";
import { ParticipantAvatar, displayName, participantLabel } from "./participant.js";

/**
 * Ro'yxatdagi suhbat — haqiqiy havola (`?c=id`): yangi oynada ochish va sahifani
 * yangilash ishlaydi, oddiy bosishda sahifa qayta yuklanmaydi.
 * Vaqt faqat oxirgi xabar bo'lsa, o'qilmaganlar belgisi faqat > 0 bo'lsa chiziladi.
 */
export function ConversationItem({
  item,
  active,
  href,
  onSelect,
}: {
  item: ConversationView;
  active: boolean;
  href: string;
  onSelect: (id: string) => void;
}) {
  const m = useT().messagesPage;
  const { locale } = useLocale();
  const name = displayName(item, m);
  const time = item.lastMessageAt ? formatListTime(item.lastMessageAt, locale, m.time) : null;
  const unread = item.unread > 0;

  return (
    <a
      href={href}
      data-conversation={item.id}
      aria-current={active ? "true" : undefined}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onSelect(item.id);
      }}
      className={`relative flex gap-3 px-4 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal ${
        active ? "bg-signal-soft/70 dark:bg-signal/15" : "hover:bg-surface-2"
      }`}
    >
      {active && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-signal" />}
      <ParticipantAvatar conversation={item} name={name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-[14.5px] text-ink ${unread ? "font-bold" : "font-semibold"}`}>{name}</span>
          {time && item.lastMessageAt && (
            <time dateTime={item.lastMessageAt} className={`shrink-0 text-[12px] tabular-nums ${unread ? "font-semibold text-signal" : "text-dusk"}`}>
              {time}
            </time>
          )}
        </span>
        <span className="block truncate text-[12px] text-dusk">{participantLabel(item, m)}</span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={`min-w-0 flex-1 truncate text-[13px] ${unread ? "font-semibold text-ink" : "text-dusk"}`}>
            {item.lastMessage ? (
              <>
                {item.lastMessageMine && <span className="font-medium text-dusk">{m.list.you} </span>}
                {item.lastMessage}
              </>
            ) : (
              <span className="italic">{m.list.noMessages}</span>
            )}
          </span>
          {unread && (
            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-signal px-1.5 text-[11px] font-bold leading-none text-white">
              <span aria-hidden>{item.unread > 99 ? "99+" : item.unread}</span>
              <span className="sr-only">{m.list.unreadBadge(item.unread)}</span>
            </span>
          )}
        </span>
      </span>
    </a>
  );
}
