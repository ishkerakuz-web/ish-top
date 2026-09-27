// Yangi bo'limlar uchun API qatlami: sevimlilar, bildirishnomalar, obunalar,
// tariflar, maosh statistikasi va admin paneli.
//
// Asosiy `api.ts` bilan bir xil uslub: xato bo'lsa `ApiError`, ulanish uzilsa
// bo'sh natija — sayt server o'chiq bo'lganda ham ochiladi.
import { API_URL, ApiError, ssrHeaders, withServerTimeout } from "./api.js";
import type {
  AdminBroadcast,
  AdminCompany,
  AdminCounters,
  AdminOverview,
  AdminSupportTicket,
  AdminUserDetail,
  AdminVacancyDetail,
  ModerationEventView,
  MyCompany,
  SupportTicketStatus,
  AdminPayment,
  AdminReview,
  AdminUser,
  AdminVacancy,
  CheckoutResult,
  FavoriteVacancy,
  InboxSummary,
  NotificationChannel,
  NotificationList,
  NotificationPref,
  NotificationType,
  Paged,
  PaymentRecord,
  PlanList,
  SalaryStats,
  SavedSearch,
  SavedSearchParams,
  SubscriptionState,
  Vacancy,
} from "./types.js";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Ulanish uzilsa `null` — chaqiruvchi zaxira qiymat beradi. */
async function tryFetch(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch {
    return null;
  }
}

async function get<T>(path: string, token: string | null, fallback: T): Promise<T> {
  const res = await tryFetch(path, token ? { headers: authHeaders(token) } : undefined);
  if (!res || !res.ok) return fallback;
  return (await res.json()) as T;
}

/**
 * Xatoni yashirmaydigan variant: tarmoq yoki server xatosida `ApiError` (status 0 — tarmoq).
 * Ro'yxat sahifalari "bo'sh" bilan "yuklab bo'lmadi"ni farqlashi uchun (audit ISSUE-021, ISSUE-022).
 */
async function getStrict<T>(path: string, token: string | null, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: token ? authHeaders(token) : undefined, signal });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "Serverga ulanib bo'lmadi", "NETWORK");
  }
  const json = (await res.json().catch(() => null)) as (T & { message?: string; error?: string }) | null;
  if (!res.ok || json === null) throw new ApiError(res.status, json?.message ?? "Kutilmagan xatolik", json?.error);
  return json as T;
}

/**
 * Xato bo'lsa `ApiError` uloqtiradi — forma va tugmalar shu bo'yicha xabar ko'rsatadi.
 *
 * Audit R3, api-errors-5: aloqa uzilsa brauzerning xom matni ("Failed to fetch")
 * o'rniga `ApiError(0, ..., "NETWORK")`, JSON bo'lmagan javob (502/504 HTML sahifasi)
 * esa `BAD_RESPONSE` kodi bilan keladi — UI ularni tarjima qilib ko'rsatadi.
 */
async function send<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  token: string | null,
  body?: unknown
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? authHeaders(token) : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "Serverga ulanib bo'lmadi", "NETWORK");
  }
  const json = (await res.json().catch(() => null)) as (T & { message?: string; error?: string }) | null;
  if (!res.ok) {
    throw new ApiError(res.status, json?.message ?? "Kutilmagan xatolik", json?.error);
  }
  // 204 (bo'sh tana) ham to'g'ri javob — faqat "ma'lumot kutilgan, lekin JSON emas" holati xato
  if (json === null && res.status !== 204) {
    throw new ApiError(res.status, "Kutilmagan xatolik", "BAD_RESPONSE");
  }
  return json as T;
}

/**
 * Xato matni (audit R3, i18n-3): API xabarlari faqat o'zbekcha, shuning uchun
 * ru/en interfeysda xom server matni ko'rsatilmaydi — chaqiruvchi bergan
 * tarjima qilingan umumiy xabar chiqadi. Tarmoq/JSON xatosi uchun alohida matn
 * berilishi mumkin. Ma'lum kodlar uchun tarjima kalitlari qo'shilgach,
 * chaqiruvchi ularni `byCode` orqali uzatadi.
 */
export function apiErrorText(
  error: unknown,
  locale: string,
  texts: { fallback: string; network?: string; byCode?: Record<string, string> }
): string {
  if (error instanceof ApiError) {
    const byCode = error.code ? texts.byCode?.[error.code] : undefined;
    if (byCode) return byCode;
    if (error.status === 0 || error.code === "NETWORK" || error.code === "BAD_RESPONSE") {
      return texts.network ?? texts.fallback;
    }
    if (locale === "uz" && error.message) return error.message;
    return texts.fallback;
  }
  // ApiError bo'lmagan xato (masalan xom TypeError) hech qachon ko'rsatilmaydi
  return texts.fallback;
}

