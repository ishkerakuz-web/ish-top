import { API_URL, ApiError } from "../api.js";
import { mapConversationToViewModel, mapMessageToViewModel, type ConversationView, type MessageView } from "./adapter.js";

/**
 * Mavjud chat endpointlari (`GET /api/conversations`, `GET /api/conversations/:id/messages`).
 * `fetchConversations`/`fetchMessages` dan farqi: xato yoki uzilishda bo'sh ro'yxat emas,
 * xato uloqtiradi — aks holda API xatosi "Xabarlar yo'q" bo'lib ko'rinardi.
 * Backend faqat token egasi ishtirok etgan suhbatlarni beradi, begona suhbat tarixi — 403.
 *
 * audit R3, api-errors-12: 2xx javob JSON bo'lmasa yoki `items` massiv bo'lmasa — bo'sh ro'yxat
 * emas, `BAD_RESPONSE` xatosi (proksi yoki captive-portal HTML'i "suhbat yo'q" bo'lib ko'rinmasin).
 * audit R3, D-078: ro'yxat va tarix kursor bilan sahifalanadi.
 */

/** Bitta so'rovdagi suhbatlar soni (server chegarasi 1..50). */
export const CONVERSATIONS_PAGE = 30;
/** Bitta so'rovdagi xabarlar soni (server chegarasi 1..100). */
export const MESSAGES_PAGE = 50;

async function getJson(path: string, token: string): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ApiError(0, "Tarmoq xatosi");
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok)
    throw new ApiError(
      res.status,
      typeof json?.message === "string" ? json.message : "Kutilmagan xatolik",
      typeof json?.error === "string" ? json.error : undefined
    );
  if (!json || !Array.isArray(json.items)) throw new ApiError(res.status, "Kutilmagan javob", "BAD_RESPONSE");
  return json;
}

export interface ConversationPage {
  items: ConversationView[];
  /** Keyingi sahifa kursori yoki `null` (server kursorni bermasa ham `null` — tugma chizilmaydi). */
  nextCursor: string | null;
}

export async function fetchConversationList(token: string, options: { before?: string | null; limit?: number } = {}): Promise<ConversationPage> {
  const params = new URLSearchParams({ limit: String(options.limit ?? CONVERSATIONS_PAGE) });
  if (options.before) params.set("before", options.before);
  const json = await getJson(`/api/conversations?${params.toString()}`, token);
  const rows = json.items as unknown[];
  const items = rows.map(mapConversationToViewModel).filter((item): item is ConversationView => item !== null);
  const cursor = typeof json.nextCursor === "string" && json.nextCursor.trim() ? json.nextCursor : null;
  return { items, nextCursor: cursor };
}

export interface MessagePage {
  items: MessageView[];
  /**
   * Serverda eskiroq xabarlar bormi. Maydon umuman bo'lmasa (kursorsiz eski server) — `false`:
   * "eskiroq xabarlar" tugmasi chizilmaydi va takroriy xabarlar paydo bo'lmaydi.
   */
  hasMore: boolean;
}

/**
 * Suhbat tarixi (eng yangi sahifa yoki `before` dan eskiroqlari, xronologik tartibda).
 * Server shu so'rovda qarshi tomon xabarlarini o'qilgan deb belgilaydi — shuning uchun
 * yashirin tabdan chaqirilmaydi (audit R3, realtime-6, `useMessenger`).
 */
export async function fetchConversationMessages(
  token: string,
  conversationId: string,
  options: { before?: string | null; limit?: number } = {}
): Promise<MessagePage> {
  const params = new URLSearchParams({ limit: String(options.limit ?? MESSAGES_PAGE) });
  if (options.before) params.set("before", options.before);
  const json = await getJson(`/api/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`, token);
  const rows = json.items as unknown[];
  const items = rows.map(mapMessageToViewModel).filter((item): item is MessageView => item !== null);
  return { items, hasMore: json.hasMore === true };
}
