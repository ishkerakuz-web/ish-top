/**
 * Vakansiya detail sahifasining ma'lumot qatlami: backend javobi (Prisma JSON)
 * → UI uchun toza view-model. Komponentlar faqat shu modelni biladi.
 *
 * Qoida: yo'q, bo'sh yoki noto'g'ri qiymat `null` / `[]` bo'ladi va UI o'sha
 * blokni chiqarmaydi. Hech narsa to'qib qo'shilmaydi (masalan, "Ofisda" yoki
 * standart imtiyozlar) — bazada bo'lmasa, sahifada ham yo'q.
 */
import type { EmploymentType, ExperienceLevel, ScheduleType, WorkplaceType } from "../types.js";
import { extractSkills } from "./skills.js";

/** `render(404, …)` sababi — `_error` sahifasi vakansiyaga xos "topilmadi" holatini chizadi. */
export const VACANCY_NOT_FOUND = "vacancy-not-found";

export interface VacancyCompanyVM {
  slug: string;
  name: string;
  logoUrl: string | null;
  isVerified: boolean;
  industry: string | null;
  employeeCount: string | null;
  foundedYear: number | null;
  regionSlug: string | null;
  regionName: string | null;
  description: string | null;
  /** `https://` bilan to'liq manzil; noto'g'ri bo'lsa `null`. */
  website: string | null;
  /** Tasdiqlangan sharhlar bo'lmasa `null` (reyting ko'rsatilmaydi). */
  rating: number | null;
  reviewCount: number;
  activeVacancyCount: number;
  images: string[];
}

export interface VacancySalaryVM {
  min: number | null;
  max: number | null;
  type: "gross" | "net" | null;
  /** ISO valyuta kodi (JSON-LD `baseSalary.currency`). */
  currency: string;
}

export interface VacancyDetailVM {
  id: string;
  slug: string;
  title: string;
  isPremium: boolean;
  isUrgent: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  viewsCount: number;
  /** Maosh yashirilgan yoki kiritilmagan bo'lsa `null` — element umuman chiqmaydi. */
  salary: VacancySalaryVM | null;
  experience: ExperienceLevel | null;
  employment: EmploymentType | null;
  schedule: ScheduleType | null;
  /** Ish joylashuvi. Eski e'londa maydon yo'q — bandlik turi "remote" bo'lsa masofaviy, aks holda `null`. */
  workplace: WorkplaceType | null;
  regionSlug: string | null;
  regionName: string | null;
  address: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  /** Oddiy matn (HTML teglar olib tashlangan). Bo'sh bo'lishi mumkin. */
  description: string;
  requirements: string[];
  /** Vakansiyadagi "Shartlar" — sahifada "Ish sharoitlari". */
  conditions: string[];
  /** Talablar matnidan ajratilgan ma'lum ko'nikmalar (ro'yxatdagi karta bilan bir xil manba). */
  skills: string[];
  images: string[];
  applyWithoutResume: boolean;
  contacts: { email: string | null; telegram: string | null; phone: string | null };
  company: VacancyCompanyVM;
}

const EXPERIENCE: readonly ExperienceLevel[] = ["none", "one_to_three", "three_to_six", "six_plus"];
const EMPLOYMENT: readonly EmploymentType[] = ["full_time", "part_time", "remote", "shift"];
const SCHEDULE: readonly ScheduleType[] = ["five_two", "two_two", "vahta", "gibkiy", "smenniy"];
const WORKPLACE: readonly WorkplaceType[] = ["office", "hybrid", "remote"];
const MAX_IMAGES = 24;

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/**
 * Xavfsiz matn: HTML kelsa teglar olib tashlanadi (qatorlar va ro'yxat
 * belgilari saqlanadi). Natija React orqali matn sifatida chiqadi —
 * `dangerouslySetInnerHTML` ishlatilmaydi.
 */
export function plainText(value: unknown): string {
  const text = str(value);
  if (!text) return "";
  if (!/[<&]/.test(text)) return text;
  return text
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<\/\s*(p|div|li|ul|ol|h[1-6])\s*>/gi, "\n")
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name: string) => ENTITIES[name] ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const BULLET = /^\s*(?:[-•*–·▪●✓✔]|\d{1,2}[.)])\s+/;

/** Ko'p qatorli matn → ro'yxat bandlari (belgilar olib tashlanadi, takrorlar yo'q). */
export function toItems(value: unknown): string[] {
  const text = plainText(value);
  if (!text) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const item = line.replace(BULLET, "").trim();
    const key = item.toLowerCase();
    if (item && !seen.has(key)) {
      seen.add(key);
      items.push(item);
    }
  }
  return items;
}

/** Faqat http(s) yoki `/uploads/...` kabi manzillar; takrorsiz, cheklangan soni. */
function imageList(value: unknown, resolveUrl: (path: string) => string): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const src = str(item);
    if (!src || !(/^https?:\/\//i.test(src) || src.startsWith("/"))) continue;
    const url = resolveUrl(src);
    if (!out.includes(url)) out.push(url);
    if (out.length >= MAX_IMAGES) break;
  }
  return out;
}

