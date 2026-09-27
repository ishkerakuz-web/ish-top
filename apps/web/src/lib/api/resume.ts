import { API_URL, ApiError, tryFetch } from "./core.js";
import { ResumeData, ResumeInput } from "../types.js";
/** Rezyume: saqlash, PDF yuklash va o'chirish. */

// ---------------------------------------------------------
// Rezyume (saytda to'ldiriladi)
// ---------------------------------------------------------

/**
 * `null` — rezyume haqiqatan yo'q (200 + `resume: null`). Tarmoq yoki server xatosida `ApiError`:
 * ilgari xato "rezyume yo'q" deb qabul qilinib, keyingi bo'lim saqlanishi (PUT butun hujjat)
 * tajriba, ta'lim va ko'nikmalarni o'chirib yuborardi (audit ISSUE-017).
 */
export async function fetchResume(token: string): Promise<ResumeData | null> {
  const res = await tryFetch("/api/resume", { headers: { Authorization: `Bearer ${token}` } });
  if (!res) throw new ApiError(0, "Network");
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
  return (json.resume ?? null) as ResumeData | null;
}

export async function saveResume(token: string, data: ResumeInput): Promise<ResumeData | null> {
  const res = await fetch(`${API_URL}/api/resume`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
  return (json?.resume ?? null) as ResumeData | null;
}

/** PDF rezyume yuklash — javobda fayl manzili (`/uploads/...`). */
export async function uploadResumeFile(token: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/profile/resume`, {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
  return json.resumeUrl as string;
}

export async function deleteResumeFile(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/profile/resume`, {
    method: "DELETE",
    credentials: "include",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
  }
}
