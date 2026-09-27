/**
 * Yordam markazi kontenti. Savollar lug'atda (mavjud arxitektura, uch tilda) —
 * bu yerda UI uchun view-model'ga keltiriladi. Savol yoki javobi bo'sh yozuv
 * tashlab yuboriladi (buzilgan accordion chizilmaydi), noma'lum kategoriya `null`,
 * savoli yo'q kategoriya kartasi umuman chiqmaydi. Sonlar — haqiqiy savollar soni.
 */
import type { Messages } from "../i18n/messages.js";
import type { SupportCategoryKey } from "../i18n/types.js";
import { normalizeSearch, searchWords } from "../list.js";
import { inlineText, parseInline, type Inline } from "../articles/content.js";

export const SUPPORT_CATEGORIES: readonly SupportCategoryKey[] = [
  "account",
  "resume",
  "applications",
  "companies",
  "payments",
  "security",
  "technical",
  "other",
];

export function isSupportCategory(value: unknown): value is SupportCategoryKey {
  return typeof value === "string" && (SUPPORT_CATEGORIES as readonly string[]).includes(value);
}

export interface SupportItemVM {
  id: string;
  category: SupportCategoryKey | null;
  question: string;
  /** Paragraflar. `[matn](/yo'l)` havolalari xavfsiz ajratilgan (javascript:, //host — matn bo'lib qoladi). */
  answer: Inline[][];
  answerText: string;
  searchText: string;
}

export interface SupportCategoryVM {
  key: SupportCategoryKey;
  title: string;
  description: string;
  count: number;
}

type SupportMessages = Messages["support"];

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function mapSupportItemToViewModel(raw: unknown, index: number, messages: SupportMessages): SupportItemVM | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const question = text(r.q);
  const source = text(r.a);
  if (!question || !source) return null;
  const answer = source
    .split(/\n\s*\n/)
    .map((paragraph) => parseInline(paragraph.replace(/\s+/g, " ").trim()))
    .filter((paragraph) => inlineText(paragraph).trim() !== "");
  if (answer.length === 0) return null;
  const answerText = answer.map(inlineText).join(" ");
  const category = isSupportCategory(r.category) ? r.category : null;
  const keywords = Array.isArray(r.keywords) ? r.keywords.filter((k): k is string => typeof k === "string") : [];
  const id = text(r.id).replace(/[^a-z0-9-]/gi, "").toLowerCase() || `savol-${index + 1}`;
  return {
    id,
    category,
    question,
    answer,
    answerText,
    searchText: normalizeSearch([question, answerText, category ? messages.categories[category]?.title ?? "" : "", ...keywords].join(" ")),
  };
}

export function mapSupportCategoryToViewModel(key: SupportCategoryKey, messages: SupportMessages, items: SupportItemVM[]): SupportCategoryVM | null {
  const count = items.filter((item) => item.category === key).length;
  const meta = messages.categories[key];
  if (count === 0 || !meta?.title?.trim()) return null;
  return { key, title: meta.title, description: meta.description?.trim() ?? "", count };
}

export function buildSupportContent(messages: SupportMessages): { items: SupportItemVM[]; categories: SupportCategoryVM[] } {
  const seen = new Set<string>();
  const items: SupportItemVM[] = [];
  (Array.isArray(messages.faq) ? messages.faq : []).forEach((raw, i) => {
    const item = mapSupportItemToViewModel(raw, i, messages);
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  });
  const categories = SUPPORT_CATEGORIES.map((key) => mapSupportCategoryToViewModel(key, messages, items)).filter(
    (category): category is SupportCategoryVM => category !== null
  );
  return { items, categories };
}

/** Har bir so'z savol, javob, kategoriya nomi yoki kalit so'zlarda bo'lishi kerak. */
export function filterSupportItems(items: SupportItemVM[], q: string, category: SupportCategoryKey | null): SupportItemVM[] {
  const words = searchWords(q);
  return items.filter((item) => (!category || item.category === category) && words.every((word) => item.searchText.includes(word)));
}

/** Tezkor so'zlar — faqat haqiqiy savollar ichida natija beradiganlari. */
export function supportSuggestions(terms: string[], items: SupportItemVM[]): string[] {
  return terms.filter((term, i) => term.trim() !== "" && terms.indexOf(term) === i && filterSupportItems(items, term, null).length > 0);
}
