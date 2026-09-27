import { API_URL, ApiError } from "../api.js";
import { mapFavoriteToViewModel, type SavedVacancy } from "./adapter.js";

/**
 * `/favorites` sahifasi ro'yxati — mavjud `GET /api/favorites` (yangi endpoint yo'q).
 * `fetchFavorites` dan farqi: xato yoki uzilishda bo'sh ro'yxat emas, xato uloqtiradi —
 * aks holda API xatosi "Saqlangan vakansiyalar yo'q" bo'lib ko'rinardi.
 * Saqlash/olib tashlash — mavjud `addFavorite` / `removeFavorite` (apiExtra).
 */
export async function fetchSavedVacancies(token: string): Promise<SavedVacancy[]> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/favorites`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ApiError(0, "Tarmoq xatosi");
  }
  const json = (await res.json().catch(() => null)) as { items?: unknown[]; message?: string; error?: string } | null;
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Kutilmagan xatolik", json?.error);
  const items = Array.isArray(json?.items) ? json.items : [];
  return items.map(mapFavoriteToViewModel).filter((item): item is SavedVacancy => item !== null);
}
