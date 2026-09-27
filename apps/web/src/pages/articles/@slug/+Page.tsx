import React from "react";
import { useData } from "vike-react/useData";
import { useLocale, useT } from "../../../lib/i18n/index.js";
import { useArticleDetail, type ArticleDetailData } from "../../../lib/articles/useArticleDetail.js";
import { ArticleBreadcrumb } from "../../../components/articles/detail/ArticleDetailHeader.js";
import { ArticleDetailView } from "../../../components/articles/detail/ArticleDetailView.js";
import { ArticleDetailSkeleton } from "../../../components/articles/detail/ArticleSkeleton.js";
import { ArticleError, ArticleNotFound } from "../../../components/articles/detail/ArticleError.js";

/** `/articles/:slug` — chop etilgan maqola (qoralama/arxiv bu manzilda ochilmaydi). */
export default function Page() {
  const initial = useData<ArticleDetailData>();
  return <DetailPage key={initial.slug} initial={initial} />;
}

function DetailPage({ initial }: { initial: ArticleDetailData }) {
  const t = useT();
  const { locale } = useLocale();
  const { state, retry, retrying } = useArticleDetail(initial, locale);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:pt-7">
      <ArticleBreadcrumb title={state.kind === "ok" ? state.article.title : null} loading={state.kind === "loading"} />
      {state.kind === "ok" ? (
        <ArticleDetailView key={state.article.id} article={state.article} related={state.related} />
      ) : state.kind === "loading" ? (
        <ArticleDetailSkeleton label={t.articles.detail.loading} />
      ) : state.kind === "not_found" ? (
        <ArticleNotFound />
      ) : (
        <ArticleError onRetry={retry} retrying={retrying} />
      )}
    </div>
  );
}
