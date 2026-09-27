/**
 * `GET /api/employer/vacancies` javobi → ish beruvchi dashboard'i view-model'i.
 *
 * Qoida: bo'sh yoki noto'g'ri qiymat `null` bo'ladi va UI o'sha qismni chizmaydi —
 * maosh, hudud, toifa, sana, rad etish sababi yoki arizalar soni to'qib qo'yilmaydi.
 * Javobdagi `subscription` (tarif) ataylab o'qilmaydi: platforma hozircha bepul.
 *
 * Audit R3 (db-perf-8, employer-flows-4, scale-10k-13): qidiruv, filtrlar, saralash va
 * sahifalash endi SERVERDA — bu yerda faqat bitta sahifa va server bergan sonlar o'giriladi.
 */
import type { Locale } from "../../i18n/config.js";
import { CATEGORY_NAMES } from "../../i18n/categories.js";
import { regionName } from "../../i18n/regions.js";
import type { EmploymentType, WorkplaceType } from "../../types.js";

export const VACANCY_STATUSES = ["active", "moderation", "draft", "rejected", "archived"] as const;
export type EmployerVacancyStatus = (typeof VACANCY_STATUSES)[number];

const EMPLOYMENT: readonly EmploymentType[] = ["full_time", "part_time", "remote", "shift"];
const WORKPLACE: readonly WorkplaceType[] = ["office", "hybrid", "remote"];

export interface EmployerVacancyVM {
  id: string;
  slug: string;
  title: string;
  status: EmployerVacancyStatus;
  /** Faqat rad etilgan vakansiyada va backend sabab yozgan bo'lsa. */
  rejectionReason: string | null;
  /** Administrator yopgan e'lon (audit R3, D-070): ish beruvchi uni qayta faollashtira olmaydi. */
  adminLocked: boolean;
  region: { slug: string | null; name: string } | null;
  category: { slug: string | null; name: string } | null;
  employmentType: EmploymentType | null;
  /** Eski e'londa yo'q: bandlik turi "remote" bo'lsa masofaviy, aks holda `null`. */
  workplaceType: WorkplaceType | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryHidden: boolean;
  /** Ariza soni bo'lmasa `null` — "0 ta ariza" to'qilmaydi. */
  applications: number | null;
  createdAt: string | null;
  publishedAt: string | null;
}

const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const positive = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null);
const counter = (value: unknown): number | null => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null);
const isoDate = (value: unknown): string | null => {
  const s = str(value);
  return s && !Number.isNaN(Date.parse(s)) ? s : null;
};
const named = (value: unknown): { slug: string | null; name: string } | null => {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const name = str(r.name);
  return name ? { slug: str(r.slug), name } : null;
};

export function mapEmployerVacancy(raw: unknown): EmployerVacancyVM | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const slug = str(r.slug);
  const title = str(r.title);
  const status = (VACANCY_STATUSES as readonly string[]).includes(r.status as string) ? (r.status as EmployerVacancyStatus) : null;
  if (!id || !slug || !title || !status) return null;
  // Yangi javobda `applications` — son; eski javobda `_count.applications` (moslik)
  const legacyCount = r._count && typeof r._count === "object" ? (r._count as Record<string, unknown>).applications : undefined;
  return {
    id,
    slug,
    title,
    status,
    rejectionReason: status === "rejected" ? str(r.rejectionReason) : null,
    adminLocked: Boolean(isoDate(r.adminArchivedAt)),
    region: named(r.region),
    category: named(r.category),
    employmentType: EMPLOYMENT.includes(r.employmentType as EmploymentType) ? (r.employmentType as EmploymentType) : null,
    workplaceType: WORKPLACE.includes(r.workplaceType as WorkplaceType) ? (r.workplaceType as WorkplaceType) : r.employmentType === "remote" ? "remote" : null,
    salaryMin: positive(r.salaryMin),
    salaryMax: positive(r.salaryMax),
    salaryHidden: r.isSalaryHidden === true,
    applications: counter(r.applications) ?? counter(legacyCount),
    createdAt: isoDate(r.createdAt),
    publishedAt: isoDate(r.publishedAt),
  };
}

export function regionLabel(v: EmployerVacancyVM, locale: Locale): string | null {
  if (!v.region) return null;
  return v.region.slug ? regionName(locale, v.region.slug, v.region.name) : v.region.name;
}

