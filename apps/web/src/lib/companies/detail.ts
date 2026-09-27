/**
 * Ochiq kompaniya sahifasi (`/companies/:slug`) ma'lumot qatlami: backend javobi
 * → UI uchun toza view-model. Bo'sh satr, `null`, bo'sh ro'yxat — bir xil
 * "yo'q" holatiga keltiriladi va UI o'sha blokni chiqarmaydi. Hech narsa
 * to'qib qo'shilmaydi: ijtimoiy tarmoq, xarita yoki muqova rasmi bazada yo'q.
 */
import type { Vacancy } from "../types.js";
import { plainText, websiteUrl } from "../vacancies/detail.js";

/** `render(404, …)` sababi — `_error` sahifasi kompaniyaga xos holatni chizadi. */
export const COMPANY_NOT_FOUND = "company-not-found";

export interface CompanyReviewVM {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  /** Profilda ism bo'lmasa `null` — UI "Nomzod" deb yozadi. */
  authorName: string | null;
  /**
   * Audit R3, D-075: ochiq sahifada sharh muallifining `userId` si qaytarilmaydi;
   * "bu meniki" bayrog'i serverda ixtiyoriy token bo'yicha hisoblanadi.
   */
  mine: boolean;
  /** Eski javob shakli (server hali `mine` yubormasa) — moslik uchun. */
  userId: string | null;
}

/** Sharh shu foydalanuvchiniki-mi: yangi `mine` bayrog'i, bo'lmasa eski `userId`. */
export function isMyReview(review: Pick<CompanyReviewVM, "mine" | "userId">, userId: string | null | undefined): boolean {
  if (review.mine) return true;
  return Boolean(review.userId && userId && review.userId === userId);
}

export interface RatingSummary {
  /** Sharh yo'q bo'lsa `null` — reyting ko'rsatilmaydi. */
  rating: number | null;
  count: number;
  /** 5 → 1 tartibida, haqiqiy sonlar. */
  distribution: { stars: 5 | 4 | 3 | 2 | 1; count: number }[];
}

export interface CompanyDetailVM {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  isVerified: boolean;
  description: string | null;
  website: string | null;
  industry: string | null;
  /** Soha matni bo'laklarga ajratilgan ("IT · Fintech" → ["IT", "Fintech"]). */
  industries: string[];
  employeeCount: string | null;
  foundedYear: number | null;
  regionSlug: string | null;
  regionName: string | null;
  images: string[];
  reviews: CompanyReviewVM[];
  /** API `reviewSummary` — to'liq to'plam bo'yicha (ro'yxat cheklangan bo'lsa ham to'g'ri). Yo'q bo'lsa `null`. */
  reviewTotal: number | null;
  ratingAverage: number | null;
  /** Faol vakansiyalarning umumiy soni (ro'yxat cheklangan bo'lishi mumkin). */
  activeVacancyTotal: number | null;
  vacancies: Vacancy[];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const MAX_IMAGES = 40;

/** Soha erkin matn — ajratgichlar bo'yicha bo'laklanadi, birinchi harf katta. */
export function splitIndustries(value: string | null): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(/\s*[·•,;|/]\s*/)) {
    const item = part.trim();
    if (!item) continue;
    const label = item.charAt(0).toLocaleUpperCase() + item.slice(1);
    const key = label.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(label);
    }
  }
  return out.slice(0, 8);
}

/** Sharhlar ro'yxatidan reyting va taqsimot — sharh qo'shilsa/o'chirilsa qayta hisoblanadi. */
export function ratingSummary(reviews: { rating: number }[]): RatingSummary {
  const valid = reviews.filter((r) => Number.isFinite(r.rating) && r.rating >= 1 && r.rating <= 5);
  const distribution = ([5, 4, 3, 2, 1] as const).map((stars) => ({
    stars,
    count: valid.filter((r) => Math.round(r.rating) === stars).length,
  }));
  if (valid.length === 0) return { rating: null, count: 0, distribution };
  const avg = valid.reduce((sum, r) => sum + r.rating, 0) / valid.length;
  return { rating: Math.round(avg * 10) / 10, count: valid.length, distribution };
}

