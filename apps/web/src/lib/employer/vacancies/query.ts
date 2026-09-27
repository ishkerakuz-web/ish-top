import { parsePage, parsePageSize, type PageSize } from "../../list.js";
import { VACANCY_STATUSES, type EmployerVacancyStatus } from "./adapter.js";

/**
 * `/employer/vacancies` holati URL'da — refresh va orqaga/oldinga saqlanadi:
 * `?q=react&status=active&region=tashkent&category=it&sort=oldest&page=2&size=20`.
 * Standart qiymatlar yozilmaydi.
 */
export const EMPLOYER_VACANCY_SORTS = ["newest", "oldest", "applications", "title"] as const;
export type EmployerVacancySort = (typeof EMPLOYER_VACANCY_SORTS)[number];
export const EMPLOYER_VACANCY_SEARCH_MAX = 100;

export interface EmployerVacancyQuery {
  q: string;
  status: EmployerVacancyStatus | null;
  region: string;
  category: string;
  sort: EmployerVacancySort;
  page: number;
  size: PageSize;
}

type Source = URLSearchParams | Record<string, string | undefined>;
const read = (source: Source, key: string) => (source instanceof URLSearchParams ? source.get(key) : source[key]) ?? "";

export function parseEmployerVacancyQuery(source: Source): EmployerVacancyQuery {
  const status = read(source, "status");
  const sort = read(source, "sort");
  return {
    q: read(source, "q").replace(/\s+/g, " ").trim().slice(0, EMPLOYER_VACANCY_SEARCH_MAX),
    status: (VACANCY_STATUSES as readonly string[]).includes(status) ? (status as EmployerVacancyStatus) : null,
    region: read(source, "region").slice(0, 120),
    category: read(source, "category").slice(0, 120),
    sort: (EMPLOYER_VACANCY_SORTS as readonly string[]).includes(sort) ? (sort as EmployerVacancySort) : "newest",
    page: parsePage(read(source, "page") || undefined),
    size: parsePageSize(read(source, "size") || undefined),
  };
}

export function employerVacancySearch(query: EmployerVacancyQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.region) params.set("region", query.region);
  if (query.category) params.set("category", query.category);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.size !== parsePageSize(undefined)) params.set("size", String(query.size));
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function hasEmployerVacancyFilters(query: EmployerVacancyQuery): boolean {
  return query.q !== "" || query.status !== null || query.region !== "" || query.category !== "";
}
