import { API_URL, ApiError } from "./core.js";
import { ApplicationStatus, CurrentUser } from "../types.js";
/** Kirish, ro'yxatdan o'tish, chiqish, Google va joriy foydalanuvchi. */

// ---------------------------------------------------------
// Auth
// ---------------------------------------------------------

async function authRequest<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // Bo'sh tanali POST'da ham "{}" yuboramiz — Fastify application/json parseri
    // bo'sh tanani 400 bilan rad etadi (handler ishlamaydi, cookie tozalanmaydi).
    body: body === undefined ? "{}" : JSON.stringify(body),
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? "Kutilmagan xatolik yuz berdi", data?.error);
  }
  return data as T;
}

export interface AuthResponse {
  accessToken: string;
}

export function registerUser(input: {
  email: string;
  password: string;
  role: "job_seeker" | "employer";
  firstName?: string;
  lastName?: string;
  companyName?: string;
}) {
  return authRequest<AuthResponse>("/api/auth/register", input);
}

export function loginUser(input: { email: string; password: string }) {
  return authRequest<AuthResponse>("/api/auth/login", input);
}

export function logoutUser() {
  return authRequest<{ ok: true }>("/api/auth/logout", undefined);
}

// --- Ijtimoiy kirish -------------------------------------

/** Google ID token bilan kirish (rol berilsa — hisob yo'q bo'lsa yaratiladi). */
export function loginWithGoogle(credential: string, role?: "job_seeker" | "employer") {
  return authRequest<AuthResponse>("/api/auth/google", { credential, ...(role ? { role } : {}) });
}

// Telegram kirish kanali emas (audit R3, D-041): `telegram/start` va `telegram/poll`
// yo'llari hamda `telegramLogin()` olib tashlandi. Telegram faqat telefon tasdiqlash
// va parolni tiklash uchun ishlatiladi — lib/auth/recovery.ts.

export type MeResult = { kind: "ok"; user: CurrentUser } | { kind: "unauthorized" } | { kind: "error" };

/**
 * Seansni tiklash uchun: "token yaroqsiz" (401/403) va "server/tarmoq javob bermadi" farqlanadi.
 * Ilgari ikkalasi ham `null` edi va tarmoq uzilishi foydalanuvchini mehmonga aylantirib, tokenni o'chirardi (audit ISSUE-020).
 */
export async function fetchMeResult(token: string): Promise<MeResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return { kind: "error" };
  }
  if (res.status === 401 || res.status === 403) return { kind: "unauthorized" };
  if (!res.ok) return { kind: "error" };
  const user = (await res.json().catch(() => null)) as CurrentUser | null;
  return user ? { kind: "ok", user } : { kind: "error" };
}

export interface AppliedApplication {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
}

/** Ariza yuboradi. Oldin yuborilgan bo'lsa backend o'sha arizani (haqiqiy holati bilan) qaytaradi. */
export function applyToVacancy(vacancyId: string, token: string): Promise<AppliedApplication> {
  return authRequest<AppliedApplication>(`/api/vacancies/${vacancyId}/apply`, { source: "site" }, token);
}
