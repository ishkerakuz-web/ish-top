import type { EmploymentType, ExperienceLevel, SavedSearchParams } from "../types.js";

/**
 * `/vacancies` sahifasining URL holati (yagona manba):
 *
 *   ?q=frontend&region=tashkent,samarqand&workType=full-time,remote
 *   &experience=junior,middle&category=it&company=nextbrain
 *   &salaryFrom=8000000&salaryTo=20000000&verified=1&premium=1
 *   &sort=salary|newest|popular&size=20&page=2
 *
 * Standart qiymatlar yozilmaydi. Eski `/search/vacancy` nomlari ham o'qiladi
 * (`text`, `area`, `categorySlug`, `employment`, `salary`, enum qiymatlari) —
 * redirect va eski havolalar shu funksiya orqali yangi ko'rinishga o'tadi.
 */

export const WORK_TYPES = ["full-time", "part-time", "remote", "shift"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_API: Record<WorkType, EmploymentType> = {
  "full-time": "full_time",
  "part-time": "part_time",
  remote: "remote",
  shift: "shift",
};

export const EXPERIENCE_KEYS = ["junior", "middle", "senior", "lead"] as const;
export type ExperienceKey = (typeof EXPERIENCE_KEYS)[number];

export const EXPERIENCE_API: Record<ExperienceKey, ExperienceLevel> = {
  junior: "none",
  middle: "one_to_three",
  senior: "three_to_six",
  lead: "six_plus",
};

/** UI'dagi saralashlar. `salary-asc` — faqat eski havoladan kelsa. */
export const VACANCY_SORTS = ["relevant", "salary", "newest", "popular"] as const;
export type VacancySort = (typeof VACANCY_SORTS)[number] | "salary-asc";

const SORT_API: Record<VacancySort, string> = {
  relevant: "relevance",
  salary: "salary_desc",
  "salary-asc": "salary_asc",
  newest: "date",
  popular: "popular",
};

export const PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;

export interface VacancyQuery {
  q: string;
  region: string[];
  workType: WorkType[];
  experience: ExperienceKey[];
  category: string;
  company: string[];
  salaryFrom: number | null;
  salaryTo: number | null;
  verified: boolean;
  premium: boolean;
  sort: VacancySort;
  page: number;
  size: number;
}

export const EMPTY_VACANCY_QUERY: VacancyQuery = {
  q: "",
  region: [],
  workType: [],
  experience: [],
  category: "",
  company: [],
  salaryFrom: null,
  salaryTo: null,
  verified: false,
  premium: false,
  sort: "relevant",
  page: 1,
  size: DEFAULT_PAGE_SIZE,
};

const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

function list(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 30);
}

function positiveInt(value: string | undefined, max: number): number | null {
  if (!value) return null;
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 && n <= max ? n : null;
}

function invert<K extends string, V extends string>(map: Record<K, V>): Record<string, K> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])) as Record<string, K>;
}
const WORK_FROM_API = invert(WORK_TYPE_API);
const EXPERIENCE_FROM_API = invert(EXPERIENCE_API);
const SORT_FROM_API: Record<string, VacancySort> = { ...invert(SORT_API), relevance: "relevant" };

