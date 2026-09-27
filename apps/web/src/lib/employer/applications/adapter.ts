/**
 * `GET /api/employer/applications` (ro'yxat qatori) va `GET /api/employer/applications/:id`
 * (to'liq tafsilot) javoblari → "Murojaatlar" view-model'i.
 *
 * Audit R3 (D-061): qidiruv, filtr, sahifalash va holat sonlari SERVER tomonida. Ro'yxat qatori
 * yengil (rezyume, ariza xati, holat tarixi va aloqa ma'lumoti yo'q) — ular ariza tanlanganda
 * tafsilot so'rovi bilan keladi.
 *
 * Qoida: bo'sh yoki noto'g'ri qiymat `null` bo'ladi va UI o'sha qismni chizmaydi —
 * telefon, hudud, rezyume, ariza xati, maosh yoki tarix to'qib qo'yilmaydi.
 * Ariza (holat, sana, xat, tarix) va nomzod (ism, aloqa) alohida tushunchalar:
 * holat — arizaga tegishli, nomzodga emas.
 */
import { absoluteUploadUrl } from "../../api.js";
import type { Locale } from "../../i18n/config.js";
import { REGIONS, regionName } from "../../i18n/regions.js";
import type { ApplicationStatus, EmploymentType, WorkplaceType } from "../../types.js";

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = ["sent", "viewed", "invited", "accepted", "rejected"];
/** Ish beruvchi qo'ya oladigan holatlar (backend `statusSchema`). "sent" — faqat boshlang'ich holat. */
export const SETTABLE_STATUSES = ["viewed", "invited", "accepted", "rejected"] as const;
export type SettableStatus = (typeof SETTABLE_STATUSES)[number];

const EMPLOYMENT: readonly EmploymentType[] = ["full_time", "part_time", "remote", "shift"];
const WORKPLACE: readonly WorkplaceType[] = ["office", "hybrid", "remote"];

/** Ism yo'q bo'lsa (profil to'ldirilmagan) — tire; email ro'yxatda yuborilmaydi. */
const NO_NAME = "—";

export interface NamedPlace {
  name: string;
  slug: string | null;
}

export interface ApplicationResumeVM {
  title: string | null;
  summary: string | null;
  desiredSalary: number | null;
  skills: string[];
  experience: { companyName: string; position: string; startDate: string | null; endDate: string | null; isCurrent: boolean; description: string | null }[];
  education: { institution: string; degree: string | null; field: string | null; startYear: number | null; endYear: number | null }[];
}

export interface ApplicationHistoryVM {
  from: ApplicationStatus | null;
  to: ApplicationStatus;
  at: string;
}

