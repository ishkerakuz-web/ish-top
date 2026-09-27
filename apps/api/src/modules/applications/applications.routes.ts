import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { idParams, objectId, OBJECT_ID_RE } from "../../common/validation.js";
import { prisma } from "../../common/prisma.js";
import { Errors } from "../../common/errors.js";
import { requireAuth, requireRole, requirePhoneVerified } from "../../common/auth-guard.js";
import { escapeHtml } from "../../common/mailer.js";
import { ownedCompanyIds } from "../../common/ownership.js";
import { deliverMessage, getOrCreateConversation } from "../chat/chat.service.js";
import { notify } from "../notifications/notifications.service.js";
import { withPublicSalary } from "../vacancies/vacancies.service.js";

const applySchema = z.object({
  resumeId: objectId().optional(),
  coverLetter: z.string().trim().max(5000).optional(),
  // `source` so'rov tanasidan olib tashlandi (audit R3, employer-flows-20): kanalni server biladi,
  // aks holda sayt orqali yuborilgan arizaga "Telegram orqali" yorlig'ini qo'yib bo'lardi.
});

const statusSchema = z.object({
  status: z.enum(["viewed", "invited", "rejected", "accepted"]),
  reason: z.string().trim().max(4000).optional(),
});

const STATUS_VALUES = ["sent", "viewed", "invited", "rejected", "accepted"] as const;
type StatusValue = (typeof STATUS_VALUES)[number];

/**
 * Javob hajmi va so'rov chegaralari (audit R3, D-061 / db-perf-1 / scale-10k-2).
 * "Murojaatlar" ro'yxati server tomonida sahifalanadi va filtrlanadi; to'liq rezyume,
 * ariza xati va holat tarixi faqat `GET /api/employer/applications/:id` da.
 */
const EMPLOYER_PAGE_SIZE_MAX = 50;
const EMPLOYER_PAGE_MAX = 200;
const EMPLOYER_PAGE_SIZE_DEFAULT = 20;
/** Bitta ish beruvchining vakansiyalari (ID + sarlavha) — filtr variantlari uchun ham shu ro'yxat. */
const OWNED_VACANCY_LIMIT = 2000;
/** Hudud va matn filtrlari uchun shu ish beruvchining arizachilari (yengil proyeksiya, chegaralangan). */
const APPLICANT_SCAN_LIMIT = 10000;
const SKILL_MATCH_LIMIT = 20000;
/** Matn bo'yicha global moslik chegarasi (ism, email, rezyume sarlavhasi): natija shundan keyin
 *  ish beruvchining arizachilari bilan kesishtiriladi (audit R3, o'lchangan). */
const TEXT_MATCH_LIMIT = 5000;
/** Nomzodning o'z arizalari — chegaralangan (audit R3, db-perf-18). */
const MY_APPLICATIONS_LIMIT = 300;
const VACANCY_APPLICATIONS_LIMIT = 500;
const PERIOD_DAYS = { "7d": 7, "30d": 30 } as const;

const STATUS_UZ: Record<string, string> = {
  viewed: "Ko'rildi 👀",
  invited: "Suhbatga taklif qilindingiz 🎉",
  accepted: "Qabul qilindingiz ✅",
  rejected: "Rad etildi ❌",
};

/** Bo'sh satr — "parametr berilmagan" (`?status=` kabi URL'lar 400 bermasin). */
const blank = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), schema);

const employerListQuery = z.object({
  // Chegaradan tashqari yoki raqam bo'lmagan `page`/`pageSize` — 400 (audit R3, D-061): jimgina
  // standart qiymatga tushish "hammasini ber" so'rovini yashirar va klientga noto'g'ri sahifa
  // ko'rsatardi. Berilmagan (yoki bo'sh) qiymat uchun standart ishlatiladi.
  page: blank(z.coerce.number().int().min(1).max(EMPLOYER_PAGE_MAX).default(1)),
  pageSize: blank(z.coerce.number().int().min(1).max(EMPLOYER_PAGE_SIZE_MAX).default(EMPLOYER_PAGE_SIZE_DEFAULT)),
  status: blank(z.enum(STATUS_VALUES).optional()),
  vacancyId: blank(objectId().optional()),
  q: blank(z.string().trim().max(100).optional()),
  /** Nomzod hududi: slug (`tashkent`), ObjectId yoki nom. */
  region: blank(z.string().trim().max(120).optional()),
  period: blank(z.enum(["7d", "30d"]).optional()),
  sort: blank(z.enum(["newest", "oldest"]).catch("newest")),
});

