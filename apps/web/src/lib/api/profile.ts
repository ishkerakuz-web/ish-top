import { API_URL, ApiError, tryFetch } from "./core.js";
import { Profile, ProfileUpdate, Region } from "../types.js";
/** Nomzod profili va hududlar. */

// ---------------------------------------------------------
// Profil + hududlar
// ---------------------------------------------------------

export async function fetchRegions(): Promise<Region[]> {
  const res = await tryFetch("/api/regions");
  if (!res || !res.ok) return [];
  const json = await res.json();
  return (json.items ?? []) as Region[];
}

/** Hududlar forma uchun majburiy bo'lganda: xatoda `ApiError` (bo'sh ro'yxat bilan forma chizilmasin). */
export async function fetchRegionsStrict(): Promise<Region[]> {
  const res = await tryFetch("/api/regions");
  if (!res) throw new ApiError(0, "Network");
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new ApiError(res.status, "Xatolik");
  return (json.items ?? []) as Region[];
}

export async function fetchProfile(token: string): Promise<Profile | null> {
  const res = await tryFetch("/api/profile", { headers: { Authorization: `Bearer ${token}` } });
  if (!res || !res.ok) return null;
  return (await res.json()) as Profile;
}

export async function updateProfile(token: string, data: ProfileUpdate): Promise<Profile> {
  const res = await fetch(`${API_URL}/api/profile`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Xatolik", json?.error);
  return json as Profile;
}
