/**
 * /companies sahifasining holati — yagona manba URL.
 *
 * Qidiruv, tezkor filtrlar, yon panel va saralash hammasi shu obyektni
 * o'zgartiradi; u `?q=...&industry=it,finance&region=tashkent` ko'rinishida
 * URL'ga yoziladi. Shuning uchun refresh, orqaga/oldinga va havolani ulashish
 * qo'shimcha kodsiz ishlaydi. Kalit nomlari API bilan bir xil
 * (apps/api/src/modules/companies/companies.list.ts).
 */

export const INDUSTRY_SLUGS = [
  "it",
  "finance",
  "education",
  "trade",
  "marketing",
  "government",
  "manufacturing",
  "construction",
  "tourism",
  "logistics",
] as const;
export type IndustrySlug = (typeof INDUSTRY_SLUGS)[number];

/** Qidiruv ostidagi tezkor tugmalarda doim ko'rinadiganlari; qolgani "Boshqalar" ichida. */
export const QUICK_INDUSTRIES: IndustrySlug[] = ["it", "finance", "education", "trade", "marketing", "government", "manufacturing"];

/** Ish beruvchi formasidagi xodimlar oraliqlari bilan bir xil (EmployerCompanyForm). */
export const SIZE_OPTIONS = [
  { slug: "1-10", label: "1–10" },
  { slug: "11-50", label: "11–50" },
  { slug: "51-100", label: "51–100" },
  { slug: "101-500", label: "101–500" },
  { slug: "500-plus", label: "500+" },
] as const;
export type SizeSlug = (typeof SIZE_OPTIONS)[number]["slug"];

export const RATING_OPTIONS = [4.5, 4, 3.5, 3] as const;
export const WORK_TYPES = ["office", "remote"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const COMPANY_SORTS = ["popular", "rating", "vacancies", "newest"] as const;
export type CompanySort = (typeof COMPANY_SORTS)[number];

export const PAGE_SIZE = 18;

export interface CompanyQuery {
  q: string;
  industry: IndustrySlug[];
  region: string;
  size: SizeSlug[];
  rating: number | null;
  work: WorkType[];
  verified: boolean;
  hiring: boolean;
  saved: boolean;
  sort: CompanySort;
}

export const EMPTY_QUERY: CompanyQuery = {
  q: "",
  industry: [],
  region: "",
  size: [],
  rating: null,
  work: [],
  verified: false,
  hiring: false,
  saved: false,
  sort: "popular",
};

function csv<T extends string>(value: string | undefined, allowed: readonly T[]): T[] {
  if (!value) return [];
  const picked = new Set(value.split(",").map((s) => s.trim()));
  // Ruxsat etilganlar tartibida — URL'da tartib boshqacha bo'lsa ham kalit bir xil chiqadi
  return allowed.filter((item) => picked.has(item));
}

const isFlag = (value: string | undefined) => value === "1" || value === "true";

/** URL search obyektidan holat. Noma'lum/buzilgan qiymatlar jimgina tashlanadi. */
export function parseCompanyQuery(search: Record<string, string | undefined>): CompanyQuery {
  const rating = Number(search.rating);
  return {
    q: (search.q ?? "").trim().slice(0, 100),
    industry: csv(search.industry, INDUSTRY_SLUGS),
    region: /^[a-z0-9-]{2,60}$/.test(search.region ?? "") ? (search.region as string) : "",
    size: csv(search.size, SIZE_OPTIONS.map((o) => o.slug)),
    rating: (RATING_OPTIONS as readonly number[]).includes(rating) ? rating : null,
    work: csv(search.work, WORK_TYPES),
    verified: isFlag(search.verified),
    hiring: isFlag(search.hiring),
    saved: isFlag(search.saved),
    sort: (COMPANY_SORTS as readonly string[]).includes(search.sort ?? "") ? (search.sort as CompanySort) : "popular",
  };
}

/** Holat -> URL parametrlari. Standart qiymatlar yozilmaydi — URL qisqa va barqaror. */
export function toSearchParams(query: CompanyQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.industry.length) params.set("industry", query.industry.join(","));
  if (query.region) params.set("region", query.region);
  if (query.size.length) params.set("size", query.size.join(","));
  if (query.rating !== null) params.set("rating", String(query.rating));
  if (query.work.length) params.set("work", query.work.join(","));
  if (query.verified) params.set("verified", "1");
  if (query.hiring) params.set("hiring", "1");
  if (query.saved) params.set("saved", "1");
  if (query.sort !== "popular") params.set("sort", query.sort);
  return params;
}

/** Natijalar ro'yxatining kaliti: kalit o'zgarsa ro'yxat va cursor boshidan boshlanadi. */
export function queryKey(query: CompanyQuery): string {
  return toSearchParams(query).toString();
}

/** Yon panel filtrlari soni (qidiruv matni va saralash hisobga olinmaydi). */
export function countFilters(query: CompanyQuery): number {
  return (
    query.industry.length +
    (query.region ? 1 : 0) +
    query.size.length +
    (query.rating !== null ? 1 : 0) +
    query.work.length +
    (query.verified ? 1 : 0) +
    (query.hiring ? 1 : 0) +
    (query.saved ? 1 : 0)
  );
}

/** Filtrlarni tozalash — saralash saqlanadi (bu filtr emas, foydalanuvchi tanlovi). */
export function clearFilters(query: CompanyQuery, keepSearch = false): CompanyQuery {
  return { ...EMPTY_QUERY, sort: query.sort, q: keepSearch ? query.q : "" };
}

export function toggleIn<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
