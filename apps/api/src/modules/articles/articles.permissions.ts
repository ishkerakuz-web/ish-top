/**
 * Maqola ruxsatlari — YAGONA manba. Admin API har bir amalni shu bilan
 * tekshiradi; javobdagi `permissions` obyekti ham shundan hisoblanadi (UI faqat
 * ruxsat berilgan tugmalarni chizadi, lekin tekshiruv baribir serverda).
 *
 *   SUPER_ADMIN (admin)       — hammasi, o'chirish faqat shu rolda
 *   CONTENT_EDITOR            — istalgan maqolani tahrirlash, ko'rib chiqish, chop etish, arxivlash
 *   CONTENT_AUTHOR            — faqat o'z maqolasi: qoralamani tahrirlash, ko'rib chiqishga
 *                               yuborish va qaytarib olish; chop etilganini o'zgartira olmaydi
 */
import type { ArticleStatus, UserRole } from "@prisma/client";

export const STAFF_ROLES: UserRole[] = ["admin", "content_editor", "content_author"];
export const EDITOR_ROLES: UserRole[] = ["admin", "content_editor"];

export const TRANSITIONS = ["submit", "return", "publish", "unpublish", "archive", "restore"] as const;
export type ArticleTransition = (typeof TRANSITIONS)[number];

export const TRANSITION_TARGET: Record<ArticleTransition, ArticleStatus> = {
  submit: "in_review",
  return: "draft",
  publish: "published",
  unpublish: "draft",
  archive: "archived",
  restore: "draft",
};

export type ArticlePermissions = Record<"edit" | ArticleTransition | "delete", boolean>;

interface Subject {
  authorId: string | null;
  status: ArticleStatus;
}

export function isEditorRole(role: UserRole): boolean {
  return EDITOR_ROLES.includes(role);
}

/** Muallif faqat o'z maqolalarini ko'radi; muharrir va admin — hammasini. */
export function canViewArticle(role: UserRole, userId: string, article: Subject): boolean {
  return isEditorRole(role) || (role === "content_author" && article.authorId === userId);
}

export function articlePermissions(role: UserRole, userId: string, article: Subject): ArticlePermissions {
  const editor = isEditorRole(role);
  const owner = role === "content_author" && article.authorId === userId;
  const { status } = article;
  return {
    edit: editor || (owner && status === "draft"),
    submit: (editor || owner) && status === "draft",
    // Muharrir qaytaradi (izoh bilan), muallif esa o'zi qaytarib oladi
    return: (editor || owner) && status === "in_review",
    publish: editor && status !== "published",
    unpublish: editor && status === "published",
    archive: editor && status !== "archived",
    restore: editor && status === "archived",
    delete: role === "admin",
  };
}
