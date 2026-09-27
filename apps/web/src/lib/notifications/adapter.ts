import type { NotificationType } from "../types.js";

/**
 * Lug'atning bildirishnoma uchun kerakli qismi (audit R3, D-059). To'liq `Messages`
 * ham mos keladi; test uchun kichik obyekt berish kifoya.
 */
export interface NotificationTemplateText {
  title: string;
  body: string;
}

export interface NotificationTexts {
  notificationTemplates: Record<string, NotificationTemplateText>;
  /** `status` parametri mavjud ariza holati yorliqlari bilan chiziladi. */
  applicationsPage: { status: Record<string, string> };
}

/** Server yuborgan tarjima kaliti: `payload.i18n = { key, params }`. */
export interface NotificationI18n {
  key: string;
  params: Record<string, string>;
}

/** Backend `NotificationType` enum'i (Prisma). */
export const NOTIFICATION_TYPES: readonly NotificationType[] = ["new_application", "application_status_changed", "new_vacancy_match", "system"];

/**
 * UI kategoriyasi — faqat backend turidan (yangi tur o'ylab topilmaydi):
 * ariza holati, obuna bo'yicha yangi vakansiya, tizim, ish beruvchiga yangi ariza.
 * Noma'lum tur (backend kelajakda qo'shsa) — "other", kategoriya belgisi chizilmaydi.
 */
export type NotificationCategory = "application" | "vacancy" | "system" | "applicant" | "other";
export const CATEGORY_ORDER: NotificationCategory[] = ["application", "vacancy", "system", "applicant", "other"];

const CATEGORY_OF: Record<NotificationType, NotificationCategory> = {
  application_status_changed: "application",
  new_vacancy_match: "vacancy",
  system: "system",
  new_application: "applicant",
};

/** Havola qayerga olib borishi — tugma matni shundan tanlanadi. */
export type NotificationTarget =
  | "applications"
  | "vacancy"
  | "vacancies"
  | "company"
  | "companies"
  | "profile"
  | "article"
  | "messages"
  | "alerts"
  | "pricing"
  | "employer"
  | "admin"
  | "page";

export interface NotificationView {
  id: string;
  type: NotificationType | null;
  category: NotificationCategory;
  /** Tarjima shabloni topilsa — joriy tildagi matn, aks holda bazadagi o'zbekcha matn (D-059). */
  title: string | null;
  body: string | null;
  /** Matn tarjima shablonidan olindimi (test va tuzatish uchun). */
  localized: boolean;
  /** Faqat sayt ichidagi nisbiy yo'l; yo'q bo'lsa havola tugmasi chizilmaydi. */
  url: string | null;
  target: NotificationTarget | null;
  isRead: boolean;
  createdAt: string | null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Sayt ichidagi yo'l: "/…". "//host" va "/\host" — boshqa saytga olib ketadi, rad etiladi. */
export function safeInternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  // Brauzer TAB/qator ko'chirishni olib tashlaydi: "/" + TAB + "/evil.example" tashqi saytga ochilardi.
  // Boshqaruv belgisi (kod < 32 yoki 127) yoki teskari chiziq (92) bo'lsa — rad (audit PHASE 6, U13)
  for (let i = 0; i < url.length; i++) {
    const code = url.charCodeAt(i);
    if (code < 32 || code === 127 || code === 92) return null;
  }
  if (!url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) return null;
  return url;
}