export interface EmployerApplicationVM {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  /** Tafsilot (rezyume, xat, tarix, aloqa) yuklanganmi — ro'yxat qatorida `false`. */
  detailed: boolean;
  source: "site" | "telegram";
  coverLetter: string | null;
  /** Arizaga rezyume biriktirilgan. */
  hasResume: boolean;
  /** Nomzodning PDF rezyume fayli bor — manzil emas, bayroq (audit R3, D-058). */
  hasResumeFile: boolean;
  candidate: {
    userId: string;
    /** Ism-familiya; profil bo'lmasa — tire. */
    name: string;
    headline: string | null;
    email: string | null;
    phone: string | null;
    region: NamedPlace | null;
    avatarUrl: string | null;
    isOpenToWork: boolean;
  };
  vacancy: {
    id: string;
    slug: string | null;
    title: string;
    status: string | null;
    region: NamedPlace | null;
    employmentType: EmploymentType | null;
    /** Eski e'londa maydon yo'q: bandlik turi "remote" bo'lsa masofaviy, aks holda `null`. */
    workplaceType: WorkplaceType | null;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryHidden: boolean;
    applicationCount: number | null;
  };
  resume: ApplicationResumeVM | null;
  history: ApplicationHistoryVM[];
}

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const positive = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null);
const count = (value: unknown): number | null => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null);
const iso = (value: unknown): string | null => {
  const s = str(value);
  return s && !Number.isNaN(Date.parse(s)) ? s : null;
};
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
const place = (value: unknown): NamedPlace | null => {
  const r = obj(value);
  const name = r ? str(r.name) : null;
  return r && name ? { name, slug: str(r.slug) } : null;
};
const avatar = (value: unknown): string | null => {
  const src = str(value);
  return src && (src.startsWith("/") || /^https?:\/\//i.test(src)) ? absoluteUploadUrl(src) : null;
};

function mapResume(value: unknown): ApplicationResumeVM | null {
  const r = obj(value);
  if (!r) return null;
  const list = (v: unknown) => (Array.isArray(v) ? v.map(obj).filter((x): x is Raw => x !== null) : []);
  return {
    title: str(r.title),
    summary: str(r.summary),
    desiredSalary: positive(r.desiredSalary),
    skills: [...new Set(list(r.skills).map((s) => str(s.skillName)).filter((s): s is string => Boolean(s)))],
    experience: list(r.experience).flatMap((e) => {
      const position = str(e.position);
      const companyName = str(e.companyName);
      return position || companyName
        ? [{ position: position ?? "", companyName: companyName ?? "", startDate: iso(e.startDate), endDate: iso(e.endDate), isCurrent: e.isCurrent === true, description: str(e.description) }]
        : [];
    }),
    education: list(r.education).flatMap((e) => {
      const institution = str(e.institution);
      return institution
        ? [{ institution, degree: str(e.degree), field: str(e.field), startYear: positive(e.startYear), endYear: positive(e.endYear) }]
        : [];
    }),
  };
}

/** Ro'yxat qatori va tafsilot uchun umumiy qism; `detailed` — tafsilot maydonlari bor-yo'qligi. */
function mapCommon(r: Raw, detailed: boolean): EmployerApplicationVM | null {
  const id = str(r.id);
  const status = oneOf(r.status, APPLICATION_STATUSES);
  const createdAt = iso(r.createdAt);
  const vacancyRaw = obj(r.vacancy);
  const vacancyId = vacancyRaw ? str(vacancyRaw.id) : null;
  const vacancyTitle = vacancyRaw ? str(vacancyRaw.title) : null;
  const candidateRaw = obj(r.candidate);
  const userId = candidateRaw ? str(candidateRaw.userId) ?? str(r.jobSeekerId) : str(r.jobSeekerId);
  if (!id || !status || !createdAt || !vacancyRaw || !vacancyId || !vacancyTitle || !candidateRaw || !userId) return null;

  const employmentType = oneOf(vacancyRaw.employmentType, EMPLOYMENT);
  return {
    id,
    status,
    createdAt,
    detailed,
    source: r.source === "telegram" ? "telegram" : "site",
    coverLetter: str(r.coverLetter),
    hasResume: r.hasResume === true,
    hasResumeFile: r.hasResumeFile === true,
    candidate: {
      userId,
      name: str(candidateRaw.name) ?? NO_NAME,
      headline: str(candidateRaw.headline),
      email: str(candidateRaw.email),
      phone: str(candidateRaw.phone),
      region: place(candidateRaw.region),
      avatarUrl: avatar(candidateRaw.avatarUrl),
      isOpenToWork: candidateRaw.isOpenToWork === true,
    },
    vacancy: {
      id: vacancyId,
      slug: str(vacancyRaw.slug),
      title: vacancyTitle,
      status: str(vacancyRaw.status),
      region: place(vacancyRaw.region),
      employmentType,
      workplaceType: oneOf(vacancyRaw.workplaceType, WORKPLACE) ?? (employmentType === "remote" ? "remote" : null),
      salaryMin: positive(vacancyRaw.salaryMin),
      salaryMax: positive(vacancyRaw.salaryMax),
      salaryHidden: vacancyRaw.isSalaryHidden === true,
      applicationCount: count(vacancyRaw.applicationCount),
    },
    resume: mapResume(r.resume),
    history: (Array.isArray(r.statusHistory) ? r.statusHistory : []).flatMap((h) => {
      const row = obj(h);
      const to = row ? oneOf(row.newStatus, APPLICATION_STATUSES) : null;
      const at = row ? iso(row.createdAt) : null;
      return row && to && at ? [{ from: oneOf(row.oldStatus, APPLICATION_STATUSES), to, at }] : [];
    }),
  };
}

/** Ro'yxat qatori (yengil javob). */
export function mapEmployerApplicationRow(raw: unknown): EmployerApplicationVM | null {
  const r = obj(raw);
  return r ? mapCommon(r, false) : null;
}

/** To'liq tafsilot (`/api/employer/applications/:id`). */
export function mapEmployerApplicationDetail(raw: unknown): EmployerApplicationVM | null {
  const r = obj(raw);
  return r ? mapCommon(r, true) : null;
}

export function initials(name: string): string {
  const words = name.replace(/["'’ʻ@.]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}

export function regionLabel(region: NamedPlace | null, locale: Locale): string | null {
  if (!region) return null;
  return region.slug ? regionName(locale, region.slug, region.name) : region.name;
}

export type StatusCounts = Record<"all" | ApplicationStatus, number>;

const ZERO_COUNTS: StatusCounts = { all: 0, sent: 0, viewed: 0, invited: 0, accepted: 0, rejected: 0 };

/** Server bergan holat sonlari; yetishmagan qiymat — 0 (soni to'qib qo'yilmaydi). */
export function mapStatusCounts(raw: unknown): StatusCounts {
  const r = obj(raw);
  if (!r) return { ...ZERO_COUNTS };
  const value = (key: keyof StatusCounts) => count(r[key]) ?? 0;
  return { all: value("all"), sent: value("sent"), viewed: value("viewed"), invited: value("invited"), accepted: value("accepted"), rejected: value("rejected") };
}

export interface FilterOption {
  value: string;
  label: string;
  /** Faqat server bergan sonlar; hudud ro'yxatida son yo'q. */
  count?: number;
}

/** Filtr variantlari — server qaytargan (ariza kelgan) vakansiyalar. */
export function mapVacancyOptions(raw: unknown): FilterOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((item) => {
      const r = obj(item);
      const value = r ? str(r.id) : null;
      const label = r ? str(r.title) : null;
      return r && value && label ? [{ value, label, count: count(r.count) ?? 0 }] : [];
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Hudud variantlari — statik katalog (server ro'yxat bo'yicha hudud sonini hisoblamaydi). */
export function regionFilterOptions(locale: Locale): FilterOption[] {
  return REGIONS.map((region) => ({ value: region.slug, label: regionName(locale, region.slug, region.slug) })).sort((a, b) =>
    a.label.localeCompare(b.label, locale)
  );
}
