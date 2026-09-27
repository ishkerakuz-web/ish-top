/**
 * Header qo'ng'irog'i (`useNotifications`) va `/notifications` sahifasi orasidagi
 * sinxronlash (bitta tab ichida):
 * - qo'ng'iroq WebSocket orqali yangi bildirishnoma olsa — sahifa ro'yxatiga qo'shiladi;
 * - sahifada o'qildi/o'chirildi bo'lsa — qo'ng'iroqdagi son yangilanadi.
 */
export const NOTIFICATION_RECEIVED = "ishbor:notification-received";
export const NOTIFICATIONS_CHANGED = "ishbor:notifications-changed";

export function emitNotificationReceived(notification: unknown): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(NOTIFICATION_RECEIVED, { detail: notification }));
}

export function emitNotificationsChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}
