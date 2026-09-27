import { API_URL, ApiError } from "../api.js";
import { isNotificationRow, type NotificationRow } from "./adapter.js";

/**
 * Bitta so'rovdagi bildirishnomalar soni (audit R3, D-078: server `limit` 1..50).
 * Davomi `nextCursor` bilan olinadi — eski bildirishnomalar endi yo'qolmaydi.
 */
export const NOTIFICATIONS_LIMIT = 50;

export interface NotificationCenterData {
  /**
   * Xom qatorlar: til almashtirilganda matn qayta chizilsin deb model emas, qator saqlanadi
   * (audit R3, D-059 — `mapNotificationRows` joriy lug'at bilan chaqiriladi).
   */
  rows: NotificationRow[];
  /** Serverdagi aniq o'qilmaganlar soni (ro'yxat chegarasidan qat'i nazar). */
  unreadCount: number;
  /**
   * Keyingi sahifa kursori (oxirgi elementning id'si) yoki `null` — davomi yo'q.
   * Server hali kursor qaytarmasa ham `null`: "yana yuklash" chizilmaydi (eski API bilan ham ishlaydi).
   */
  nextCursor: string | null;
  /**
   * Javobda `nextCursor` maydoni bormi. Yo'q bo'lsa (kursorsiz eski server) chegaraga
   * yetgan ro'yxat "kesilgan" deb belgilanadi — "hammasi shu" deb ko'rsatilmaydi.
   */
  cursorSupported: boolean;
}

/**
 * Markaz ro'yxati — mavjud `GET /api/notifications` (yangi endpoint yo'q).
 * `fetchNotifications` dan farqi: xato yoki uzilishda bo'sh ro'yxat emas, xato
 * uloqtiradi — aks holda API xatosi "Bildirishnomalar yo'q" bo'lib ko'rinardi.
 * O'qildi/o'chirish — mavjud `markNotificationRead` va boshqalar (apiExtra).
 *
 * audit R3, api-errors-12: 2xx javob JSON bo'lmasa yoki `items` massiv bo'lmasa —
 * bo'sh ro'yxat emas, `BAD_RESPONSE` xatosi (proksi HTML'i "hech narsa yo'q" bo'lib ko'rinmasin).
 * audit R3, D-078: `before` — kursor (oxirgi ko'rsatilgan bildirishnoma id'si).
 */
export async function fetchNotificationCenter(
  token: string,
  options: { before?: string | null; limit?: number } = {}
): Promise<NotificationCenterData> {
  const params = new URLSearchParams({ limit: String(options.limit ?? NOTIFICATIONS_LIMIT) });
  if (options.before) params.set("before", options.before);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/notifications?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ApiError(0, "Tarmoq xatosi");
  }
  const json = (await res.json().catch(() => null)) as
    | { items?: unknown; unreadCount?: unknown; nextCursor?: unknown; message?: string; error?: string }
    | null;
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Kutilmagan xatolik", json?.error);
  if (!json || !Array.isArray(json.items)) throw new ApiError(res.status, "Kutilmagan javob", "BAD_RESPONSE");
  const rows = json.items.filter(isNotificationRow);
  const count = typeof json.unreadCount === "number" && json.unreadCount >= 0 ? json.unreadCount : rows.filter((row) => row.isRead === false).length;
  const cursor = typeof json.nextCursor === "string" && json.nextCursor.trim() ? json.nextCursor : null;
  return { rows, unreadCount: count, nextCursor: cursor, cursorSupported: "nextCursor" in json };
}
