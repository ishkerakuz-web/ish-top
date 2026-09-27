import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MessageView } from "../../lib/messages/adapter.js";
import { CONVERSATIONS_PAGE } from "../../lib/messages/api.js";
import { filterConversations, type MessagesQuery } from "../../lib/messages/query.js";
import type { Messenger } from "../../lib/messages/useMessenger.js";
import { useT } from "../../lib/i18n/index.js";
import { ConversationDetails } from "./ConversationDetails.js";
import { ConversationList } from "./ConversationList.js";
import { ConversationPane } from "./ConversationPane.js";
import { DetailsDialog } from "./DetailsDialog.js";
import { MessagesHeader } from "./MessagesHeader.js";
import {
  ConversationEmptyState,
  ConversationNotFound,
  ThreadSkeleton,
  MESSENGER_COLUMNS,
  MESSENGER_HEIGHT,
  MOBILE_CHAT_HEIGHT,
  MessagesEmptyState,
  MessagesErrorState,
  MessengerSkeleton,
  PANEL,
} from "./MessagesStates.js";
import { RatingDialog } from "./RatingDialog.js";
import { displayName } from "./participant.js";

type QueryUpdate = (patch: Partial<MessagesQuery>, options?: { replace?: boolean }) => void;

const PAGE = "mx-auto max-w-7xl px-4 pb-8 pt-4 sm:px-6 sm:pt-6";
const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

/** Seans hali aniqlanmoqda (yoki mehmon login'ga yo'naltirilmoqda). */
export function MessagesLoadingView({ role }: { role: string | null }) {
  return (
    <div className={PAGE}>
      <MessagesHeader role={role} hideOnMobile={false} />
      <div className="mt-5">
        <MessengerSkeleton />
      </div>
    </div>
  );
}

/**
 * `/messages` — suhbatlar ro'yxati va chat.
 *
 * Ilgari kengroq ekranlarda uchinchi ustun (vakansiya/kompaniya paneli) doimiy turardi:
 * u chat kengligini yeb, o'zi ALOHIDA skroll qilinadigan ikkinchi maydon bo'lib qolardi —
 * bitta ekranda ikkita skroll chalkash edi. Endi ikki ustun: ro'yxat va IMKON QADAR KENG
 * chat, kontekst esa modalda (sarlavhadagi nom, "i" tugmasi yoki "Vakansiya haqida").
 * Telefonda: ro'yxat ↔ chat (ikki qadam). Tanlangan suhbat URL'da (`?c=`).
 */
