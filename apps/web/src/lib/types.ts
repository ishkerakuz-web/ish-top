// Frontend ma'lumot tiplari (backend DTO'lari shu shaklga moslanadi).

export type EmploymentType = "full_time" | "part_time" | "remote" | "shift";
export type ExperienceLevel = "none" | "one_to_three" | "three_to_six" | "six_plus";
export type ScheduleType = "five_two" | "two_two" | "vahta" | "gibkiy" | "smenniy";
/** Ish joylashuvi. Masofaviy bo'lsa hudud ixtiyoriy. */
export type WorkplaceType = "office" | "hybrid" | "remote";

export interface Vacancy {
  id: string;
  slug: string;
  title: string;
  companyName: string;
  companySlug: string;
  regionName: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  isSalaryHidden: boolean;
  employmentType: EmploymentType;
  experienceRequired: ExperienceLevel;
  isPremium: boolean;
  isUrgent: boolean;
  publishedAt: string | null;
  // Ro'yxat javobidan (GET /api/vacancies) — boshqa manbalarda bo'lmasligi mumkin
  companyLogoUrl?: string | null;
  companyVerified?: boolean;
  regionSlug?: string | null;
  categoryName?: string | null;
  scheduleType?: ScheduleType | null;
  /** Noma'lum (eski e'lon) bo'lsa `null` — ko'rsatilmaydi. */
  workplaceType?: WorkplaceType | null;
  /** Talablar matnidan ajratilgan ma'lum ko'nikmalar (lib/vacancies/skills.ts). */
  skills?: string[];
}

export interface VacancyPage {
  items: Vacancy[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface VacancyFacets {
  total: number;
  regions: { slug: string; name: string; count: number }[];
  employment: { value: EmploymentType; count: number }[];
  experience: { value: ExperienceLevel; count: number }[];
  companies: { slug: string; name: string; isVerified: boolean; count: number }[];
  categories: { slug: string; name: string; count: number }[];
}

export interface Company {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
  regionName: string | null;
  industry: string | null;
  employeeCount: string | null;
  foundedYear: number | null;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  activeVacancyCount: number;
}

export interface CompanyReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  authorName: string;
  userId?: string;
  mine?: boolean;
  /** `pending` — moderatsiyada (ochiq ro'yxatda ko'rinmaydi). */
  status?: "pending" | "approved" | "rejected";
}

export interface Stats {
  vacancies: number;
  companies: number;
  applicationsToday: number;
}

/** `admin` — SUPER_ADMIN; kontent rollari faqat taklif orqali ochiladi (lib/admin/roles.ts). */
export type UserRole = "job_seeker" | "employer" | "admin" | "content_editor" | "content_author" | "moderator";

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
}

export interface Region {
  id: string;
  name: string;
  slug: string;
}

export interface Profile {
  email: string;
  role: UserRole;
  phone: string | null;
  isPhoneVerified: boolean;
  additionalPhone: string | null;
  firstName: string;
  lastName: string;
  headline: string | null;
  regionId: string | null;
  regionName: string | null;
  isOpenToWork: boolean;
  resumeUrl: string | null;
}

export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  additionalPhone?: string | null;
  headline?: string | null;
  regionId?: string | null;
  isOpenToWork?: boolean;
}

export interface ResumeExperienceItem {
  companyName: string;
  position: string;
  startDate: string; // YYYY-MM
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
}

export interface ResumeEducationItem {
  institution: string;
  degree: string | null;
  field: string | null;
  startYear: number;
  endYear: number | null;
}

export interface ResumeData {
  title: string;
  summary: string | null;
  desiredSalary: number | null;
  skills: string[];
  experience: ResumeExperienceItem[];
  education: ResumeEducationItem[];
}

export type ResumeInput = ResumeData;

export interface MyCompany {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  regionId: string | null;
  region?: Region | null;
  industry: string | null;
  employeeCount: string | null;
  foundedYear: number | null;
  isVerified: boolean;
  legalName?: string | null;
  stir?: string | null;
  /** Tasdiq so'rovi yuborilgan (admin hali qaror qilmagan). */
  verificationRequestedAt?: string | null;
  /** Oxirgi rad etish izohi. */
  verificationNote?: string | null;
}

