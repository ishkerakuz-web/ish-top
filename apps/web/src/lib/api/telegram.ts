import { API_URL, ApiError, authHeaders, throwApiError, tryFetch } from "./core.js";
import { TelegramLink, TelegramStatus } from "../types.js";
/** Telegram: hisobni bog'lash va telefon tasdig'i. */

// ---------------------------------------------------------
// Telegram (hisob bog'lash + telefon tasdiqlash)
// ---------------------------------------------------------

/** Xatoda `ApiError`: holat noma'lum bo'lsa "bog'lanmagan" deb ko'rsatilmaydi. */
export async function fetchTelegramStatus(token: string): Promise<TelegramStatus> {
  const res = await tryFetch("/api/telegram/status", { headers: authHeaders(token) });
  if (!res) throw new ApiError(0, "Network");
  if (!res.ok) await throwApiError(res);
  return (await res.json()) as TelegramStatus;
}

/** Telefon tasdiqlash uchun deep-link (audit R3, D-042): `{ link, expiresAt }`. */
export async function requestTelegramLink(token: string): Promise<TelegramLink> {
  const res = await fetch(`${API_URL}/api/telegram/link`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: "{}",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
  return { link: String(json?.link ?? ""), expiresAt: (json?.expiresAt as string | undefined) ?? null };
}
