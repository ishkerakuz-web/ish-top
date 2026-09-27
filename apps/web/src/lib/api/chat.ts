import { API_URL, ApiError, absoluteUploadUrl, authGet, authHeaders, tryFetch } from "./core.js";
import { ChatMessage, Conversation, ConversationRating, UserSummary } from "../types.js";
/** Chat: suhbatlar va xabarlar. */

// ---------------------------------------------------------
// Chat
// ---------------------------------------------------------

export async function fetchConversations(token: string): Promise<Conversation[]> {
  return (await authGet<{ items: Conversation[] }>("/api/conversations", token, { items: [] })).items;
}

export async function fetchMessages(token: string, conversationId: string): Promise<ChatMessage[]> {
  return (
    await authGet<{ items: ChatMessage[] }>(`/api/conversations/${conversationId}/messages`, token, {
      items: [],
    })
  ).items;
}

/** Suhbat bo'yicha baho holati (berish mumkinmi, mening bahom, o'rtacha). */
export async function fetchConversationRating(
  token: string,
  conversationId: string
): Promise<ConversationRating | null> {
  const res = await tryFetch(`/api/conversations/${conversationId}/rating`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res || !res.ok) return null;
  return (await res.json()) as ConversationRating;
}

/** Suhbatdoshning qisqa profili (faqat suhbat mavjud bo'lsa server ruxsat beradi). */
export async function fetchUserSummary(token: string, userId: string): Promise<UserSummary | null> {
  const res = await tryFetch(`/api/users/${userId}/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res || !res.ok) return null;
  const json = (await res.json()) as UserSummary;
  if (json.company?.logoUrl) json.company.logoUrl = absoluteUploadUrl(json.company.logoUrl);
  return json;
}

/** Suhbatdoshga 1–5 yulduz baho yuboradi. */
export async function submitConversationRating(
  token: string,
  conversationId: string,
  score: number,
  comment?: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/conversations/${conversationId}/rating`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ score, ...(comment?.trim() ? { comment: comment.trim() } : {}) }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
}

/** Suhbat ochadi yoki mavjudini topadi. Ish beruvchi: candidateUserId; nomzod: companySlug. */
export async function startConversation(
  token: string,
  params: { candidateUserId?: string; companySlug?: string }
): Promise<string> {
  const res = await fetch(`${API_URL}/api/conversations/start`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(params),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
  return json.id as string;
}
