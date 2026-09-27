import React, { useEffect } from "react";
import { useAuth } from "../../components/AuthContext.js";
import { MessagesLoadingView, MessagesView } from "../../components/messages/MessagesView.js";
import { useHref } from "../../lib/i18n/index.js";
import { useMessagesQuery } from "../../lib/messages/useMessagesQuery.js";
import { useMessenger } from "../../lib/messages/useMessenger.js";

/**
 * Xabarlar (nomzod va ish beruvchi uchun umumiy). Mehmon — login sahifasiga (mavjud qoida).
 * Ma'lumot mavjud chat endpointlari va `/ws/chat` WebSocket'idan: backend faqat token
 * egasi ishtirok etgan suhbatlarni qaytaradi, begona suhbat tarixi — 403.
 */
export default function Page() {
  const { status, user, accessToken } = useAuth();
  const l = useHref();

  useEffect(() => {
    if (status === "guest") window.location.assign(l("/login"));
  }, [status, l]);

  if (status !== "authed" || !user || !accessToken) return <MessagesLoadingView role={user?.role ?? null} />;
  return <AuthedMessages token={accessToken} userId={user.id} role={user.role} />;
}

function AuthedMessages({ token, userId, role }: { token: string; userId: string; role: string }) {
  const { query, update } = useMessagesQuery();
  const messenger = useMessenger(token, userId, query.conversation);
  return <MessagesView messenger={messenger} query={query} update={update} role={role} userId={userId} />;
}
