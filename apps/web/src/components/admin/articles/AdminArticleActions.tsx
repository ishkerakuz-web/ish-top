import React from "react";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { ActionsMenu, type ActionItem } from "../../ActionsMenu.js";
import type { AdminArticleListItem, ArticleTransition } from "../../../lib/admin/articles.js";
import { isEditorRole } from "../../../lib/admin/roles.js";
import { IconArchive, IconEdit, IconExternal, IconEye, IconEyeOff, IconGlobe, IconSend, IconTrash, IconUndo } from "../icons.js";

export type ArticleRowAction = ArticleTransition | "delete";

/**
 * "⋮" menyu — faqat server ruxsat bergan (`permissions`) amallar. Tekshiruv
 * baribir serverda: menyu yashirish — qulaylik, himoya emas.
 */
export function AdminArticleActions({
  article,
  role,
  onAction,
}: {
  article: AdminArticleListItem;
  role: string | null;
  onAction: (article: AdminArticleListItem, action: ArticleRowAction) => void;
}) {
  const c = useT().contentAdmin.articles;
  const l = useHref();
  const p = article.permissions;
  const act = (action: ArticleRowAction) => () => onAction(article, action);

  const items: ActionItem[] = [
    ...(p.edit ? [{ key: "edit", label: c.actions.edit, icon: <IconEdit size={17} />, href: l(`/admin/articles/${article.id}/edit`) }] : []),
    { key: "preview", label: c.actions.preview, icon: <IconEye size={17} />, href: l(`/admin/articles/${article.id}/preview`) },
    ...(article.status === "published" ? [{ key: "view", label: c.actions.view, icon: <IconExternal size={17} />, href: l(`/articles/${article.slug}`) }] : []),
    ...(p.submit ? [{ key: "submit", label: c.actions.submit, icon: <IconSend size={17} />, onSelect: act("submit") }] : []),
    ...(p.return ? [{ key: "return", label: isEditorRole(role) ? c.actions.return : c.actions.withdraw, icon: <IconUndo size={17} />, onSelect: act("return") }] : []),
    ...(p.publish ? [{ key: "publish", label: c.actions.publish, icon: <IconGlobe size={17} />, onSelect: act("publish") }] : []),
    ...(p.unpublish ? [{ key: "unpublish", label: c.actions.unpublish, icon: <IconEyeOff size={17} />, onSelect: act("unpublish") }] : []),
    ...(p.restore ? [{ key: "restore", label: c.actions.restore, icon: <IconUndo size={17} />, onSelect: act("restore") }] : []),
    ...(p.archive ? [{ key: "archive", label: c.actions.archive, icon: <IconArchive size={17} />, onSelect: act("archive") }] : []),
    ...(p.delete ? [{ key: "delete", label: c.actions.delete, icon: <IconTrash size={17} />, onSelect: act("delete"), tone: "danger" as const }] : []),
  ];

  return <ActionsMenu label={c.actions.menu(article.title)} items={items} />;
}