/**
 * Sarlavhadagi reyting va son (audit PHASE 6, U24). Ro'yxat "cheklangan"mi — serverning DASTLABKI
 * ro'yxatidan (`company.reviews` < `reviewTotal`) aniqlanadi: jonli ro'yxat bilan solishtirilsa, o'z
 * sharhini o'chirgandan keyin eski reyting va son ko'rinib qolardi.
 * - cheklanmagan → jonli ro'yxatdan (qo'shish/o'chirish darhol aks etadi);
 * - cheklangan → serverdagi o'rtacha, son esa mahalliy farq bilan (jonli − dastlabki).
 */
export function companyRatingSummary(
  company: Pick<CompanyDetailVM, "reviews" | "reviewTotal" | "ratingAverage">,
  reviews: { rating: number }[]
): RatingSummary {
  const local = ratingSummary(reviews);
  const total = company.reviewTotal;
  if (total === null || company.ratingAverage === null || company.reviews.length >= total) return local;
  const count = Math.max(0, total + reviews.length - company.reviews.length);
  return { ...local, rating: count > 0 ? company.ratingAverage : null, count };
}

/**
 * `GET /api/companies/:slug` javobi → view-model. `vacancies` — api.ts'dagi
 * umumiy vakansiya mapperidan o'tgan ro'yxat (ro'yxat kartasi bilan bir xil).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCompanyToViewModel(raw: any, options: { resolveUrl: (path: string) => string; vacancies: Vacancy[] }): CompanyDetailVM {
  const { resolveUrl, vacancies } = options;
  const industry = str(raw?.industry);
  const logo = str(raw?.logoUrl);
  const founded = typeof raw?.foundedYear === "number" && raw.foundedYear > 0 ? raw.foundedYear : null;

  const images: string[] = [];
  if (Array.isArray(raw?.images)) {
    for (const item of raw.images) {
      const src = str(item);
      if (!src || !(/^https?:\/\//i.test(src) || src.startsWith("/"))) continue;
      const url = resolveUrl(src);
      if (!images.includes(url)) images.push(url);
      if (images.length >= MAX_IMAGES) break;
    }
  }

  const reviews: CompanyReviewVM[] = Array.isArray(raw?.reviews)
    ? raw.reviews
        .filter((r: { rating?: unknown }) => typeof r?.rating === "number")
        .map((r: any) => {
          const p = r.user?.jobSeekerProfile;
          const name = [str(p?.firstName), str(p?.lastName)].filter(Boolean).join(" ");
          return {
            id: String(r.id),
            rating: r.rating,
            comment: str(r.comment),
            createdAt: String(r.createdAt ?? ""),
            authorName: name || null,
            mine: r.mine === true,
            userId: str(r.userId),
          };
        })
    : [];

  return {
    id: String(raw?.id ?? ""),
    slug: String(raw?.slug ?? ""),
    name: str(raw?.name) ?? "",
    logoUrl: logo ? resolveUrl(logo) : null,
    isVerified: raw?.isVerified === true,
    description: plainText(raw?.description) || null,
    website: websiteUrl(raw?.website),
    industry,
    industries: splitIndustries(industry),
    employeeCount: str(raw?.employeeCount),
    foundedYear: founded,
    regionSlug: str(raw?.region?.slug),
    regionName: str(raw?.region?.name),
    images,
    reviews,
    reviewTotal: typeof raw?.reviewSummary?.count === "number" ? raw.reviewSummary.count : null,
    ratingAverage: typeof raw?.reviewSummary?.rating === "number" ? raw.reviewSummary.rating : null,
    activeVacancyTotal: typeof raw?._count?.vacancies === "number" ? raw._count.vacancies : null,
    vacancies,
  };
}
