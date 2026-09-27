import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { useAuth } from "../../AuthContext.js";
import { ApiError } from "../../../lib/api.js";
import { formatDate } from "../../../lib/format.js";
import { ARTICLE_CATEGORIES, type ArticleCategory } from "../../../lib/articles/categories.js";
import { mapArticleToViewModel } from "../../../lib/articles/adapter.js";
import {
  EXCERPT_MAX,
  META_DESCRIPTION_MAX,
  META_TITLE_MAX,
  MIN_PUBLISH_CHARS,
  SLUG_RE,
  TITLE_MAX,
  estimateReadingMinutes,
  plainTextLength,
  slugify,
} from "../../../lib/articles/editing.js";
import {
  createAdminArticle,
  fetchAdminArticle,
  fetchArticleAuthors,
  transitionAdminArticle,
  updateAdminArticle,
  type AdminArticleDetail,
  type AdminArticleInput,
  type ArticleTransition,
  type StaffAuthorOption,
} from "../../../lib/admin/articles.js";
import { isEditorRole } from "../../../lib/admin/roles.js";
import { errorText, useNotice } from "../../../lib/admin/useNotice.js";
import { ArticleDetailView } from "../../articles/detail/ArticleDetailView.js";
import { Skeleton } from "../../Skeleton.js";
import { ADMIN_CARD, ADMIN_INPUT, ADMIN_LABEL, ADMIN_PRIMARY, ADMIN_SECONDARY, AdminEmpty, AdminError, AdminNotice } from "../AdminStates.js";
import { IconArchive, IconArticle, IconChevronLeft, IconEye, IconEyeOff, IconGlobe, IconSend, IconUndo, Spinner } from "../icons.js";
import { AdminArticleStatus } from "./AdminArticleStatus.js";
import { ContentEditor } from "./ContentEditor.js";
import { CoverField } from "./CoverField.js";
import { TagInput } from "./TagInput.js";

interface EditorForm {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  category: ArticleCategory | "";
  tags: string[];
  authorId: string;
  metaTitle: string;
  metaDescription: string;
}

type Intent = "draft" | "review" | "publish";

const EMPTY_FORM: EditorForm = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImageUrl: null,
  category: "",
  tags: [],
  authorId: "",
  metaTitle: "",
  metaDescription: "",
};

function formFrom(article: AdminArticleDetail): EditorForm {
  return {
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt ?? "",
    content: article.content,
    coverImageUrl: article.coverImageUrl,
    category: article.category ?? "",
    tags: article.tags,
    authorId: article.author?.id ?? "",
    metaTitle: article.metaTitle ?? "",
    metaDescription: article.metaDescription ?? "",
  };
}

function Counter({ value, max }: { value: number; max: number }) {
  const e = useT().contentAdmin.editor;
  return <span className={`text-xs tabular-nums ${value > max ? "text-danger" : "text-dusk"}`}>{e.counter(value, max)}</span>;
}

/**
 * Maqola yaratish va tahrirlash (`/admin/articles/new`, `/admin/articles/:id/edit`).
 *
 * Tugmalar rol va holatga qarab: muallif — qoralamani saqlash va ko'rib chiqishga
 * yuborish; muharrir/admin — qo'shimcha chop etish va istalgan holatdagi maqolani
 * saqlash. Ruxsat serverdagi `permissions` dan (tahrirlash yopiq bo'lsa maydonlar
 * faqat o'qish uchun). "Ko'rib chiqish" — saqlanmagan formani saytdagi ko'rinishda
 * ochadi; qoralama ochiq URL'da hech qachon ko'rinmaydi.
 */
