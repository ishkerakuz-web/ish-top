import { redirect, render } from "vike/abort";
import { ApiError } from "../../../lib/api.js";
import { fetchArticleDetail } from "../../../lib/articles/api.js";
import { ARTICLE_NOT_FOUND } from "../../../lib/articles/adapter.js";
import type { ArticleDetailData } from "../../../lib/articles/useArticleDetail.js";
import { DEFAULT_LOCALE, isLocale, localizeHref } from "../../../lib/i18n/config.js";

/**
 * Bitta maqola. Topilmasa (yoki chop etilmagan) — haqiqiy 404; eski slug —
 * yangi manzilga 301.
 *
 * API javob bermasa SSR 503 qaytaradi (audit R3, seo-2 / api-errors-1) —
 * 200 + `noindex` chop etilgan maqolani indeksdan chiqarib yuborardi. Brauzer
 * ichidagi navigatsiyada `article: null` va "Qayta urinish" holati saqlanadi.
 */
export async function data(pageContext: {
  routeParams: { slug: string };
  locale?: unknown;
  isClientSideNavigation?: boolean;
}): Promise<ArticleDetailData> {
  const { slug } = pageContext.routeParams;
  let result;
  try {
    result = await fetchArticleDetail(slug);
  } catch (error) {
    if (error instanceof ApiError) {
      if (!pageContext.isClientSideNavigation) throw render(503);
      return { slug, article: null, related: [] };
    }
    throw error;
  }
  if (result.kind === "redirect") {
    const locale = isLocale(pageContext.locale) ? pageContext.locale : DEFAULT_LOCALE;
    throw redirect(localizeHref(`/articles/${encodeURIComponent(result.slug)}`, locale), 301);
  }
  if (result.kind === "not_found") throw render(404, ARTICLE_NOT_FOUND);
  return { slug, article: result.article, related: result.related };
}
