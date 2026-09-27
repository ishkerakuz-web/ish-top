import { API_URL, ApiError } from "../api.js";

/**
 * Admin paneli so'rovlari (maqolalar, jamoa, taklif). Har doim natija yoki
 * `ApiError` (status/kod bilan) — forma xabarlari va 401/403 holatlari shunga
 * tayanadi. Tarmoq uzilsa status 0, bekor qilinsa AbortError.
 */
export async function adminRequest<T>(
  path: string,
  options: {
    token: string | null;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    form?: FormData;
    signal?: AbortSignal;
  }
): Promise<T> {
  const { token, method = "GET", body, form, signal } = options;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "Serverga ulanib bo'lmadi", "NETWORK");
  }
  const json = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Kutilmagan xatolik", json?.error);
  return json as T;
}