/** "uzum.uz" → "https://uzum.uz/"; domeni bo'lmagan qiymat → `null`. */
export function websiteUrl(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.includes(".") ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Reyting va sharhlar soni. API `company.reviewSummary` beradi (bazada agregatsiya — ro'yxat endi yuborilmaydi,
 * audit PHASE 6, U17); eski javob shaklida sharhlar ro'yxatidan hisoblanadi (moslik uchun).
 */
function ratingOf(company: { reviewSummary?: unknown; reviews?: unknown }): { rating: number | null; count: number } {
  const summary = company.reviewSummary as { count?: unknown; rating?: unknown } | null | undefined;
  if (summary && typeof summary.count === "number" && Number.isFinite(summary.count)) {
    const count = Math.max(0, Math.trunc(summary.count));
    const rating = count > 0 && typeof summary.rating === "number" && Number.isFinite(summary.rating) ? summary.rating : null;
    return { rating, count };
  }
  const reviews = company.reviews;
  const list = Array.isArray(reviews) ? reviews.filter((r) => typeof r?.rating === "number") : [];
  if (list.length === 0) return { rating: null, count: 0 };
  const sum = list.reduce((s: number, r: { rating: number }) => s + r.rating, 0);
  return { rating: Math.round((sum / list.length) * 10) / 10, count: list.length };
}

/**
 * `GET /api/vacancies/:slug` javobini view-model'ga aylantiradi.
 * `resolveUrl` — `/uploads/x.png` kabi nisbiy yo'lni API manziliga to'ldiradi.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapVacancyToViewModel(raw: any, resolveUrl: (path: string) => string): VacancyDetailVM {
  const company = raw?.company ?? {};
  const { rating, count } = ratingOf(company);
  const min = positive(raw?.salaryMin);
  const max = positive(raw?.salaryMax);
  const salaryVisible = !raw?.isSalaryHidden && Boolean(min || max);
  const requirementsText = plainText(raw?.requirements);
  const title = str(raw?.title) ?? "";

  return {
    id: String(raw?.id ?? ""),
    slug: String(raw?.slug ?? ""),
    title,
    isPremium: raw?.isPremium === true,
    isUrgent: raw?.isUrgent === true,
    publishedAt: str(raw?.publishedAt),
    expiresAt: str(raw?.expiresAt),
    viewsCount: positive(raw?.viewsCount) ?? 0,
    salary: salaryVisible ? { min, max, type: oneOf(raw?.salaryType, ["gross", "net"] as const), currency: str(raw?.currency) ?? "UZS" } : null,
    experience: oneOf(raw?.experienceRequired, EXPERIENCE),
    employment: oneOf(raw?.employmentType, EMPLOYMENT),
    schedule: oneOf(raw?.scheduleType, SCHEDULE),
    workplace: oneOf(raw?.workplaceType, WORKPLACE) ?? (raw?.employmentType === "remote" ? "remote" : null),
    regionSlug: str(raw?.region?.slug),
    regionName: str(raw?.region?.name),
    address: str(raw?.address),
    categorySlug: str(raw?.category?.slug),
    categoryName: str(raw?.category?.name),
    description: plainText(raw?.description),
    requirements: toItems(raw?.requirements),
    conditions: toItems(raw?.conditions),
    skills: extractSkills(`${title}\n${requirementsText}`, 12),
    images: imageList(raw?.images, resolveUrl),
    applyWithoutResume: raw?.applyWithoutResume === true,
    contacts: {
      email: str(raw?.contactEmail),
      telegram: str(raw?.contactTelegram)?.replace(/^@+/, "") || null,
      phone: str(raw?.contactPhone),
    },
    company: {
      slug: String(company.slug ?? ""),
      name: str(company.name) ?? "",
      logoUrl: str(company.logoUrl) ? resolveUrl(company.logoUrl.trim()) : null,
      isVerified: company.isVerified === true,
      industry: str(company.industry),
      employeeCount: str(company.employeeCount),
      foundedYear: positive(company.foundedYear),
      regionSlug: str(company.region?.slug),
      regionName: str(company.region?.name),
      description: plainText(company.description) || null,
      website: websiteUrl(company.website),
      rating,
      reviewCount: count,
      activeVacancyCount: positive(company._count?.vacancies) ?? 0,
      images: imageList(company.images, resolveUrl),
    },
  };
}

export type RichBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] };

const LIST_LINE = /^(?:([-•*–·▪●✓✔])|(\d{1,2})[.)])\s+(.+)$/;

/**
 * Tavsif matnini tuzilmaga ajratadi: bo'sh qator — yangi paragraf,
 * "- ", "• ", "1." bilan boshlangan qatorlar — ro'yxat, ":" bilan tugagan
 * qisqa qator (ortidan matn bo'lsa) — kichik sarlavha.
 */
export function parseRichText(text: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  const lines = text.split(/\r?\n/);
  let para: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join("\n") });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const bullet = LIST_LINE.exec(line);
    if (bullet) {
      flushPara();
      const kind = bullet[2] ? "ol" : "ul";
      if (!list || list.kind !== kind) {
        flushList();
        list = { kind, items: [] };
      }
      list.items.push(bullet[3].trim());
      continue;
    }
    flushList();
    const hasMore = lines.slice(i + 1).some((l) => l.trim());
    if (hasMore && line.length <= 80 && /:$/.test(line)) {
      flushPara();
      blocks.push({ kind: "h", text: line.slice(0, -1).trim() });
      continue;
    }
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}
