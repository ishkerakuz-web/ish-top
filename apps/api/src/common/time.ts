/**
 * O'zbekiston vaqti (Asia/Tashkent, UTC+5, yozgi vaqt yo'q). Server Railway'da UTC'da ishlaydi —
 * "bugun" va kunlik grafiklar foydalanuvchi kuniga mos bo'lishi uchun (audit ISSUE-052).
 */
export const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Toshkent bo'yicha joriy kalendar kuni boshlanishi (UTC `Date` sifatida). */
export function startOfTashkentDay(now: number = Date.now()): Date {
  return new Date(Math.floor((now + TASHKENT_OFFSET_MS) / DAY_MS) * DAY_MS - TASHKENT_OFFSET_MS);
}

/** `YYYY-MM-DD` — berilgan vaqtning Toshkentdagi kalendar kuni. */
export function tashkentDayKey(date: Date): string {
  return new Date(date.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}
