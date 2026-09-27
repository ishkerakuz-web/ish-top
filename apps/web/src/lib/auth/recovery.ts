// Parolni tiklash, telefon xavfsizligi va qo'lda tiklash so'rovlari uchun API qatlami
// (audit R3, D-045, D-047, D-048, D-049). Uslub `api.ts` bilan bir xil: xatoda `ApiError`,
// tarmoq uzilsa status 0 — sahifa hech qachon bo'sh holat ko'rsatmaydi.
import { API_URL, ApiError } from "../api.js";
import type { TelegramLink } from "../types.js";

/** Qo'lda tiklash so'rovining holati (server `not_found` ni ham qaytaradi). */
export type ManualRecoveryStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "expired"
  | "not_found";

export interface RecoveryAccountSummary {
  exists: boolean;
  id?: string | null;
  role?: string | null;
  createdAt?: string | null;
  isBlocked?: boolean;
  /** Niqoblangan raqamlar — admin to'liq raqamni ko'rmaydi. */
  phoneMasked?: string | null;
  backupPhoneMasked?: string | null;
  telegramLinked?: boolean;
}

export interface RecoveryRequestItem {
  id: string;
  email: string;
  fullName: string;
  details: string;
  contact: string | null;
  status: Exclude<ManualRecoveryStatus, "not_found">;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  account: RecoveryAccountSummary;
}

export interface SecurityEventItem {
  id: string;
  type: string;
  createdAt: string;
  meta?: Record<string, unknown> | null;
}

export interface RecoveryRequestPage {
  items: RecoveryRequestItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Xato bo'lsa `ApiError` — chaqiruvchi kodni (`TELEGRAM_UNAVAILABLE` va h.k.) tekshiradi. */
async function send<T>(
  path: string,
  method: "POST" | "DELETE",
  body: unknown,
  token?: string | null
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError(0, "Serverga ulanib bo'lmadi", "NETWORK");
  }
  const json = (await res.json().catch(() => null)) as (T & { message?: string; error?: string }) | null;
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Kutilmagan xatolik", json?.error);
  return json as T;
}

async function get<T>(path: string, token: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "Serverga ulanib bo'lmadi", "NETWORK");
  }
  const json = (await res.json().catch(() => null)) as (T & { message?: string; error?: string }) | null;
  if (!res.ok || json === null) throw new ApiError(res.status, json?.message ?? "Kutilmagan xatolik", json?.error);
  return json as T;
}

/* ------------------------------------------------------------------ *
 * Anonim: parolni tiklash
 * ------------------------------------------------------------------ */

/** Telefon bo'yicha tiklash: hisob bor-yo'qligidan qat'i nazar bir xil javob (D-045). */
export function startPhoneRecovery(phone: string): Promise<TelegramLink> {
  return send<TelegramLink>("/api/auth/recovery/start", "POST", { phone });
}

/** Reset havolasi hali amal qiladimi (parol formasi chizilishidan oldin). */
export function checkResetToken(token: string): Promise<{ valid: boolean }> {
  return send<{ valid: boolean }>("/api/auth/recovery/check", "POST", { token });
}

/** Yangi parol. Javobda token yoki parol qaytmaydi — foydalanuvchi qaytadan kiradi. */
export function resetPassword(token: string, password: string): Promise<{ ok: true }> {
  return send<{ ok: true }>("/api/auth/recovery/reset", "POST", { token, password });
}

/** Qo'lda tiklash so'rovi — javobdagi kod foydalanuvchiga faqat bir marta ko'rsatiladi. */
export function submitManualRecovery(input: {
  email: string;
  fullName: string;
  details: string;
  contact?: string;
}): Promise<{ requestCode: string }> {
  return send<{ requestCode: string }>("/api/auth/recovery/manual", "POST", input);
}

export function manualRecoveryStatus(requestCode: string): Promise<{ status: ManualRecoveryStatus }> {
  return send<{ status: ManualRecoveryStatus }>("/api/auth/recovery/manual/status", "POST", { requestCode });
}

