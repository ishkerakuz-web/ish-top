import { Company, CompanyReviewItem, Vacancy } from "../types.js";
import { absoluteUploadUrl } from "./core.js";
import { extractSkills } from "../vacancies/skills.js";
/** Server javobini (Prisma JSON) frontend tiplariga o'giruvchilar. */

// ---------------------------------------------------------
// Mapperlar (Prisma JSON -> frontend tiplari)
// ---------------------------------------------------------

export function avgRating(reviews: unknown): { rating: number; count: number } {
  const list = Array.isArray(reviews) ? (reviews as { rating: number }[]) : [];
  if (list.length === 0) return { rating: 0, count: 0 };
  const sum = list.reduce((s, r) => s + (r.rating ?? 0), 0);
  return { rating: Math.round((sum / list.length) * 10) / 10, count: list.length };
}

export function mapVacancy(raw: any, companyFallback?: { name: string; slug: string }): Vacancy {
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    companyName: raw.company?.name ?? companyFallback?.name ?? "",
    companySlug: raw.company?.slug ?? companyFallback?.slug ?? "",
    regionName: raw.region?.name ?? null,
    salaryMin: raw.salaryMin ?? null,
    salaryMax: raw.salaryMax ?? null,
    currency: raw.currency ?? "UZS",
    isSalaryHidden: raw.isSalaryHidden ?? false,
    employmentType: raw.employmentType ?? "full_time",
    experienceRequired: raw.experienceRequired ?? "none",
    isPremium: raw.isPremium ?? false,
    isUrgent: raw.isUrgent ?? false,
    publishedAt: raw.publishedAt ?? null,
    companyLogoUrl: raw.company?.logoUrl ? absoluteUploadUrl(raw.company.logoUrl) : null,
    companyVerified: Boolean(raw.company?.isVerified),
    regionSlug: raw.region?.slug ?? null,
    categoryName: raw.category?.name ?? null,
    scheduleType: raw.scheduleType ?? null,
    // Eski e'lonlarda maydon yo'q — bandlik turi "remote" bo'lsa masofaviy, aks holda noma'lum (ko'rsatilmaydi)
    workplaceType: raw.workplaceType ?? (raw.employmentType === "remote" ? "remote" : null),
    skills: extractSkills(`${raw.title ?? ""}\n${raw.requirements ?? ""}`),
  };
}

export function mapCompany(raw: any): Company {
  // Katalog (`GET /api/companies`) ko'rsatkichlarni serverda hisoblab beradi;
  // kompaniya sahifasi (`/api/companies/:slug`) esa sharh va vakansiyalar ro'yxatini.
  const fromList = typeof raw.reviewCount === "number";
  // Kompaniya sahifasi javobidagi ro'yxatlar cheklangan — to'liq to'plam bo'yicha son va reyting `reviewSummary`da
  const summary = raw.reviewSummary && typeof raw.reviewSummary.count === "number" ? raw.reviewSummary : null;
  const { rating, count } = fromList
    ? { rating: raw.rating ?? 0, count: raw.reviewCount }
    : summary
      ? { rating: summary.rating ?? 0, count: summary.count }
      : avgRating(raw.reviews);
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    description: raw.description ?? "",
    logoUrl: raw.logoUrl ? absoluteUploadUrl(raw.logoUrl) : null,
    regionName: raw.region?.name ?? null,
    industry: raw.industry ?? null,
    employeeCount: raw.employeeCount ?? null,
    foundedYear: raw.foundedYear ?? null,
    rating,
    reviewCount: count,
    isVerified: raw.isVerified ?? false,
    activeVacancyCount: fromList
      ? raw.activeVacancyCount ?? 0
      : typeof raw._count?.vacancies === "number"
        ? raw._count.vacancies
        : Array.isArray(raw.vacancies)
        ? raw.vacancies.length
        : 0,
  };
}

export function mapReview(raw: any): CompanyReviewItem {
  const p = raw.user?.jobSeekerProfile;
  const authorName = [p?.firstName, p?.lastName].filter(Boolean).join(" ") || "Nomzod";
  return {
    id: raw.id,
    rating: raw.rating,
    comment: raw.comment ?? null,
    createdAt: raw.createdAt,
    authorName,
    userId: raw.userId,
  };
}