type EmployerListQuery = z.infer<typeof employerListQuery>;

const like = (value: string) => ({ contains: value, mode: "insensitive" as const });
const emptyCounts = (): Record<"all" | StatusValue, number> => ({ all: 0, sent: 0, viewed: 0, invited: 0, rejected: 0, accepted: 0 });

/** Qidiruv so'zlari (2+ belgi, ko'pi bilan 6 ta) — vakansiya qidiruvi bilan bir xil qoida. */
function searchTerms(text: string): string[] {
  return text.trim().split(/\s+/).filter((term) => term.length >= 2).slice(0, 6);
}

/**
 * Har bir so'z shu maydonda uchrashi shart (AND). Prisma `contains` MongoDB uchun qiymatni
 * o'zi ekranlaydi — regex belgilarini qo'lda qo'shmaymiz.
 */
const containsAll = (terms: string[]) => terms.map((term) => like(term));

const LIST_VACANCY_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  employmentType: true,
  workplaceType: true,
  salaryMin: true,
  salaryMax: true,
  isSalaryHidden: true,
  region: { select: { name: true, slug: true } },
} as const;

const LIST_PROFILE_SELECT = {
  firstName: true,
  lastName: true,
  headline: true,
  avatarUrl: true,
  isOpenToWork: true,
  // Faqat `hasResumeFile` uchun o'qiladi — fayl manzili ish beruvchiga chiqmaydi (audit R3, D-058)
  resumeUrl: true,
  region: { select: { name: true, slug: true } },
} as const;

type ListProfile = {
  firstName: string;
  lastName: string;
  headline: string | null;
  avatarUrl: string | null;
  isOpenToWork: boolean;
  resumeUrl: string | null;
  region: { name: string; slug: string } | null;
} | null;

/** Ism yo'q bo'lsa `null` — email o'rniga qo'yilmaydi (ro'yxatda aloqa ma'lumoti yuborilmaydi). */
function candidateCard(userId: string, profile: ListProfile) {
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  return {
    userId,
    name: name || null,
    headline: profile?.headline ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    isOpenToWork: profile?.isOpenToWork ?? false,
    region: profile?.region ?? null,
  };
}

/** PDF fayl manzili javobga chiqmaydi — faqat `hasResumeFile` bayrog'i (audit R3, D-058). */
function withoutResumeUrl(profile: NonNullable<ListProfile>) {
  const { resumeUrl: _ignored, ...rest } = profile;
  return rest;
}

/** Ish beruvchining vakansiyalari: kompaniya → vakansiya (indeksli, relation filtersiz). */
async function ownedVacancyCards(userId: string): Promise<{ id: string; title: string }[]> {
  const companyIds = await ownedCompanyIds(userId);
  if (companyIds.length === 0) return [];
  return prisma.vacancy.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true, title: true },
    take: OWNED_VACANCY_LIMIT,
  });
}

/** `region` — slug, ObjectId yoki nom. Topilmasa `null` (filtr hech narsaga mos kelmaydi). */
async function resolveRegionId(value: string): Promise<string | null> {
  if (OBJECT_ID_RE.test(value)) return value;
  const bySlug = await prisma.region.findUnique({ where: { slug: value }, select: { id: true } });
  if (bySlug) return bySlug.id;
  const byName = await prisma.region.findFirst({ where: { name: value }, select: { id: true } });
  return byName?.id ?? null;
}

/** Shu ish beruvchiga kelgan arizalarning nomzod va rezyume ID'lari (bir marta o'qiladi). */
type ApplicantScope = { userIds: string[]; resumeIds: string[] };

async function loadApplicantScope(vacancyIds: string[]): Promise<ApplicantScope> {
  const rows = await prisma.application.findMany({
    where: { vacancyId: { in: vacancyIds } },
    select: { jobSeekerId: true, resumeId: true },
    take: APPLICANT_SCAN_LIMIT,
  });
  const userIds = new Set<string>();
  const resumeIds = new Set<string>();
  for (const row of rows) {
    userIds.add(row.jobSeekerId);
    if (row.resumeId) resumeIds.add(row.resumeId);
  }
  return { userIds: [...userIds], resumeIds: [...resumeIds] };
}

