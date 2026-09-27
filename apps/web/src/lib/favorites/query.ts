import { PAGE_SIZE, normalizeSearch, parsePage, parsePageSize, searchWords, time, type PageSize } from "../list.js";
import type { EmploymentType } from "../types.js";
import type { SavedVacancy } from "./adapter.js";

/**
 * `/favorites` holati URL'da: `?type=remote&q=frontend&region=tashkent&sort=salary&page=2&size=5`.
 * `GET /api/favorites` foydalanuvchining barcha saqlangan vakansiyalarini bitta
 * ro'yxatda qaytaradi (sahifalash/saralash yo'q) — qidiruv, filtr, saralash va
 * sahifalash shu to'liq ro'yxat ustida (qisman ma'lumot ustida taxmin emas).
 */

/** Ish turi tablari tartibi — backend `EmploymentType` enum'i. */
export const TYPE_ORDER: EmploymentType[] = ["remote", "full_time", "part_time", "shift"];

const TYPE_ALIASES: Record<string, EmploymentType> = {
  fulltime: "full_time",
  "full-time": "full_time",
  parttime: "part_time",
  "part-time": "part_time",
};

/** Saralash — hammasi javobdagi haqiqiy maydonlardan (saqlangan sana, maosh, e'lon sanasi). */
export const SORTS = ["newest", "oldest", "salary", "published"] as const;
export type FavoritesSort = (typeof SORTS)[number];

const MAX_QUERY = 100;

export interface FavoritesQuery {
  type: EmploymentType | "all";
  q: string;
  /** Hudud slug'i yoki "all". */
  region: string;
  sort: FavoritesSort;
  page: number;
  size: PageSize;
}

export const DEFAULT_QUERY: FavoritesQuery = { type: "all", q: "", region: "all", sort: "newest", page: 1, size: PAGE_SIZE };

type SearchSource = URLSearchParams | Record<string, string | undefined>;

function read(source: SearchSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  return source[key];
}

export function parseType(value: string | undefined): EmploymentType | "all" {
  const v = value?.trim().toLowerCase();
  if (!v) return "all";
  if ((TYPE_ORDER as string[]).includes(v)) return v as EmploymentType;
  return TYPE_ALIASES[v] ?? "all";
}

export function parseFavoritesQuery(source: SearchSource): FavoritesQuery {
  const sort = read(source, "sort");
  const region = read(source, "region")?.trim().toLowerCase();
  return {
    type: parseType(read(source, "type")),
    q: (read(source, "q") ?? "").trim().slice(0, MAX_QUERY),
    region: region && /^[a-z0-9-]{1,60}$/.test(region) ? region : "all",
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as FavoritesSort) : "newest",
    page: parsePage(read(source, "page")),
    size: parsePageSize(read(source, "size")),
  };
}

/** Standart qiymatlar URL'ga yozilmaydi: `/favorites` — toza manzil. */
export function favoritesSearch(query: FavoritesQuery): string {
  const params = new URLSearchParams();
  if (query.type !== "all") params.set("type", query.type);
  if (query.q) params.set("q", query.q);
  if (query.region !== "all") params.set("region", query.region);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.size !== PAGE_SIZE) params.set("size", String(query.size));
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function emptyTypeCounts(): Record<EmploymentType, number> {
  return { remote: 0, full_time: 0, part_time: 0, shift: 0 };
}

export function countByType(items: SavedVacancy[]): Record<EmploymentType, number> {
  const counts = emptyTypeCounts();
  for (const item of items) if (item.employmentType) counts[item.employmentType] += 1;
  return counts;
}

export interface RegionOption {
  slug: string;
  name: string;
  count: number;
}

/** Joylashuv tanlovi — faqat saqlanganlar orasida uchraydigan hududlar (ko'pi oldinda). */
export function regionOptions(items: SavedVacancy[]): RegionOption[] {
  const map = new Map<string, RegionOption>();
  for (const item of items) {
    const slug = item.region?.slug;
    if (!slug) continue;
    const existing = map.get(slug);
    if (existing) existing.count += 1;
    else map.set(slug, { slug, name: item.region!.name, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Qidiruv + hudud (ish turidan tashqari) — tab sonlari shu to'plamdan hisoblanadi. */
export function matchSearchAndRegion(items: SavedVacancy[], query: Pick<FavoritesQuery, "q" | "region">): SavedVacancy[] {
  const words = searchWords(query.q);
  return items.filter((item) => {
    if (query.region !== "all" && item.region?.slug !== query.region) return false;
    if (words.length === 0) return true;
    const haystack = normalizeSearch([item.title, item.company.name, item.categoryName, item.region?.name].filter(Boolean).join(" "));
    return words.every((word) => haystack.includes(word));
  });
}

function salaryValue(item: SavedVacancy): number | null {
  return item.salary ? item.salary.max ?? item.salary.min : null;
}

/** `null` qiymatlar (maoshi/sanasi yo'q) har doim oxirida; teng bo'lsa — yangi saqlangan oldin. */
function byNullableDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

export function sortFavorites(items: SavedVacancy[], sort: FavoritesSort): SavedVacancy[] {
  const saved = (item: SavedVacancy) => (item.savedAt ? time(item.savedAt) : null);
  const list = [...items];
  if (sort === "oldest") {
    return list.sort((a, b) => {
      const x = saved(a);
      const y = saved(b);
      if (x === null || y === null) return byNullableDesc(x, y);
      return x - y;
    });
  }
  if (sort === "salary") return list.sort((a, b) => byNullableDesc(salaryValue(a), salaryValue(b)) || byNullableDesc(saved(a), saved(b)));
  if (sort === "published") {
    return list.sort((a, b) => byNullableDesc(a.publishedAt ? time(a.publishedAt) : null, b.publishedAt ? time(b.publishedAt) : null) || byNullableDesc(saved(a), saved(b)));
  }
  return list.sort((a, b) => byNullableDesc(saved(a), saved(b)));
}