/** Prisma vakansiyasini frontend kartasi shakliga keltiradi. */
function mapVacancyRow(raw: Record<string, unknown>): Vacancy {
  const company = raw.company as { name?: string; slug?: string } | undefined;
  const region = raw.region as { name?: string; slug?: string } | undefined;
  return {
    id: String(raw.id),
    slug: String(raw.slug),
    title: String(raw.title),
    companyName: company?.name ?? "",
    companySlug: company?.slug ?? "",
    regionName: region?.name ?? null,
    // Audit R3, i18n-4: slug saqlanadi — hudud nomi ru/en da ham tarjima qilinsin
    regionSlug: region?.slug ?? null,
    salaryMin: (raw.salaryMin as number | null) ?? null,
    salaryMax: (raw.salaryMax as number | null) ?? null,
    currency: (raw.currency as string) ?? "UZS",
    isSalaryHidden: Boolean(raw.isSalaryHidden),
    employmentType: (raw.employmentType as Vacancy["employmentType"]) ?? "full_time",
    experienceRequired: (raw.experienceRequired as Vacancy["experienceRequired"]) ?? "none",
    isPremium: Boolean(raw.isPremium),
    isUrgent: Boolean(raw.isUrgent),
    publishedAt: (raw.publishedAt as string | null) ?? null,
  };
}

// ---------------------------------------------------------
// Sevimlilar
// ---------------------------------------------------------

export async function fetchFavorites(token: string): Promise<FavoriteVacancy[]> {
  const json = await get<{ items: Record<string, unknown>[] }>("/api/favorites", token, { items: [] });
  return json.items.map((raw) => ({
    ...mapVacancyRow(raw),
    favoritedAt: String(raw.favoritedAt),
    isClosed: Boolean(raw.isClosed),
  }));
}

export async function fetchFavoriteIdsStrict(token: string): Promise<string[]> {
  const json = await getStrict<{ ids?: string[] }>("/api/favorites/ids", token);
  return Array.isArray(json.ids) ? json.ids : [];
}

/** Profil "Saqlanganlar" bo'limi uchun: API xatosi bo'sh ro'yxat bo'lib ko'rinmasin. */
export async function fetchFavoritesStrict(token: string): Promise<FavoriteVacancy[]> {
  const json = await getStrict<{ items?: Record<string, unknown>[] }>("/api/favorites", token);
  return (json.items ?? []).map((raw) => ({
    ...mapVacancyRow(raw),
    favoritedAt: String(raw.favoritedAt),
    isClosed: Boolean(raw.isClosed),
  }));
}

export function addFavorite(token: string, vacancyId: string) {
  return send<{ ok: true; favorited: boolean }>(`/api/favorites/${vacancyId}`, "POST", token, {});
}

export function removeFavorite(token: string, vacancyId: string) {
  return send<{ ok: true; favorited: boolean }>(`/api/favorites/${vacancyId}`, "DELETE", token);
}

/**
 * Audit R3, api-errors-7: xatoda uloqtiradi — 401/5xx yoki tarmoq uzilishi
 * "hech qanday kompaniya saqlanmagan" bo'lib ko'rinmasin (yuraklar bo'shab qolmasin).
 */
export async function fetchSavedCompanyIdsStrict(token: string): Promise<string[]> {
  const json = await getStrict<{ ids?: string[] }>("/api/favorites/companies/ids", token);
  return Array.isArray(json.ids) ? json.ids : [];
}

export function saveCompany(token: string, companyId: string) {
  return send<{ ok: true; saved: boolean }>(`/api/favorites/companies/${companyId}`, "POST", token, {});
}

export function unsaveCompany(token: string, companyId: string) {
  return send<{ ok: true; saved: boolean }>(`/api/favorites/companies/${companyId}`, "DELETE", token);
}

// ---------------------------------------------------------
// Bildirishnomalar
// ---------------------------------------------------------

const EMPTY_NOTIFICATIONS: NotificationList = { items: [], unreadCount: 0 };

