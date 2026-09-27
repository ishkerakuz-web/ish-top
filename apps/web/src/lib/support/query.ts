import type { SupportCategoryKey } from "../i18n/types.js";
import { isSupportCategory } from "./faq.js";

/** `/support` holati URL'da: `?q=` (qidiruv) va `?category=` (kategoriya filtri). */
export const SUPPORT_SEARCH_MAX = 100;

export interface SupportQuery {
  q: string;
  category: SupportCategoryKey | null;
}

type Source = URLSearchParams | Record<string, string | undefined>;

const read = (source: Source, key: string) => (source instanceof URLSearchParams ? source.get(key) : source[key]) ?? "";

export function parseSupportQuery(source: Source): SupportQuery {
  const q = read(source, "q").replace(/\s+/g, " ").trim().slice(0, SUPPORT_SEARCH_MAX);
  const category = read(source, "category");
  return { q, category: isSupportCategory(category) ? category : null };
}

export function supportSearch(query: SupportQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  const search = params.toString();
  return search ? `?${search}` : "";
}