export interface MyCompanyInput {
  name: string;
  description?: string | null;
  website?: string | null;
  regionId?: string | null;
  industry?: string | null;
  employeeCount?: string | null;
  foundedYear?: number | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export type ApplicationStatus = "sent" | "viewed" | "invited" | "rejected" | "accepted";

/** Arizaning haqiqiy holat o'zgarishi (`ApplicationStatusHistory`). */
export interface ApplicationHistoryEntry {
  status: ApplicationStatus;
  at: string;
}

/**
 * Nomzodning o'zi yuborgan ariza (`GET /api/applications`).
 * Ixtiyoriy maydonlar backend'da bo'lmasa `null` — UI ularni yashiradi.
 */
export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  source: "site" | "telegram";
  coverLetter: string | null;
  /** Ariza qaysi rezyume bilan yuborilgan (rezyumesiz vakansiyada yoki o'chirilgan bo'lsa `null`). */
  resume: { id: string; title: string } | null;
  /** Vaqt bo'yicha o'sib boruvchi holat tarixi; bo'sh bo'lishi mumkin. */
  history: ApplicationHistoryEntry[];
  vacancy: {
    id: string;
    slug: string;
    title: string;
    /** Vakansiya faol emas (arxivlangan, rad etilgan va h.k.). */
    isClosed: boolean;
    salaryMin: number | null;
    salaryMax: number | null;
    isSalaryHidden: boolean;
    employmentType: Vacancy["employmentType"] | null;
    experienceRequired: Vacancy["experienceRequired"] | null;
    regionSlug: string | null;
    regionName: string | null;
  };
  company: { name: string; slug: string; logoUrl: string | null; isVerified: boolean };
}

export interface EmployerVacancy {
  id: string;
  slug: string;
  title: string;
  /** draft | moderation | active | archived | rejected */
  status: string;
  /** Moderator rad etgan bo'lsa — sababi. */
  rejectionReason?: string | null;
  employmentType: EmploymentType;
  scheduleType?: ScheduleType | null;
  workplaceType?: WorkplaceType | null;
  experienceRequired: ExperienceLevel;
  salaryMin: number | null;
  salaryMax: number | null;
  isSalaryHidden?: boolean;
  region?: { name: string } | null;
  _count: { applications: number };
  // Tahrirlash formasi shu maydonlarni to'ldiradi (API to'liq yozuvni qaytaradi)
  description?: string;
  requirements?: string | null;
  conditions?: string | null;
  categoryId?: string | null;
  regionId?: string | null;
  applyWithoutResume?: boolean;
  contactEmail?: string | null;
  contactTelegram?: string | null;
  contactPhone?: string | null;
}

export interface VacancyCreateInput {
  title: string;
  description: string;
  requirements?: string;
  conditions?: string;
  /** Majburiy. */
  categoryId: string;
  /** Masofaviy bo'lmasa majburiy; `null` — tahrirlashda hududni olib tashlash (masofaviy). */
  regionId?: string | null;
  workplaceType: WorkplaceType;
  employmentType: EmploymentType;
  /** `null` — tahrirlashda grafikni olib tashlash. */
  scheduleType?: ScheduleType | null;
  experienceRequired?: ExperienceLevel;
  /** `null` — tahrirlashda maoshni olib tashlash. */
  salaryMin?: number | null;
  salaryMax?: number | null;
  isSalaryHidden?: boolean;
  applyWithoutResume?: boolean;
  contactEmail?: string;
  contactTelegram?: string;
  contactPhone?: string;
  /** Faqat yaratishda: "draft" — qoralama (saytda ko'rinmaydi). */
  status?: "active" | "draft";
}

export interface ApplicantResume {
  title: string;
  summary: string | null;
  desiredSalary: number | null;
  skills: { skillName: string }[];
  experience: {
    companyName: string;
    position: string;
    startDate: string;
    endDate: string | null;
    isCurrent: boolean;
    description: string | null;
  }[];
  education: {
    institution: string;
    degree: string | null;
    field: string | null;
    startYear: number;
    endYear: number | null;
  }[];
}

