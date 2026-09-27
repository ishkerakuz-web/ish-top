import { API_URL, ApiError } from "../../api.js";
import {
  mapEmployerApplicationDetail,
  mapEmployerApplicationRow,
  mapStatusCounts,
  mapVacancyOptions,
  type EmployerApplicationVM,
  type FilterOption,
  type SettableStatus,
  type StatusCounts,
} from "./adapter.js";
import type { EmployerApplicationQuery } from "./query.js";

/**
 * `GET /api/employer/applications` javobi (audit R3, D-061): server sahifalaydi va filtrlaydi.
 * `total` — joriy filtr bo'yicha arizalar soni, `counts` — holat tablari uchun sonlar.
 */
export interface EmployerApplicationList {
  items: EmployerApplicationVM[];
  total: number;
  page: number;
  pageSize: number;
  counts: StatusCounts;
  /** Filtr variantlari — ariza kelgan vakansiyalar. */
  vacancies: FilterOption[];
}

/** Server sahifa chegarasi (D-061): URL'dagi kattaroq qiymat 400 emas, oxirgi ruxsat etilgan sahifa. */
const MAX_PAGE = 200;

/** URL holati → server so'rovi parametrlari (standart qiymatlar yuborilmaydi). */
export function employerApplicationParams(query: EmployerApplicationQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.page > 1) params.set("page", String(Math.min(query.page, MAX_PAGE)));
  params.set("pageSize", String(query.size));
  if (query.status) params.set("status", query.status);
  if (query.vacancy) params.set("vacancyId", query.vacancy);
  if (query.q) params.set("q", query.q);
  if (query.region) params.set("region", query.region);
  if (query.period) params.set("period", query.period);
  if (query.sort !== "newest") params.set("sort", query.sort);
  return params;
}

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}

async function fail(res: Response): Promise<never> {
  const json = await readJson(res);
  throw new ApiError(
    res.status,
    typeof json?.message === "string" ? json.message : "Xatolik",
    typeof json?.error === "string" ? json.error : undefined
  );
}

/**
 * "Murojaatlar" ro'yxati. `fetchEmployerApplications`dan (api.ts) farqi: xatoda bo'sh ro'yxat emas,
 * `ApiError` uloqtiriladi — "yuklab bo'lmadi" hech qachon "murojaatlar yo'q" bo'lib ko'rinmaydi.
 * Bekor qilinsa — AbortError.
 */
export async function fetchEmployerApplicationList(
  token: string,
  query: EmployerApplicationQuery,
  signal?: AbortSignal
): Promise<EmployerApplicationList> {
  const search = employerApplicationParams(query).toString();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/employer/applications${search ? `?${search}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "Network");
  }
  if (!res.ok) await fail(res);
  const json = await readJson(res);
  if (!json || !Array.isArray(json.items)) throw new ApiError(res.status, "Kutilmagan javob");
  const items = (json.items as unknown[]).map(mapEmployerApplicationRow).filter((a): a is EmployerApplicationVM => a !== null);
  const number = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
  return {
    items,
    total: number(json.total, items.length),
    page: number(json.page, query.page),
    pageSize: number(json.pageSize, query.size),
    counts: mapStatusCounts(json.counts),
    vacancies: mapVacancyOptions(json.vacancies),
  };
}

/** Tanlangan arizaning to'liq tafsiloti — `GET /api/employer/applications/:id`. */
export async function fetchEmployerApplication(token: string, id: string, signal?: AbortSignal): Promise<EmployerApplicationVM> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/employer/applications/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "Network");
  }
  if (!res.ok) await fail(res);
  const detail = mapEmployerApplicationDetail(await readJson(res));
  if (!detail) throw new ApiError(res.status, "Kutilmagan javob");
  return detail;
}

/**
 * Ariza holati — `PATCH /api/applications/:id/status`. `reason` yozilsa, backend uni nomzodga
 * suhbat xabari sifatida yuboradi; har bir o'zgarish nomzodga bildirishnoma bo'ladi.
 */
export async function updateApplicationStatus(token: string, id: string, status: SettableStatus, reason?: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/applications/${id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(reason ? { status, reason } : { status }),
    });
  } catch {
    throw new ApiError(0, "Network");
  }
  if (!res.ok) await fail(res);
}