/** Tasdiqlangan so'rov bilan davom etish: yangi Telegram deep-link. */
export function manualRecoveryContinue(requestCode: string): Promise<TelegramLink> {
  return send<TelegramLink>("/api/auth/recovery/manual/continue", "POST", { requestCode });
}

/* ------------------------------------------------------------------ *
 * Autentifikatsiyali: telefon xavfsizligi
 * ------------------------------------------------------------------ */

export function startPhoneChange(token: string, password: string): Promise<TelegramLink> {
  return send<TelegramLink>("/api/auth/phone/change", "POST", { password }, token);
}

export function startBackupPhone(token: string, password: string): Promise<TelegramLink> {
  return send<TelegramLink>("/api/auth/phone/backup", "POST", { password }, token);
}

export function removeBackupPhone(token: string, password: string): Promise<{ ok: true }> {
  return send<{ ok: true }>("/api/auth/phone/backup", "DELETE", { password }, token);
}

export function unlinkTelegram(token: string, password: string): Promise<{ ok: true }> {
  return send<{ ok: true }>("/api/telegram/link", "DELETE", { password }, token);
}

/* ------------------------------------------------------------------ *
 * Admin: qo'lda tiklash so'rovlari
 * ------------------------------------------------------------------ */

export function fetchRecoveryRequests(
  token: string,
  params: { status?: string; page?: number } = {},
  signal?: AbortSignal
): Promise<RecoveryRequestPage> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const query = qs.toString();
  return get<RecoveryRequestPage>(`/api/admin/recovery-requests${query ? `?${query}` : ""}`, token, signal);
}

export function approveRecoveryRequest(token: string, id: string, note?: string) {
  return send<{ ok: true }>(`/api/admin/recovery-requests/${id}/approve`, "POST", note ? { note } : {}, token);
}

export function rejectRecoveryRequest(token: string, id: string, note?: string) {
  return send<{ ok: true }>(`/api/admin/recovery-requests/${id}/reject`, "POST", note ? { note } : {}, token);
}

/**
 * Bitta foydalanuvchining oxirgi xavfsizlik hodisalari (maxfiy qiymatlarsiz).
 * Javob `{ items }` yoki to'g'ridan-to'g'ri massiv bo'lishi mumkin — ikkalasi ham qabul qilinadi.
 */
export async function fetchSecurityEvents(
  token: string,
  userId: string,
  signal?: AbortSignal
): Promise<{ items: SecurityEventItem[] }> {
  const raw = await get<{ items?: SecurityEventItem[] } | SecurityEventItem[]>(
    `/api/admin/users/${userId}/security-events`,
    token,
    signal
  );
  const items = Array.isArray(raw) ? raw : (raw.items ?? []);
  return { items };
}

/* ------------------------------------------------------------------ *
 * Yordamchilar
 * ------------------------------------------------------------------ */

/** `/login` query rejimlari (audit R3, D-063) — yangi sahifa yaratilmaydi. */
export type RecoveryMode = "phone" | "manual" | "status" | "reset" | null;

export function recoveryModeFrom(search: Record<string, string | undefined>): RecoveryMode {
  if (search.reset) return "reset";
  const recover = search.recover;
  if (recover === "manual") return "manual";
  if (recover === "status") return "status";
  if (recover === "1" || recover === "phone" || recover === "true") return "phone";
  return null;
}

/** Xato kodini uch tildagi matnga aylantirish uchun umumiy tasnif. */
export type RecoveryErrorKind = "unavailable" | "rateLimit" | "invalidPhone" | "notApproved" | "generic";

export function recoveryErrorKind(err: unknown): RecoveryErrorKind {
  if (!(err instanceof ApiError)) return "generic";
  if (err.code === "TELEGRAM_UNAVAILABLE" || err.status === 503) return "unavailable";
  if (err.status === 429) return "rateLimit";
  if (err.code === "RECOVERY_NOT_APPROVED") return "notApproved";
  if (err.status === 400) return "invalidPhone";
  return "generic";
}

/**
 * Havola muddatigacha qolgan daqiqalar (kamida 1) — matnda "N daqiqa amal qiladi".
 * Sana kelmasa yoki noto'g'ri bo'lsa `null`.
 */
export function minutesUntil(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(1, Math.round(ms / 60000));
}
