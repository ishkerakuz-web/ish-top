/**
 * Jamoa rollari (UI tomoni). Haqiqiy tekshiruv serverda — bu yerda faqat qaysi
 * bo'lim va tugma chizilishi hal qilinadi.
 *
 *   admin           — SUPER_ADMIN: butun panel, jamoa, maqolani o'chirish
 *   content_editor  — maqolalar: tahrirlash, ko'rib chiqish, chop etish
 *   content_author  — o'z qoralamalari, ko'rib chiqishga yuborish
 *   moderator       — vakansiya, sharh, kompaniya tasdig'i va murojaatlar (maqolalarsiz)
 */
export const STAFF_ROLES = ["admin", "content_editor", "content_author"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Jamoa sahifasida tanlanadigan rollar: kontent rollari + moderator. */
export const TEAM_ROLES = ["admin", "content_editor", "content_author", "moderator"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/** Maqolalar bo'limiga kira oladiganlar. */
export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return typeof role === "string" && (STAFF_ROLES as readonly string[]).includes(role);
}

export function isEditorRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "content_editor";
}

/** Moderatsiya bo'limlari (vakansiya, sharh, kompaniya, murojaatlar, jurnal). */
export function canModerate(role: string | null | undefined): boolean {
  return role === "admin" || role === "moderator";
}

/** Jamoaning har qanday a'zosi (admin panelga kira oladi). */
export function isTeamRole(role: string | null | undefined): role is TeamRole {
  return typeof role === "string" && (TEAM_ROLES as readonly string[]).includes(role);
}