export function AdminArticleEditor({ articleId }: { articleId: string | null }) {
  const t = useT();
  const c = t.contentAdmin;
  const e = c.editor;
  const f = e.fields;
  const l = useHref();
  const { locale } = useLocale();
  const { accessToken, user } = useAuth();
  const role = user?.role ?? null;
  const editor = isEditorRole(role);

  const [article, setArticle] = useState<AdminArticleDetail | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error" | "not_found">(articleId ? "loading" : "ready");
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState<EditorForm>(() => ({ ...EMPTY_FORM, authorId: user?.id ?? "" }));
  const [baseline, setBaseline] = useState(() => JSON.stringify({ ...EMPTY_FORM, authorId: user?.id ?? "" }));
  const [authors, setAuthors] = useState<StaffAuthorOption[]>([]);
  const [saving, setSaving] = useState<Intent | null>(null);
  const [transitioning, setTransitioning] = useState<ArticleTransition | null>(null);
  const [errors, setErrors] = useState<{ title?: string; slug?: string; content?: string }>({});
  const [previewing, setPreviewing] = useState(false);
  const { notice, show } = useNotice();
  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);

  const currentId = article?.id ?? articleId;
  const readOnly = Boolean(article && !article.permissions.edit);
  const dirty = JSON.stringify(form) !== baseline;
  const busy = saving !== null || transitioning !== null;

  // Tahrirlanadigan maqola
  useEffect(() => {
    if (!articleId || !accessToken) return;
    const ctrl = new AbortController();
    setLoadState("loading");
    fetchAdminArticle(accessToken, articleId, ctrl.signal)
      .then((loaded) => {
        const next = formFrom(loaded);
        setArticle(loaded);
        setForm(next);
        setBaseline(JSON.stringify(next));
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name === "AbortError") return;
        setLoadState(err instanceof ApiError && (err.status === 404 || err.status === 403) ? "not_found" : "error");
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, reload, Boolean(accessToken)]);

  // Yangi maqola: muallif sukut bo'yicha — o'zi
  useEffect(() => {
    if (articleId || !user?.id) return;
    setForm((prev) => (prev.authorId ? prev : { ...prev, authorId: user.id }));
    setBaseline((prev) => {
      const parsed = JSON.parse(prev) as EditorForm;
      return parsed.authorId ? prev : JSON.stringify({ ...parsed, authorId: user.id });
    });
  }, [articleId, user?.id]);

  // Muallif tanlovi (faqat muharrir va admin)
  useEffect(() => {
    if (!editor || !accessToken) return;
    const ctrl = new AbortController();
    fetchArticleAuthors(accessToken, ctrl.signal)
      .then((res) => setAuthors(res.items))
      .catch(() => undefined);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, Boolean(accessToken)]);

  // Saqlanmagan o'zgarish bilan sahifani yopish
  useEffect(() => {
    if (!dirty) return;
    const handler = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const status = article?.status ?? "draft";
  const canSubmit = !readOnly && (article ? article.permissions.submit : true);
  const canPublish = !readOnly && editor && status !== "published";

  const save = useCallback(
    async (intent: Intent) => {
      if (!accessToken || readOnly || busy) return;
      const nextErrors: typeof errors = {};
      if (form.title.trim().length < 3) nextErrors.title = e.errors.title;
      if (form.slug.trim() && !SLUG_RE.test(form.slug.trim())) nextErrors.slug = f.slugHint;
      const needsContent = intent !== "draft" || status === "in_review" || status === "published";
      if (needsContent && plainTextLength(form.content) < MIN_PUBLISH_CHARS) nextErrors.content = e.errors.contentShort(MIN_PUBLISH_CHARS);
      setErrors(nextErrors);
      if (nextErrors.title) return titleRef.current?.focus();
      if (nextErrors.slug) return slugRef.current?.focus();
      if (nextErrors.content) return document.getElementById("article-content")?.focus();

      const input: AdminArticleInput = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        excerpt: form.excerpt.trim() || null,
        content: form.content,
        coverImageUrl: form.coverImageUrl,
        category: form.category || null,
        tags: form.tags,
        metaTitle: form.metaTitle.trim() || null,
        metaDescription: form.metaDescription.trim() || null,
        intent,
        ...(editor ? { authorId: form.authorId || null } : {}),
      };
      setSaving(intent);
      try {
        const saved = currentId ? await updateAdminArticle(accessToken, currentId, input) : await createAdminArticle(accessToken, input);
        const next = formFrom(saved);
        setArticle(saved);
        setForm(next);
        setBaseline(JSON.stringify(next));
        if (!currentId) window.history.replaceState(null, "", l(`/admin/articles/${saved.id}/edit`));
        show("success", intent === "review" ? c.articles.done.submitted : intent === "publish" ? c.articles.done.published : c.articles.done.saved);
      } catch (err) {
        if (err instanceof ApiError && (err.code === "INVALID_SLUG" || err.code === "SLUG_TAKEN")) {
          setErrors({ slug: errorText(err, f.slugHint, locale) });
          slugRef.current?.focus();
        } else if (err instanceof ApiError && err.code === "CONTENT_TOO_SHORT") {
          setErrors({ content: e.errors.contentShort(MIN_PUBLISH_CHARS) });
        } else {
          show("error", errorText(err, e.errors.generic, locale));
        }
      } finally {
        setSaving(null);
      }
    },
    [accessToken, readOnly, busy, form, status, editor, currentId, l, show, c, e, f, locale]
  );

  // Ctrl/⌘+S — saqlash (holat o'zgarmaydi)
  useEffect(() => {
    if (readOnly || previewing) return;
    const handler = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
        ev.preventDefault();
        void save("draft");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [readOnly, previewing, save]);

  const transition = async (action: ArticleTransition) => {
    if (!accessToken || !article || busy) return;
    if (action === "unpublish" && !window.confirm(c.articles.confirm.unpublish(article.title))) return;
    if (action === "archive" && !window.confirm(c.articles.confirm.archive(article.title))) return;
    if (dirty && !window.confirm(`${e.unsaved}. ${t.admin.common.confirmAction}`)) return;
    let note: string | undefined;
    if (action === "return" && editor) {
      const answer = window.prompt(c.articles.returnNotePrompt, "");
      if (answer === null) return;
      note = answer.trim() || undefined;
    }
    setTransitioning(action);
    try {
      const saved = await transitionAdminArticle(accessToken, article.id, action, note);
      const next = formFrom(saved);
      setArticle(saved);
      setForm(next);
      setBaseline(JSON.stringify(next));
      const done = { submit: c.articles.done.submitted, return: c.articles.done.returned, publish: c.articles.done.published, unpublish: c.articles.done.unpublished, archive: c.articles.done.archived, restore: c.articles.done.restored }[action];
      show("success", done);
    } catch (err) {
      show("error", errorText(err, c.articles.failed, locale));
    } finally {
      setTransitioning(null);
    }
  };

  const previewModel = useMemo(() => {
    if (!previewing) return null;
    const option = authors.find((a) => a.id === form.authorId);
    const author = editor
      ? option
        ? { name: option.name, position: option.position }
        : article?.author && article.author.id === form.authorId
          ? article.author
          : null
      : article?.author ?? (user?.firstName ? { name: user.firstName } : null);
    return mapArticleToViewModel(
      {
        id: article?.id ?? "preview",
        slug: form.slug.trim() || slugify(form.title) || "preview",
        title: form.title,
        excerpt: form.excerpt,
        content: form.content,
        coverImageUrl: form.coverImageUrl,
        category: form.category || null,
        tags: form.tags,
        readingMinutes: estimateReadingMinutes(form.content),
        publishedAt: article?.publishedAt ?? null,
        updatedAt: article?.updatedAt ?? null,
        author,
      },
      status
    );
  }, [previewing, authors, form, editor, article, user?.firstName, status]);

  if (articleId && loadState === "loading" && !article) {
    return (
      <div aria-busy="true" data-testid="editor-skeleton">
        <span role="status" className="sr-only">
          {e.loading}
        </span>
        <div aria-hidden className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <Skeleton className="h-8 w-60" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
          <div className="space-y-5">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }
  if (loadState === "not_found") {
    return (
      <AdminEmpty testId="editor-not-found" icon={<IconArticle size={22} />} title={e.notFound.title} text={e.notFound.text}>
        <a href={l("/admin/articles")} className={ADMIN_SECONDARY}>
          {e.back}
        </a>
      </AdminEmpty>
    );
  }
  if (loadState === "error") {
    return <AdminError testId="editor-error" title={e.loadError.title} text={e.loadError.text} retry={e.loadError.retry} onRetry={() => setReload((n) => n + 1)} />;
  }

  if (previewing) {
    return (
      <div className="space-y-5" data-testid="editor-preview">
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/35 bg-gold/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <IconEye size={17} />
            {e.previewNote}
          </p>
          <button type="button" className={ADMIN_PRIMARY} onClick={() => setPreviewing(false)}>
            {e.tabs.write}
          </button>
        </div>
        {previewModel ? (
          <ArticleDetailView article={previewModel} related={[]} preview />
        ) : (
          <AdminEmpty icon={<IconArticle size={22} />} title={e.tabs.preview} text={e.previewEmpty} />
        )}
      </div>
    );
  }

  const readOnlyText = !article ? "" : status === "in_review" ? e.readOnly.in_review : status === "published" ? e.readOnly.published : status === "archived" ? e.readOnly.archived : e.readOnly.foreign;
  const slugPreview = form.slug.trim() || slugify(form.title);
  const extraTransitions: { action: ArticleTransition; label: string; icon: React.ReactNode }[] = article
    ? [
        ...(article.permissions.return ? [{ action: "return" as const, label: editor ? c.articles.actions.return : c.articles.actions.withdraw, icon: <IconUndo size={16} /> }] : []),
        ...(article.permissions.unpublish ? [{ action: "unpublish" as const, label: c.articles.actions.unpublish, icon: <IconEyeOff size={16} /> }] : []),
        ...(article.permissions.restore ? [{ action: "restore" as const, label: c.articles.actions.restore, icon: <IconUndo size={16} /> }] : []),
        ...(article.permissions.archive ? [{ action: "archive" as const, label: c.articles.actions.archive, icon: <IconArchive size={16} /> }] : []),
      ]
    : [];

  return (
    <div className="space-y-5" data-testid="article-editor">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <a href={l("/admin/articles")} className="inline-flex items-center gap-1 text-sm text-dusk transition-colors hover:text-ink">
            <IconChevronLeft size={16} />
            {e.back}
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-xl font-bold text-ink">{article ? e.editTitle : e.newTitle}</h2>
            {article && <AdminArticleStatus status={article.status} />}
            {dirty && !readOnly && <span className="text-xs font-medium text-amber-800 dark:text-gold-deep">{e.unsaved}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={ADMIN_SECONDARY} onClick={() => setPreviewing(true)} data-testid="editor-preview-button">
            <IconEye size={16} />
            {e.buttons.preview}
          </button>
          {!readOnly && (
            <button type="button" className={ADMIN_SECONDARY} onClick={() => void save("draft")} disabled={busy} data-testid="editor-save">
              {saving === "draft" && <Spinner size={15} />}
              {saving === "draft" ? e.buttons.saving : status === "draft" ? e.buttons.saveDraft : e.buttons.save}
            </button>
          )}
          {canSubmit && (
            <button type="button" className={editor ? ADMIN_SECONDARY : ADMIN_PRIMARY} onClick={() => void save("review")} disabled={busy} data-testid="editor-submit">
              {saving === "review" ? <Spinner size={15} /> : <IconSend size={16} />}
              {e.buttons.submit}
            </button>
          )}
          {canPublish && (
            <button type="button" className={ADMIN_PRIMARY} onClick={() => void save("publish")} disabled={busy} data-testid="editor-publish">
              {saving === "publish" ? <Spinner size={15} /> : <IconGlobe size={16} />}
              {e.buttons.publish}
            </button>
          )}
        </div>
      </div>

      <AdminNotice notice={notice} />
      {readOnly && (
        <p role="note" data-testid="editor-readonly" className="rounded-xl border border-gold/35 bg-gold/10 px-4 py-3 text-sm text-ink">
          {readOnlyText}
        </p>
      )}
      {article?.reviewNote && article.status === "draft" && (
        <div role="note" className="rounded-xl border border-signal/20 bg-signal-soft px-4 py-3 text-sm text-ink">
          <span className="font-semibold">{c.articles.reviewNote}:</span> {article.reviewNote}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section className={ADMIN_CARD}>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="article-title" className={ADMIN_LABEL}>
                {f.title}
              </label>
              <Counter value={form.title.length} max={TITLE_MAX} />
            </div>
            <input
              id="article-title"
              ref={titleRef}
              value={form.title}
              maxLength={TITLE_MAX}
              disabled={readOnly}
              onChange={(ev) => set("title", ev.target.value)}
              placeholder={f.titlePlaceholder}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? "article-title-error" : undefined}
              className={`${ADMIN_INPUT} mt-1.5 text-[16px] font-semibold ${errors.title ? "border-danger" : ""}`}
            />
            {errors.title && (
              <p id="article-title-error" className="mt-1 text-xs font-medium text-danger">
                {errors.title}
              </p>
            )}

            <label htmlFor="article-slug" className={`${ADMIN_LABEL} mt-4`}>
              {f.slug}
            </label>
            <div className={`mt-1.5 flex overflow-hidden rounded-xl border bg-surface transition-colors focus-within:border-signal ${errors.slug ? "border-danger" : "border-line"}`}>
              <span aria-hidden className="flex items-center border-r border-line bg-surface-2 px-3 font-mono text-xs text-dusk">
                /articles/
              </span>
              <input
                id="article-slug"
                ref={slugRef}
                value={form.slug}
                maxLength={90}
                disabled={readOnly}
                onChange={(ev) => set("slug", ev.target.value.toLowerCase().replace(/\s+/g, "-"))}
                placeholder={slugPreview || "maqola-manzili"}
                aria-invalid={errors.slug ? true : undefined}
                aria-describedby="article-slug-hint"
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-sm text-ink placeholder:text-dusk/70 focus:outline-none disabled:text-dusk"
              />
            </div>
            <p id="article-slug-hint" className={`mt-1.5 text-xs ${errors.slug ? "font-medium text-danger" : "text-dusk"}`}>
              {errors.slug ?? f.slugHint}
            </p>
            {article?.publishedAt && form.slug.trim() && form.slug.trim() !== article.slug && (
              <p className="mt-1 text-xs text-amber-800 dark:text-gold-deep">{f.slugRedirectHint}</p>
            )}
          </section>

          <section className={ADMIN_CARD}>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="article-excerpt" className={ADMIN_LABEL}>
                {f.excerpt}
              </label>
              <Counter value={form.excerpt.length} max={EXCERPT_MAX} />
            </div>
            <textarea
              id="article-excerpt"
              value={form.excerpt}
              maxLength={EXCERPT_MAX}
              rows={3}
              disabled={readOnly}
              onChange={(ev) => set("excerpt", ev.target.value)}
              aria-describedby="article-excerpt-hint"
              className={`${ADMIN_INPUT} mt-1.5 resize-y`}
            />
            <p id="article-excerpt-hint" className="mt-1.5 text-xs text-dusk">
              {f.excerptHint}
            </p>
          </section>

          <section className={ADMIN_CARD}>
            <ContentEditor
              id="article-content"
              value={form.content}
              onChange={(value) => set("content", value)}
              disabled={readOnly}
              error={errors.content}
              token={accessToken}
              onUploadError={(message) => show("error", message)}
            />
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          {article && (
            <section className={ADMIN_CARD} data-testid="editor-status-card">
              <h3 className="font-display text-[15px] font-bold text-ink">{e.sections.status}</h3>
              <div className="mt-3 flex items-center gap-2 text-sm text-dusk">
                {e.statusLabel}: <AdminArticleStatus status={article.status} />
              </div>
              <ul className="mt-3 space-y-1 text-[13px] text-dusk">
                {article.publishedAt && <li>{e.publishedAt(formatDate(article.publishedAt, locale))}</li>}
                <li>{e.updatedAt(formatDate(article.updatedAt, locale))}</li>
                {article.status !== "draft" || article.stats.views > 0 ? (
                  <li>
                    {e.stats.views}: <span className="font-semibold tabular-nums text-ink">{article.stats.views}</span>
                  </li>
                ) : null}
                {article.stats.helpfulYes + article.stats.helpfulNo > 0 && (
                  <li>
                    {e.stats.helpful}:{" "}
                    <span className="font-semibold tabular-nums text-ink">
                      {article.stats.helpfulYes} / {article.stats.helpfulYes + article.stats.helpfulNo}
                    </span>
                  </li>
                )}
              </ul>
              {extraTransitions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  {extraTransitions.map((item) => (
                    <button key={item.action} type="button" className={`${ADMIN_SECONDARY} h-9 px-3 text-[13px]`} onClick={() => void transition(item.action)} disabled={busy} data-transition={item.action}>
                      {transitioning === item.action ? <Spinner size={14} /> : item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className={ADMIN_CARD}>
            <h3 className="mb-3 font-display text-[15px] font-bold text-ink">{e.sections.cover}</h3>
            <CoverField value={form.coverImageUrl} onChange={(url) => set("coverImageUrl", url)} disabled={readOnly} token={accessToken} />
          </section>

          <section className={`${ADMIN_CARD} space-y-4`}>
            <h3 className="font-display text-[15px] font-bold text-ink">{e.sections.details}</h3>
            <div>
              <label htmlFor="article-category" className={ADMIN_LABEL}>
                {f.category}
              </label>
              <select
                id="article-category"
                value={form.category}
                disabled={readOnly}
                onChange={(ev) => set("category", ev.target.value as ArticleCategory | "")}
                className={`${ADMIN_INPUT} mt-1.5`}
              >
                <option value="">{f.categoryNone}</option>
                {ARTICLE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t.articles.categories[category]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              {editor ? (
                <>
                  <label htmlFor="article-author" className={ADMIN_LABEL}>
                    {f.author}
                  </label>
                  <select
                    id="article-author"
                    value={form.authorId}
                    disabled={readOnly}
                    onChange={(ev) => set("authorId", ev.target.value)}
                    className={`${ADMIN_INPUT} mt-1.5`}
                  >
                    <option value="">{f.authorNone}</option>
                    {/* Joriy muallif ro'yxatda bo'lmasa ham (faolsizlantirilgan) tanlov yo'qolmasin */}
                    {article?.author && !authors.some((a) => a.id === article.author!.id) && <option value={article.author.id}>{article.author.name}</option>}
                    {authors.map((author) => (
                      <option key={author.id} value={author.id}>
                        {author.name} · {c.roles[author.role as keyof typeof c.roles] ?? author.role}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <p className={ADMIN_LABEL}>{f.author}</p>
                  <p className="mt-1.5 text-sm text-ink">{article?.author?.name ?? user?.firstName ?? user?.email}</p>
                </>
              )}
            </div>
            <TagInput id="article-tags" value={form.tags} onChange={(tags) => set("tags", tags)} disabled={readOnly} />
          </section>

          <section className={`${ADMIN_CARD} space-y-4`}>
            <h3 className="font-display text-[15px] font-bold text-ink">{e.sections.seo}</h3>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="article-meta-title" className={ADMIN_LABEL}>
                  {f.seoTitle}
                </label>
                <Counter value={form.metaTitle.length} max={META_TITLE_MAX} />
              </div>
              <input
                id="article-meta-title"
                value={form.metaTitle}
                maxLength={META_TITLE_MAX}
                disabled={readOnly}
                onChange={(ev) => set("metaTitle", ev.target.value)}
                aria-describedby="article-meta-title-hint"
                className={`${ADMIN_INPUT} mt-1.5`}
              />
              <p id="article-meta-title-hint" className="mt-1.5 text-xs text-dusk">
                {f.seoTitleHint}
              </p>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="article-meta-description" className={ADMIN_LABEL}>
                  {f.seoDescription}
                </label>
                <Counter value={form.metaDescription.length} max={META_DESCRIPTION_MAX} />
              </div>
              <textarea
                id="article-meta-description"
                value={form.metaDescription}
                maxLength={META_DESCRIPTION_MAX}
                rows={3}
                disabled={readOnly}
                onChange={(ev) => set("metaDescription", ev.target.value)}
                aria-describedby="article-meta-description-hint"
                className={`${ADMIN_INPUT} mt-1.5 resize-y`}
              />
              <p id="article-meta-description-hint" className="mt-1.5 text-xs text-dusk">
                {f.seoDescriptionHint}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
