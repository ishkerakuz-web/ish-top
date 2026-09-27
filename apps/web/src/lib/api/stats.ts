import { Stats } from "../types.js";
import { tryFetch } from "./core.js";
/** Bosh sahifa statistikasi. */

// ---------------------------------------------------------
// Statistika (maqolalar — lib/articles/api.ts)
// ---------------------------------------------------------

/** Xatoda `null`: "0 vakansiya / 0 kompaniya" ko'rsatilmasin — blok yashiriladi (audit ISSUE-016). */
export async function fetchStats(): Promise<Stats | null> {
  const res = await tryFetch("/api/stats");
  if (!res || !res.ok) return null;
  const json = (await res.json().catch(() => null)) as Stats | null;
  return json && typeof json.vacancies === "number" ? json : null;
}
