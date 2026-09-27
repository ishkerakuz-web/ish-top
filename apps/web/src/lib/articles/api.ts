import { API_URL, ApiError, ssrHeaders, withServerTimeout } from "../api.js";
import { mapArticleCard, mapArticleListPage, mapArticleToViewModel, type ArticleCardVM, type ArticleDetailVM, type ArticleListPage } from "./adapter.js";
import { toArticlesApiParams, type ArticlesQuery } from "./query.js";

/**
 * Ochiq maqolalar API. "Bo'sh natija" va "yuklab bo'lmadi" farqlanadi: xatoda
 * `ApiError` (tarmoq uzilsa status 0), bekor qilinsa AbortError uloqtiriladi.
 *
 * SSR'da so'rov 8 soniyadan uzun kutilmaydi (audit R3, api-errors-2): sekin API
 * `/articles` sahifalarining SSR'ini platforma timeout'igacha osiltirib
 * qo'ymasin — o'rniga "yuklab bo'lmadi" holati ishlaydi. Timeout `TimeoutError`
 * bo'lib keladi (AbortError emas), shuning uchun quyidagi shart uni tarmoq
 * xatosi deb `ApiError(0)` ga aylantiradi.
 */
async function request(path: string, init?: RequestInit): Promise<{ res: Response; json: Record<string, unknown> | null }> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init?.headers as Record<string, string> | undefined), ...ssrHeaders() },
      signal: withServerTimeout(init?.signal),
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "Serverga ulanib bo'lmadi");
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { res, json };
}

function fail(res: Response, json: Record<string, unknown> | null): never {
  throw new ApiError(res.status, typeof json?.message === "string" ? json.message : "Kutilmagan xatolik", typeof json?.error === "string" ? json.error : undefined);
}

export async function fetchArticlePage(query: ArticlesQuery, signal?: AbortSignal): Promise<ArticleListPage> {
  const { res, json } = await request(`/api/articles?${toArticlesApiParams(query)}`, { signal });
  if (!res.ok || !json) fail(res, json);
  return mapArticleListPage(json);
}

export type ArticleDetailResult =
  | { kind: "ok"; article: ArticleDetailVM; related: ArticleCardVM[] }
  | { kind: "redirect"; slug: string }
  | { kind: "not_found" };

export async function fetchArticleDetail(slug: string, signal?: AbortSignal): Promise<ArticleDetailResult> {
  const { res, json } = await request(`/api/articles/${encodeURIComponent(slug)}`, { signal });
  if (res.status === 404) return { kind: "not_found" };
  if (!res.ok || !json) fail(res, json);
  if (typeof json.redirectTo === "string" && json.redirectTo) return { kind: "redirect", slug: json.redirectTo };
  const article = mapArticleToViewModel(json.article);
  if (!article) return { kind: "not_found" };
  const related = (Array.isArray(json.related) ? json.related : []).map(mapArticleCard).filter((a): a is ArticleCardVM => a !== null);
  return { kind: "ok", article, related };
}

export async function sendArticleFeedback(slug: string, helpful: boolean): Promise<void> {
  const { res, json } = await request(`/api/articles/${encodeURIComponent(slug)}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ helpful }),
  });
  if (!res.ok) fail(res, json);
}
