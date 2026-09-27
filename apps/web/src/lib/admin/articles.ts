import { adminRequest } from "./http.js";
import type { ArticleCategory } from "../articles/categories.js";

export const ARTICLE_STATUSES = ["draft", "in_review", "published", "archived"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export type ArticleTransition = "submit" | "return" | "publish" | "unpublish" | "archive" | "restore";
/** Server hisoblagan ruxsatlar — UI faqat `true` bo'lgan amallarni chizadi. */
export type AdminArticlePermissions = Record<"edit" | ArticleTransition | "delete", boolean>;

export interface AdminArticleAuthor {
  id: string;
  name: string;
  position: string | null;
  avatarUrl: string | null;
}

export interface AdminArticleListItem {
  id: string;
  title: string;
  slug: string;
  status: ArticleStatus;
  category: ArticleCategory | null;
  coverImageUrl: string | null;
  readingMinutes: number | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  author: AdminArticleAuthor | null;
  permissions: AdminArticlePermissions;
}

export interface AdminArticleDetail extends AdminArticleListItem {
  excerpt: string | null;
  content: string;
  tags: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  previousSlugs: string[];
  stats: { views: number; helpfulYes: number; helpfulNo: number };
}

export interface AdminArticlesPage {
  items: AdminArticleListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  counts: Record<"all" | ArticleStatus, number>;
}

export interface AdminArticleInput {
  title: string;
  slug?: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  category: ArticleCategory | null;
  tags: string[];
  authorId?: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  intent?: "draft" | "review" | "publish";
}

export interface StaffAuthorOption {
  id: string;
  name: string;
  position: string | null;
  role: string;
}

export function fetchAdminArticles(
  token: string,
  params: { q?: string; status?: ArticleStatus | null; page?: number },
  signal?: AbortSignal
) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.status) qs.set("status", params.status);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const suffix = qs.toString() ? `?${qs}` : "";
  return adminRequest<AdminArticlesPage>(`/api/admin/articles${suffix}`, { token, signal });
}

export function fetchAdminArticle(token: string, id: string, signal?: AbortSignal) {
  return adminRequest<AdminArticleDetail>(`/api/admin/articles/${encodeURIComponent(id)}`, { token, signal });
}

export function createAdminArticle(token: string, input: AdminArticleInput) {
  return adminRequest<AdminArticleDetail>("/api/admin/articles", { token, method: "POST", body: input });
}

export function updateAdminArticle(token: string, id: string, input: AdminArticleInput) {
  return adminRequest<AdminArticleDetail>(`/api/admin/articles/${encodeURIComponent(id)}`, { token, method: "PUT", body: input });
}

export function transitionAdminArticle(token: string, id: string, action: ArticleTransition, note?: string) {
  return adminRequest<AdminArticleDetail>(`/api/admin/articles/${encodeURIComponent(id)}/${action}`, {
    token,
    method: "POST",
    body: note ? { note } : {},
  });
}

export function deleteAdminArticle(token: string, id: string) {
  return adminRequest<{ ok: true }>(`/api/admin/articles/${encodeURIComponent(id)}`, { token, method: "DELETE" });
}

export function fetchArticleAuthors(token: string, signal?: AbortSignal) {
  return adminRequest<{ items: StaffAuthorOption[] }>("/api/admin/articles/authors", { token, signal });
}

export function uploadArticleCover(token: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return adminRequest<{ url: string }>("/api/admin/articles/cover", { token, method: "POST", form });
}
