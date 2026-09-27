/**
 * Klient tomonida filtrlanadigan va sahifalanadigan ro'yxatlar uchun umumiy
 * yordamchilar (arizalar, saqlangan vakansiyalar): backend butun ro'yxatni
 * bitta javobda qaytaradi, qidiruv/saralash/sahifalash shu ro'yxat ustida.
 */

/** "Sahifadagi" tanlovi. */
export const PAGE_SIZES = [5, 10, 20] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const PAGE_SIZE: PageSize = 10;

export function parsePageSize(value: string | undefined): PageSize {
  const size = Number.parseInt(value ?? "", 10);
  return (PAGE_SIZES as readonly number[]).includes(size) ? (size as PageSize) : PAGE_SIZE;
}

export function parsePage(value: string | undefined): number {
  const page = Number.parseInt(value ?? "", 10);
  return Number.isFinite(page) && page > 1 ? page : 1;
}

export interface PageSlice<T> {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  items: T[];
}

/** URL'dagi sahifa ro'yxatdan katta bo'lsa — oxirgi sahifa. */
export function paginate<T>(items: T[], page: number, size: number = PAGE_SIZE): PageSlice<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * size;
  const slice = items.slice(start, start + size);
  return { page: current, pageCount, from: slice.length ? start + 1 : 0, to: start + slice.length, items: slice };
}

/** O'zbekcha apostrof variantlari (ʻ ’ ‘ `) va bo'shliqlar bir xil qidirilsin. */
export function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase().replace(/[ʻʼ’‘`]/g, "'").replace(/\s+/g, " ").trim();
}

/** Qidiruv so'zlari — har biri matnda bo'lishi kerak. */
export function searchWords(q: string): string[] {
  return normalizeSearch(q).split(" ").filter(Boolean);
}

export function time(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}