/**
 * Ro'yxat filtrlari (holat va vakansiya tanlovisiz — ular sonlar uchun alohida qo'llanadi).
 * Katta kolleksiyalarda relation filter ($lookup) ishlatilmaydi: mos ID'lar oldindan,
 * chegaralangan so'rovlar bilan aniqlanadi (audit R3, D-068).
 */
async function buildListFilters(
  query: EmployerListQuery,
  vacancies: { id: string; title: string }[]
): Promise<Prisma.ApplicationWhereInput[]> {
  const filters: Prisma.ApplicationWhereInput[] = [];
  // Hudud va matn filtrlari bitta skandan foydalanadi (audit R3, D-068)
  let scope: ApplicantScope | null = null;
  const applicants = async () => (scope ??= await loadApplicantScope(vacancies.map((vacancy) => vacancy.id)));

  if (query.period) {
    filters.push({ createdAt: { gte: new Date(Date.now() - PERIOD_DAYS[query.period] * 86_400_000) } });
  }

  if (query.region) {
    const regionId = await resolveRegionId(query.region);
    if (!regionId) return [{ id: { in: [] } }];
    // Hudud filtri SHU ish beruvchining arizachilari ustida ishlaydi (audit R3, D-061/D-068):
    // avval arizachi ID'lari (indeksli, yengil proyeksiya), so'ng ular ichidan hududi mos profillar.
    // Ilgari butun bazadan 2000 ta profil olinardi — nomzodlari ko'p hududda ro'yxat va sonlar
    // jimgina to'liqsiz chiqardi. Relation filter ($lookup) baribir ishlatilmaydi.
    const { userIds } = await applicants();
    const rows = userIds.length
      ? await prisma.jobSeekerProfile.findMany({
          where: { regionId, userId: { in: userIds } },
          select: { userId: true },
        })
      : [];
    filters.push({ jobSeekerId: { in: rows.map((row) => row.userId) } });
  }

  const terms = searchTerms(query.q ?? "");
  if (terms.length > 0) {
    const lowered = terms.map((term) => term.toLowerCase());
    const vacancyIds = vacancies
      .filter((vacancy) => lowered.every((term) => vacancy.title.toLowerCase().includes(term)))
      .map((vacancy) => vacancy.id);

    // Matn uchun ID to'plamlari ham SHU ish beruvchining arizachilari ustida aniqlanadi
    // (audit R3, D-061/D-068). Ilgari butun bazadan chegaralangan (2000 ta) ro'yxat olinardi:
    // ko'p uchraydigan so'z (masalan lavozim nomi) bo'yicha qidirilganda chegaradan tashqarida
    // qolgan arizachi jimgina topilmasdi — hudud filtridagi bilan bir xil xato.
    const { userIds, resumeIds: appliedResumeIds } = await applicants();
    // DIQQAT (audit R3, o'lchangan): katta `$in` ro'yxati (bu yerda 5000+ ID) bilan birga regex
    // ishlatilganda MongoDB indeksdan foyda ko'rmaydi — bitta so'rov 3.2 s davom etdi. Shuning uchun
    // matn bo'yicha moslik CHEGARALANGAN global so'rov bilan topiladi (52 ms) va shu ish beruvchining
    // arizachilari bilan kesishma xotirada olinadi. Natija to'plami bir xil, tezligi ~60 barobar yaxshi.
    const userIdSet = new Set(userIds);
    const appliedResumeIdSet = new Set(appliedResumeIds);
    const [profileRows, userRows, resumeRows, skillRows] = await Promise.all([
      prisma.jobSeekerProfile.findMany({
        where: { AND: terms.map((term) => ({ OR: [{ firstName: like(term) }, { lastName: like(term) }, { headline: like(term) }] })) },
        select: { userId: true },
        take: TEXT_MATCH_LIMIT,
      }),
      prisma.user.findMany({
        where: { AND: containsAll(terms).map((filter) => ({ email: filter })) },
        select: { id: true },
        take: TEXT_MATCH_LIMIT,
      }),
      prisma.resume.findMany({
        where: { AND: containsAll(terms).map((filter) => ({ title: filter })) },
        select: { id: true },
        take: TEXT_MATCH_LIMIT,
      }),
      prisma.resumeSkill.findMany({
        where: { resumeId: { in: appliedResumeIds }, OR: terms.map((term) => ({ skillName: like(term) })) },
        select: { resumeId: true, skillName: true },
        take: SKILL_MATCH_LIMIT,
      }),
    ]);
    const profiles = profileRows.filter((row) => userIdSet.has(row.userId));
    const users = userRows.filter((row) => userIdSet.has(row.id));
    const resumes = resumeRows.filter((row) => appliedResumeIdSet.has(row.id));

    // Ko'nikmalar: har bir so'z rezyumening BIRORTA ko'nikmasida uchrashi kerak
    const skillsByResume = new Map<string, string[]>();
    for (const row of skillRows) {
      const list = skillsByResume.get(row.resumeId);
      if (list) list.push(row.skillName.toLowerCase());
      else skillsByResume.set(row.resumeId, [row.skillName.toLowerCase()]);
    }
    const resumeIds = new Set(resumes.map((resume) => resume.id));
    for (const [resumeId, names] of skillsByResume) {
      if (lowered.every((term) => names.some((name) => name.includes(term)))) resumeIds.add(resumeId);
    }

    const or: Prisma.ApplicationWhereInput[] = [];
    if (profiles.length) or.push({ jobSeekerId: { in: profiles.map((row) => row.userId) } });
    if (users.length) or.push({ jobSeekerId: { in: users.map((row) => row.id) } });
    if (vacancyIds.length) or.push({ vacancyId: { in: vacancyIds } });
    if (resumeIds.size) or.push({ resumeId: { in: [...resumeIds] } });

    // Xat matni (`coverLetter`) bo'yicha qidiruv — indekslanmaydigan regex skani. U ro'yxat va
    // sonlar so'rovlarida IKKI marta bajarilib, eng katta ish beruvchida (6123 ariza) ~1.5 s dan
    // ortiq turardi (audit R3, o'lchangan). Shuning uchun u faqat ism, email, rezyume sarlavhasi,
    // ko'nikma va vakansiya nomi bo'yicha hech narsa topilmaganda, bir marta va chegaralangan
    // holda ishlaydi; topilgan ID'lar keyin indeks bo'yicha ishlatiladi.
    if (or.length === 0) {
      const coverMatches = await prisma.application.findMany({
        where: {
          vacancyId: { in: vacancies.map((vacancy) => vacancy.id) },
          AND: containsAll(terms).map((filter) => ({ coverLetter: filter })),
        },
        select: { id: true },
        take: TEXT_MATCH_LIMIT,
      });
      if (coverMatches.length) or.push({ id: { in: coverMatches.map((row) => row.id) } });
    }

    // Hech bir maydon mos kelmasa — bo'sh natija (Prisma'da bo'sh `OR` ni qoldirmaymiz)
    filters.push(or.length ? { OR: or } : { id: { in: [] } });
  }

  return filters;
}

