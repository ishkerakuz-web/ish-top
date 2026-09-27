import React, { useCallback, useEffect, useState } from "react";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { useAuth } from "../../AuthContext.js";
import { formatDate } from "../../../lib/format.js";
import { useHistoryQuery } from "../../../lib/useHistoryQuery.js";
import { adminArticlesSearch, parseAdminArticlesQuery } from "../../../lib/admin/articlesQuery.js";
import {
  deleteAdminArticle,
  fetchAdminArticles,
  transitionAdminArticle,
  type AdminArticleListItem,
  type AdminArticlesPage,
  type ArticleStatus,
} from "../../../lib/admin/articles.js";
import { isEditorRole } from "../../../lib/admin/roles.js";
import { errorText, useNotice } from "../../../lib/admin/useNotice.js";
import { articleCoverUrl } from "../../../lib/articles/adapter.js";
import { Pager } from "../../AdminShell.js";
import { Skeleton } from "../../Skeleton.js";
import { ADMIN_PRIMARY, ADMIN_SECONDARY, AdminEmpty, AdminError, AdminNotice } from "../AdminStates.js";
import { IconArticle, IconPlus, IconSearch } from "../icons.js";
import { AdminArticleFilters } from "./AdminArticleFilters.js";
import { AdminArticleStatus } from "./AdminArticleStatus.js";
import { AdminArticleActions, type ArticleRowAction } from "./AdminArticleActions.js";

/**
 * `/admin/articles` — kontent jamoasi ro'yxati. Muallif faqat o'z maqolalarini
 * ko'radi (server filtrlaydi). Qidiruv, holat va sahifa URL'da; amallar
 * serverdagi ruxsat bo'yicha, har amaldan keyin ro'yxat qayta so'raladi.
 */
