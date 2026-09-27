import { PAGE_SIZE, parsePage, parsePageSize, type PageSize } from "../list.js";
import { CATEGORY_ORDER, type NotificationCategory, type NotificationView } from "./adapter.js";

/**
 * `/notifications` holati URL'da: `?tab=settings`, `?unread=true&type=application&page=2&size=5`.
 * `?tab=settings` — profil sozlamalaridagi "Boshqarish" havolasi bilan mos.
 * Backend oxirgi 100 tasini bitta ro'yxatda beradi — filtr va sahifalash shu ro'yxat ustida.
 */

export type NotificationsTab = "list" | "settings";

export interface NotificationsQuery {
  tab: NotificationsTab;
  unread: boolean;
  category: NotificationCategory | "all";
  page: number;
  size: PageSize;
}

export const DEFAULT_QUERY: NotificationsQuery = { tab: "list", unread: false, category: "all", page: 1, size: PAGE_SIZE };

type SearchSource = URLSearchParams | Record<string, string | undefined>;

function read(source: SearchSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  return source[key];
}

export function parseNotificationsQuery(source: SearchSource): NotificationsQuery {
  const type = read(source, "type")?.trim().toLowerCase();
  const unread = read(source, "unread")?.trim().toLowerCase();
  return {
    tab: read(source, "tab") === "settings" ? "settings" : "list",
    unread: unread === "true" || unread === "1",
    category: (CATEGORY_ORDER as string[]).includes(type ?? "") ? (type as NotificationCategory) : "all",
    page: parsePage(read(source, "page")),
    size: parsePageSize(read(source, "size")),
  };
}

/** Standart qiymatlar URL'ga yozilmaydi: `/notifications` — toza manzil. */
export function notificationsSearch(query: NotificationsQuery): string {
  const params = new URLSearchParams();
  if (query.tab === "settings") params.set("tab", "settings");
  if (query.unread) params.set("unread", "true");
  if (query.category !== "all") params.set("type", query.category);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.size !== PAGE_SIZE) params.set("size", String(query.size));
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function countByCategory(items: NotificationView[]): Record<NotificationCategory, number> {
  const counts: Record<NotificationCategory, number> = { application: 0, vacancy: 0, system: 0, applicant: 0, other: 0 };
  for (const item of items) counts[item.category] += 1;
  return counts;
}

export function filterNotifications(items: NotificationView[], query: Pick<NotificationsQuery, "unread" | "category">): NotificationView[] {
  return items.filter((item) => (!query.unread || !item.isRead) && (query.category === "all" || item.category === query.category));
}