export interface EmployerApplication {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  jobSeekerId: string;
  vacancy: { id: string; title: string; slug: string };
  jobSeeker: {
    email: string;
    phone: string | null;
    jobSeekerProfile: {
      firstName: string;
      lastName: string;
      headline: string | null;
      isOpenToWork?: boolean;
      avatarUrl?: string | null;
      region?: { name: string } | null;
    } | null;
  };
  resume: ApplicantResume | null;
}

export interface Conversation {
  id: string;
  /** `null` — nom yo'q: server email qaytarmaydi (audit PHASE 6, V1). */
  title: string | null;
  subtitle: string | null;
  companySlug: string | null;
  otherUserId: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: number;
}

/** Suhbat bo'yicha o'zaro baho holati. */
export interface ConversationRating {
  eligible: boolean;
  myScore: number | null;
  myComment: string | null;
  otherAvg: number | null;
  otherCount: number;
}

/** Suhbatdoshning qisqa profili (chat'dagi modal uchun). */
export interface UserSummary {
  role: UserRole;
  /** Ism yoki kompaniya nomi; `null` — nom yo'q (email qaytarilmaydi, audit PHASE 6, V1). */
  name: string | null;
  headline: string | null;
  regionName: string | null;
  ratingAvg: number | null;
  ratingCount: number;
  isOpenToWork: boolean | null;
  resumeTitle: string | null;
  skills: string[];
  company: {
    name: string;
    slug: string;
    logoUrl: string | null;
    industry: string | null;
    description: string | null;
  } | null;
}

export interface InboxSummary {
  unreadMessages: number;
  newApplications: number;
}

export interface TelegramStatus {
  linked: boolean;
  phoneVerified: boolean;
  phone: string | null;
  /** Zaxira raqam (audit R3, D-047). Eski API javobida bo'lmasligi mumkin. */
  backupPhone?: string | null;
  /** Rule K (audit R3, D-051): bot ishlayaptimi. Maydon kelmasa "mavjud" deb hisoblanadi. */
  available?: boolean;
  botUsername: string | null;
}

/** Telegram deep-link javobi: havola va amal qilish muddati (audit R3, D-042). */
export interface TelegramLink {
  link: string;
  expiresAt: string | null;
}