export function targetOf(url: string): NotificationTarget {
  const path = url.split(/[?#]/)[0];
  if (path === "/applications" || path.startsWith("/applications/")) return "applications";
  if (/^\/vacancies\/[^/]+/.test(path)) return "vacancy";
  if (path === "/vacancies") return "vacancies";
  if (/^\/companies\/[^/]+/.test(path)) return "company";
  if (path === "/companies") return "companies";
  if (path.startsWith("/profile")) return "profile";
  if (path.startsWith("/article")) return "article";
  if (path.startsWith("/messages")) return "messages";
  if (path.startsWith("/alerts")) return "alerts";
  // Tariflar sahifasi hozir yo'q (platforma bepul, `/pricing` → `/employer`) — eski bildirishnomada "Tariflarni ko'rish" chiqmasin
  if (path.startsWith("/pricing")) return "employer";
  if (path.startsWith("/employer")) return "employer";
  if (path.startsWith("/admin")) return "admin";
  return "page";
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * `payload.i18n` (yoki WebSocket freymidagi `i18n`) — { key, params }.
 * Parametrlar faqat oddiy qiymat (matn/son/mantiqiy); boshqasi tashlab yuboriladi.
 */
export function readNotificationI18n(raw: unknown): NotificationI18n | null {
  const r = record(raw);
  if (!r) return null;
  const source = record(r.i18n) ?? record(record(r.payload)?.i18n);
  if (!source) return null;
  const key = text(source.key);
  if (!key) return null;
  const params: Record<string, string> = {};
  const given = record(source.params);
  if (given) {
    for (const [name, value] of Object.entries(given)) {
      if (typeof value === "string") params[name] = value;
      else if (typeof value === "number" && Number.isFinite(value)) params[name] = String(value);
      else if (typeof value === "boolean") params[name] = String(value);
    }
  }
  return { key, params };
}

/** `{param}` o'rinlari. Kalit nomlari faqat harf/raqam/pastki chiziq. */
const PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;

/** Parametr yetishmasa `null` — chaqiruvchi bazadagi matnga qaytadi (D-059). */
function fillTemplate(template: string, params: Record<string, string>): string | null {
  let missing = false;
  const filled = template.replace(PLACEHOLDER, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      missing = true;
      return "";
    }
    return value;
  });
  if (missing) return null;
  // Bo'sh parametr (masalan sababsiz rad etish) qo'sh probel qoldiradi
  const clean = filled.replace(/ {2,}/g, " ").trim();
  return clean ? clean : null;
}

/**
 * Tarjima shablonini joriy tilda chizadi (audit R3, D-059).
 * Noma'lum kalit, shablonsiz til yoki yetishmayotgan parametr — `null` (bazadagi matn ishlatiladi).
 * Sof funksiya: tarmoq, `window` va vaqtga bog'liq emas.
 */
export function renderNotificationTemplate(i18n: NotificationI18n | null, t?: NotificationTexts | null): Partial<NotificationTemplateText> | null {
  if (!i18n || !t) return null;
  const templates = t.notificationTemplates as Record<string, NotificationTemplateText | undefined>;
  const template = templates?.[i18n.key];
  if (!template || typeof template.title !== "string" || typeof template.body !== "string") return null;
  const params = { ...i18n.params };
  // `status` — ariza holati enum'i: mavjud yorliqlar bilan chiziladi
  if (params.status) {
    const labels = t.applicationsPage?.status as Record<string, string | undefined> | undefined;
    const label = labels?.[params.status];
    if (label) params.status = label;
  }
  const title = fillTemplate(template.title, params);
  const body = fillTemplate(template.body, params);
  if (title === null && body === null) return null;
  return { ...(title !== null ? { title } : {}), ...(body !== null ? { body } : {}) };
}

/**
 * `GET /api/notifications` qatori → `NotificationView`. Bo'sh qator/`null`/noma'lum
 * tur normallashtiriladi; sarlavhasi ham, matni ham yo'q qator tashlab yuboriladi.
 * `isRead` aniq `false` bo'lmasa — o'qilgan (soxta "o'qilmagan" chizilmaydi).
 *
 * `t` berilsa (audit R3, D-059) `payload.i18n` kaliti joriy tilda chiziladi; kalit noma'lum,
 * parametr yetishmagan yoki `t` berilmagan bo'lsa — bazadagi o'zbekcha `title`/`body` qoladi.
 * Sof funksiya (unit test bilan tekshiriladi).
 */
export function mapNotificationToViewModel(raw: unknown, t?: NotificationTexts | null): NotificationView | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = text(r.id);
  if (!id) return null;
  const storedTitle = text(r.title);
  const storedBody = text(r.body);
  const localized = renderNotificationTemplate(readNotificationI18n(r), t);
  const title = text(localized?.title) ?? storedTitle;
  const body = text(localized?.body) ?? storedBody;
  if (!title && !body) return null;
  const type = typeof r.type === "string" && (NOTIFICATION_TYPES as readonly string[]).includes(r.type) ? (r.type as NotificationType) : null;
  // Havola REST javobida yuqorida, WebSocket freymida ham; eski yozuvlarda `payload.url`
  const url = safeInternalUrl(r.url) ?? safeInternalUrl(record(r.payload)?.url);
  return {
    id,
    type,
    category: type ? CATEGORY_OF[type] : "other",
    title,
    body,
    localized: Boolean(localized),
    url,
    target: url ? targetOf(url) : null,
    isRead: r.isRead !== false,
    createdAt: isoDate(r.createdAt),
  };
}

/**
 * Serverdan kelgan xom qator (REST yoki WebSocket freymi). Xuk'lar aynan shu ko'rinishda
 * saqlaydi va har chizishda joriy til bilan modelga aylantiradi — til almashtirilganda
 * matn ham almashadi (audit R3, D-059).
 */
export type NotificationRow = Record<string, unknown>;

/** Obyekt va id'si bor qatormi (boshqasi ro'yxatga umuman qo'shilmaydi). */
export function isNotificationRow(raw: unknown): raw is NotificationRow {
  const r = record(raw);
  return Boolean(r && text(r.id));
}

export function notificationRowId(raw: unknown): string | null {
  const r = record(raw);
  return r ? text(r.id) : null;
}

/** Xom qatorlar → ko'rinish modellari (matnsiz qatorlar tashlab yuboriladi). */
export function mapNotificationRows(rows: readonly NotificationRow[], t?: NotificationTexts | null): NotificationView[] {
  const items: NotificationView[] = [];
  for (const row of rows) {
    const view = mapNotificationToViewModel(row, t);
    if (view) items.push(view);
  }
  return items;
}

/** Ish izlovchiga ish beruvchi/admin sahifasiga havola ko'rsatilmaydi (ochilmaydi). */
export function canOpenTarget(target: NotificationTarget | null, role: string | null): boolean {
  if (!target) return false;
  if (target === "admin") return role === "admin";
  if (target === "employer") return role === "employer" || role === "admin";
  return true;
}
