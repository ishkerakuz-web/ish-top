/**
 * `/articles` URL holati: `q`, `category`, `sort`, `page`. Standart qiymatlar
 * URL'ga yozilmaydi — kalit har doim bir xil chiqadi (refresh, orqaga/oldinga).
 */
import { parsePage } from "../list.js";
import { isArticleCategory, type ArticleCategory } from "./categories.js";

export const ARTICLE_SORTS = ["newest", "oldest", "popular"] as const;
export type ArticleSort = (typeof ARTICLE_SORTS)[number];

/** Grid 3 / 2 / 1 ustunda to'liq qatorlar bersin. Birinchi sahifada + katta karta. */
export const ARTICLES_PAGE_SIZE = 9;
export const ARTICLE_SEARCH_MAX = 100;

export interface ArticlesQuery {
  q: string;
  category: ArticleCategory | null;
  sort: ArticleSort;
  page: number;
}

type Search = Record<string, string | undefined>;

export function parseArticlesQuery(search: Search): ArticlesQuery {
  const sort = search.sort as ArticleSort;
  return {
    q: (search.q ?? "").replace(/\s+/g, " ").trim().slice(0, ARTICLE_SEARCH_MAX),
    category: isArticleCategory(search.category) ? search.category : null,
    sort: (ARTICLE_SORTS as readonly string[]).includes(sort) ? sort : "newest",
    page: parsePage(search.page),
  };
}

export function serializeArticlesQuery(query: ArticlesQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

export function articlesQueryKey(query: ArticlesQuery): string {
  return serializeArticlesQuery(query).toString();
}

/** Qidiruv natijalari bir xil kartalar; oddiy ro'yxatda eng tepadagi maqola katta karta bo'ladi. */
export function hasFeaturedSlot(query: ArticlesQuery): boolean {
  return !query.q;
}

export function toArticlesApiParams(query: ArticlesQuery): URLSearchParams {
  const params = serializeArticlesQuery(query);
  params.set("pageSize", String(ARTICLES_PAGE_SIZE));
  if (hasFeaturedSlot(query)) params.set("featured", "1");
  return params;
}

export function articlesHref(query: ArticlesQuery): string {
  const key = articlesQueryKey(query);
  return key ? `/articles?${key}` : "/articles";
}