export function MessagesView({
  messenger,
  query,
  update,
  role,
  userId,
}: {
  messenger: Messenger;
  query: MessagesQuery;
  update: QueryUpdate;
  role: string;
  userId: string;
}) {
  const m = useT().messagesPage;
  const { list } = messenger;
  const ready = list.status === "ready";
  const items = useMemo(() => (list.status === "ready" ? list.items : []), [list]);
  // Qidiruv ekrandagi nom bo'yicha — nomsiz suhbat ham rol yorlig'i bilan topiladi (audit PHASE 6, V1)
  const filtered = useMemo(
    () => filterConversations(items, { unread: query.unread, q: query.q }, (item) => displayName(item, m)),
    [items, query.unread, query.q, m]
  );
  // audit R3, D-078: ro'yxat davomi kursor bilan
  const hasMoreConversations = list.status === "ready" && list.nextCursor !== null;
  const conversationsMore = list.status === "ready" ? list.more : "idle";
  const active = query.conversation ? items.find((item) => item.id === query.conversation) ?? null : null;
  const thread = active ? messenger.threads[active.id] : undefined;
  const rating = active ? messenger.ratings[active.id] ?? null : null;
  const partner = active?.otherUserId ? messenger.partners[active.otherUserId] : undefined;

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const drafts = useRef(new Map<string, string>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const openedFromList = useRef(false);
  const lastConversation = useRef<string | null>(null);

  useEffect(() => {
    setDetailsOpen(false);
    setRatingOpen(false);
    if (query.conversation) {
      lastConversation.current = query.conversation;
      return;
    }
    openedFromList.current = false;
    // Telefonda chatdan ro'yxatga qaytildi — fokus o'sha suhbatga
    const id = lastConversation.current;
    if (!id || !isPhone()) return;
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-conversation="${CSS.escape(id)}"]`)?.focus();
    });
  }, [query.conversation]);

  useEffect(() => {
    if (!active || !focusHeading.current) return;
    focusHeading.current = false;
    headingRef.current?.focus({ preventScroll: true });
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = useCallback(
    (id: string) => {
      if (id === query.conversation) {
        headingRef.current?.focus({ preventScroll: true });
        return;
      }
      focusHeading.current = true;
      openedFromList.current = true;
      update({ conversation: id });
      if (isPhone()) window.scrollTo({ top: 0 });
    },
    [query.conversation, update]
  );

  const back = useCallback(() => {
    // Ro'yxatdan ochilgan bo'lsa — brauzer tarixidagi o'sha qadamga qaytamiz (orqaga tugmasi bilan bir xil)
    if (openedFromList.current) {
      openedFromList.current = false;
      window.history.back();
      return;
    }
    update({ conversation: null });
  }, [update]);

  const retry = useCallback((message: MessageView) => message.clientId && messenger.retry(message.conversationId, message.clientId), [messenger]);
  const discard = useCallback((message: MessageView) => message.clientId && messenger.discard(message.conversationId, message.clientId), [messenger]);
  const closeDetails = useCallback(() => setDetailsOpen(false), []);
  const closeRating = useCallback(() => setRatingOpen(false), []);

  const chatOpen = query.conversation !== null && ready;
  let body: React.ReactNode;
  if (list.status === "loading") body = <MessengerSkeleton />;
  else if (list.status === "error") body = <MessagesErrorState onRetry={() => void messenger.reloadList()} />;
  else if (items.length === 0) body = <MessagesEmptyState role={role} />;
  else {
    body = (
      <div className={`${MESSENGER_COLUMNS} ${MESSENGER_HEIGHT}`}>
        <section aria-labelledby="messages-list-title" className={`${chatOpen ? "hidden md:flex" : "flex"} ${PANEL}`}>
          <ConversationList
            items={items}
            filtered={filtered}
            query={query}
            activeId={query.conversation}
            hasMore={hasMoreConversations}
            moreStatus={conversationsMore}
            showEnd={!hasMoreConversations && items.length > CONVERSATIONS_PAGE}
            onLoadMore={() => void messenger.loadMoreConversations()}
            onQuery={update}
            onSelect={select}
          />
        </section>
        <section data-testid="chat-panel" className={`${chatOpen ? `flex ${MOBILE_CHAT_HEIGHT}` : "hidden md:flex"} ${PANEL}`}>
          {active ? (
            <ConversationPane
              conversation={active}
              thread={thread}
              rating={rating}
              userId={userId}
              connected={messenger.connected}
              draft={drafts.current.get(active.id) ?? ""}
              headingRef={headingRef}
              onBack={back}
              onRetryThread={() => void messenger.loadThread(active.id)}
              onLoadOlder={() => void messenger.loadOlder(active.id)}
              onSend={(text) => messenger.send(active.id, text)}
              onRetry={retry}
              onDiscard={discard}
              onDraft={(value) => drafts.current.set(active.id, value)}
              onOpenDetails={() => setDetailsOpen(true)}
              onRate={() => setRatingOpen(true)}
            />
          ) : query.conversation ? (
            // Suhbat ro'yxatning keyingi sahifalarida bo'lishi mumkin — qidiruv tugamaguncha
            // "topilmadi" deyilmaydi (audit R3, D-078)
            messenger.findingActive ? (
              <ThreadSkeleton />
            ) : (
              <ConversationNotFound onBack={back} />
            )
          ) : (
            <ConversationEmptyState />
          )}
        </section>
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <MessagesHeader role={role} hideOnMobile={chatOpen} />
      <div className={chatOpen ? "md:mt-5" : "mt-5"}>{body}</div>
      {active && (
        <DetailsDialog open={detailsOpen} onClose={closeDetails}>
          <ConversationDetails conversation={active} thread={thread} rating={rating} partner={partner} idPrefix="sheet" onLoadPartner={messenger.loadPartner} />
        </DetailsDialog>
      )}
      {active && (
        <RatingDialog
          open={ratingOpen}
          rating={rating}
          name={displayName(active, m)}
          onClose={closeRating}
          onSubmit={(score, comment) => messenger.rate(active.id, score, comment)}
        />
      )}
    </div>
  );
}
