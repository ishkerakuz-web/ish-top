import { API_URL, ApiError, absoluteUploadUrl } from "../../api.js";
import { mapEmployerVacancyPage, type EmployerVacancyPage } from "./adapter.js";
import type { EmployerVacancyQuery } from "./query.js";

/**
 * Ish beruvchi vakansiyalari. `authGet`'dan farqi: xatoda bo'sh ro'yxat emas,
 * `ApiError` uloqtiriladi — "yuklab bo'lmadi" hech qachon "vakansiyalar yo'q"
 * bo'lib ko'rinmaydi. Bekor qilinsa AbortError.
 */
async function getJson(path: string, token: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "Serverga ulanib bo'lmadi");
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json) {
    throw new ApiError(res.status, typeof json?.message === "string" ? json.message : "Kutilmagan xatolik", typeof json?.error === "string" ? json.error : undefined);
  }
  return json;
}

/**
 * Bitta sahifa: qidiruv, filtrlar, saralash va sahifalash SERVERDA bajariladi
 * (audit R3, db-perf-8 / scale-10k-13) — ilgari butun ro'yxat (1000 tagacha to'liq hujjat) yuklanardi.
 */
export async function fetchEmployerVacancyPage(
  token: string,
  query: EmployerVacancyQuery,
  signal?: AbortSignal
): Promise<EmployerVacancyPage> {
  const params = new URLSearchParams();
  if (query.q) params.set("text", query.q);
  if (query.status) params.set("status", query.status);
  if (query.region) params.set("region", query.region);
  if (query.category) params.set("category", query.category);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  params.set("pageSize", String(query.size));
  const search = params.toString();
  const json = await getJson(`/api/employer/vacancies${search ? `?${search}` : ""}`, token, signal);
  if (!Array.isArray(json.items)) throw new ApiError(500, "Kutilmagan javob");
  return mapEmployerVacancyPage(json, query.size);
}

/**
 * Tahrirlash formasi uchun bitta to'liq yozuv (audit R3, scale-10k-13): ilgari forma
 * butun ro'yxatni yuklab, keraklisini xotirada topardi. Topilmasa (404/403) — `null`,
 * boshqa xatolar `ApiError` bo'lib qoladi (xato "topilmadi" bo'lib ko'rinmasin).
 */
export async function fetchEmployerVacancyRecord(token: string, id: string, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  try {
    return await getJson(`/api/employer/vacancies/${encodeURIComponent(id)}`, token, signal);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return null;
    throw err;
  }
}

/** Kompaniya profili bormi — vakansiya joylash undan oldin mumkin emas. */
export async function fetchHasEmployerCompany(token: string, signal?: AbortSignal): Promise<boolean> {
  const json = await getJson("/api/employer/company", token, signal);
  return Boolean(json.company);
}

export interface EmployerCompanySummary {
  /** Bo'sh bo'lishi mumkin — preview nomsiz neytral holatni ko'rsatadi. */
  name: string;
  logoUrl: string | null;
}

/** Kompaniya profili (vakansiya preview'i uchun nom va logo). Profil yo'q — `null`. */
export async function fetchEmployerCompanySummary(token: string, signal?: AbortSignal): Promise<EmployerCompanySummary | null> {
  const json = await getJson("/api/employer/company", token, signal);
  const company = json.company;
  if (!company || typeof company !== "object") return null;
  const r = company as Record<string, unknown>;
  const logo = typeof r.logoUrl === "string" ? r.logoUrl.trim() : "";
  return { name: typeof r.name === "string" ? r.name.trim() : "", logoUrl: logo ? absoluteUploadUrl(logo) : null };
}

/** Amal xatosi turi: 409 — bu holatdan o'tib bo'lmaydi. (Faol vakansiyalar limiti yo'q — platforma bepul.) */
export function vacancyActionErrorKind(err: unknown): "transition" | "hasApplications" | "incomplete" | "phoneGate" | "generic" {
  if (!(err instanceof ApiError)) return "generic";
  // Arxiv/qoralamani qayta faollashtirish telefon tasdig'ini talab qiladi (403) — tasdiqlash havolasi ko'rsatiladi (audit PHASE 6, U4).
  // Telegram ishlamayotgan bo'lsa (503) ham shu eslatma chiqadi: uning o'zi Rule K matnini ko'rsatadi (audit R3).
  if (err.code === "PHONE_NOT_VERIFIED" || err.code === "TELEGRAM_UNAVAILABLE") return "phoneGate";
  // Arizasi bor e'lonni o'chirib bo'lmaydi — yopish taklif qilinadi
  if (err.code === "VACANCY_HAS_APPLICATIONS") return "hasApplications";
  // Administrator yopgan e'lonni ish beruvchi qayta ocholmaydi (audit R3, D-070) — 409 bilan bir xil matn
  if (err.status === 409) return "transition";
  // Qayta e'lon qilishda kategoriya / ish joylashuvi / hudud yetishmaydi
  if (err.status === 400 && err.code === "VALIDATION_ERROR") return "incomplete";
  return "generic";
}