export function fetchNotifications(token: string, options?: { unreadOnly?: boolean; limit?: number }) {
  const qs = new URLSearchParams();
  if (options?.unreadOnly) qs.set("unreadOnly", "true");
  if (options?.limit) qs.set("limit", String(options.limit));
  const suffix = qs.toString() ? `?${qs}` : "";
  return get<NotificationList>(`/api/notifications${suffix}`, token, EMPTY_NOTIFICATIONS);
}

/**
 * Header nishonlari (xabarlar, yangi arizalar) uchun: tarmoq yoki server xatosida `ApiError` —
 * chaqiruvchi oldingi sonni saqlaydi, vaqtinchalik xato nishonni 0 ga tushirmaydi (audit PHASE 6, U22).
 */
export async function fetchInboxSummaryStrict(token: string): Promise<InboxSummary> {
  const json = await getStrict<Partial<InboxSummary>>("/api/inbox/summary", token);
  return {
    unreadMessages: typeof json.unreadMessages === "number" ? json.unreadMessages : 0,
    newApplications: typeof json.newApplications === "number" ? json.newApplications : 0,
  };
}

export function markNotificationRead(token: string, id: string) {
  return send<{ ok: true }>(`/api/notifications/${id}/read`, "POST", token, {});
}

export function markAllNotificationsRead(token: string) {
  return send<{ updated: number }>("/api/notifications/read-all", "POST", token, {});
}

export function deleteNotification(token: string, id: string) {
  return send<{ ok: true }>(`/api/notifications/${id}`, "DELETE", token);
}

export async function fetchNotificationPrefs(token: string): Promise<NotificationPref[]> {
  const json = await get<{ items: NotificationPref[] }>("/api/notifications/preferences", token, {
    items: [],
  });
  return json.items;
}

export function saveNotificationPrefs(
  token: string,
  items: { notificationType: NotificationType; channel: NotificationChannel; isEnabled: boolean }[]
) {
  return send<{ ok: true }>("/api/notifications/preferences", "PUT", token, { items });
}

// --- Brauzer push ---

export async function fetchPushPublicKey(): Promise<string> {
  const json = await get<{ key: string }>("/api/push/public-key", null, { key: "" });
  return json.key;
}

export function subscribePush(
  token: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  return send<{ ok: true }>("/api/push/subscribe", "POST", token, subscription);
}

export function unsubscribePush(token: string, endpoint: string) {
  return send<{ ok: true }>("/api/push/unsubscribe", "POST", token, { endpoint });
}

// ---------------------------------------------------------
// Qidiruv obunalari
// ---------------------------------------------------------

export async function fetchSavedSearchesStrict(token: string, signal?: AbortSignal): Promise<SavedSearch[]> {
  const json = await getStrict<{ items?: SavedSearch[] }>("/api/saved-searches", token, signal);
  return json.items ?? [];
}

export function createSavedSearch(
  token: string,
  input: { name: string; queryParams: SavedSearchParams; frequency: "instant" | "daily" }
) {
  return send<SavedSearch>("/api/saved-searches", "POST", token, input);
}

export function updateSavedSearch(
  token: string,
  id: string,
  input: { name?: string; frequency?: "instant" | "daily"; emailAlertsEnabled?: boolean }
) {
  return send<{ ok: true }>(`/api/saved-searches/${id}`, "PATCH", token, input);
}

export function deleteSavedSearch(token: string, id: string) {
  return send<{ ok: true }>(`/api/saved-searches/${id}`, "DELETE", token);
}

// ---------------------------------------------------------
// Tariflar va to'lov
// ---------------------------------------------------------

const EMPTY_PLANS: PlanList = { items: [], providers: { payme: false, click: false } };

export function fetchPlans(): Promise<PlanList> {
  return get<PlanList>("/api/plans", null, EMPTY_PLANS);
}

export async function fetchSubscription(token: string): Promise<SubscriptionState | null> {
  const json = await get<{ subscription: SubscriptionState | null }>(
    "/api/employer/subscription",
    token,
    { subscription: null }
  );
  return json.subscription;
}

export async function fetchMyPayments(token: string): Promise<PaymentRecord[]> {
  const json = await get<{ items: PaymentRecord[] }>("/api/employer/payments", token, { items: [] });
  return json.items;
}

export function startCheckout(token: string, planSlug: string, provider: "payme" | "click") {
  return send<CheckoutResult>("/api/employer/subscription/checkout", "POST", token, {
    planSlug,
    provider,
  });
}

// ---------------------------------------------------------
// Maosh statistikasi
// ---------------------------------------------------------

