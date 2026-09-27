import { render } from "vike/abort";
import { fetchArticlePage } from "../../../lib/articles/api.js";
import type { ArticleListPage } from "../../../lib/articles/adapter.js";
import { articlesQueryKey, parseArticlesQuery } from "../../../lib/articles/query.js";
import type { ArticlesPageData } from "../../../lib/articles/useArticleList.js";

/**
 * Ro'yxat server tomonda — sahifa qidiruv tizimlariga tayyor maqolalar bilan
 * boradi. Filtr/sahifa o'zgarganda Vike shu hookni qayta chaqiradi.
 * `page: null` — server javob bermadi (xato holati, brauzer qayta urinadi).
 *
 * Fayllar `articles/index/` da: `articles/+Head.tsx` bo'lganda Vike uni
 * `/articles/:slug` ga ham meros qilib, maqola sahifasida ikkinchi og/description chiqardi.
 */
export async function data(pageContext: {
  urlParsed: { search: Record<string, string> };
  isClientSideNavigation?: boolean;
}): Promise<ArticlesPageData> {
  const query = parseArticlesQuery(pageContext.urlParsed.search);
  const page = await fetchArticlePage(query).catch((): ArticleListPage | null => null);
  // SSR'da ro'yxat kelmasa 503 — indekslanadigan "yuklab bo'lmadi" sahifasi
  // bo'lmasin (audit R3, seo-3). Brauzer ichidagi navigatsiyada eski yo'l.
  if (!page && !pageContext.isClientSideNavigation) throw render(503);
  return { key: articlesQueryKey(query), page };
}
