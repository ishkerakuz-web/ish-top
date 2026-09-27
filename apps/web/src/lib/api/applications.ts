import { ApiError, authHeaders, throwApiError, tryFetch } from "./core.js";
import { ApplicationStatus, MyApplication } from "../types.js";
/** Nomzodning arizalari. */

// ---------------------------------------------------------
// Nomzodning arizalari
// ---------------------------------------------------------

/**
 * Nomzodning o'z arizalari, eng yangisi birinchi.
 * Boshqa ro'yxat funksiyalaridan farqli o'laroq xatoni YASHIRMAYDI: profil
 * sahifasi "ariza yo'q" bilan "yuklab bo'lmadi"ni farqlab ko'rsatishi kerak.
 */
export async function fetchMyApplications(token: string): Promise<MyApplication[]> {
  const res = await tryFetch("/api/applications", { headers: authHeaders(token) });
  if (!res) throw new ApiError(0, "Network");
  if (!res.ok) await throwApiError(res);
  const rows = (await res.json()) as unknown;
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row?.vacancy && APPLICATION_STATUSES.includes(row.status)).map(mapMyApplication);
}

const APPLICATION_STATUSES: ApplicationStatus[] = ["sent", "viewed", "invited", "rejected", "accepted"];
const EMPLOYMENT_TYPES = ["full_time", "part_time", "remote", "shift"] as const;
const EXPERIENCE_LEVELS = ["none", "one_to_three", "three_to_six", "six_plus"] as const;

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** Backend yozuvi -> `MyApplication`. Yo'q/yaroqsiz maydon `null` bo'ladi, to'qima qiymat qo'yilmaydi. */
function mapMyApplication(row: any): MyApplication {
  const vacancy = row.vacancy;
  const company = vacancy.company ?? {};
  const history = Array.isArray(row.statusHistory) ? row.statusHistory : [];
  return {
    id: String(row.id),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    source: row.source === "telegram" ? "telegram" : "site",
    coverLetter: text(row.coverLetter),
    resume: row.resume?.id && text(row.resume.title) ? { id: String(row.resume.id), title: text(row.resume.title)! } : null,
    history: history
      .filter((h: any) => APPLICATION_STATUSES.includes(h?.newStatus) && typeof h.createdAt === "string")
      .map((h: any) => ({ status: h.newStatus as ApplicationStatus, at: h.createdAt as string })),
    vacancy: {
      id: String(vacancy.id),
      slug: String(vacancy.slug),
      title: text(vacancy.title) ?? "",
      isClosed: vacancy.status !== "active",
      salaryMin: positiveInt(vacancy.salaryMin),
      salaryMax: positiveInt(vacancy.salaryMax),
      isSalaryHidden: vacancy.isSalaryHidden === true,
      employmentType: pick(vacancy.employmentType, EMPLOYMENT_TYPES),
      experienceRequired: pick(vacancy.experienceRequired, EXPERIENCE_LEVELS),
      regionSlug: text(vacancy.region?.slug),
      regionName: text(vacancy.region?.name),
    },
    company: {
      name: text(company.name) ?? "",
      slug: text(company.slug) ?? "",
      logoUrl: text(company.logoUrl),
      isVerified: company.isVerified === true,
    },
  };
}
