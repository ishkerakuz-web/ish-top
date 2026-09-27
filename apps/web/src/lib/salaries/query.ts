import type { ExperienceLevel, SavedSearchParams } from "../types.js";
import type { SalaryStatsParams } from "../apiExtra.js";

/**
 * /salaries sahifasining URL holati:
 *   ?role=frontend-developer | ?q=erkin matn
 *   &category=it &region=tashkent &experience=junior|middle|senior|lead
 *
 * Eski manzillar (sitemap, tashqi havolalar) ham o'qiladi:
 *   ?categorySlug=it&area=tashkent&experience=one_to_three
 */

/** API bilan bir xil ro'yxat (apps/api/src/modules/stats/salary.stats.ts). */
export const SALARY_ROLES = [
  "frontend-developer",
  "backend-developer",
  "ui-ux-designer",
  "marketer",
  "accountant",
  "sales-manager",
  "hr",
  "data-analyst",
] as const;
export type SalaryRole = (typeof SALARY_ROLES)[number];

export const EXPERIENCE_KEYS = ["junior", "middle", "senior", "lead"] as const;
export type ExperienceKey = (typeof EXPERIENCE_KEYS)[number];

/** Karyera bosqichi → vakansiyadagi talab (real enum oraliqlari). */
export const EXPERIENCE_LEVEL: Record<ExperienceKey, ExperienceLevel> = {
  junior: "none",
  middle: "one_to_three",
  senior: "three_to_six",
  lead: "six_plus",
};

export interface SalaryQuery {
  role: SalaryRole | "";
  q: string;
  category: string;
  region: string;
  experience: ExperienceKey | "";
}

export const EMPTY_SALARY_QUERY: SalaryQuery = { role: "", q: "", category: "", region: "", experience: "" };

const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function parseSalaryQuery(search: Record<string, string | undefined>): SalaryQuery {
  const role = (SALARY_ROLES as readonly string[]).includes(search.role ?? "") ? (search.role as SalaryRole) : "";
  const q = role ? "" : (search.q ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
  const category = search.category ?? search.categorySlug ?? "";
  const region = search.region ?? search.area ?? "";
  const rawExperience = search.experience ?? "";
  const experience = (EXPERIENCE_KEYS as readonly string[]).includes(rawExperience)
    ? (rawExperience as ExperienceKey)
    : (EXPERIENCE_KEYS.find((key) => EXPERIENCE_LEVEL[key] === rawExperience) ?? "");
  return {
    role,
    q,
    category: SLUG.test(category) ? category : "",
    region: SLUG.test(region) ? region : "",
    experience,
  };
}

/** Faqat berilgan qiymatlar, doimiy tartibda — kalit va ulashiladigan URL bir xil chiqadi. */
export function toSearchParams(query: SalaryQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.role) params.set("role", query.role);
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.region) params.set("region", query.region);
  if (query.experience) params.set("experience", query.experience);
  return params;
}

export function queryKey(query: SalaryQuery): string {
  return toSearchParams(query).toString();
}

export function hasFilters(query: SalaryQuery): boolean {
  return queryKey(query) !== "";
}

export function toApiParams(query: SalaryQuery): SalaryStatsParams {
  return {
    role: query.role || undefined,
    q: query.q || undefined,
    categorySlug: query.category || undefined,
    area: query.region || undefined,
    experience: query.experience ? EXPERIENCE_LEVEL[query.experience] : undefined,
  };
}

/**
 * Vakansiya qidiruvi faqat matn bilan ishlaydi (har so'z mos kelishi shart),
 * shuning uchun kasb nomi o'rniga eng aniq bitta kalit so'z yuboriladi.
 */
export const ROLE_SEARCH_TEXT: Record<SalaryRole, string> = {
  "frontend-developer": "frontend",
  "backend-developer": "backend",
  "ui-ux-designer": "dizayner",
  marketer: "marketolog",
  accountant: "buxgalter",
  "sales-manager": "sotuv",
  hr: "HR",
  "data-analyst": "analitik",
};

/** Joriy tanlov vakansiya qidiruvi / obuna parametrlariga (ixtiyoriy maosh oralig'i bilan). */
export function vacancySearchParams(query: SalaryQuery, range?: { from: number; to: number }): SavedSearchParams {
  const params: SavedSearchParams = {};
  const text = query.role ? ROLE_SEARCH_TEXT[query.role] : query.q;
  if (text) params.text = text;
  if (query.category) params.categorySlug = query.category;
  if (query.region) params.area = query.region;
  if (query.experience) params.experience = EXPERIENCE_LEVEL[query.experience];
  if (range && range.from > 0 && range.to >= range.from) {
    params.salary = range.from;
    params.salaryTo = range.to;
  }
  return params;
}

/** `/vacancies` havolasi — parametrlar lib/vacancies/query.ts dagi tartib va nomlarda. */
export function vacancySearchHref(query: SalaryQuery, range?: { from: number; to: number }): string {
  const qs = new URLSearchParams();
  const text = query.role ? ROLE_SEARCH_TEXT[query.role] : query.q;
  if (text) qs.set("q", text);
  if (query.region) qs.set("region", query.region);
  if (query.experience) qs.set("experience", query.experience);
  if (query.category) qs.set("category", query.category);
  if (range && range.from > 0 && range.to >= range.from) {
    qs.set("salaryFrom", String(range.from));
    qs.set("salaryTo", String(range.to));
  }
  const str = qs.toString();
  return str ? `/vacancies?${str}` : "/vacancies";
}