export interface Candidate {
  userId: string;
  /** Faqat shu kompaniyaga ariza yuborgan nomzodda keladi (audit ISSUE-008); aks holda `null`. */
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  headline: string | null;
  regionName: string | null;
  isOpenToWork: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  resume: ApplicantResume | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

// ---------------------------------------------------------
// Sevimlilar, bildirishnomalar, obunalar, tariflar, admin
// ---------------------------------------------------------

/** Sevimlilar sahifasidagi karta — oddiy vakansiya + yopilgan holati. */
export interface FavoriteVacancy extends Vacancy {
  favoritedAt: string;
  isClosed: boolean;
}

export type NotificationType =
  | "new_application"
  | "application_status_changed"
  | "new_vacancy_match"
  | "system";

export type NotificationChannel = "in_app" | "email" | "push" | "telegram";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  url: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationList {
  items: AppNotification[];
  unreadCount: number;
}

export interface NotificationPref {
  notificationType: NotificationType;
  channel: NotificationChannel;
  isEnabled: boolean;
  /** Kanal serverda umuman sozlanmagan bo'lsa false (UI uni o'chiq ko'rsatadi). */
  available: boolean;
}

export interface SavedSearchParams {
  text?: string;
  categorySlug?: string;
  /** area / experience / employment / company — vergul bilan bir nechta bo'lishi mumkin. */
  area?: string;
  experience?: string;
  employment?: string;
  salary?: number;
  salaryTo?: number;
  company?: string;
  verified?: boolean;
  premium?: boolean;
}

export interface SavedSearch {
  id: string;
  name: string;
  params: SavedSearchParams;
  url: string;
  frequency: "instant" | "daily";
  emailAlertsEnabled: boolean;
  lastNotifiedAt: string | null;
  createdAt: string;
}

export interface SubscriptionPlan {
  slug: string;
  name: string;
  price: number;
  currency: string;
  durationDays: number;
  maxActiveVacancies: number;
  maxFeaturedVacancies: number;
  canSearchCandidates: boolean;
  features: string[];
}

export interface PlanList {
  items: SubscriptionPlan[];
  providers: { payme: boolean; click: boolean };
}

export interface SubscriptionState {
  slug: string;
  name: string;
  price: number;
  maxActiveVacancies: number;
  maxFeaturedVacancies: number;
  canSearchCandidates: boolean;
  expiresAt: string | null;
  expired: boolean;
  activeVacancies: number;
  featuredVacancies: number;
  canPostMore: boolean;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface PaymentRecord {
  id: string;
  transactionId: string | null;
  planName: string;
  amount: number;
  status: PaymentStatus;
  provider: "payme" | "click";
  paidAt: string | null;
  createdAt: string;
}

export interface CheckoutResult {
  paymentId: string;
  transactionId: string;
  amount: number;
  provider: "payme" | "click";
  checkoutUrl: string;
  manual: boolean;
}

// --- Maosh statistikasi ---

export interface SalarySummary {
  count: number;
  currency: string;
  min: number;
  max: number;
  average: number;
  median: number;
  p25: number;
  p75: number;
}

export interface SalaryBucket {
  label: string;
  from: number;
  to: number | null;
  count: number;
}

export interface SalaryGroup {
  name: string;
  slug: string;
  count: number;
  median: number;
  average: number;
}

export interface SalaryLevelStat {
  level: ExperienceLevel;
  count: number;
  median: number;
  average: number;
}

export interface SalaryStats {
  summary: SalarySummary;
  distribution: SalaryBucket[];
  /** Hudud va tajriba filtri bilan, lekin kategoriya filtrisiz (tanlangani ajratiladi). */
  byCategory: SalaryGroup[];
  /** Kategoriya va tajriba filtri bilan, lekin hudud filtrisiz. */
  byRegion: SalaryGroup[];
  /** Har doim 4 ta daraja; tajriba filtrisiz. */
  byExperience: SalaryLevelStat[];
  /** Tanlovga mos faol vakansiyalar (maoshi yashirinlari ham). */
  vacancyCount: number;
  /** Filtrsiz butun bozor. */
  market: { count: number; median: number; average: number };
}

// --- Admin ---

export interface AdminOverview {
  users: { total: number; seekers: number; employers: number; blocked: number; newThisWeek: number };
  companies: { total: number; verified: number };
  vacancies: { active: number; moderation: number };
  applications: { total: number; today: number };
  reviews: { pending: number };
  payments: { paid: number; revenue: number };
  search: { engine: string };
  /** `autoApproveHours: 0` — avto-tasdiq o'chiq. */
  moderation?: { autoApproveHours: number; autoApprovedUnreviewed?: number };
  support?: { open: number };
  verificationRequests?: number;
  chart: { date: string; users: number; applications: number }[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface AdminUser {
  id: string;
  email: string;
  phone: string | null;
  role: UserRole;
  isBlocked: boolean;
  isPhoneVerified: boolean;
  telegramLinked: boolean;
  name: string | null;
  companyName: string | null;
  applicationCount: number;
  createdAt: string;
}

export interface AdminVacancy {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "moderation" | "active" | "archived" | "rejected";
  companyName: string;
  companySlug: string;
  regionName: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  isPremium: boolean;
  viewsCount: number;
  applicationCount: number;
  rejectionReason: string | null;
  /** Moderatsiyadagi e'lon qachon avtomatik tasdiqlanadi (o'chiq bo'lsa null). */
  autoApproveAt?: string | null;
  /** Admin ko'rmasdan avtomatik tasdiqlangan — "Tekshirildi" bosilguncha belgili. */
  autoApprovedAt?: string | null;
  /** Navbatdagi e'lon joylashuv qoidasidan o'tmaydi — egasi to'ldirishi kerak. */
  placementIssue?: PlacementIssue | null;
  ownerBlocked?: boolean;
  companyVerified?: boolean;
  openReports?: number;
  createdAt: string;
}

export type PlacementIssue = "categoryId" | "workplaceType" | "regionId";

export interface ModerationEventView {
  id: string;
  entityType: "vacancy" | "review" | "company" | "ticket";
  entityId: string;
  action: string;
  /** null — tizim (avto-tasdiq) */
  actorName: string | null;
  actorId: string | null;
  reason: string | null;
  meta: Record<string, string | number | boolean> | null;
  createdAt: string;
}

export interface AdminVacancyDetail {
  id: string;
  slug: string;
  title: string;
  status: AdminVacancy["status"];
  description: string;
  requirements: string | null;
  conditions: string | null;
  categoryName: string | null;
  regionName: string | null;
  address: string | null;
  employmentType: string;
  scheduleType: string | null;
  workplaceType: string | null;
  experienceRequired: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  isSalaryHidden: boolean;
  contactEmail: string | null;
  contactTelegram: string | null;
  contactPhone: string | null;
  images: string[];
  isPremium: boolean;
  rejectionReason: string | null;
  placementIssue: PlacementIssue | null;
  autoApproveAt: string | null;
  autoApprovedAt: string | null;
  moderationSubmittedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  viewsCount: number;
  applicationCount: number;
  company: {
    id: string;
    name: string;
    slug: string;
    isVerified: boolean;
    website: string | null;
    createdAt: string;
    ownerUserId: string;
    ownerEmail: string;
    ownerBlocked: boolean;
    ownerPhoneMasked: string | null;
    vacancies: Partial<Record<AdminVacancy["status"], number>>;
  };
  reports: { id: string; subject: string | null; message: string; status: SupportTicketStatus; createdAt: string }[];
  history: ModerationEventView[];
}

export type SupportTicketStatus = "open" | "in_progress" | "resolved" | "dismissed";

export interface AdminSupportTicket {
  id: string;
  kind: "contact" | "vacancy_report";
  status: SupportTicketStatus;
  subject: string | null;
  name: string | null;
  email: string | null;
  message: string;
  adminNote: string | null;
  handledAt: string | null;
  repliedAt: string | null;
  createdAt: string;
  account: { id: string; email: string; role: UserRole } | null;
  vacancy: { id: string; title: string; slug: string; status: AdminVacancy["status"]; companyName: string } | null;
}

export interface AdminCounters {
  vacancies: number;
  reviews: number;
  companies: number;
  support: number;
  autoApproved: number;
  recovery: number;
}

export interface AdminBroadcast {
  id: string;
  title: string;
  audience: string;
  total: number;
  delivered: number;
  status: "running" | "done" | "failed";
  createdAt: string;
  finishedAt: string | null;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  phoneMasked: string | null;
  role: UserRole;
  isBlocked: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  telegramLinked: boolean;
  createdAt: string;
  name: string | null;
  headline: string | null;
  regionName: string | null;
  companies: { id: string; name: string; slug: string; isVerified: boolean; verificationRequestedAt: string | null; createdAt: string }[];
  vacancies: {
    items: { id: string; slug: string; title: string; status: AdminVacancy["status"]; autoApprovedAt: string | null; createdAt: string }[];
    total: number;
  };
  applications: {
    items: {
      id: string;
      status: string;
      createdAt: string;
      vacancyTitle: string;
      vacancySlug: string;
      vacancyStatus: AdminVacancy["status"];
      companyName: string;
    }[];
    total: number;
  };
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    status: AdminReview["status"];
    createdAt: string;
    companyName: string;
    companySlug: string;
  }[];
  tickets: { id: string; kind: AdminSupportTicket["kind"]; subject: string | null; status: SupportTicketStatus; message: string; createdAt: string }[];
  securityEvents: { id: string; type: string; meta: Record<string, unknown> | null; actorId: string | null; createdAt: string }[];
}

export interface AdminCompany {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  ownerUserId?: string;
  isVerified: boolean;
  legalName?: string | null;
  stir?: string | null;
  website?: string | null;
  verificationRequestedAt?: string | null;
  verificationNote?: string | null;
  planName: string | null;
  subscriptionExpiresAt: string | null;
  vacancyCount: number;
  reviewCount: number;
  createdAt: string;
}

export interface AdminReview {
  id: string;
  rating: number;
  comment: string | null;
  status: "pending" | "approved" | "rejected";
  companyName: string;
  companySlug: string;
  authorName: string;
  autoApproveAt?: string | null;
  autoApprovedAt?: string | null;
  createdAt: string;
}

export interface AdminPayment {
  id: string;
  transactionId: string | null;
  companyName: string;
  planName: string;
  amount: number;
  status: PaymentStatus;
  provider: "payme" | "click";
  paidAt: string | null;
  createdAt: string;
}
