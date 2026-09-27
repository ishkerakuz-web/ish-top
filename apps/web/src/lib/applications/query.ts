import type { ApplicationStatus, MyApplication } from "../types.js";
import { PAGE_SIZE, parsePage, parsePageSize, searchWords, normalizeSearch, time, type PageSize } from "../list.js";

export { PAGE_SIZE, PAGE_SIZES, paginate, type PageSize, type PageSlice } from "../list.js";

/**
 * `/applications` holati URL'da: `?status=viewed&q=frontend&date=30d&sort=oldest&page=2&size=5&id=…`.
 * `GET /api/applications` nomzodning barcha arizalarini bitta ro'yxatda
 * qaytaradi (paginatsiya/saralash yo'q) — shuning uchun qidiruv, filtr,
 * saralash va sahifalash shu ro'yxat ustida bajariladi; backend o'zgartirilmaydi.
 */

/** Ariza bosqichlari tartibi (tablar, taqsimot). Qiymatlar — backend enum'i. */
export const STATUS_ORDER: ApplicationStatus[] = ["sent", "viewed", "invited", "accepted", "rejected"];

/** "Holat bo'yicha" saralash: e'tibor talab qiladiganlar yuqorida. */
const STATUS_PRIORITY: Record<ApplicationStatus, number> = { invited: 0, accepted: 1, viewed: 2, sent: 3, rejected: 4 };

/** Tashqi havolalardagi umumiy nomlar -> backend enum'i (yangi holat yaratilmaydi). */
const STATUS_ALIASES: Record<string, ApplicationStatus> = {
  pending: "sent",
  submitted: "sent",
  reviewing: "viewed",
  review: "viewed",
  interview: "invited",
  hired: "accepted",
};

export const DATE_RANGES = ["all", "7d", "30d", "90d"] as const;
export type DateRange = (typeof DATE_RANGES)[number];
const RANGE_DAYS: Record<Exclude<DateRange, "all">, number> = { "7d": 7, "30d": 30, "90d": 90 };

export const SORTS = ["newest", "oldest", "status"] as const;
export type SortKey = (typeof SORTS)[number];

const MAX_QUERY = 100;

export interface ApplicationsQuery {
  status: ApplicationStatus | "all";
  q: string;
  date: DateRange;
  sort: SortKey;
  page: number;
  size: PageSize;
  /** Ochiq ariza tafsiloti. */
  id: string | null;
}

export const DEFAULT_QUERY: ApplicationsQuery = {
  status: "all",
  q: "",
  date: "all",
  sort: "newest",
  page: 1,
  size: PAGE_SIZE,
  id: null,
};

type SearchSource = URLSearchParams | Record<string, string | undefined>;

function read(source: SearchSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  return source[key];
}

export function parseStatus(value: string | undefined): ApplicationStatus | "all" {
  const v = value?.trim().toLowerCase();
  if (!v) return "all";
  if ((STATUS_ORDER as string[]).includes(v)) return v as ApplicationStatus;
  return STATUS_ALIASES[v] ?? "all";
}

export function parseApplicationsQuery(source: SearchSource): ApplicationsQuery {
  const date = read(source, "date");
  const sort = read(source, "sort");
  const id = read(source, "id")?.trim();
  return {
    status: parseStatus(read(source, "status")),
    q: (read(source, "q") ?? "").trim().slice(0, MAX_QUERY),
    date: (DATE_RANGES as readonly string[]).includes(date ?? "") ? (date as DateRange) : "all",
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as SortKey) : "newest",
    page: parsePage(read(source, "page")),
    size: parsePageSize(read(source, "size")),
    id: id && /^[\w-]{1,64}$/.test(id) ? id : null,
  };
}

/** Standart qiymatlar URL'ga yozilmaydi: `/applications` — toza manzil. */
export function applicationsSearch(query: ApplicationsQuery): string {
  const params = new URLSearchParams();
  if (query.status !== "all") params.set("status", query.status);
  if (query.q) params.set("q", query.q);
  if (query.date !== "all") params.set("date", query.date);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.size !== PAGE_SIZE) params.set("size", String(query.size));
  if (query.id) params.set("id", query.id);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function hasActiveFilters(query: ApplicationsQuery): boolean {
  return query.status !== "all" || query.q !== "" || query.date !== "all";
}

export function emptyCounts(): Record<ApplicationStatus, number> {
  return { sent: 0, viewed: 0, invited: 0, accepted: 0, rejected: 0 };
}

export function countByStatus(items: MyApplication[]): Record<ApplicationStatus, number> {
  const counts = emptyCounts();
  for (const item of items) counts[item.status] += 1;
  return counts;
}

/** Qidiruv + sana (holatdan tashqari) — tab sonlari shu to'plamdan hisoblanadi. */
export function matchSearchAndDate(items: MyApplication[], query: ApplicationsQuery, now = Date.now()): MyApplication[] {
  const words = searchWords(query.q);
  const since = query.date === "all" ? null : now - RANGE_DAYS[query.date] * 86_400_000;
  return items.filter((item) => {
    if (since !== null && new Date(item.createdAt).getTime() < since) return false;
    if (words.length === 0) return true;
    const haystack = normalizeSearch(`${item.vacancy.title} ${item.company.name}`);
    return words.every((word) => haystack.includes(word));
  });
}

export function sortApplications(items: MyApplication[], sort: SortKey): MyApplication[] {
  const list = [...items];
  if (sort === "oldest") return list.sort((a, b) => time(a.createdAt) - time(b.createdAt));
  if (sort === "status") {
    return list.sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || time(b.createdAt) - time(a.createdAt));
  }
  return list.sort((a, b) => time(b.createdAt) - time(a.createdAt));
}

export interface TimelineStep {
  status: ApplicationStatus;
  /** `null` — joriy holat ma'lum, lekin o'zgarish vaqti tarixda yozilmagan. */
  at: string | null;
}

/**
 * Faqat haqiqiy bosqichlar: yuborilgan vaqt (`createdAt`) + `ApplicationStatusHistory`
 * yozuvlari. Kelajak bosqichlar ("Natija") to'qib qo'yilmaydi. Tarixda joriy holat
 * yo'q bo'lsa (masalan tarix yozilishidan oldingi eski ariza) — sanasiz qo'shiladi.
 */
export function timelineOf(app: MyApplication): TimelineStep[] {
  const steps: TimelineStep[] = [{ status: "sent", at: app.createdAt }];
  for (const entry of app.history) {
    if (entry.status === "sent") continue;
    if (steps[steps.length - 1].status === entry.status) continue;
    steps.push({ status: entry.status, at: entry.at });
  }
  if (steps[steps.length - 1].status !== app.status) steps.push({ status: app.status, at: null });
  return steps;
}
