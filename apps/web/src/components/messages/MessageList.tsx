import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ConversationView, MessageView } from "../../lib/messages/adapter.js";
import { dayKey, formatDayLabel } from "../../lib/messages/format.js";
import type { ThreadState } from "../../lib/messages/useMessenger.js";
import { useT } from "../../lib/i18n/index.js";
import { MessageBubble } from "./MessageBubble.js";
import { MESSAGES_PAGE } from "../../lib/messages/api.js";
import { OlderMessages } from "./MessagesStates.js";
import { IconChats } from "./icons.js";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
/** Shu vaqt ichidagi ketma-ket xabarlar bitta guruh (avatar bir marta). */
const GROUP_GAP_MS = 5 * 60_000;

/** Kun ajratgichi — sana bo'lmagan xabarlarda chizilmaydi. */
function MessageDayDivider({ label }: { label: string }) {
  return (
    <li className="my-3 flex justify-center first:mt-0">
      <span className="rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-medium text-dusk">{label}</span>
    </li>
  );
}

/**
 * Xabarlar oqimi. Ochilganda — pastga (o'qilmaganlar bo'lsa "Yangi xabarlar"ga),
 * yangi xabar kelsa — foydalanuvchi pastda turgan bo'lsa yoki o'zi yozgan bo'lsa pastga.
 * `role="log"` faqat birinchi chizilishdan keyin jonli (butun tarix o'qib berilmasin).
 *
 * audit R3, D-078: yuqorida "Eskiroq xabarlar" — eski xabarlar qo'shilganda ekrandagi
 * joy saqlanadi (ro'yxat sakramaydi).
 */
export function MessageList({
  conversation,
  name,
  thread,
  userId,
  onRetry,
  onDiscard,
  onLoadOlder,
}: {
  conversation: ConversationView;
  name: string;
  thread: ThreadState;
  userId: string;
  onRetry: (message: MessageView) => void;
  onDiscard: (message: MessageView) => void;
  onLoadOlder: () => void;
}) {
  const m = useT().messagesPage;
  const scrollRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLLIElement>(null);
  const initial = useRef(true);
  /** "Eskiroq xabarlar" bosilgandagi holat — yangi xabarlar qo'shilgach o'sha joy tiklanadi. */
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const [live, setLive] = useState(false);
  const items = thread.items;
  const last = items[items.length - 1];

  const loadOlder = () => {
    const el = scrollRef.current;
    if (el) anchor.current = { height: el.scrollHeight, top: el.scrollTop };
    onLoadOlder();
  };

  useIsoLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || items.length === 0) return;
    if (initial.current) {
      initial.current = false;
      el.scrollTop = newRef.current ? Math.max(0, newRef.current.offsetTop - 12) : el.scrollHeight;
      return;
    }
    // Eskiroq xabarlar tepaga qo'shildi: ko'rinib turgan xabar joyida qoladi
    const pending = anchor.current;
    if (pending && el.scrollHeight !== pending.height) {
      anchor.current = null;
      el.scrollTop = el.scrollHeight - pending.height + pending.top;
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 180;
    if (nearBottom || last?.senderId === userId) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [items.length, last?.id, last?.status]);

  // audit R3, D-078: yuklash tugadi-yu yangi xabar kelmadi (xato yoki hammasi takror) —
  // eski joy belgisi qolib ketmasin, aks holda keyingi xabar kelganda ro'yxat sakrardi
  useEffect(() => {
    if (thread.older !== "loading") anchor.current = null;
  }, [thread.older]);

  // Keshlangan suhbat qayta ochilib, o'qilmaganlar aniqlansa — ajratgichga
  useEffect(() => {
    const el = scrollRef.current;
    if (el && newRef.current) el.scrollTop = Math.max(0, newRef.current.offsetTop - 12);
  }, [thread.newFromId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setLive(true), 800);
    return () => window.clearTimeout(timer);
  }, []);

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-soft text-signal">
          <IconChats size={24} />
        </span>
        <h3 className="mt-4 font-display text-[16px] font-bold text-ink">{m.chat.emptyTitle}</h3>
        <p className="mt-1 max-w-xs text-[14px] text-dusk">{m.chat.emptyText}</p>
      </div>
    );
  }

  const rows: React.ReactNode[] = [];
  let previousDay = "";
  let previous: MessageView | null = null;
  for (const message of items) {
    if (message.createdAt) {
      const day = dayKey(message.createdAt);
      if (day !== previousDay) {
        rows.push(<MessageDayDivider key={`day-${day}`} label={formatDayLabel(message.createdAt, m.time)} />);
        previousDay = day;
        previous = null;
      }
    }
    if (message.id === thread.newFromId) {
      rows.push(
        <li key="new-messages" ref={newRef} className="my-3 flex items-center gap-3 text-[12px] font-semibold text-signal">
          <span aria-hidden className="h-px flex-1 bg-signal/30" />
          {m.chat.newMessages}
          <span aria-hidden className="h-px flex-1 bg-signal/30" />
        </li>
      );
      previous = null;
    }
    const grouped =
      previous !== null &&
      previous.senderId === message.senderId &&
      (!previous.createdAt || !message.createdAt || new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < GROUP_GAP_MS);
    rows.push(
      <MessageBubble
        key={message.clientId ?? message.id}
        message={message}
        mine={message.senderId === userId}
        grouped={grouped}
        name={name}
        conversation={conversation}
        onRetry={onRetry}
        onDiscard={onDiscard}
      />
    );
    previous = message;
  }

  return (
    <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
      <OlderMessages
        hasMore={thread.hasMore}
        status={thread.older}
        showStart={!thread.hasMore && thread.status === "ready" && items.length >= MESSAGES_PAGE}
        onLoad={loadOlder}
      />
      <div role="log" aria-live={live ? "polite" : "off"} aria-label={m.chat.logLabel(name)}>
        <ul className="flex flex-col">{rows}</ul>
      </div>
    </div>
  );
}