export function categoryLabel(v: EmployerVacancyVM, locale: Locale): string | null {
  if (!v.category) return null;
  return (v.category.slug && CATEGORY_NAMES[locale][v.category.slug]) || v.category.name;
}

/**
 * Amallar — faqat backend ruxsat beradigan o'tishlar:
 * PATCH status faol/rad etilgan/moderatsiya → yopilgan, yopilgan/qoralama → faol.
 * Administrator yopgan e'lon qayta faollashtirilmaydi (audit R3, D-070).
 */
export function vacancyCapabilities(v: EmployerVacancyVM) {
  return {
    viewPublic: v.status === "active",
    // Arizasi bor, rad etilgan yoki moderatsiyadagi e'lon ham yopiladi (audit R3, employer-flows-15)
    close: v.status === "active" || v.status === "rejected" || v.status === "moderation",
    activate: (v.status === "archived" || v.status === "draft") && !v.adminLocked,
    viewApplications: v.status === "active" || v.status === "archived" || (v.applications ?? 0) > 0,
  };
}

export interface EmployerVacancyStats {
  total: number;
  /** `null` — server ariza sonini bermagan. */
  applications: number | null;
  byStatus: Record<EmployerVacancyStatus, number>;
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

/** Server bergan filtr varianti (hudud/toifa): nomi UI tilida chiziladi. */
export interface ServerFilterOption {
  slug: string;
  name: string;
  count: number;
}

export interface EmployerVacancyPage {
  items: EmployerVacancyVM[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  stats: EmployerVacancyStats;
  regions: ServerFilterOption[];
  categories: ServerFilterOption[];
}

const emptyByStatus = (): Record<EmployerVacancyStatus, number> =>
  Object.fromEntries(VACANCY_STATUSES.map((s) => [s, 0])) as Record<EmployerVacancyStatus, number>;

function filterOptions(value: unknown): ServerFilterOption[] {
  if (!Array.isArray(value)) return [];
  const out: ServerFilterOption[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const slug = str(r.slug);
    const name = str(r.name);
    if (!slug || !name) continue;
    out.push({ slug, name, count: counter(r.count) ?? 0 });
  }
  return out;
}

/** Server javobi → sahifa view-model'i. Noto'g'ri qiymatlar xavfsiz standartga tushadi. */
export function mapEmployerVacancyPage(json: Record<string, unknown>, fallbackPageSize: number): EmployerVacancyPage {
  const items = Array.isArray(json.items)
    ? json.items.map(mapEmployerVacancy).filter((v): v is EmployerVacancyVM => v !== null)
    : [];
  const counts = json.counts && typeof json.counts === "object" ? (json.counts as Record<string, unknown>) : {};
  const byStatus = emptyByStatus();
  const rawByStatus = counts.byStatus && typeof counts.byStatus === "object" ? (counts.byStatus as Record<string, unknown>) : {};
  for (const status of VACANCY_STATUSES) byStatus[status] = counter(rawByStatus[status]) ?? 0;
  const total = counter(json.total) ?? items.length;
  const pageSize = counter(json.pageSize) || fallbackPageSize;
  const filters = json.filters && typeof json.filters === "object" ? (json.filters as Record<string, unknown>) : {};

  return {
    items,
    total,
    page: counter(json.page) || 1,
    pageSize,
    pageCount: counter(json.pageCount) ?? Math.max(1, Math.ceil(total / pageSize)),
    stats: {
      total: counter(counts.total) ?? VACANCY_STATUSES.reduce((sum, s) => sum + byStatus[s], 0),
      applications: counter(counts.applications),
      byStatus,
    },
    regions: filterOptions(filters.regions),
    categories: filterOptions(filters.categories),
  };
}

/** Hudud variantlari — nomlar joriy tilda, alifbo bo'yicha. */
export function regionFilterOptions(options: ServerFilterOption[], locale: Locale): FilterOption[] {
  return options
    .map((o) => ({ value: o.slug, label: regionName(locale, o.slug, o.name), count: o.count }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

export function categoryFilterOptions(options: ServerFilterOption[], locale: Locale): FilterOption[] {
  return options
    .map((o) => ({ value: o.slug, label: CATEGORY_NAMES[locale][o.slug] || o.name, count: o.count }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}
