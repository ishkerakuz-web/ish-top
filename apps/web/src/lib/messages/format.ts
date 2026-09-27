import { formatDate } from "../format.js";
import type { Messages } from "../i18n/messages.js";

type Labels = Messages["messagesPage"]["time"];

const TIME_TAG: Record<string, string> = { uz: "uz-Latn-UZ", ru: "ru-RU", en: "en-GB" };

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Mahalliy kalendar kunlari farqi (0 — bugun, 1 — kecha). */
export function daysBetween(iso: string, now = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
}

/** Kun ajratgichi kaliti (mahalliy sana). */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** "19:39" — foydalanuvchining mahalliy vaqtida. */
export function formatClock(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(TIME_TAG[locale] ?? locale, { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Ro'yxatdagi vaqt: bugun — soat, kecha, hafta ichida — "3 kun oldin", undan eski — sana. */
export function formatListTime(iso: string, locale: string, labels: Labels): string {
  const days = daysBetween(iso);
  if (days <= 0) return formatClock(iso, locale);
  if (days === 1) return labels.yesterday;
  if (days < 7) return labels.daysAgo(days);
  return formatDate(iso, locale);
}

/** Kun ajratgichi: "Bugun", "Kecha" yoki "12 dekabr, 2026". */
export function formatDayLabel(iso: string, labels: Labels): string {
  const days = daysBetween(iso);
  if (days === 0) return labels.today;
  if (days === 1) return labels.yesterday;
  const d = new Date(iso);
  return labels.day(d.getDate(), d.getMonth(), d.getFullYear());
}
