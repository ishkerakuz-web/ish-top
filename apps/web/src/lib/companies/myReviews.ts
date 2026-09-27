import { API_URL } from "../api.js";

/**
 * "Qaysi sharh meniki" (audit R3, D-075).
 *
 * Ochiq `GET /api/companies/:slug` javobida sharh muallifining `userId` si
 * qaytarilmaydi, `mine` bayrog'i esa faqat `Authorization` sarlavhasi bilan
 * kelgan so'rovda hisoblanadi. Sahifa ma'lumoti SSR'da tokensiz olinadi va
 * brauzerda qayta so'ralmaydi — shu sababli kirgan nomzod o'z sharhini
 * tanimay qolardi (tahrirlash formasi bo'sh ochilar, o'chirish tugmasi
 * ko'rinmasdi). Bu yerda faqat shu bayroq uchun bir marta aniqlashtiriladi.
 *
 * Xato yoki tarmoq uzilishida jimgina bo'sh to'plam qaytadi: UI SSR holatida
 * qoladi, huquqni baribir server (`POST`/`DELETE`) tekshiradi.
 */
export async function fetchMyReviewIds(slug: string, token: string, signal?: AbortSignal): Promise<Set<string>> {
  const ids = new Set<string>();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/companies/${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  } catch {
    return ids;
  }
  if (!res.ok) return ids;
  const json = (await res.json().catch(() => null)) as { reviews?: unknown } | null;
  const rows = Array.isArray(json?.reviews) ? (json.reviews as { id?: unknown; mine?: unknown }[]) : [];
  for (const row of rows) {
    if (row?.mine === true && typeof row.id === "string") ids.add(row.id);
  }
  return ids;
}
