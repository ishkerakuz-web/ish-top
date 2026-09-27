import React, { useEffect, useMemo, useState } from "react";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { useAuth } from "../../AuthContext.js";
import { ApiError } from "../../../lib/api.js";
import { fetchAdminArticle, type AdminArticleDetail } from "../../../lib/admin/articles.js";
import { mapArticleToViewModel } from "../../../lib/articles/adapter.js";
import { ArticleDetailView } from "../../articles/detail/ArticleDetailView.js";
import { ArticleDetailSkeleton } from "../../articles/detail/ArticleSkeleton.js";
import { ADMIN_PRIMARY, ADMIN_SECONDARY, AdminEmpty, AdminError } from "../AdminStates.js";
import { IconArticle, IconEye } from "../icons.js";
import { AdminArticleStatus } from "./AdminArticleStatus.js";

/**
 * `/admin/articles/:id/preview` — saqlangan maqolaning saytdagi ko'rinishi,
 * holatidan qat'i nazar. Ma'lumot admin API'dan (faqat kontent jamoasi);
 * ochiq `/articles/:slug` qoralamani baribir 404 bilan qaytaradi.
 */
export function AdminArticlePreview({ id }: { id: string }) {
  const t = useT();
  const c = t.contentAdmin;
  const l = useHref();
  const { accessToken } = useAuth();
  const [article, setArticle] = useState<AdminArticleDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "not_found">("loading");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    const ctrl = new AbortController();
    setState("loading");
    fetchAdminArticle(accessToken, id, ctrl.signal)
      .then((loaded) => {
        setArticle(loaded);
        setState("ready");
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name === "AbortError") return;
        setState(err instanceof ApiError && (err.status === 404 || err.status === 403) ? "not_found" : "error");
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reload, Boolean(accessToken)]);

  const model = useMemo(() => (article ? mapArticleToViewModel(article, article.status) : null), [article]);

  if (state === "loading" && !article) return <ArticleDetailSkeleton label={c.editor.loading} />;
  if (state === "not_found") {
    return (
      <AdminEmpty icon={<IconArticle size={22} />} title={c.editor.notFound.title} text={c.editor.notFound.text}>
        <a href={l("/admin/articles")} className={ADMIN_SECONDARY}>
          {c.preview.back}
        </a>
      </AdminEmpty>
    );
  }
  if (state === "error" || !article || !model) {
    return <AdminError title={c.editor.loadError.title} text={c.editor.loadError.text} retry={c.editor.loadError.retry} onRetry={() => setReload((n) => n + 1)} />;
  }

  return (
    <div data-testid="admin-article-preview">
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/35 bg-gold/10 px-4 py-3">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
          <IconEye size={17} />
          {c.preview.banner}
          <AdminArticleStatus status={article.status} />
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={l("/admin/articles")} className={ADMIN_SECONDARY}>
            {c.preview.back}
          </a>
          {article.permissions.edit && (
            <a href={l(`/admin/articles/${article.id}/edit`)} className={ADMIN_PRIMARY}>
              {c.preview.edit}
            </a>
          )}
        </div>
      </div>
      <ArticleDetailView article={model} related={[]} preview />
    </div>
  );
}
