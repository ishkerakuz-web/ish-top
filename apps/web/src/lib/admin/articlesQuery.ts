import { parsePage } from "../list.js";
import { ARTICLE_STATUSES, type ArticleStatus } from "./articles.js";

/** `/admin/articles` URL holati: qidiruv, holat filtri, sahifa. */
export interface AdminArticlesQuery {
  q: string;
  status: ArticleStatus | null;
  page: number;
}

type Search = Record<string, string | undefined>;

export function parseAdminArticlesQuery(source: URLSearchParams | Search): AdminArticlesQuery {
  const get = (key: string) => (source instanceof URLSearchParams ? source.get(key) ?? undefined : source[key]);
  const status = get("status");
  return {
    q: (get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    status: (ARTICLE_STATUSES as readonly string[]).includes(status ?? "") ? (status as ArticleStatus) : null,
    page: parsePage(get("page")),
  };
}

export function adminArticlesSearch(query: AdminArticlesQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.page > 1) params.set("page", String(query.page));
  const str = params.toString();
  return str ? `?${str}` : "";
}