const EMPTY_SALARY: SalaryStats = {
  summary: { count: 0, currency: "UZS", min: 0, max: 0, average: 0, median: 0, p25: 0, p75: 0 },
  distribution: [],
  byCategory: [],
  byRegion: [],
  byExperience: [],
  vacancyCount: 0,
  market: { count: 0, median: 0, average: 0 },
};

export interface SalaryStatsParams {
  role?: string;
  q?: string;
  categorySlug?: string;
  area?: string;
  /** `ExperienceLevel` qiymati (none, one_to_three, ...). */
  experience?: string;
}

/**
 * Maosh statistikasi. "Ma'lumot yo'q" (bo'sh natija) va "yuklab bo'lmadi"
 * farqlanadi: xatoda `ApiError` (tarmoq uzilsa status 0), bekor qilinsa AbortError.
 *
 * SSR'da so'rov 8 soniyadan uzun kutilmaydi (audit R3, api-errors-2) — sekin API
 * `/salaries` sahifasining SSR'ini platforma timeout'igacha osiltirib qo'ymasin.
 */
export async function fetchSalaryStats(params: SalaryStatsParams = {}, signal?: AbortSignal): Promise<SalaryStats> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/stats/salary${suffix}`, {
      headers: ssrHeaders(),
      signal: withServerTimeout(signal),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new ApiError(0, "Serverga ulanib bo'lmadi");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new ApiError(res.status, json?.message ?? "Kutilmagan xatolik", json?.error);
  return { ...EMPTY_SALARY, ...json } as SalaryStats;
}

// ---------------------------------------------------------
// Admin
// ---------------------------------------------------------

function adminQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

// Admin ro'yxatlari xatoni yashirmaydi: sahifalar xato holatini ko'rsatadi (audit ISSUE-021)
export function fetchAdminOverview(token: string, signal?: AbortSignal): Promise<AdminOverview> {
  return getStrict<AdminOverview>("/api/admin/overview", token, signal);
}

export function fetchAdminUsers(
  token: string,
  params: { text?: string; role?: string; page?: number } = {},
  signal?: AbortSignal
) {
  return getStrict<Paged<AdminUser>>(`/api/admin/users${adminQuery(params)}`, token, signal);
}

export function setUserBlocked(token: string, id: string, isBlocked: boolean) {
  return send<{ id: string; isBlocked: boolean }>(`/api/admin/users/${id}/block`, "PATCH", token, {
    isBlocked,
  });
}

export function setUserRole(token: string, id: string, role: "job_seeker" | "employer" | "admin") {
  return send<{ id: string; role: string }>(`/api/admin/users/${id}/role`, "PATCH", token, { role });
}

export function fetchAdminVacancies(
  token: string,
  params: { text?: string; status?: string; autoApproved?: boolean; page?: number } = {},
  signal?: AbortSignal
) {
  return getStrict<Paged<AdminVacancy>>(`/api/admin/vacancies${adminQuery(params)}`, token, signal);
}

export function moderateVacancy(
  token: string,
  id: string,
  input: { status?: "active" | "rejected" | "archived"; reason?: string; isPremium?: boolean }
) {
  return send<{ id: string; status: string; isPremium: boolean }>(
    `/api/admin/vacancies/${id}/moderate`,
    "PATCH",
    token,
    input
  );
}

export function fetchAdminCompanies(
  token: string,
  params: { text?: string; verified?: boolean; requested?: boolean; page?: number } = {},
  signal?: AbortSignal
) {
  return getStrict<Paged<AdminCompany>>(`/api/admin/companies${adminQuery(params)}`, token, signal);
}

export function verifyCompany(token: string, id: string, isVerified: boolean, note?: string) {
  return send<{ id: string; isVerified: boolean }>(
    `/api/admin/companies/${id}/verify`,
    "PATCH",
    token,
    { isVerified, ...(note ? { note } : {}) }
  );
}

// ---------------------------------------------------------------- moderatsiya ish joyi

export function fetchAdminCounters(token: string, signal?: AbortSignal) {
  return getStrict<AdminCounters>("/api/admin/counters", token, signal);
}

export function fetchAdminVacancy(token: string, id: string, signal?: AbortSignal) {
  return getStrict<AdminVacancyDetail>(`/api/admin/vacancies/${id}`, token, signal);
}

export type BulkResult = { done: number; failed: { id: string; code: string; message: string }[] };

export function bulkModerateVacancies(token: string, ids: string[], status: "active" | "rejected" | "archived", reason?: string) {
  return send<BulkResult>("/api/admin/vacancies/bulk", "POST", token, { ids, status, ...(reason ? { reason } : {}) });
}

export function bulkModerateReviews(token: string, ids: string[], action: "approved" | "rejected" | "delete") {
  return send<BulkResult>("/api/admin/reviews/bulk", "POST", token, { ids, action });
}

export function fetchModerationLog(
  token: string,
  params: { entityType?: string; entityId?: string; actor?: string; page?: number } = {},
  signal?: AbortSignal
) {
  return getStrict<Paged<ModerationEventView>>(`/api/admin/moderation-log${adminQuery(params)}`, token, signal);
}

export function fetchAdminSupport(
  token: string,
  params: { status?: string; kind?: string; page?: number } = {},
  signal?: AbortSignal
) {
  return getStrict<Paged<AdminSupportTicket> & { canReply: boolean }>(`/api/admin/support${adminQuery(params)}`, token, signal);
}

export function updateSupportTicket(token: string, id: string, input: { status?: SupportTicketStatus; adminNote?: string | null }) {
  return send<{ id: string; status: SupportTicketStatus; adminNote: string | null }>(`/api/admin/support/${id}`, "PATCH", token, input);
}

export function replySupportTicket(token: string, id: string, message: string) {
  return send<{ ok: true }>(`/api/admin/support/${id}/reply`, "POST", token, { message });
}

export function fetchAdminUser(token: string, id: string, signal?: AbortSignal) {
  return getStrict<AdminUserDetail>(`/api/admin/users/${id}`, token, signal);
}

export function fetchBroadcasts(token: string, signal?: AbortSignal) {
  return getStrict<{ items: AdminBroadcast[] }>("/api/admin/broadcasts", token, signal);
}

/** Ish beruvchi: kompaniyani tasdiqlash so'rovi (yuridik nom + STIR). */
export function requestCompanyVerification(token: string, input: { legalName: string; stir: string }) {
  return send<{ company: Pick<MyCompany, "id" | "isVerified" | "legalName" | "stir" | "verificationRequestedAt" | "verificationNote"> }>(
    "/api/employer/company/verification",
    "POST",
    token,
    input
  );
}

/** Vakansiya shikoyati (sabab + izoh), vakansiyaga bog'lanadi. */
export function reportVacancy(
  slug: string,
  input: { reason: "outdated" | "wrong" | "fraud" | "other"; comment?: string; email?: string },
  token: string | null
) {
  return send<{ ok: true }>(`/api/vacancies/${encodeURIComponent(slug)}/report`, "POST", token, input);
}

export function fetchAdminReviews(
  token: string,
  params: { status?: string; autoApproved?: boolean; page?: number } = {},
  signal?: AbortSignal
) {
  return getStrict<Paged<AdminReview>>(`/api/admin/reviews${adminQuery(params)}`, token, signal);
}

export function setReviewStatus(
  token: string,
  id: string,
  status: "pending" | "approved" | "rejected"
) {
  return send<{ id: string; status: string }>(`/api/admin/reviews/${id}`, "PATCH", token, { status });
}

export function deleteAdminReview(token: string, id: string) {
  return send<{ ok: true }>(`/api/admin/reviews/${id}`, "DELETE", token);
}

export function fetchAdminPayments(token: string, params: { status?: string; page?: number } = {}, signal?: AbortSignal) {
  return getStrict<Paged<AdminPayment>>(`/api/admin/payments${adminQuery(params)}`, token, signal);
}

export function confirmPayment(token: string, transactionId: string) {
  return send<{ ok: true }>(`/api/admin/payments/${transactionId}/confirm`, "POST", token, {});
}

export function reindexSearch(token: string) {
  return send<{ indexed: number; engine: string }>("/api/admin/search/reindex", "POST", token, {});
}

export function runAlertsNow(token: string) {
  return send<{ checked: number; notified: number; matched: number }>(
    "/api/admin/alerts/run",
    "POST",
    token,
    {}
  );
}

export function runAutoApproveNow(token: string) {
  return send<{ enabled: boolean; vacancies: number; vacanciesSkipped: number; reviews: number }>(
    "/api/admin/moderation/auto-approve/run",
    "POST",
    token,
    {}
  );
}

export function sendBroadcast(
  token: string,
  input: { title: string; body: string; role: "all" | "job_seeker" | "employer"; url?: string }
) {
  return send<{ sent: number }>("/api/admin/broadcast", "POST", token, input);
}
