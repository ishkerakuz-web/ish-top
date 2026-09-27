import { API_URL, ApiError } from "../api.js";

/**
 * Himoyalangan PDF rezyume fayllari (audit R3, D-058).
 *
 * Fayl endi `/uploads/...` statik manzilidan OLINMAYDI: API uni faqat
 * `GET /api/resume-files/*` orqali, Bearer token bilan beradi (nomzodning
 * o'zi, ariza kelgan kompaniya egasi yoki admin). Shuning uchun uni oddiy
 * `<a href>` bilan ochib bo'lmaydi — fayl fetch bilan olinadi va blob sifatida
 * yangi oynada ochiladi.
 */

/** Nomzodning o'z rezyume fayli. */
export function ownResumeFileUrl(): string {
  return `${API_URL}/api/resume-files/me`;
}

/** Ariza bo'yicha nomzod rezyumesi (ish beruvchi, admin yoki nomzodning o'zi). */
export function applicationResumeFileUrl(applicationId: string): string {
  return `${API_URL}/api/resume-files/application/${encodeURIComponent(applicationId)}`;
}

/**
 * Blob manzili darhol bekor qilinmaydi: yangi oyna faylni o'qib ulgurishi kerak.
 * Bir daqiqadan keyin xotira bo'shatiladi (oyna ochiq bo'lsa ham PDF allaqachon o'qilgan).
 */
const REVOKE_DELAY_MS = 60_000;

/** Popup bloklangan holat uchun zaxira: faylni yuklab olish. */
function downloadFallback(objectUrl: string): void {
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = "resume.pdf";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Faylni Bearer token bilan yuklab, yangi oynada ochadi.
 *
 * MUHIM: oyna `await` dan OLDIN, foydalanuvchi bosgan paytda ochiladi — aks
 * holda brauzer uni popup deb bloklaydi. (`"noopener"` berilmaydi: u holda
 * `window.open` `null` qaytaradi va oynani boshqarib bo'lmaydi.)
 *
 * Xatoda `ApiError` uloqtiriladi — chaqiruvchi UI'da xato holatini ko'rsatadi
 * (bo'sh holat yoki soxta muvaffaqiyat emas).
 */
export async function openProtectedFile(url: string, token: string): Promise<void> {
  if (typeof window === "undefined") throw new ApiError(0, "Fayl faqat brauzerda ochiladi");

  const tab = window.open("", "_blank");
  if (tab) {
    try {
      tab.document.write("<!doctype html><meta charset=utf-8><title>PDF</title><p>Yuklanmoqda…</p>");
    } catch {
      // Ba'zi brauzerlar yangi oynaga yozishga ruxsat bermaydi — muhim emas.
    }
  }

  try {
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      throw new ApiError(0, "Serverga ulanib bo'lmadi");
    }
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      throw new ApiError(res.status, json?.message ?? "Faylni ochib bo'lmadi", json?.error);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    if (tab) tab.location.replace(objectUrl);
    else downloadFallback(objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), REVOKE_DELAY_MS);
  } catch (error) {
    tab?.close();
    throw error instanceof ApiError ? error : new ApiError(0, "Faylni ochib bo'lmadi");
  }
}
