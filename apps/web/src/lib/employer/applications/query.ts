import { parsePage, parsePageSize, type PageSize } from "../../list.js";
import type { ApplicationStatus } from "../../types.js";

/**
 * `/employer/applications` holati URL'da — refresh, orqaga/oldinga va havola bilan saqlanadi:
 * `?status=sent&vacancy=<id>&region=tashkent&period=7d&q=react&sort=oldest&page=2&application=<id>`.
 * Standart qiymatlar yozilmaydi. `?vacancy=` — "Vakansiyalarim"dagi "Arizalarni ko'rish" havolasi.
 */
export const APPLICATION_SORTS = ["newest", "oldest"] as const;
export type ApplicationSort = (typeof APPLICATION_SORTS)[number];
export const APPLICATION_PERIODS = ["7d", "30d"] as const;
export type ApplicationPeriod = (typeof APPLICATION_PERIODS)[number];
export const APPLICATION_SEARCH_MAX = 100;

const STATUSES: readonly ApplicationStatus[] = ["sent", "viewed", "invited", "accepted", "rejected"];
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export interface EmployerApplicationQuery {
  q: string;
  status: ApplicationStatus | null;
  vacancy: string;
  region: string;
  period: ApplicationPeriod | "";
  sort: ApplicationSort;
  page: number;
  size: PageSize;
  /** Tanlangan ariza (nomzod emas — bir nomzodning bir nechta arizasi bo'lishi mumkin). */
  application: string;
}

type Source = URLSearchParams | Record<string, string | undefined>;
const read = (source: Source, key: string) => (source instanceof URLSearchParams ? source.get(key) : source[key]) ?? "";
const oneOf = <T extends string>(value: string, allowed: readonly T[]): T | null => ((allowed as readonly string[]).includes(value) ? (value as T) : null);

export function parseEmployerApplicationQuery(source: Source): EmployerApplicationQuery {
  const vacancy = read(source, "vacancy");
  const application = read(source, "application");
  return {
    q: read(source, "q").replace(/\s+/g, " ").trim().slice(0, APPLICATION_SEARCH_MAX),
    status: oneOf(read(source, "status"), STATUSES),
    vacancy: OBJECT_ID.test(vacancy) ? vacancy : "",
    region: read(source, "region").slice(0, 120),
    period: oneOf(read(source, "period"), APPLICATION_PERIODS) ?? "",
    sort: oneOf(read(source, "sort"), APPLICATION_SORTS) ?? "newest",
    page: parsePage(read(source, "page") || undefined),
    size: parsePageSize(read(source, "size") || undefined),
    application: OBJECT_ID.test(application) ? application : "",
  };
}

export function employerApplicationSearch(query: EmployerApplicationQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.vacancy) params.set("vacancy", query.vacancy);
  if (query.region) params.set("region", query.region);
  if (query.period) params.set("period", query.period);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.size !== parsePageSize(undefined)) params.set("size", String(query.size));
  if (query.application) params.set("application", query.application);
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** Ro'yxatni toraytiradigan har qanday tanlov (holat tabi ham). */
export function hasApplicationFilters(query: EmployerApplicationQuery): boolean {
  return Boolean(query.q || query.status || query.vacancy || query.region || query.period);
}

/** "Filtrlar" oynasidagi faol tanlovlar soni (tugmadagi belgi uchun). */
export function panelFilterCount(query: EmployerApplicationQuery): number {
  return [query.vacancy, query.region, query.period, query.sort !== "newest" ? query.sort : ""].filter(Boolean).length;
}
