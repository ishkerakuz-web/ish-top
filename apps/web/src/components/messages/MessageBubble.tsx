import React from "react";
import { splitMessageText, type ConversationView, type MessageView } from "../../lib/messages/adapter.js";
import { formatClock } from "../../lib/messages/format.js";
import { useLocale, useT } from "../../lib/i18n/index.js";
import { IconAlert, IconClock, IconTicks } from "./icons.js";
import { ParticipantAvatar } from "./participant.js";

/**
 * Xabar pufagi. Kiruvchi — och fon, chiqaruvchi — indigo. Belgilar faqat serverdagi
 * holatdan: bitta — yuborildi, ikkita — o'qildi; tasdiq kutilayotganda — soat,
 * yetib bormagan xabarda — "Yuborilmadi" + "Qayta yuborish".
 */
export function MessageBubble({
  message,
  mine,
  grouped,
  name,
  conversation,
  onRetry,
  onDiscard,
}: {
  message: MessageView;
  mine: boolean;
  grouped: boolean;
  name: string;
  conversation: ConversationView;
  onRetry: (message: MessageView) => void;
  onDiscard: (message: MessageView) => void;
}) {
  const m = useT().messagesPage;
  const { locale } = useLocale();
  const clock = message.createdAt ? formatClock(message.createdAt, locale) : null;
  const pending = message.status === "pending";
  const failed = message.status === "failed";

  return (
    <li data-status={message.status} data-mine={mine ? "true" : undefined} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-1" : "mt-3"}`}>
      {!mine &&
        (grouped ? (
          <span aria-hidden className="w-8 shrink-0" />
        ) : (
          <span aria-hidden className="shrink-0">
            <ParticipantAvatar conversation={conversation} name={name} size="xs" />
          </span>
        ))}
      <div className={`flex min-w-0 max-w-[85%] flex-col sm:max-w-[75%] lg:max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed ${
            mine
              ? `rounded-br-md bg-signal text-white shadow-xs ${pending ? "opacity-80" : ""} ${failed ? "ring-2 ring-danger/70 ring-offset-2 ring-offset-surface" : ""}`
              : "rounded-bl-md border border-line/60 bg-surface-2 text-ink"
          }`}
        >
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            <span className="sr-only">{mine ? m.chat.mine : name}: </span>
            {splitMessageText(message.body).map((part, index) =>
              part.kind === "link" ? (
                <a
                  key={index}
                  href={part.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  className={`underline underline-offset-2 ${mine ? "text-white decoration-white/60" : "text-signal"}`}
                >
                  {part.value}
                </a>
              ) : (
                <React.Fragment key={index}>{part.value}</React.Fragment>
              )
            )}
          </p>
          {(clock || mine) && (
            <p className={`mt-1 flex items-center justify-end gap-1 text-[11px] leading-none ${mine ? "text-white/80" : "text-dusk"}`}>
              {clock && message.createdAt && <time dateTime={message.createdAt}>{clock}</time>}
              {mine && message.status === "sent" && (
                <>
                  <IconTicks read={message.isRead} size={15} />
                  <span className="sr-only">{message.isRead ? m.chat.read : m.chat.sent}</span>
                </>
              )}
              {pending && (
                <>
                  <IconClock size={12} />
                  <span className="sr-only">{m.chat.sending}</span>
                </>
              )}
            </p>
          )}
        </div>
        {failed && (
          <p role="alert" className="mt-1.5 flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[12px]">
            <span className="inline-flex items-center gap-1 font-semibold text-danger">
              <IconAlert size={13} />
              {m.chat.failed}
            </span>
            <button
              type="button"
              onClick={() => onRetry(message)}
              className="rounded-md px-1 font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              {m.chat.resend}
            </button>
            <button
              type="button"
              onClick={() => onDiscard(message)}
              className="rounded-md px-1 text-dusk hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              {m.chat.discard}
            </button>
          </p>
        )}
      </div>
    </li>
  );
}
