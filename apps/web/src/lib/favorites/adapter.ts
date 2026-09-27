import type { EmploymentType, ExperienceLevel } from "../types.js";

/**
 * `/favorites` kartasi uchun normallashtirilgan ko'rinish modeli. Bo'sh qator,
 * `null`/`undefined`, noma'lum enum — `null` (UI o'sha qatorni chizmaydi).
 */
export interface SavedVacancy {
  id: string;
  slug: string;
  title: string;
  company: { name: string | null; slug: string | null; logoUrl: string | null; isVerified: boolean };
  region: { name: string; slug: string | null } | null;
  categoryName: string | null;
  /** `null` — maosh ko'rsatilmaydi (ish beruvchi yashirgan yoki kiritilmagan). */
  salary: { min: number | null; max: number | null; currency: string } | null;
  employmentType: EmploymentType | null;
  experience: ExperienceLevel | null;
  publishedAt: string | null;
  /** Saqlangan vaqt (`Favorite.createdAt`); bo'lmasa sana ko'rsatilmaydi. */
  savedAt: string | null;
  /** Backend `isClosed` — vakansiya faol emas (arxiv, moderatsiya va h.k.). */
  isClosed: boolean;
}

const EMPLOYMENT: readonly EmploymentType[] = ["full_time", "part_time", "remote", "shift"];
const EXPERIENCE: readonly ExperienceLevel[] = ["none", "one_to_three", "three_to_six", "six_plus"];

type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
  return value && typeof value === "object" ? (value as Row) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * `GET /api/favorites` qatori → `SavedVacancy`. Asosiy maydonlari (id, slug,
 * sarlavha) bo'lmagan qator tashlab yuboriladi — kartani ochib bo'lmaydi.
 */
export function mapFavoriteToViewModel(raw: unknown): SavedVacancy | null {
  const r = asRow(raw);
  if (!r) return null;
  const id = text(r.id);
  const slug = text(r.slug);
  const title = text(r.title);
  if (!id || !slug || !title) return null;

  const company = asRow(r.company) ?? {};
  const region = asRow(r.region);
  const regionName = region ? text(region.name) : null;
  const min = positive(r.salaryMin);
  const max = positive(r.salaryMax);

  return {
    id,
    slug,
    title,
    company: {
      name: text(company.name),
      slug: text(company.slug),
      logoUrl: text(company.logoUrl),
      isVerified: company.isVerified === true,
    },
    region: regionName ? { name: regionName, slug: text(region?.slug) } : null,
    categoryName: text(asRow(r.category)?.name),
    salary: r.isSalaryHidden === true || (min === null && max === null) ? null : { min, max, currency: text(r.currency) ?? "UZS" },
    employmentType: pick(r.employmentType, EMPLOYMENT),
    experience: pick(r.experienceRequired, EXPERIENCE),
    publishedAt: isoDate(r.publishedAt),
    savedAt: isoDate(r.favoritedAt),
    isClosed: r.isClosed === true,
  };
}
