import { API_URL, ApiError, authGet, authHeaders, throwApiError, tryFetch } from "./core.js";
import {
  Candidate,
  Category,
  EmployerApplication,
  MyCompany,
  MyCompanyInput,
  VacancyCreateInput,
} from "../types.js";
/** Ish beruvchi: kompaniya, vakansiyalar va kelgan arizalar. */

// ---------------------------------------------------------
// Ish beruvchi kompaniyasi
// ---------------------------------------------------------

/** `null` — kompaniya haqiqatan yo'q. Xatoda `ApiError`: bo'sh forma bilan mavjud kompaniya ustidan yozilmasin (audit ISSUE-018). */
export async function fetchMyCompany(token: string): Promise<MyCompany | null> {
  const res = await tryFetch("/api/employer/company", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res) throw new ApiError(0, "Network");
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
  return (json.company ?? null) as MyCompany | null;
}

/** Kompaniya logosini yuklaydi (PNG/JPG/WebP/SVG, maks 5MB). */
export async function uploadCompanyLogo(token: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/employer/company/logo`, {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
  return json.logoUrl as string;
}

export async function deleteCompanyLogo(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/employer/company/logo`, {
    method: "DELETE",
    credentials: "include",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
  }
}

export async function saveMyCompany(token: string, data: MyCompanyInput): Promise<MyCompany> {
  const res = await fetch(`${API_URL}/api/employer/company`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
  return json.company as MyCompany;
}

// ---------------------------------------------------------
// Ish beruvchi: vakansiyalar va murojaatlar
// ---------------------------------------------------------

export async function fetchCategories(): Promise<Category[]> {
  const res = await tryFetch("/api/categories");
  if (!res || !res.ok) return [];
  return ((await res.json()).items ?? []) as Category[];
}

/** Mavjud vakansiyani tahrirlaydi (faqat berilgan maydonlar yangilanadi). */
export async function updateVacancy(
  token: string,
  id: string,
  input: Partial<VacancyCreateInput>
) {
  const res = await fetch(`${API_URL}/api/vacancies/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
  return json;
}

export async function createVacancy(token: string, input: VacancyCreateInput) {
  const res = await fetch(`${API_URL}/api/vacancies`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
  return json;
}

export async function setVacancyStatus(token: string, id: string, status: "active" | "archived") {
  const res = await fetch(`${API_URL}/api/vacancies/${id}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) await throwApiError(res);
  // Yangi holat: qoralama birinchi marta chiqarilganda "moderation" bo'lishi mumkin
  return (await res.json().catch(() => null)) as { status?: string } | null;
}

export async function deleteVacancy(token: string, id: string) {
  const res = await fetch(`${API_URL}/api/vacancies/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: authHeaders(token),
  });
  if (!res.ok) await throwApiError(res);
}

export interface CandidatePage {
  items: Candidate[];
  /** API keyingi sahifa borligini aytdi. */
  hasMore: boolean;
}

/**
 * Nomzodlar bazasining bitta sahifasi. Xatoda `ApiError` (server kodi saqlanadi, masalan COMPANY_REQUIRED) —
 * "nomzod topilmadi" bilan "yuklab bo'lmadi" farqlanadi (audit ISSUE-023). API sahifalaydi, keyingilari
 * `page` bilan olinadi (audit PHASE 6, U25, U5).
 */
export async function fetchCandidates(
  token: string,
  params: { text?: string; page?: number } = {},
  signal?: AbortSignal
): Promise<CandidatePage> {
  const qs = new URLSearchParams();
  if (params.text) qs.set("text", params.text);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const search = qs.toString();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/candidates${search ? `?${search}` : ""}`, { headers: authHeaders(token), signal });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "Network");
  }
  if (!res.ok) await throwApiError(res);
  const json = (await res.json().catch(() => null)) as { items?: unknown; hasMore?: unknown } | null;
  // Buzuq javob "nomzod yo'q" bo'lib ko'rinmasin
  if (!json || !Array.isArray(json.items)) throw new ApiError(res.status, "Kutilmagan javob");
  return { items: json.items as Candidate[], hasMore: json.hasMore === true };
}

export async function fetchEmployerApplications(token: string): Promise<EmployerApplication[]> {
  return (await authGet<{ items: EmployerApplication[] }>("/api/employer/applications", token, { items: [] })).items;
}
