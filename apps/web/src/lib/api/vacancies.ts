import { API_URL, ApiError, absoluteUploadUrl, ssrHeaders, withServerTimeout } from "./core.js";
import { Vacancy, VacancyFacets, VacancyPage } from "../types.js";
import { VacancyDetailVM, mapVacancyToViewModel } from "../vacancies/detail.js";
import { mapVacancy } from "./mappers.js";
/** Vakansiyalar: ro'yxat, filtr sonlari, tafsilot va o'xshashlar. */

// ---------------------------------------------------------
// Vakansiyalar
// ---------------------------------------------------------

export interface VacancyQuery {
  text?: string;
  categorySlug?: string;
  area?: string;
  experience?: string;
  employment?: string;
  salary?: string;
  salaryTo?: string;
  /** Saralash: mosligi (default), sana yoki maosh bo'yicha. */
  sort?: "relevance" | "date" | "salary_desc" | "salary_asc";
}

function buildQuery(params: VacancyQuery): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, String(value));
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

/**
 * `/vacancies` sahifasining bitta sahifasi. `params` — API nomlaridagi
 * parametrlar (lib/vacancies/query.ts → toApiParams). "Natija yo'q" va
 * "yuklab bo'lmadi" farqlanadi: xatoda `ApiError` (tarmoq uzilsa status 0),
 * bekor qilinsa AbortError.
 */
export async function fetchVacancyPage(params: URLSearchParams, signal?: AbortSignal): Promise<VacancyPage> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/vacancies?${params}`, { signal: withServerTimeout(signal), headers: ssrHeaders() });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new ApiError(0, "Serverga ulanib bo'lmadi");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new ApiError(res.status, json?.message ?? "Kutilmagan xatolik", json?.error);
  const items: Vacancy[] = (json.items ?? []).map((v: any) => mapVacancy(v));
  return {
    items,
    total: json.total ?? items.length,
    page: json.page ?? 1,
    pageSize: json.pageSize ?? items.length,
    pageCount: json.pageCount ?? 1,
  };
}

/** Filtr paneli sonlari. Ikkinchi darajali ma'lumot — xatoda `null` (panel sonlarsiz ishlaydi). */
export async function fetchVacancyFacets(params: URLSearchParams, signal?: AbortSignal): Promise<VacancyFacets | null> {
  try {
    const res = await fetch(`${API_URL}/api/vacancies/facets?${params}`, { signal: withServerTimeout(signal), headers: ssrHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as VacancyFacets;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return null;
  }
}

/**
 * Detail sahifasi uchun vakansiya (view-model, lib/vacancies/detail.ts).
 * Topilmasa `null` (404); boshqa xatoda `ApiError` (tarmoq uzilsa status 0) —
 * sahifa "topilmadi" va "yuklab bo'lmadi" holatlarini farqlaydi.
 */
export async function fetchVacancyDetail(slug: string, signal?: AbortSignal): Promise<VacancyDetailVM | null> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/vacancies/${encodeURIComponent(slug)}`, { signal: withServerTimeout(signal), headers: ssrHeaders() });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new ApiError(0, "Serverga ulanib bo'lmadi");
  }
  if (res.status === 404) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new ApiError(res.status, json?.message ?? "Kutilmagan xatolik", json?.error);
  return mapVacancyToViewModel(json, absoluteUploadUrl);
}

/** "O'xshash vakansiyalar" — ikkinchi darajali blok: xatoda bo'sh ro'yxat (blok yashiriladi). */
export async function fetchSimilarVacancies(slug: string, limit = 4, signal?: AbortSignal): Promise<Vacancy[]> {
  try {
    const res = await fetch(`${API_URL}/api/vacancies/${encodeURIComponent(slug)}/similar?limit=${limit}`, { signal: withServerTimeout(signal), headers: ssrHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.items ?? []).map((v: any) => mapVacancy(v));
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return [];
  }
}
