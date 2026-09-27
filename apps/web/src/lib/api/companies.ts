import {
  API_URL,
  ApiError,
  absoluteUploadUrl,
  authHeaders,
  ssrHeaders,
  throwApiError,
  tryFetch,
  withServerTimeout,
} from "./core.js";
import { Company, CompanyReviewItem, Vacancy } from "../types.js";
import { CompanyDetailVM, mapCompanyToViewModel } from "../companies/detail.js";
import { mapCompany, mapReview, mapVacancy } from "./mappers.js";
/** Kompaniyalar: katalog, tafsilot, o'xshashlar va sharhlar. */

// ---------------------------------------------------------
// Kompaniyalar
// ---------------------------------------------------------

export interface CompanyPage {
  items: Company[];
  nextCursor: string | null;
  /** Faqat birinchi sahifada keladi. */
  total: number | null;
}

/**
 * Katalogning bitta sahifasi. `params` — URL holatidan yasalgan parametrlar
 * (lib/companies/query.ts). Xatoda `ApiError` uloqtiradi: sahifa bo'sh natija
 * bilan "yuklab bo'lmadi" holatini farqlashi kerak.
 */
export async function fetchCompanyPage(
  params: URLSearchParams,
  options: { cursor?: string | null; limit?: number; signal?: AbortSignal; token?: string | null } = {}
): Promise<CompanyPage> {
  const qs = new URLSearchParams(params);
  if (options.limit) qs.set("limit", String(options.limit));
  if (options.cursor) qs.set("cursor", options.cursor);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/companies?${qs}`, {
      signal: withServerTimeout(options.signal),
      headers: { ...ssrHeaders(), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "Network error");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Request failed", json?.error);
  return {
    items: (json?.items ?? []).map(mapCompany),
    nextCursor: json?.nextCursor ?? null,
    total: typeof json?.total === "number" ? json.total : null,
  };
}

/** "Top kompaniyalar": tasdiqlangan, hozir ishga olayotgan, mashhurlik bo'yicha. Xatoda — bo'sh (blok yashiriladi). */
export async function fetchFeaturedCompanies(limit = 10): Promise<Company[]> {
  try {
    const page = await fetchCompanyPage(new URLSearchParams({ verified: "1", hiring: "1" }), { limit });
    return page.items;
  } catch {
    return [];
  }
}

export async function fetchCompany(
  slug: string
): Promise<{ company: Company; vacancies: Vacancy[]; reviews: CompanyReviewItem[] } | null> {
  const res = await tryFetch(`/api/companies/${slug}`);
  if (!res || !res.ok) return null;
  const raw = await res.json();
  const company = mapCompany(raw);
  const vacancies: Vacancy[] = (raw.vacancies ?? []).map((v: any) =>
    mapVacancy(v, { name: company.name, slug: company.slug })
  );
  const reviews: CompanyReviewItem[] = (raw.reviews ?? []).map(mapReview);
  return { company, vacancies, reviews };
}

/**
 * Ochiq kompaniya sahifasi uchun (view-model, lib/companies/detail.ts).
 * Topilmasa `null` (404); boshqa xatoda `ApiError` (tarmoq uzilsa status 0).
 */
export async function fetchCompanyDetail(slug: string, signal?: AbortSignal): Promise<CompanyDetailVM | null> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/companies/${encodeURIComponent(slug)}`, { signal: withServerTimeout(signal), headers: ssrHeaders() });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new ApiError(0, "Serverga ulanib bo'lmadi");
  }
  if (res.status === 404) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new ApiError(res.status, json?.message ?? "Kutilmagan xatolik", json?.error);
  const owner = { name: json.name, slug: json.slug, logoUrl: json.logoUrl ?? null, isVerified: json.isVerified ?? false };
  const vacancies: Vacancy[] = (json.vacancies ?? []).map((v: any) => mapVacancy({ ...v, company: v.company ?? owner }));
  return mapCompanyToViewModel(json, { resolveUrl: absoluteUploadUrl, vacancies });
}

/** "O'xshash kompaniyalar" — ikkinchi darajali blok: xatoda bo'sh ro'yxat (blok yashiriladi). */
export async function fetchSimilarCompanies(slug: string, limit = 5, signal?: AbortSignal): Promise<Company[]> {
  try {
    const res = await fetch(`${API_URL}/api/companies/${encodeURIComponent(slug)}/similar?limit=${limit}`, { signal: withServerTimeout(signal), headers: ssrHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.items ?? []).map(mapCompany);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return [];
  }
}

export async function submitReview(
  token: string,
  slug: string,
  input: { rating: number; comment?: string }
): Promise<CompanyReviewItem> {
  const res = await fetch(`${API_URL}/api/companies/${slug}/reviews`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
  return json as CompanyReviewItem;
}

export async function deleteReview(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/reviews/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: authHeaders(token),
  });
  if (!res.ok) await throwApiError(res);
}