export async function applicationRoutes(app: FastifyInstance) {
  // Nomzod ariza yuboradi. Yuborish tezligi cheklangan (audit R3, D-052: 30 / 10 daqiqa IP).
  app.post(
    "/api/vacancies/:id/apply",
    {
      preHandler: [requireAuth, requireRole("job_seeker"), requirePhoneVerified],
      config: { rateLimit: { max: 30, timeWindow: "10 minutes" } },
    },
    async (req, reply) => {
      const { id: vacancyId } = idParams.parse(req.params);
      const body = applySchema.parse(req.body);
      const userId = req.user!.sub;

      const vacancy = await prisma.vacancy.findUnique({
        where: { id: vacancyId },
        include: { company: { select: { ownerUserId: true } } },
      });
      if (!vacancy || vacancy.status !== "active") throw Errors.notFound();

      // Bir nomzod bir vakansiyaga faqat bir marta ariza yuboradi — mavjudini haqiqiy holati bilan qaytaramiz
      const existing = await prisma.application.findFirst({ where: { vacancyId, jobSeekerId: userId } });
      if (existing) return reply.status(200).send(existing);

      const profile = await prisma.jobSeekerProfile.findUnique({ where: { userId }, select: { id: true } });
      let resumeId: string | undefined;
      if (body.resumeId) {
        // Faqat O'Z rezyumesi (audit ISSUE-006): ilgari istalgan rezyume ID'si arizaga
        // biriktirilib, begona nomzod rezyumesi ish beruvchiga ochilardi.
        const own = profile
          ? await prisma.resume.findFirst({ where: { id: body.resumeId, jobSeekerId: profile.id }, select: { id: true } })
          : null;
        if (!own) throw Errors.badRequest("Rezyume topilmadi");
        resumeId = own.id;
      } else if (!vacancy.applyWithoutResume) {
        // Rezyume talab qilinsa va berilmagan bo'lsa — nomzodning rezyumesini avtomatik biriktiramiz
        const resume = profile
          ? await prisma.resume.findFirst({ where: { jobSeekerId: profile.id }, orderBy: { createdAt: "asc" }, select: { id: true } })
          : null;
        if (!resume) {
          throw Errors.badRequest("Bu vakansiyaga ariza yuborish uchun avval rezyumeni to'ldiring");
        }
        resumeId = resume.id;
      }

      let application;
      try {
        // Boshlang'ich "sent" tarix yozuvi ariza bilan bitta tranzaksiyada (audit R3, data-integrity-10)
        application = await prisma.$transaction(async (tx) => {
          const created = await tx.application.create({
            data: {
              vacancyId,
              jobSeekerId: userId,
              resumeId,
              coverLetter: body.coverLetter,
              source: "site",
            },
          });
          await tx.applicationStatusHistory.create({
            data: { applicationId: created.id, oldStatus: null, newStatus: "sent", changedBy: userId },
          });
          return created;
        });
      } catch (error) {
        // Parallel ikkinchi so'rov: unique indeks (P2002) yoki MongoDB yozuv konflikti (P2034).
        // Ikkala holatda ham birinchi so'rov yaratgan arizani qaytaramiz; hali commit bo'lmagan
        // bo'lsa qisqa kutib qayta o'qiymiz (audit ISSUE-086, R3 e2e).
        const known = error instanceof Prisma.PrismaClientKnownRequestError;
        if (known && (error.code === "P2002" || error.code === "P2034")) {
          for (let attempt = 0; attempt < 6; attempt++) {
            const current = await prisma.application.findFirst({ where: { vacancyId, jobSeekerId: userId } });
            if (current) return reply.status(200).send(current);
            await new Promise((resolve) => setTimeout(resolve, 80));
          }
        }
        throw error;
      }
      // `bumpDataVersion()` chaqirilmaydi: u barcha keshlarni (5 daqiqalik maosh to'plami, kompaniyalar katalogi,
      // facets) bekor qilardi, arizani esa faqat bosh sahifa statistikasi o'qiydi — undagi "bugungi arizalar"
      // soni 60 s gacha kechikishi mumkin (audit PHASE 6, U14)

      // Bildirishnoma — qaysi kanalga borishini notify() xizmati hal qiladi
      // (sayt ichida + Telegram + brauzer push + email, sozlamaga qarab)
      void notify({
        userId: vacancy.company.ownerUserId,
        type: "new_application",
        title: "Yangi ariza",
        body: `"${vacancy.title}" vakansiyasiga yangi nomzod ariza yubordi`,
        url: "/employer/applications",
        payload: { applicationId: application.id, vacancyId },
        // Web matnni joriy tilda chizadi; bazada `title`/`body` o'zbekcha qoladi (audit R3, D-059)
        i18n: { key: "application.new", params: { vacancyTitle: vacancy.title } },
        ctaLabel: "Arizani ko'rish",
        emailHtml: `<p style="margin:0">«<b>${escapeHtml(
          vacancy.title
        )}</b>» vakansiyangizga yangi nomzod ariza yubordi.</p>`,
      });

      return reply.status(201).send(application);
    }
  );

  // Nomzodning o'z arizalari (`/applications` sahifasi, profil, vakansiya sahifasi).
  // Faqat sahifaga kerakli maydonlar: kompaniyaning ichki ma'lumotlari (STIR,
  // egasining ID'si) nomzodga yuborilmaydi. Holat tarixi — haqiqiy o'zgarishlar.
  app.get(
    "/api/applications",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req) => {
      const rows = await prisma.application.findMany({
        where: { jobSeekerId: req.user!.sub },
        include: {
          vacancy: {
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              salaryMin: true,
              salaryMax: true,
              currency: true,
              isSalaryHidden: true,
              employmentType: true,
              experienceRequired: true,
              region: { select: { name: true, slug: true } },
              company: { select: { name: true, slug: true, logoUrl: true, isVerified: true } },
            },
          },
          resume: { select: { id: true, title: true } },
          statusHistory: {
            select: { oldStatus: true, newStatus: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        // Chegaralangan so'rov (audit R3, db-perf-18): eng yangi arizalar
        take: MY_APPLICATIONS_LIMIT,
      });
      return rows.map((row) => {
        // Moderatsiyadagi yoki rad etilgan e'lonning maosh raqamlari nomzodga ko'rsatilmaydi (audit R3, gap4-2)
        const moderated = row.vacancy.status === "moderation" || row.vacancy.status === "rejected";
        const vacancy = moderated
          ? { ...row.vacancy, salaryMin: null, salaryMax: null, isSalaryHidden: true, isUnavailable: true }
          : { ...withPublicSalary(row.vacancy), isUnavailable: false };
        // Yashirilgan maosh raqamlari javobga chiqmaydi (audit ISSUE-033)
        return { ...row, vacancy };
      });
    }
  );

  /**
   * Ish beruvchi — "Murojaatlar" ro'yxati: server tomonida sahifalash va filtrlash
   * (audit R3, D-061). Javob yengil: to'liq rezyume, ariza xati va holat tarixi yo'q —
   * ular `GET /api/employer/applications/:id` da. Sonlar bitta `groupBy` bilan.
   */
  app.get(
    "/api/employer/applications",
    { preHandler: [requireAuth, requireRole("employer", "admin")] },
    async (req) => {
      const query = employerListQuery.parse(req.query);
      const vacancies = await ownedVacancyCards(req.user!.sub);
      const base = {
        total: 0,
        page: 1,
        pageSize: query.pageSize,
        counts: emptyCounts(),
        vacancies: [] as { id: string; title: string; count: number }[],
      };
      if (vacancies.length === 0) return { items: [], ...base };

      const vacancyIds = vacancies.map((vacancy) => vacancy.id);
      const filters = await buildListFilters(query, vacancies);
      // Holat sonlari holat tanlovisiz, vakansiya sonlari esa vakansiya tanlovisiz hisoblanadi —
      // ikkalasi ham BITTA groupBy dan chiqadi (audit R3, db-perf-13: alohida `count` so'rovi yo'q).
      const countRows = await prisma.application.groupBy({
        by: ["vacancyId", "status"],
        where: { AND: [{ vacancyId: { in: vacancyIds } }, ...filters] },
        _count: { _all: true },
      });

      const counts = emptyCounts();
      const perVacancy = new Map<string, number>();
      for (const row of countRows) {
        const amount = row._count._all;
        perVacancy.set(row.vacancyId, (perVacancy.get(row.vacancyId) ?? 0) + amount);
        if (query.vacancyId && row.vacancyId !== query.vacancyId) continue;
        counts[row.status as StatusValue] += amount;
        counts.all += amount;
      }
      const vacancyOptions = vacancies
        .filter((vacancy) => perVacancy.has(vacancy.id))
        .map((vacancy) => ({ id: vacancy.id, title: vacancy.title, count: perVacancy.get(vacancy.id) ?? 0 }));

      // Begona vakansiya ID'si so'ralsa — bo'sh natija (o'zga kompaniya arizalari ochilmaydi)
      const scopeIds = query.vacancyId ? (vacancyIds.includes(query.vacancyId) ? [query.vacancyId] : []) : vacancyIds;
      const total = query.status ? counts[query.status] : counts.all;
      const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
      const page = Math.min(query.page, pageCount);

      const rows =
        total === 0 || scopeIds.length === 0
          ? []
          : await prisma.application.findMany({
              where: {
                AND: [{ vacancyId: { in: scopeIds } }, ...filters, ...(query.status ? [{ status: query.status }] : [])],
              },
              select: {
                id: true,
                status: true,
                createdAt: true,
                vacancyId: true,
                jobSeekerId: true,
                resumeId: true,
                vacancy: { select: LIST_VACANCY_SELECT },
                jobSeeker: { select: { jobSeekerProfile: { select: LIST_PROFILE_SELECT } } },
              },
              // `id` — ikkinchi mezon: bir xil sekundda yaratilgan arizalar tartibi barqaror bo'lsin,
              // aks holda skip/take bilan bitta ariza ikki sahifada chiqib, boshqasi tushib qolardi.
              orderBy: [
                { createdAt: query.sort === "oldest" ? "asc" : "desc" },
                { id: query.sort === "oldest" ? "asc" : "desc" },
              ],
              skip: (page - 1) * query.pageSize,
              take: query.pageSize,
            });

      return {
        items: rows.map((row) => ({
          id: row.id,
          status: row.status,
          createdAt: row.createdAt,
          jobSeekerId: row.jobSeekerId,
          hasResume: row.resumeId !== null,
          // Fayl manzili emas, faqat bayroq (audit R3, D-058)
          hasResumeFile: Boolean(row.jobSeeker.jobSeekerProfile?.resumeUrl),
          candidate: candidateCard(row.jobSeekerId, row.jobSeeker.jobSeekerProfile),
          vacancy: row.vacancy,
        })),
        total,
        page,
        pageSize: query.pageSize,
        counts,
        vacancies: vacancyOptions,
      };
    }
  );

  /**
   * Ish beruvchi — bitta arizaning to'liq tafsiloti (rezyume, ariza xati, holat tarixi, aloqa).
   * Faqat vakansiya egasi yoki admin; ID bo'yicha indeksli qidiruv.
   */
  app.get(
    "/api/employer/applications/:id",
    { preHandler: [requireAuth, requireRole("employer", "admin")] },
    async (req) => {
      const { id } = idParams.parse(req.params);
      const row = await prisma.application.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          source: true,
          coverLetter: true,
          createdAt: true,
          jobSeekerId: true,
          resumeId: true,
          vacancyId: true,
          vacancy: { select: { ...LIST_VACANCY_SELECT, company: { select: { ownerUserId: true } } } },
          statusHistory: {
            // "Faoliyat" — haqiqiy holat o'zgarishlari (kim o'zgartirgani yuborilmaydi)
            select: { oldStatus: true, newStatus: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
          jobSeeker: {
            select: {
              email: true,
              phone: true,
              jobSeekerProfile: { select: LIST_PROFILE_SELECT },
            },
          },
          resume: {
            select: {
              id: true,
              title: true,
              summary: true,
              desiredSalary: true,
              skills: { select: { skillName: true } },
              experience: { orderBy: { startDate: "desc" } },
              education: { orderBy: { startYear: "desc" } },
            },
          },
        },
      });
      if (!row) throw Errors.notFound();
      const { company, ...vacancy } = row.vacancy;
      if (company.ownerUserId !== req.user!.sub && req.user!.role !== "admin") throw Errors.forbidden();

      // Shu vakansiyadagi arizalar soni — indeksli ([vacancyId, status]) bitta hisob
      const applicationCount = await prisma.application.count({ where: { vacancyId: row.vacancyId } });
      const profile = row.jobSeeker.jobSeekerProfile;

      return {
        id: row.id,
        status: row.status,
        source: row.source,
        coverLetter: row.coverLetter,
        createdAt: row.createdAt,
        jobSeekerId: row.jobSeekerId,
        hasResume: row.resumeId !== null,
        hasResumeFile: Boolean(profile?.resumeUrl),
        candidate: {
          ...candidateCard(row.jobSeekerId, profile),
          // Aloqa ma'lumoti: nomzod aynan shu ish beruvchining vakansiyasiga ariza yuborgan (D-012)
          email: row.jobSeeker.email,
          phone: row.jobSeeker.phone,
        },
        vacancy: { ...vacancy, applicationCount },
        resume: row.resume,
        statusHistory: row.statusHistory,
      };
    }
  );

  // Ish beruvchi - vakansiya bo'yicha arizalar
  app.get(
    "/api/vacancies/:id/applications",
    { preHandler: [requireAuth, requireRole("employer", "admin")] },
    async (req) => {
      const { id: vacancyId } = idParams.parse(req.params);

      // Faqat O'Z vakansiyasi. Bunday tekshiruv yo'q edi: istalgan ish beruvchi
      // boshqasining vakansiya ID'sini kiritib, nomzodlarning ismi, telefoni,
      // emaili va rezyumesini to'liq ko'ra olardi.
      const vacancy = await prisma.vacancy.findUnique({
        where: { id: vacancyId },
        select: { company: { select: { ownerUserId: true } } },
      });
      if (!vacancy) throw Errors.notFound();
      if (vacancy.company.ownerUserId !== req.user!.sub && req.user!.role !== "admin") {
        throw Errors.forbidden();
      }

      // Aniq whitelist (audit ISSUE-001): ilgari `include` User'ning barcha maydonlarini —
      // parol hashi, telegramChatId, blok holatini — ish beruvchiga qaytarardi.
      const rows = await prisma.application.findMany({
        where: { vacancyId },
        select: {
          id: true,
          vacancyId: true,
          jobSeekerId: true,
          resumeId: true,
          coverLetter: true,
          source: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          resume: {
            select: {
              id: true,
              title: true,
              summary: true,
              desiredSalary: true,
              skills: { select: { skillName: true } },
              experience: { orderBy: { startDate: "desc" } },
              education: { orderBy: { startYear: "desc" } },
            },
          },
          jobSeeker: {
            select: {
              id: true,
              email: true,
              phone: true,
              jobSeekerProfile: { select: LIST_PROFILE_SELECT },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: VACANCY_APPLICATIONS_LIMIT,
      });

      // PDF rezyume manzili o'rniga bayroq (audit R3, D-058 / files-xss-2): fayl
      // `GET /api/resume-files/application/:id` orqali, avtorizatsiya bilan beriladi.
      return rows.map((row) => {
        const profile = row.jobSeeker.jobSeekerProfile;
        return {
          ...row,
          hasResumeFile: Boolean(profile?.resumeUrl),
          jobSeeker: { ...row.jobSeeker, jobSeekerProfile: profile ? withoutResumeUrl(profile) : null },
        };
      });
    }
  );

  // Ariza holatini o'zgartirish
  app.patch(
    "/api/applications/:id/status",
    { preHandler: [requireAuth, requireRole("employer", "admin")] },
    async (req, reply) => {
      const { id } = idParams.parse(req.params);
      const { status, reason } = statusSchema.parse(req.body);

      const application = await prisma.application.findUnique({
        where: { id },
        include: { vacancy: { include: { company: { select: { ownerUserId: true } } } } },
      });
      if (!application) throw Errors.notFound();
      const ownerUserId = application.vacancy.company.ownerUserId;
      // Faqat vakansiya egasi (ish beruvchi) holatni o'zgartira oladi
      if (ownerUserId !== req.user!.sub && req.user!.role !== "admin") {
        throw Errors.forbidden();
      }

      const { vacancy, ...current } = application;
      const reasonText = reason?.trim();
      const changed = application.status !== status;
      // Bir xil holat qayta yuborilsa — tarix ham, bildirishnoma ham yaratilmaydi (audit ISSUE-036)
      if (!changed && !reasonText) return current;

      // Izoh nomzodga suhbat xabari bo'lib boradi — chat bilan bir xil telefon tasdig'i talab qilinadi
      // (audit R3, employer-flows-13). Holatlar orasidagi o'tishlar qoidasi o'zgarmaydi (D-064).
      if (reasonText && req.user!.sub === ownerUserId) await requirePhoneVerified(req, reply);

      const updated = changed
        ? await prisma.$transaction(async (tx) => {
            const next = await tx.application.update({ where: { id }, data: { status } });
            await tx.applicationStatusHistory.create({
              data: {
                applicationId: id,
                oldStatus: application.status,
                newStatus: status,
                changedBy: req.user!.sub,
              },
            });
            return next;
          })
        : current;

      // Sabab yozilgan bo'lsa — nomzod bilan suhbatga real-time xabar sifatida yuboramiz.
      // Admin kompaniya nomidan yozmaydi: uning izohi faqat bildirishnomaga qo'shiladi.
      let conversationId: string | null = null;
      if (reasonText && req.user!.sub === ownerUserId) {
        const conv = await getOrCreateConversation(ownerUserId, application.jobSeekerId, vacancy.companyId);
        await deliverMessage(conv.id, ownerUserId, application.jobSeekerId, reasonText.slice(0, 4000));
        conversationId = conv.id;
      }

      if (changed) {
        const statusLabel = STATUS_UZ[status] ?? status;
        // Havola haqiqiy manzilga: izoh bo'lsa — o'sha suhbat, bo'lmasa — arizalar sahifasi (audit ISSUE-060)
        void notify({
          userId: application.jobSeekerId,
          type: "application_status_changed",
          title: "Ariza holati o'zgardi",
          body: `«${vacancy.title}» bo'yicha: ${statusLabel}`,
          url: conversationId ? `/messages?c=${conversationId}` : "/applications",
          payload: { applicationId: id, status },
          // `status` — ApplicationStatus enum qiymati, web uni o'z yorliqlari bilan chizadi (audit R3, D-059)
          i18n: { key: "application.statusChanged", params: { vacancyTitle: vacancy.title, status } },
          ctaLabel: conversationId ? "Suhbatni ochish" : "Arizalarimni ko'rish",
          emailHtml:
            `<p style="margin:0 0 8px">«<b>${escapeHtml(vacancy.title)}</b>» bo'yicha ` +
            `arizangiz holati: <b>${escapeHtml(statusLabel)}</b></p>` +
            (reasonText
              ? `<p style="margin:0;color:#57606a">Izoh: ${escapeHtml(reasonText.slice(0, 400))}</p>`
              : ""),
        });
      }

      return updated;
    }
  );
}
