/** Maqola kategoriyalari — backend `ArticleCategory` enum'i bilan bir xil (nomlari i18n'da). */
export const ARTICLE_CATEGORIES = ["career", "resume", "interview", "salary", "job_search", "tips"] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export function isArticleCategory(value: unknown): value is ArticleCategory {
  return typeof value === "string" && (ARTICLE_CATEGORIES as readonly string[]).includes(value);
}
