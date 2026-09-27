import React, { useEffect, useRef, useState } from "react";
import type { ConversationView } from "../../lib/messages/adapter.js";
import { messagesSearch, type MessagesQuery } from "../../lib/messages/query.js";
import { useHref, useT } from "../../lib/i18n/index.js";
import { ConversationItem } from "./ConversationItem.js";
import { ConversationsLoadMore, type LoadMoreStatus } from "./MessagesStates.js";
import { IconSearch } from "./icons.js";

type QueryUpdate = (patch: Partial<MessagesQuery>, options?: { replace?: boolean }) => void;

/** Tezkor filtr: "Barchasi" / "O'qilmagan" — backend'dagi haqiqiy o'qilmaganlar soni bo'yicha. */
function FilterPill({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="inline-flex h-9 items-center rounded-full border border-line px-3.5 text-[13px] font-semibold text-dusk transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal aria-pressed:border-signal/30 aria-pressed:bg-signal-soft aria-pressed:text-signal"
    >
      {children}
    </button>
  );
}

/**
 * Chap ustun: qidiruv (debounce), filtrlar va suhbatlar ro'yxati.
 * audit R3, D-078: ro'yxat serverda kursor bilan sahifalangan — "Yana suhbatlar"
 * davomini yuklaydi, yuklanmoqda/xato/oxiri holatlari ko'rinib turadi.
 */
export function ConversationList({
  items,
  filtered,
  query,
  activeId,
  hasMore,
  moreStatus,
  showEnd,
  onLoadMore,
  onQuery,
  onSelect,
}: {
  items: ConversationView[];
  filtered: ConversationView[];
  query: MessagesQuery;
  activeId: string | null;
  hasMore: boolean;
  moreStatus: LoadMoreStatus;
  showEnd: boolean;
  onLoadMore: () => void;
  onQuery: QueryUpdate;
  onSelect: (id: string) => void;
}) {
  const m = useT().messagesPage;
  const l = useHref();
  const [text, setText] = useState(query.q);
  const sent = useRef(query.q);

  // Orqaga/oldinga yoki tozalash — maydon URL bilan sinxron
  useEffect(() => {
    if (query.q === sent.current) return;
    sent.current = query.q;
    setText(query.q);
  }, [query.q]);

  useEffect(() => {
    if (text === sent.current) return;
    const timer = window.setTimeout(() => {
      sent.current = text;
      onQuery({ q: text }, { replace: true });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [text, onQuery]);

  const unreadTotal = items.filter((item) => item.unread > 0).length;
  const clear = () => {
    sent.current = "";
    setText("");
    onQuery({ q: "", unread: false });
  };

  return (
    <>
      <div className="border-b border-line p-3 sm:p-4">
        <h2 id="messages-list-title" className="sr-only">
          {m.list.title}
        </h2>
        <div role="search" className="relative">
          <label htmlFor="messages-search" className="sr-only">
            {m.list.searchLabel}
          </label>
          <IconSearch size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dusk" />
          <input
            id="messages-search"
            type="search"
            value={text}
            maxLength={100}
            autoComplete="off"
            placeholder={m.list.searchPlaceholder}
            onChange={(event) => setText(event.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-surface-2/60 pl-10 pr-3 text-[16px] text-ink placeholder:text-dusk focus:border-signal/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-signal/20 sm:text-[14px]"
          />
        </div>
        <div role="group" aria-label={m.list.filtersLabel} className="mt-3 flex flex-wrap gap-2">
          <FilterPill pressed={!query.unread} onClick={() => onQuery({ unread: false })}>
            {m.list.all(items.length)}
          </FilterPill>
          <FilterPill pressed={query.unread} onClick={() => onQuery({ unread: true })}>
            {m.list.unread(unreadTotal)}
          </FilterPill>
        </div>
        <p className="sr-only" aria-live="polite">
          {m.list.results(filtered.length)}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <h3 className="font-display text-[15px] font-bold text-ink">{m.list.emptyTitle}</h3>
          <p className="mt-1 max-w-[220px] text-[13.5px] text-dusk">{m.list.emptyText}</p>
          <button
            type="button"
            onClick={clear}
            className="mt-4 inline-flex h-9 items-center rounded-xl border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {m.list.clear}
          </button>
          {/* Filtr natijasi bo'sh bo'lsa ham davomida mos suhbat bo'lishi mumkin */}
          <div className="mt-4 w-full">
            <ConversationsLoadMore hasMore={hasMore} status={moreStatus} showEnd={false} onLoad={onLoadMore} />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ul aria-labelledby="messages-list-title" className="divide-y divide-line/70">
            {filtered.map((item) => (
              <li key={item.id}>
                <ConversationItem
                  item={item}
                  active={item.id === activeId}
                  href={l("/messages") + messagesSearch({ ...query, conversation: item.id })}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
          <ConversationsLoadMore hasMore={hasMore} status={moreStatus} showEnd={showEnd} onLoad={onLoadMore} />
        </div>
      )}
    </>
  );
}
