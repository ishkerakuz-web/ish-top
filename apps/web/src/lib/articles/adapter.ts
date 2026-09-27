/**
 * Maqolalar ma'lumot qatlami: backend javobi -> UI view-model.
 *
 * Qoida: bo'sh satr, `null`, `undefined`, bo'sh ro'yxat va noto'g'ri qiymat bir
 * xil "yo'q" holatiga keltiriladi; `has*` bayroqlari UI blokini chiqarish yoki
 * yashirishni hal qiladi. Hech narsa to'qib qo'shilmaydi: muqova, muallif,
 * o'qish vaqti yoki sana bo'lmasa — karta va sahifada ham yo'q ("0 daqiqa" emas).
 */
import { absoluteUploadUrl } from "../api.js";
import { isArticleCategory, type ArticleCategory } from "./categories.js";

export interface ArticleCardVM {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  category: ArticleCategory | null;
  readingMinutes: number | null;
  publishedAt: string | null;
  hasCover: boolean;
  hasExcerpt: boolean;
  hasCategory: boolean;
  hasReadingTime: boolean;
  hasDate: boolean;
}

export interface ArticleAuthorVM {
  name: string;
  position: string | null;
  avatarUrl: string | null;
  initials: string;
}

export interface ArticleDetailVM extends ArticleCardVM {
  content: string;
  tags: string[];
  updatedAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  author: ArticleAuthorVM | null;
  hasTags: boolean;
  hasAuthor: boolean;
  isPublished: boolean;
}

export interface ArticleListPage {
  items: ArticleCardVM[];
  featured: ArticleCardVM | null;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** Faqat maqolasi bor kategoriyalar (haqiqiy sonlar). */
  categories: { key: ArticleCategory; count: number }[];
  publishedTotal: number;
}

/** `render(404, …)` sababi — `_error` sahifasi maqolaga xos holatni chizadi. */
export const ARTICLE_NOT_FOUND = "article-not-found";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Muqova: yuklangan fayl (`/uploads/…` -> API manzili) yoki https. Boshqasi — yo'q. */
export function articleCoverUrl(value: unknown): string | null {
  const url = text(value);
  if (!url) return null;
  if (/^\/uploads\/[A-Za-z0-9._-]+$/.test(url)) return absoluteUploadUrl(url);
  if (/^https:\/\/[^\s"'<>]+$/i.test(url)) return url;
  return null;
}

export function authorInitials(name: string): string {
  const words = name.replace(/["'’ʻ]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0][0]).toUpperCase();
}

export function mapArticleCard(raw: unknown): ArticleCardVM | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = text(r.id);
  const slug = text(r.slug);
  const title = text(r.title);
  if (!id || !slug || !title) return null;
  const excerpt = text(r.excerpt);
  const coverUrl = articleCoverUrl(r.coverImageUrl);
  const category = isArticleCategory(r.category) ? r.category : null;
  const readingMinutes = typeof r.readingMinutes === "number" && r.readingMinutes >= 1 ? Math.round(r.readingMinutes) : null;
  const publishedAt = isoDate(r.publishedAt);
  return {
    id,
    slug,
    title,
    excerpt,
    coverUrl,
    category,
    readingMinutes,
    publishedAt,
    hasCover: coverUrl !== null,
    hasExcerpt: excerpt !== null,
    hasCategory: category !== null,
    hasReadingTime: readingMinutes !== null,
    hasDate: publishedAt !== null,
  };
}

function mapAuthor(raw: unknown): ArticleAuthorVM | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = text(r.name);
  if (!name) return null;
  return { name, position: text(r.position), avatarUrl: articleCoverUrl(r.avatarUrl), initials: authorInitials(name) };
}

/**
 * Bitta maqola (ochiq API yoki admin preview). `status` berilsa (admin) —
 * `isPublished` shundan; ochiq API faqat chop etilganlarini qaytaradi.
 */
export function mapArticleToViewModel(raw: unknown, status?: string): ArticleDetailVM | null {
  const card = mapArticleCard(raw);
  if (!card) return null;
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const tags = (Array.isArray(r.tags) ? r.tags : [])
    .map(text)
    .filter((tag): tag is string => {
      if (!tag || seen.has(tag.toLowerCase())) return false;
      seen.add(tag.toLowerCase());
      return true;
    });
  const author = mapAuthor(r.author);
  return {
    ...card,
    content: typeof r.content === "string" ? r.content : "",
    tags,
    updatedAt: isoDate(r.updatedAt),
    metaTitle: text(r.metaTitle),
    metaDescription: text(r.metaDescription),
    author,
    hasTags: tags.length > 0,
    hasAuthor: author !== null,
    isPublished: status === undefined ? card.publishedAt !== null : status === "published",
  };
}

export function mapArticleListPage(raw: unknown): ArticleListPage {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const items = (Array.isArray(r.items) ? r.items : []).map(mapArticleCard).filter((a): a is ArticleCardVM => a !== null);
  const categories = (Array.isArray(r.categories) ? r.categories : []).flatMap((c) => {
    const row = (c ?? {}) as Record<string, unknown>;
    return isArticleCategory(row.key) && count(row.count) > 0 ? [{ key: row.key, count: count(row.count) }] : [];
  });
  return {
    items,
    featured: mapArticleCard(r.featured),
    total: count(r.total),
    page: Math.max(1, count(r.page)),
    pageSize: Math.max(1, count(r.pageSize)),
    pageCount: count(r.pageCount),
    categories,
    publishedTotal: count(r.publishedTotal),
  };
}
