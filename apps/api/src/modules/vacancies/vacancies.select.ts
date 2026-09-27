import type { Prisma } from "@prisma/client";


/** Ochiq javob shakllari: kompaniya va vakansiya `select` ro'yxatlari, maosh yashirish, enum qiymatlar. */

type VacancySort = "relevance" | "date" | "salary_desc" | "salary_asc" | "popular";

export interface VacancyListQuery {
  text?: string;
  categorySlug?: string;
  /** Hudud slug'i yoki vergul bilan bir nechtasi (`tashkent,samarqand`). */
  area?: string;
  /** Tajriba (enum) — bitta yoki vergul bilan bir nechta. */
  experience?: string;
  /** Bandlik turi (enum) — bitta yoki vergul bilan bir nechta. */
  employment?: string;
  salary?: number;
  salaryTo?: number;
  /** Kompaniya slug'lari (vergul bilan). */
  company?: string;
  /** Faqat tasdiqlangan ish beruvchilar. */
  verified?: boolean;
  /** Faqat premium vakansiyalar. */
  premium?: boolean;
  /** Faqat shu vaqtdan keyin chop etilganlar (obuna xabarnomalari uchun, URL'dan kelmaydi). */
  publishedAfter?: Date;
  /** Faqat shu vaqtgacha (shu jumladan) chop etilganlar — obuna aylanishining yuqori chegarasi, URL'dan kelmaydi (audit PHASE 6, V6). */
  publishedBefore?: Date;
  sort?: VacancySort;
  page?: number;
  pageSize?: number;
}

/**
 * Ochiq javoblardagi kompaniya kartasi — faqat ko'rsatiladigan maydonlar. Ilgari `company: true`
 * egasining ID'si, STIR, yuridik nom va tarif maydonlarini mehmonga ham qaytarardi (audit ISSUE-032).
 */
const PUBLIC_COMPANY_CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  isVerified: true,
  industry: true,
} as const satisfies Prisma.CompanySelect;

/** Kompaniya va vakansiya sahifasidagi ochiq profil (ichki maydonlarsiz). */
export const PUBLIC_COMPANY_SELECT = {
  ...PUBLIC_COMPANY_CARD_SELECT,
  description: true,
  website: true,
  employeeCount: true,
  foundedYear: true,
  images: true,
  regionId: true,
  createdAt: true,
  region: { select: { id: true, name: true, slug: true } },
} as const satisfies Prisma.CompanySelect;

/**
 * Ro'yxat kartasi (qidiruv, bosh sahifa, o'xshashlar, kompaniya sahifasi). To'liq tavsif va shartlar
 * faqat detail sahifada; talablar kartadagi ko'nikma belgilarini ajratish uchun qoldirilgan (audit ISSUE-048).
 */
export const VACANCY_CARD_SELECT = {
  id: true,
  companyId: true,
  title: true,
  slug: true,
  requirements: true,
  categoryId: true,
  regionId: true,
  employmentType: true,
  scheduleType: true,
  workplaceType: true,
  experienceRequired: true,
  salaryMin: true,
  salaryMax: true,
  currency: true,
  salaryType: true,
  isSalaryHidden: true,
  applyWithoutResume: true,
  status: true,
  isUrgent: true,
  isPremium: true,
  publishedAt: true,
  expiresAt: true,
  viewsCount: true,
  createdAt: true,
  updatedAt: true,
  company: { select: PUBLIC_COMPANY_CARD_SELECT },
  region: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
} as const satisfies Prisma.VacancySelect;

/**
 * Ochiq vakansiya sahifasi — aniq maydonlar ro'yxati (audit R3, gap4-3).
 *
 * Ilgari `include` ishlatilardi, ya'ni Vacancy'ning BARCHA maydonlari mehmonga ham chiqardi:
 * jumladan ichki moderator izohi `rejectionReason` va `adminArchivedAt`. Endi ro'yxat aniq,
 * shuning uchun kelajakda qo'shiladigan ichki maydon ham avtomatik ochilmaydi.
 */
export const VACANCY_DETAIL_SELECT = {
  id: true,
  companyId: true,
  title: true,
  slug: true,
  description: true,
  requirements: true,
  conditions: true,
  categoryId: true,
  regionId: true,
  address: true,
  latitude: true,
  longitude: true,
  images: true,
  employmentType: true,
  scheduleType: true,
  workplaceType: true,
  experienceRequired: true,
  salaryMin: true,
  salaryMax: true,
  currency: true,
  salaryType: true,
  isSalaryHidden: true,
  applyWithoutResume: true,
  contactEmail: true,
  contactTelegram: true,
  contactPhone: true,
  status: true,
  isUrgent: true,
  isPremium: true,
  publishedAt: true,
  expiresAt: true,
  viewsCount: true,
  createdAt: true,
  updatedAt: true,
  company: {
    select: {
      ...PUBLIC_COMPANY_SELECT,
      // "Kompaniyaning boshqa vakansiyalari" havolasi uchun
      _count: { select: { vacancies: { where: { status: "active" as const } } } },
    },
  },
  region: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
} as const satisfies Prisma.VacancySelect;

/**
 * Yashirilgan maosh raqamlari ochiq javobga chiqmaydi — faqat frontend yashirishiga tayanilmaydi
 * (audit ISSUE-033). Ish beruvchining o'z endpointlarida raqamlar qoladi (tahrirlash formasi).
 */
export function withPublicSalary<T extends { isSalaryHidden: boolean; salaryMin: number | null; salaryMax: number | null }>(
  vacancy: T
): T {
  return vacancy.isSalaryHidden ? { ...vacancy, salaryMin: null, salaryMax: null } : vacancy;
}

export const EXPERIENCE_VALUES = ["none", "one_to_three", "three_to_six", "six_plus"] as const;
export const EMPLOYMENT_VALUES = ["full_time", "part_time", "remote", "shift"] as const;

/**
 * "a, b,a" → ["a", "b"]. `allowed` berilsa noma'lum qiymatlar tashlanadi
 * (ilgari noto'g'ri enum Prisma xatosiga — 500 ga olib kelardi).
 */
export function splitList(value: string | undefined, allowed?: readonly string[]): string[] {
  if (!value) return [];
  const list = [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 50);
  return allowed ? list.filter((v) => allowed.includes(v)) : list;
}