export function parseVacancyQuery(search: Record<string, string | undefined>): VacancyQuery {
  const workType = list(search.workType ?? search.employment)
    .map((v) => ((WORK_TYPES as readonly string[]).includes(v) ? (v as WorkType) : WORK_FROM_API[v]))
    .filter((v): v is WorkType => Boolean(v));
  const experience = list(search.experience)
    .map((v) => ((EXPERIENCE_KEYS as readonly string[]).includes(v) ? (v as ExperienceKey) : EXPERIENCE_FROM_API[v]))
    .filter((v): v is ExperienceKey => Boolean(v));
  const rawSort = search.sort ?? "";
  const sort: VacancySort = rawSort in SORT_API ? (rawSort as VacancySort) : (SORT_FROM_API[rawSort] ?? "relevant");
  const size = positiveInt(search.size ?? search.pageSize, 50);
  const category = search.category ?? search.categorySlug ?? "";
  let salaryFrom = positiveInt(search.salaryFrom ?? search.salary, 10_000_000_000);
  let salaryTo = positiveInt(search.salaryTo, 10_000_000_000);
  if (salaryFrom && salaryTo && salaryFrom > salaryTo) [salaryFrom, salaryTo] = [salaryTo, salaryFrom];

  return {
    q: (search.q ?? search.text ?? "").trim().replace(/\s+/g, " ").slice(0, 100),
    region: list(search.region ?? search.area).filter((s) => SLUG.test(s)),
    workType: [...new Set(workType)],
    experience: [...new Set(experience)],
    category: SLUG.test(category) ? category : "",
    company: list(search.company).filter((s) => SLUG.test(s)),
    salaryFrom,
    salaryTo,
    verified: search.verified === "1" || search.verified === "true",
    premium: search.premium === "1" || search.premium === "true",
    sort,
    page: positiveInt(search.page, 10_000) ?? 1,
    size: size && (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

/** Faqat standartdan farqli qiymatlar, doimiy tartibda — kalit va ulashiladigan URL bir xil chiqadi. */
export function toSearchParams(query: VacancyQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (query.region.length) p.set("region", query.region.join(","));
  if (query.workType.length) p.set("workType", query.workType.join(","));
  if (query.experience.length) p.set("experience", query.experience.join(","));
  if (query.category) p.set("category", query.category);
  if (query.company.length) p.set("company", query.company.join(","));
  if (query.salaryFrom) p.set("salaryFrom", String(query.salaryFrom));
  if (query.salaryTo) p.set("salaryTo", String(query.salaryTo));
  if (query.verified) p.set("verified", "1");
  if (query.premium) p.set("premium", "1");
  if (query.sort !== "relevant") p.set("sort", query.sort);
  if (query.size !== DEFAULT_PAGE_SIZE) p.set("size", String(query.size));
  if (query.page > 1) p.set("page", String(query.page));
  return p;
}

export function queryKey(query: VacancyQuery): string {
  return toSearchParams(query).toString();
}

/** Filtrlar (API nomlarida) — ro'yxat, facets va obuna uchun umumiy qism. */
function filterParams(query: VacancyQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (query.q) p.set("text", query.q);
  if (query.region.length) p.set("area", query.region.join(","));
  if (query.workType.length) p.set("employment", query.workType.map((w) => WORK_TYPE_API[w]).join(","));
  if (query.experience.length) p.set("experience", query.experience.map((e) => EXPERIENCE_API[e]).join(","));
  if (query.category) p.set("categorySlug", query.category);
  if (query.company.length) p.set("company", query.company.join(","));
  if (query.salaryFrom) p.set("salary", String(query.salaryFrom));
  if (query.salaryTo) p.set("salaryTo", String(query.salaryTo));
  if (query.verified) p.set("verified", "1");
  if (query.premium) p.set("premium", "1");
  return p;
}

/** `GET /api/vacancies` parametrlari. */
export function toApiParams(query: VacancyQuery): URLSearchParams {
  const p = filterParams(query);
  if (query.sort !== "relevant") p.set("sort", SORT_API[query.sort]);
  p.set("page", String(query.page));
  p.set("pageSize", String(query.size));
  return p;
}

/** `GET /api/vacancies/facets` parametrlari (sahifa va saralashsiz). */
export function toFacetParams(query: VacancyQuery): URLSearchParams {
  return filterParams(query);
}

/** Obuna ("Obuna bo'lish") uchun — mavjud saqlangan qidiruv formatida. */
export function toSavedSearchParams(query: VacancyQuery): SavedSearchParams {
  const p = Object.fromEntries(filterParams(query)) as Record<string, string>;
  return {
    text: p.text,
    area: p.area,
    employment: p.employment,
    experience: p.experience,
    categorySlug: p.categorySlug,
    company: p.company,
    salary: p.salary ? Number(p.salary) : undefined,
    salaryTo: p.salaryTo ? Number(p.salaryTo) : undefined,
    verified: query.verified || undefined,
    premium: query.premium || undefined,
  };
}

/** Yon panel filtrlari soni (qidiruv matni, saralash va sahifa hisobga olinmaydi). */
export function countFilters(query: VacancyQuery): number {
  return (
    query.region.length +
    query.workType.length +
    query.experience.length +
    query.company.length +
    (query.category ? 1 : 0) +
    (query.salaryFrom || query.salaryTo ? 1 : 0) +
    (query.verified ? 1 : 0) +
    (query.premium ? 1 : 0)
  );
}

/** Filtrlarni tozalaydi; qidiruv matni, saralash va sahifa hajmi saqlanadi. */
export function clearFilters(query: VacancyQuery, keepSearch = true): VacancyQuery {
  return { ...EMPTY_VACANCY_QUERY, q: keepSearch ? query.q : "", sort: query.sort, size: query.size };
}

export function toggleIn<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

/** Ichki havolalar uchun: `vacanciesHref({ q: "frontend", region: ["tashkent"] })`. */
export function vacanciesHref(patch: Partial<VacancyQuery> = {}): string {
  const qs = queryKey({ ...EMPTY_VACANCY_QUERY, ...patch });
  return qs ? `/vacancies?${qs}` : "/vacancies";
}
