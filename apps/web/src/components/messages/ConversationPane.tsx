import React from "react";
import type { ConversationView, MessageView } from "../../lib/messages/adapter.js";
import type { ThreadState } from "../../lib/messages/useMessenger.js";
import { useDelayedFlag } from "../../lib/useDelayedFlag.js";
import { useT } from "../../lib/i18n/index.js";
import type { ConversationRating } from "../../lib/types.js";
import { ConversationHeader } from "./ConversationHeader.js";
import { ConversationVacancyContext } from "./ConversationVacancyContext.js";
import { MessageComposer } from "./MessageComposer.js";
import { MessageList } from "./MessageList.js";
import { ThreadErrorState, ThreadSkeleton } from "./MessagesStates.js";
import { displayName } from "./participant.js";

/** Markaziy ustun: sarlavha, vakansiya konteksti, xabarlar oqimi va yozish maydoni. */
export function ConversationPane({
  conversation,
  thread,
  rating,
  userId,
  connected,
  draft,
  headingRef,
  onBack,
  onRetryThread,
  onLoadOlder,
  onSend,
  onRetry,
  onDiscard,
  onDraft,
  onOpenDetails,
  onRate,
}: {
  conversation: ConversationView;
  thread: ThreadState | undefined;
  rating: ConversationRating | null;
  userId: string;
  connected: boolean;
  draft: string;
  headingRef: React.RefObject<HTMLHeadingElement>;
  onBack: () => void;
  onRetryThread: () => void;
  /** Eskiroq xabarlar (audit R3, D-078). */
  onLoadOlder: () => void;
  onSend: (text: string) => void;
  onRetry: (message: MessageView) => void;
  onDiscard: (message: MessageView) => void;
  onDraft: (value: string) => void;
  onOpenDetails: () => void;
  onRate: () => void;
}) {
  const m = useT().messagesPage;
  const name = displayName(conversation, m);
  // Birinchi ulanish odatda bir zumda — uzilish xabari faqat uzoqroq davom etsa chiqadi
  const offline = useDelayedFlag(!connected, 3000);
  const ready = thread?.status === "ready";
  const sending = thread?.items.some((message) => message.status === "pending") ?? false;

  let body: React.ReactNode;
  if (!thread || (thread.status === "loading" && thread.items.length === 0)) body = <ThreadSkeleton />;
  else if (thread.status === "error" && thread.items.length === 0) body = <ThreadErrorState onRetry={onRetryThread} />;
  else {
    body = (
      <MessageList
        key={conversation.id}
        conversation={conversation}
        name={name}
        thread={thread}
        userId={userId}
        onRetry={onRetry}
        onDiscard={onDiscard}
        onLoadOlder={onLoadOlder}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <ConversationHeader
        conversation={conversation}
        name={name}
        rating={rating}
        headingRef={headingRef}
        onBack={onBack}
        onOpenDetails={onOpenDetails}
        onRate={onRate}
      />
      {conversation.vacancy && <ConversationVacancyContext vacancy={conversation.vacancy} onOpenDetails={onOpenDetails} />}
      <div className="flex min-h-0 flex-1 flex-col">{body}</div>
      {offline && (
        <p role="status" className="border-t border-line bg-gold/10 px-4 py-2 text-[12.5px] text-gold-deep">
          {m.chat.offline}
        </p>
      )}
      <MessageComposer key={conversation.id} initial={draft} disabled={!ready} sending={sending} onDraft={onDraft} onSend={onSend} />
    </div>
  );
}
