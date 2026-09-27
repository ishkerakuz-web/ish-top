import React, { useCallback, useRef } from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import { useUrlQuery } from "../../lib/useUrlQuery.js";
import {
  ARTICLE_SORTS,
  articlesHref,
  hasFeaturedSlot,
  parseArticlesQuery,
  serializeArticlesQuery,
  type ArticleSort,
  type ArticlesQuery,
} from "../../lib/articles/query.js";
import type { ArticleCategory } from "../../lib/articles/categories.js";
import { useArticleList, type ArticlesPageData } from "../../lib/articles/useArticleList.js";
import { FieldSelect } from "../vacancies/FieldSelect.js";
import { ArticlesHeader } from "./ArticlesHeader.js";
import { ArticlesSearch } from "./ArticlesSearch.js";
import { ArticleCategories } from "./ArticleCategories.js";
import { ArticleFeatured } from "./ArticleFeatured.js";
import { ArticleGrid } from "./ArticleGrid.js";
import { ArticlesPagination } from "./ArticlesPagination.js";
import { ArticleListSkeleton } from "./ArticleSkeleton.js";
import { ArticlesEmpty, ArticlesNoResults } from "./ArticlesEmpty.js";
import { ArticlesError } from "./ArticlesError.js";

/**
 * `/articles`: qidiruv, kategoriya, saralash va sahifa — URL'da (`useUrlQuery` +
 * `+data`): refresh, orqaga/oldinga va ulashilgan havola bir xil holatni ochadi.
 * Holatlar aniq ajratilgan: yuklanmoqda (skelet), xato (qayta urinish), umuman
 * maqola yo'q, filtr bo'yicha natija yo'q, natijalar.
 */
export function ArticlesView({ initial }: { initial: ArticlesPageData }) {
  const a = useT().articles;
  const l = useHref();
  const { query, urlQuery, urlKey, pending, update } = useUrlQuery(parseArticlesQuery, serializeArticlesQuery);
  const { page, retrying, retry } = useArticleList(initial, urlKey, urlQuery);
  const resultsRef = useRef<HTMLDivElement>(null);

  const onSearch = useCallback((q: string) => update({ q, page: 1 }, { replace: true }), [update]);
  const onCategory = useCallback((category: ArticleCategory | null) => update({ category, page: 1 }), [update]);
  const onSort = useCallback((sort: string) => update({ sort: sort as ArticleSort, page: 1 }), [update]);
  const onPage = useCallback(
    (next: number) => {
      update({ page: next });
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [update]
  );
  const hrefWith = (patch: Partial<ArticlesQuery>) => l(articlesHref({ ...query, page: 1, ...patch }));

  const hasFilters = Boolean(query.q || query.category);
  const loading = pending || (page === null && retrying);
  const showToolbar = page !== null && (page.publishedTotal > 0 || hasFilters);

  return (
    <>
      <ArticlesHeader count={page?.publishedTotal ?? null} loading={page === null && retrying} />

      {showToolbar && (
        <div className="mt-6 rounded-3xl border border-line bg-surface/70 p-3 shadow-card backdrop-blur sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <ArticlesSearch value={query.q} onSearch={onSearch} />
            <FieldSelect
              id="articles-sort"
              label={a.sortLabel}
              value={query.sort}
              options={ARTICLE_SORTS.map((sort) => ({ value: sort, label: a.sort[sort] }))}
              onChange={onSort}
              className="sm:w-52"
            />
          </div>
          {(page.categories.length > 0 || query.category) && (
            <div className="mt-3 border-t border-line pt-3">
              <ArticleCategories
                categories={page.categories}
                active={query.category}
                total={page.publishedTotal}
                hrefFor={(category) => hrefWith({ category })}
                onSelect={onCategory}
              />
            </div>
          )}
        </div>
      )}

      <div ref={resultsRef} id="articles-results" className="mt-6 scroll-mt-28">
        <p role="status" aria-live="polite" className="sr-only">
          {page && !loading ? a.results(page.total) : ""}
        </p>
        {loading ? (
          <ArticleListSkeleton featured={hasFeaturedSlot(query) && query.page === 1} label={a.loading} />
        ) : page === null ? (
          <ArticlesError onRetry={retry} retrying={retrying} />
        ) : page.total === 0 ? (
          hasFilters ? (
            <ArticlesNoResults onReset={() => update({ q: "", category: null, page: 1 })} />
          ) : (
            <ArticlesEmpty />
          )
        ) : (
          <>
            {page.featured && <ArticleFeatured article={page.featured} />}
            <ArticleGrid articles={page.items} className={page.featured ? "mt-6" : ""} />
            <ArticlesPagination
              page={page.page}
              pageCount={page.pageCount}
              hrefFor={(target) => l(articlesHref({ ...urlQuery, page: target }))}
              onPage={onPage}
            />
          </>
        )}
      </div>
    </>
  );
}
