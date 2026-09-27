import { useCallback, useEffect, useState } from "react";
import { localizeHref, type Locale } from "../i18n/config.js";
import type { ArticleCardVM, ArticleDetailVM } from "./adapter.js";
import { fetchArticleDetail } from "./api.js";
import { reportArticleView } from "../views.js";

/** `+data` natijasi: `article === null` — API xatosi (404 serverda `render(404)`, eski slug — 301). */
export interface ArticleDetailData {
  slug: string;
  article: ArticleDetailVM | null;
  related: ArticleCardVM[];
}

export type ArticleDetailState =
  | { kind: "ok"; article: ArticleDetailVM; related: ArticleCardVM[] }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "not_found" };

/**
 * Server ma'lumotini oladi; server javob bermagan bo'lsa brauzer bir marta o'zi
 * qayta so'raydi (skelet bilan), "Qayta urinish" ham shunday. Komponent har slug
 * uchun `key` bilan qayta tug'iladi (kompaniya sahifasidagi naqsh).
 */
export function useArticleDetail(initial: ArticleDetailData, locale: Locale) {
  const { slug } = initial;
  const [state, setState] = useState<ArticleDetailState>(() =>
    initial.article ? { kind: "ok", article: initial.article, related: initial.related } : { kind: "loading" }
  );
  const [request, setRequest] = useState(() => (initial.article ? 0 : 1));

  useEffect(() => {
    if (request === 0) return;
    const controller = new AbortController();
    setState({ kind: "loading" });
    fetchArticleDetail(slug, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.kind === "redirect") {
          window.location.replace(localizeHref(`/articles/${encodeURIComponent(result.slug)}`, locale));
          return;
        }
        setState(result.kind === "ok" ? { kind: "ok", article: result.article, related: result.related } : { kind: "not_found" });
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name !== "AbortError") setState({ kind: "error" });
      });
    return () => controller.abort();
  }, [request, slug, locale]);

  // Ko'rish faqat maqola HAQIQATAN ochilganda va faqat brauzerdan sanaladi (audit: views-1)
  useEffect(() => {
    if (state.kind === "ok") reportArticleView(slug);
  }, [slug, state.kind]);

  const retry = useCallback(() => setRequest((r) => r + 1), []);
  return { state, retry, retrying: state.kind === "loading" };
}