export function AdminArticleList() {
  const t = useT();
  const c = t.contentAdmin.articles;
  const l = useHref();
  const { locale } = useLocale();
  const { accessToken, user } = useAuth();
  const role = user?.role ?? null;
  const { query, commit } = useHistoryQuery(parseAdminArticlesQuery, adminArticlesSearch);
  const [data, setData] = useState<AdminArticlesPage | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { notice, show } = useNotice();

  useEffect(() => {
    if (!accessToken) return;
    const ctrl = new AbortController();
    setState("loading");
    fetchAdminArticles(accessToken, { q: query.q, status: query.status, page: query.page }, ctrl.signal)
      .then((page) => {
        setData(page);
        setState("ready");
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name !== "AbortError") setState("error");
      });
    return () => ctrl.abort();
    // Token har 12 daqiqada yangilanadi — ro'yxatni qayta so'rash shart emas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.q, query.status, query.page, reload, Boolean(accessToken)]);

  const onSearch = useCallback((q: string) => commit({ ...query, q, page: 1 }, true), [commit, query]);
  const onStatus = useCallback((status: ArticleStatus | null) => commit({ ...query, status, page: 1 }), [commit, query]);

  const runAction = async (article: AdminArticleListItem, action: ArticleRowAction) => {
    if (!accessToken) return;
    if (action === "delete" && !window.confirm(c.confirm.delete(article.title))) return;
    if (action === "unpublish" && !window.confirm(c.confirm.unpublish(article.title))) return;
    if (action === "archive" && !window.confirm(c.confirm.archive(article.title))) return;
    let note: string | undefined;
    if (action === "return" && isEditorRole(role)) {
      const answer = window.prompt(c.returnNotePrompt, "");
      if (answer === null) return;
      note = answer.trim() || undefined;
    }
    setBusyId(article.id);
    try {
      if (action === "delete") await deleteAdminArticle(accessToken, article.id);
      else await transitionAdminArticle(accessToken, article.id, action, note);
      const done = { delete: c.done.deleted, submit: c.done.submitted, return: c.done.returned, publish: c.done.published, unpublish: c.done.unpublished, archive: c.done.archived, restore: c.done.restored }[action];
      show("success", done);
      setReload((n) => n + 1);
    } catch (error) {
      show("error", errorText(error, c.failed, locale));
    } finally {
      setBusyId(null);
    }
  };

  const hasFilters = Boolean(query.q || query.status);
  const items = data?.items ?? [];

  return (
    <section aria-labelledby="admin-articles-title" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id="admin-articles-title" className="font-display text-xl font-bold text-ink">
            {c.title}
          </h2>
          <p className="mt-1 text-sm text-dusk">{isEditorRole(role) ? c.subtitle : c.subtitleAuthor}</p>
        </div>
        <a href={l("/admin/articles/new")} className={ADMIN_PRIMARY} data-testid="new-article">
          <IconPlus size={17} />
          {c.newArticle}
        </a>
      </div>

      <AdminArticleFilters q={query.q} status={query.status} counts={data?.counts ?? null} onSearch={onSearch} onStatus={onStatus} />
      <AdminNotice notice={notice} />
      <p role="status" className="sr-only">
        {state === "ready" && data ? c.results(data.total) : ""}
      </p>

      {state === "error" && !data ? (
        <AdminError testId="admin-articles-error" title={c.error.title} text={c.error.text} retry={c.error.retry} onRetry={() => setReload((n) => n + 1)} />
      ) : !data ? (
        <ListSkeleton label={c.loading} />
      ) : items.length === 0 ? (
        hasFilters ? (
          <AdminEmpty testId="admin-articles-empty-filter" icon={<IconSearch size={22} />} title={c.emptyFilter.title} text={c.emptyFilter.text}>
            <button type="button" className={ADMIN_SECONDARY} onClick={() => commit({ q: "", status: null, page: 1 })}>
              {c.emptyFilter.reset}
            </button>
          </AdminEmpty>
        ) : (
          <AdminEmpty testId="admin-articles-empty" icon={<IconArticle size={22} />} title={c.empty.title} text={c.empty.text}>
            <a href={l("/admin/articles/new")} className={ADMIN_PRIMARY}>
              <IconPlus size={17} />
              {c.newArticle}
            </a>
          </AdminEmpty>
        )
      ) : (
        <div aria-busy={state === "loading" || undefined} className={state === "loading" ? "opacity-60 transition-opacity" : ""}>
          {state === "error" && (
            <AdminError title={c.error.title} text={c.error.text} retry={c.error.retry} onRetry={() => setReload((n) => n + 1)} />
          )}
          {/* Keng ekran (1280+): jadval. 7 ustun 1024px'ga sig'maydi, overflow konteyner esa ⋮ menyuni kesadi */}
          <div className="hidden rounded-2xl border border-line bg-surface xl:block">
            <table className="w-full text-sm" data-testid="admin-articles-table">
              <thead>
                <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-wide text-dusk">
                  <th scope="col" className="px-4 py-3 font-semibold">{c.columns.title}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{c.columns.author}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{c.columns.category}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{c.columns.status}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{c.columns.updated}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{c.columns.published}</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    <span className="sr-only">{c.columns.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((article) => (
                  <tr key={article.id} data-article-row={article.slug} aria-busy={busyId === article.id || undefined} className="border-b border-line/70 align-middle last:border-0">
                    <td className="max-w-[360px] px-4 py-3.5">
                      <TitleCell article={article} />
                    </td>
                    <td className="px-3 py-3.5 text-ink">{article.author ? article.author.name : <span className="text-dusk">{c.noAuthor}</span>}</td>
                    <td className="px-3 py-3.5 text-dusk">{article.category ? t.articles.categories[article.category] : c.noCategory}</td>
                    <td className="px-3 py-3.5">
                      <AdminArticleStatus status={article.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-dusk">{formatDate(article.updatedAt, locale)}</td>
                    <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-dusk">
                      {article.publishedAt ? formatDate(article.publishedAt, locale) : <span aria-label={c.notPublished}>—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end">
                        <AdminArticleActions article={article} role={role} onAction={(a, action) => void runAction(a, action)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Telefon, planshet va 1024–1279: kartalar */}
          <ul className="space-y-3 xl:hidden" data-testid="admin-articles-cards">
            {items.map((article) => (
              <li key={article.id} data-article-row={article.slug} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <TitleCell article={article} />
                  </div>
                  <AdminArticleActions article={article} role={role} onAction={(a, action) => void runAction(a, action)} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-dusk">
                  <AdminArticleStatus status={article.status} />
                  <span>{article.author ? article.author.name : c.noAuthor}</span>
                  <span aria-hidden>·</span>
                  <span>{article.category ? t.articles.categories[article.category] : c.noCategory}</span>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">
                    {c.columns.updated}: {formatDate(article.updatedAt, locale)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <Pager page={data.page} pageCount={data.pageCount} total={data.total} onChange={(page) => commit({ ...query, page })} />
        </div>
      )}
    </section>
  );
}

function TitleCell({ article }: { article: AdminArticleListItem }) {
  const c = useT().contentAdmin.articles;
  const l = useHref();
  const cover = articleCoverUrl(article.coverImageUrl);
  const href = l(article.permissions.edit ? `/admin/articles/${article.id}/edit` : `/admin/articles/${article.id}/preview`);
  return (
    <div className="flex min-w-0 items-start gap-3">
      {cover && <img src={cover} alt="" width={56} height={40} loading="lazy" className="mt-0.5 h-10 w-14 shrink-0 rounded-lg object-cover" />}
      <div className="min-w-0">
        <a href={href} className="line-clamp-2 font-semibold leading-snug text-ink transition-colors hover:text-signal">
          {article.title}
        </a>
        <p className="mt-0.5 truncate font-mono text-[11.5px] text-dusk">/articles/{article.slug}</p>
        {article.reviewNote && article.status === "draft" && (
          <p className="mt-1 line-clamp-2 text-[12px] text-amber-800 dark:text-gold-deep">
            <span className="font-semibold">{c.reviewNote}:</span> {article.reviewNote}
          </p>
        )}
      </div>
    </div>
  );
}

function ListSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" data-testid="admin-articles-skeleton">
      <span role="status" className="sr-only">
        {label}
      </span>
      <div aria-hidden className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-14 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </div>
            <Skeleton className="hidden h-6 w-24 rounded-full sm:block" />
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
