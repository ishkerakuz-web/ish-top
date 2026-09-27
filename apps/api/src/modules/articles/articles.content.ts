/**
 * Maqola matni bilan ishlash (server tomoni): o'qish vaqti, qidiruv matni,
 * teglar va slug.
 *
 * Matn — Markdown'ning cheklangan to'plami. Web uni o'z parseri bilan React
 * elementlariga aylantiradi (lib/articles/content.ts), HTML sifatida hech
 * qayerda ishlanmaydi — shuning uchun serverda "tozalash" kerak emas, faqat
 * hosila maydonlar hisoblanadi.
 */
import type { ArticleCategory } from "@prisma/client";
import { slugifyText } from "../../common/slug.js";

export const ARTICLE_CATEGORIES = ["career", "resume", "interview", "salary", "job_search", "tips"] as const satisfies readonly ArticleCategory[];

/**
 * Kategoriya nomlari uch tilda — FAQAT qidiruv uchun: "rezyume" yoki "резюме"
 * deb yozilsa, shu kategoriyadagi maqolalar ham topiladi. Sahifadagi yozuvlar
 * web i18n'da.
 */
const CATEGORY_WORDS: Record<ArticleCategory, string> = {
  career: "karyera karera карьера career",
  resume: "rezyume rezume резюме resume cv",
  interview: "suhbat intervyu собеседование интервью interview",
  salary: "maosh ish haqi зарплата salary",
  job_search: "ish topish ish qidirish поиск работы job search",
  tips: "maslahatlar maslahat советы tips",
};

const WORDS_PER_MINUTE = 200;
/** Ko'rib chiqishga yuborish va chop etish uchun matnning eng kam hajmi (oddiy matn belgilari). */
export const MIN_PUBLISH_CHARS = 200;
export const MAX_TAGS = 10;

/** Muqova: yuklangan fayl (`/uploads/…`) yoki tashqi https rasm. */
export const COVER_URL_RE = /^(\/uploads\/[A-Za-z0-9._-]+|https:\/\/[^\s"'<>]+)$/;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** O'zbekcha apostrof variantlari (ʻ ’ ‘ `) va bo'shliqlar bir xil qidirilsin (web lib/list.ts bilan bir xil). */
export function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[ʻʼ’‘`]/g, "'").replace(/\s+/g, " ").trim();
}

export function searchWords(q: string): string[] {
  return normalizeSearch(q).split(" ").filter(Boolean).slice(0, 8);
}

/** Markdown belgilarisiz oddiy matn — o'qish vaqti va hajm tekshiruvi uchun. */
export function markdownToPlainText(content: string): string {
  return content
    .replace(/^\s*>\s*\[![a-z]+\]\s*$/gim, " ")
    .replace(/^\s*!\[[^\]]*\]\([^)]*\)\s*$/gm, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/^\s*(-{3,}|\*{3,})\s*$/gm, " ")
    .replace(/(\*\*|__|\*|`)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Daqiqa, yuqoriga yumaloqlangan. Matn bo'sh bo'lsa `null` — "0 daqiqa" hech qachon chiqmaydi. */
export function readingMinutes(content: string): number | null {
  const plain = markdownToPlainText(content);
  if (!plain) return null;
  const words = plain.split(" ").length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export function hasEnoughContent(content: string): boolean {
  return markdownToPlainText(content).length >= MIN_PUBLISH_CHARS;
}

/** Bo'shliqlar tekislanadi, registrsiz takrorlar olib tashlanadi, eng ko'pi 10 ta. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.replace(/\s+/g, " ").trim().slice(0, 40);
    const key = normalizeSearch(tag);
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 90 && SLUG_RE.test(slug);
}

/** Sarlavhadan SEO slug: "Rezyume qanday yoziladi?" -> "rezyume-qanday-yoziladi". */
export function articleSlug(title: string): string {
  return slugifyText(title).slice(0, 80).replace(/-+$/, "");
}

/** Saqlashda hisoblanadigan hosila maydonlar. */
export function articleDerived(input: {
  title: string;
  excerpt: string | null;
  content: string;
  tags: string[];
  category: ArticleCategory | null;
}): { readingMinutes: number | null; searchText: string } {
  return {
    readingMinutes: readingMinutes(input.content),
    searchText: normalizeSearch(
      [input.title, input.excerpt ?? "", input.tags.join(" "), input.category ? CATEGORY_WORDS[input.category] : ""].join(" ")
    ),
  };
}
