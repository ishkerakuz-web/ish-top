import type { FastifyInstance } from "fastify";
import type { Prisma, VacancyStatus } from "@prisma/client";
import { z } from "zod";
import { OBJECT_ID_RE, idParams, objectId } from "../../common/validation.js";
import {
  listVacancies,
  vacancyFacets,
  getVacancyBySlug,
  similarVacancies,
  createVacancy,
  syncVacancyIndex,
} from "./vacancies.service.js";
import { requireAuth, requireRole, requirePhoneVerified } from "../../common/auth-guard.js";
import { prisma } from "../../common/prisma.js";
import { AppError, Errors } from "../../common/errors.js";
import { bumpDataVersion } from "../../common/cache.js";
import { recordView } from "../../common/views.js";
import { ownedCompanyIds, primaryCompany } from "../../common/ownership.js";
import { WORKPLACE_VALUES, assertVacancyPlacement, effectiveWorkplaceType, requiresPremoderation } from "./vacancies.rules.js";

/** "1" / "true" → true; boshqa har qanday qiymat → false; berilmasa — undefined. */
const flag = z.preprocess((v) => (v === undefined || v === "" ? undefined : v === "1" || v === "true" || v === true), z.boolean().optional());

/**
 * URL'dagi son: buzilgan qiymat (Infinity, "abc", manfiy) 500 emas — e'tiborsiz qoladi
 * (eskirgan havola sahifani yiqitmasin; audit ISSUE-044).
 */
const queryInt = (min: number, max: number) => z.coerce.number().int().min(min).max(max).optional().catch(undefined);

/** Juda uzun erkin matn qisqartiriladi (qidiruv 6 so'zdan ortig'ini baribir ishlatmaydi). */
const queryText = (max: number) => z.string().optional().transform((v) => v?.slice(0, max));

// area / experience / employment / company — bitta qiymat yoki vergul bilan bir nechta
const listQuerySchema = z.object({
  text: queryText(200),
  categorySlug: queryText(120),
  area: z.string().max(500).optional(),
  experience: z.string().max(200).optional(),
  employment: z.string().max(200).optional(),
  salary: queryInt(0, 2_147_483_647),
  salaryTo: queryInt(0, 2_147_483_647),
  company: z.string().max(2000).optional(),
  verified: flag,
  premium: flag,
  sort: z.enum(["relevance", "date", "salary_desc", "salary_asc", "popular"]).optional(),
  // Juda katta sahifa raqami cheklanadi: 20k e'londa 1000 sahifadan oshmaydi, katta `skip` bazani skan qiladi
  page: queryInt(1, Number.MAX_SAFE_INTEGER).transform((v) => (v === undefined ? v : Math.min(v, 1000))),
  pageSize: queryInt(1, 50),
});

// Maosh — butun so'm (Prisma `Int`); `null` — tahrirlashda maoshni olib tashlash.
// Ilgari o'nlik son 500 berardi, bo'shatib bo'lmasdi.
const salary = z.union([z.null(), z.coerce.number().int().min(0).max(2_147_483_647)]).optional();

// Matn uzunliklari cheklangan (audit ISSUE-044): ilgari 200 KB sarlavha ham saqlanardi
const createSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(20_000),
  requirements: z.string().max(10_000).optional(),
  conditions: z.string().max(10_000).optional(),
  // Kategoriya va ish joylashuvi majburiy; hudud — masofaviy bo'lmasa (`assertVacancyPlacement`)
  categoryId: z.string({ required_error: "Kategoriyani tanlang", invalid_type_error: "Kategoriyani tanlang" }).regex(OBJECT_ID_RE, "ID formati noto'g'ri"),
  regionId: objectId().nullable().optional(),
  workplaceType: z.enum(WORKPLACE_VALUES, { errorMap: () => ({ message: "Ish joylashuvini tanlang" }) }),
  employmentType: z.enum(["full_time", "part_time", "remote", "shift"]),
  // Ish grafigi — modelda va vakansiya sahifasida bor edi, API qabul qilmasdi
  scheduleType: z.enum(["five_two", "two_two", "vahta", "gibkiy", "smenniy"]).nullable().optional(),
  experienceRequired: z.enum(["none", "one_to_three", "three_to_six", "six_plus"]).optional(),
  salaryMin: salary,
  salaryMax: salary,
  isSalaryHidden: z.boolean().optional(),
  applyWithoutResume: z.boolean().optional(),
  // Bog'lanish yo'llari — ixtiyoriy; bo'sh satr "o'chirish" degani
  contactEmail: z.union([z.string().trim().email().max(120), z.literal("")]).optional(),
  contactTelegram: z
    .string()
    .trim()
    .max(64)
    .transform((v) => v.replace(/^@+/, ""))
    .optional(),
  contactPhone: z.string().trim().max(32).optional(),
});

// Yaratishda: "draft" — qoralama (saytda ko'rinmaydi, limitga kirmaydi). Boshqa holatni
// (moderatsiya, rad etilgan...) ish beruvchi o'zi qo'ya olmaydi.
const createBodySchema = createSchema.extend({ status: z.enum(["active", "draft"]).optional() });

// Tahrirlashda barcha maydonlar ixtiyoriy (qisman yangilash); holat bu yerda o'zgarmaydi
const updateSchema = createSchema.partial();

/**
 * Ish beruvchi dashboard'i endi SERVER tomonida sahifalanadi (audit R3, D-068; db-perf-8,
 * employer-flows-4, scale-10k-13): ilgari 1000 tagacha TO'LIQ hujjat va har qator uchun
 * `_count` ($lookup) qaytardi (500 e'londa ~987 KB), tahrirlash formasi esa bitta yozuvni
 * topish uchun butun ro'yxatni yuklardi.
 */
const EMPLOYER_PAGE_SIZE_DEFAULT = 20;
const EMPLOYER_PAGE_SIZE_MAX = 50;
/**
 * Statistika va "jami arizalar" uchun eng ko'p shuncha `id` o'qiladi (faqat `_id` + sana).
 * Bitta kompaniyada bundan ko'p e'lon real holatda kutilmaydi; chegaradan oshsa sonlar
 * eng yangi shuncha e'lon bo'yicha hisoblanadi (javobda `countsCapped: true`).
 */
const EMPLOYER_AGGREGATE_LIMIT = 2000;

const EMPLOYER_SORTS = ["newest", "oldest", "applications", "title"] as const;
const VACANCY_STATUS_VALUES = ["draft", "moderation", "active", "archived", "rejected"] as const;

const employerListSchema = z.object({
  text: z.string().max(100).optional().catch(undefined),
  status: z.enum(VACANCY_STATUS_VALUES).optional().catch(undefined),
  region: z.string().max(120).optional().catch(undefined),
  category: z.string().max(120).optional().catch(undefined),
  sort: z.enum(EMPLOYER_SORTS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
  pageSize: z.coerce.number().int().min(1).max(EMPLOYER_PAGE_SIZE_MAX).optional().catch(undefined),
});

/** Hech qachon mos kelmaydigan ObjectId: noma'lum slug bilan filtr bo'sh natija beradi (500 emas). */
const NO_MATCH_ID = "000000000000000000000000";

/** Prisma `contains` MongoDB'da regexga aylanadi — foydalanuvchi matnidagi maxsus belgilar zararsizlantiriladi. */
function plainSearchText(value: string | undefined): string {
  return (value ?? "").replace(/[\\^$.*+?()[\]{}|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

/** Dashboard kartasi uchun yetarli maydonlar (tavsif va talablar ro'yxatga kerak emas). */
const EMPLOYER_CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  status: true,
  rejectionReason: true,
  employmentType: true,
  workplaceType: true,
  salaryMin: true,
  salaryMax: true,
  isSalaryHidden: true,
  isPremium: true,
  viewsCount: true,
  adminArchivedAt: true,
  createdAt: true,
  publishedAt: true,
  region: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
} as const;

/** Vakansiya so'ralgan foydalanuvchiga tegishliligini tekshiradi. */
async function ownedVacancy(vacancyId: string, userId: string, role: string) {
  const vacancy = await prisma.vacancy.findUnique({
    where: { id: vacancyId },
    include: { company: { select: { ownerUserId: true, id: true } } },
  });
  if (!vacancy) throw Errors.notFound();
  if (vacancy.company.ownerUserId !== userId && role !== "admin") throw Errors.forbidden();
  return vacancy;
}

/**
 * Admin yopgan e'lon qulfi (audit R3, D-070; authz-idor-4, employer-flows-1, data-integrity-3).
 * `adminArchivedAt` yozilgan bo'lsa ish beruvchi uni qayta faollashtira olmaydi — ilgari admin
 * "arxivlash" bilan olib tashlagan e'lonni ish beruvchi bir so'rov bilan qaytarardi.
 * ESKI ma'lumot: maydoni yo'q (null) e'lonlarga cheklov qo'llanmaydi.
 */
function assertNotAdminLocked(vacancy: { adminArchivedAt: Date | null }): void {
  if (vacancy.adminArchivedAt) {
    throw new AppError(
      409,
      "VACANCY_LOCKED",
      "Bu e'lonni administrator yopgan — uni o'zingiz qayta faollashtira olmaysiz. Qo'llab-quvvatlash xizmatiga murojaat qiling."
    );
  }
}

/**
 * Bandlik turi "remote" bo'lsa ish joylashuvi ham masofaviy bo'lishi shart (audit R3, employer-flows-17):
 * ilgari `office` + `remote` kabi qarama-qarshi yozuv saqlanardi va u masofaviy filtrga tushardi.
 * Eski e'lon (workplaceType yo'q, employmentType remote) uchun yakuniy qiymat baribir "remote" bo'ladi.
 */
function assertWorkplaceMatchesEmployment(employmentType: string | null | undefined, workplaceType: string | null | undefined): void {
  if (employmentType === "remote" && workplaceType && workplaceType !== "remote") {
    throw new AppError(400, "VALIDATION_ERROR", "workplaceType: Masofaviy bandlik turi uchun ish joylashuvi ham masofaviy bo'lishi kerak");
  }
}

export async function vacancyRoutes(app: FastifyInstance) {
  app.get("/api/vacancies", async (req) => {
    const query = listQuerySchema.parse(req.query);
    return listVacancies(query);
  });

  // Filtr paneli sonlari — ro'yxat bilan bir xil parametrlar (sahifa/saralashsiz)
  app.get("/api/vacancies/facets", async (req) => {
    const query = listQuerySchema.parse(req.query);
    return vacancyFacets(query);
  });

  /**
   * Ish beruvchining o'z vakansiyalari — SERVER sahifalash bilan (audit R3, D-068).
   * Platforma bepul — tarif/limit ma'lumoti yo'q.
   *
   * Javob: `items` (karta maydonlari + `applications` soni), `total/page/pageSize/pageCount`,
   * `counts` va `filters` (hudud/toifa variantlari).
   *
   * `counts.byStatus`, `counts.total` va `filters` — BARCHA e'lonlar bo'yicha (filtrlardan qat'i nazar:
   * statistika kartalari va holat tanlovi shuni ko'rsatadi), `total` va `counts.applications` esa
   * FILTRLANGAN to'plam bo'yicha (ro'yxat ustidagi "N vakansiya · M ariza" satri).
   */
  app.get(
    "/api/employer/vacancies",
    { preHandler: [requireAuth, requireRole("employer", "admin")] },
    async (req) => {
      const query = employerListSchema.parse(req.query);
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? EMPLOYER_PAGE_SIZE_DEFAULT;
      const emptyByStatus = Object.fromEntries(VACANCY_STATUS_VALUES.map((v) => [v, 0])) as Record<VacancyStatus, number>;

      // Relation filter ($lookup) o'rniga `companyId` indeksi (audit ISSUE-058)
      const companyIds = await ownedCompanyIds(req.user!.sub);
      if (companyIds.length === 0) {
        return {
          items: [],
          total: 0,
          page: 1,
          pageSize,
          pageCount: 0,
          counts: { total: 0, applications: 0, byStatus: emptyByStatus },
          countsCapped: false,
          filters: { regions: [], categories: [] },
        };
      }

      const base: Prisma.VacancyWhereInput = { companyId: { in: companyIds } };
      const text = plainSearchText(query.text);
      const [regionRow, categoryRow] = await Promise.all([
        query.region ? prisma.region.findUnique({ where: { slug: query.region }, select: { id: true } }) : Promise.resolve(null),
        query.category ? prisma.vacancyCategory.findUnique({ where: { slug: query.category }, select: { id: true } }) : Promise.resolve(null),
      ]);
      const where: Prisma.VacancyWhereInput = {
        ...base,
        ...(query.status ? { status: query.status } : {}),
        ...(text ? { title: { contains: text, mode: "insensitive" as const } } : {}),
        ...(query.region ? { regionId: regionRow?.id ?? NO_MATCH_ID } : {}),
        ...(query.category ? { categoryId: categoryRow?.id ?? NO_MATCH_ID } : {}),
      };

      // Holat / hudud / toifa sonlari — bitta guruhlash (har biri uchun alohida so'rov emas)
      // DIQQAT: Prisma 5.22 MongoDB konnektori bitta `groupBy` da bir nechta nullable ObjectId
      // maydon bo'lsa panic beradi (query engine `Option::unwrap()` on None) — uchta alohida
      // guruhlash ishlatiladi (audit R3, e2e db-perf-8).
      const [statusGroups, regionGroups, categoryGroups, matched] = await Promise.all([
        prisma.vacancy.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
        prisma.vacancy.groupBy({ by: ["regionId"], where: base, _count: { _all: true } }),
        prisma.vacancy.groupBy({ by: ["categoryId"], where: base, _count: { _all: true } }),
        prisma.vacancy.findMany({
          where,
          select: { id: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: EMPLOYER_AGGREGATE_LIMIT,
        }),
      ]);

      const byStatus = { ...emptyByStatus };
      const regionCounts = new Map<string, number>();
      const categoryCounts = new Map<string, number>();
      let countsTotal = 0;
      for (const g of statusGroups) {
        const n = g._count._all;
        countsTotal += n;
        byStatus[g.status] = (byStatus[g.status] ?? 0) + n;
      }
      for (const g of regionGroups) {
        if (g.regionId) regionCounts.set(g.regionId, (regionCounts.get(g.regionId) ?? 0) + g._count._all);
      }
      for (const g of categoryGroups) {
        if (g.categoryId) categoryCounts.set(g.categoryId, (categoryCounts.get(g.categoryId) ?? 0) + g._count._all);
      }

      const countsCapped = matched.length === EMPLOYER_AGGREGATE_LIMIT;
      const total = countsCapped ? await prisma.vacancy.count({ where }) : matched.length;
      const matchedIds = matched.map((v) => v.id);

      // Ariza sonlari — har qator uchun `_count` ($lookup) o'rniga bitta guruhlash
      const applicationGroups = matchedIds.length
        ? await prisma.application.groupBy({ by: ["vacancyId"], where: { vacancyId: { in: matchedIds } }, _count: { _all: true } })
        : [];
      const applicationsById = new Map(applicationGroups.map((g) => [g.vacancyId, g._count._all]));
      let applicationsTotal = 0;
      for (const n of applicationsById.values()) applicationsTotal += n;

      const skip = (page - 1) * pageSize;
      let rows: Prisma.VacancyGetPayload<{ select: typeof EMPLOYER_CARD_SELECT }>[] = [];
      if (query.sort === "applications") {
        // Ariza soni bo'yicha saralash bazada ifodalanmaydi: id ro'yxati (chegaralangan) xotirada tartiblanadi
        const createdAt = new Map(matched.map((v) => [v.id, v.createdAt.getTime()]));
        const ordered = [...matchedIds].sort(
          (a, b) => (applicationsById.get(b) ?? 0) - (applicationsById.get(a) ?? 0) || (createdAt.get(b) ?? 0) - (createdAt.get(a) ?? 0)
        );
        const pageIds = ordered.slice(skip, skip + pageSize);
        const found = pageIds.length
          ? await prisma.vacancy.findMany({ where: { id: { in: pageIds } }, select: EMPLOYER_CARD_SELECT })
          : [];
        const byId = new Map(found.map((v) => [v.id, v]));
        rows = pageIds.map((id) => byId.get(id)).filter((v): v is (typeof found)[number] => Boolean(v));
      } else {
        const orderBy: Prisma.VacancyOrderByWithRelationInput =
          query.sort === "oldest" ? { createdAt: "asc" } : query.sort === "title" ? { title: "asc" } : { createdAt: "desc" };
        rows = await prisma.vacancy.findMany({ where, select: EMPLOYER_CARD_SELECT, orderBy, skip, take: pageSize });
      }

      // Chegaradan oshgan holatda sahifadagi qator `matched` ro'yxatiga tushmagan bo'lishi mumkin —
      // uning ariza soni "0" bo'lib ko'rinmasin, alohida so'raladi
      if (countsCapped) {
        const missing = rows.map((v) => v.id).filter((id) => !applicationsById.has(id));
        if (missing.length) {
          const extra = await prisma.application.groupBy({ by: ["vacancyId"], where: { vacancyId: { in: missing } }, _count: { _all: true } });
          for (const g of extra) applicationsById.set(g.vacancyId, g._count._all);
        }
      }

      const [regionNames, categoryNames] = await Promise.all([
        regionCounts.size
          ? prisma.region.findMany({ where: { id: { in: [...regionCounts.keys()] } }, select: { id: true, name: true, slug: true } })
          : Promise.resolve([]),
        categoryCounts.size
          ? prisma.vacancyCategory.findMany({ where: { id: { in: [...categoryCounts.keys()] } }, select: { id: true, name: true, slug: true } })
          : Promise.resolve([]),
      ]);

      return {
        items: rows.map((v) => ({
          ...v,
          applications: applicationsById.get(v.id) ?? 0,
          // Eski nom ham saqlanadi: mavjud mijozlar `_count.applications` ni o'qiydi
          _count: { applications: applicationsById.get(v.id) ?? 0 },
        })),
        total,
        page,
        pageSize,
        pageCount: Math.ceil(total / pageSize),
        counts: { total: countsTotal, applications: applicationsTotal, byStatus },
        countsCapped,
        filters: {
          regions: regionNames.map((r) => ({ slug: r.slug, name: r.name, count: regionCounts.get(r.id) ?? 0 })),
          categories: categoryNames.map((c) => ({ slug: c.slug, name: c.name, count: categoryCounts.get(c.id) ?? 0 })),
        },
      };
    }
  );

  /**
   * Bitta vakansiya — tahrirlash formasi uchun (audit R3, scale-10k-13): ilgari forma butun
   * ro'yxatni yuklab, kerakli yozuvni xotirada topardi. Egalik serverda tekshiriladi.
   */
  app.get(
    "/api/employer/vacancies/:id",
    { preHandler: [requireAuth, requireRole("employer", "admin")] },
    async (req) => {
      const { id } = idParams.parse(req.params);
      const vacancy = await ownedVacancy(id, req.user!.sub, req.user!.role);
      const { company: _company, ...rest } = vacancy;
      const applications = await prisma.application.count({ where: { vacancyId: id } });
      return { ...rest, applications, _count: { applications } };
    }
  );

  app.get("/api/vacancies/:slug", async (req) => {
    const { slug } = req.params as { slug: string };
    return getVacancyBySlug(slug);
  });

  /**
   * Ko'rishni qayd etish — sahifa brauzerda ochilgandan keyin yuboriladi (audit: views-1).
   *
   * Yengil yo'l: bazaga murojaat qilmaydi, faqat takror filtridan o'tkazib buferga qo'yadi.
   * Chegara keng, chunki bitta odam sayt bo'ylab yurib o'nlab e'lon ochishi normal; ayni paytda
   * bitta IP'dan minglab so'rov bilan hisoblagichni shishirishga yo'l qo'ymaydi.
   */
  app.post(
    "/api/vacancies/:slug/view",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const result = await recordView(req, "vacancies", slug);
      return reply.status(202).send(result);
    }
  );

  // Detail sahifasidagi "O'xshash vakansiyalar" (ko'rishlar soniga ta'sir qilmaydi)
  app.get("/api/vacancies/:slug/similar", async (req) => {
    const { slug } = req.params as { slug: string };
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(10).optional() }).parse(req.query);
    return similarVacancies(slug, limit);
  });

  // Vakansiya joylash — ish beruvchining o'z kompaniyasiga (faol vakansiyalar soni cheklanmagan)
  app.post(
    "/api/vacancies",
    { preHandler: [requireAuth, requireRole("employer", "admin"), requirePhoneVerified] },
    async (req, reply) => {
      const body = createBodySchema.parse(req.body);
      const company = await primaryCompany(req.user!.sub);
      if (!company) throw Errors.badRequest("Avval kompaniya profilini to'ldiring");

      await assertVacancyPlacement(body);
      assertWorkplaceMatchesEmployment(body.employmentType, body.workplaceType);
      // Oldindan moderatsiya: tasdiqlanmagan kompaniya e'loni admin (yoki 24 soatlik avto-tasdiq) kutadi
      const status =
        body.status === "draft" ? "draft" : req.user!.role !== "admin" && requiresPremoderation(company) ? "moderation" : "active";
      const vacancy = await createVacancy({ ...body, status, companyId: company.id });
      return reply.status(201).send(vacancy);
    }
  );

  // Vakansiyani tahrirlash
  app.put(
    "/api/vacancies/:id",
    { preHandler: [requireAuth, requireRole("employer", "admin")] },
    async (req, reply) => {
      const { id } = idParams.parse(req.params);
      const body = updateSchema.parse(req.body);
      const vacancy = await ownedVacancy(id, req.user!.sub, req.user!.role);
      // Tahrirlash ham yangi e'lon va qayta e'lon qilish bilan bir xil shart: tasdiqlangan telefon
      // (audit R3, employer-flows-16). Ilgari POST va PATCH /status gate'da edi, PUT esa ochiq qolgan.
      if (req.user!.role !== "admin") await requirePhoneVerified(req, reply);
      // Qoida yakuniy holat bo'yicha: yuborilmagan maydon — bazadagi qiymat; `regionId: null` — hududni olib tashlash
      const finalWorkplace = effectiveWorkplaceType(body, vacancy);
      await assertVacancyPlacement({
        categoryId: body.categoryId ?? vacancy.categoryId,
        regionId: body.regionId !== undefined ? body.regionId : vacancy.regionId,
        // Eski e'londa `workplaceType` yo'q bo'lsa — PATCH /status bilan bir xil fallback (audit PHASE 6, U18)
        workplaceType: finalWorkplace,
      });
      assertWorkplaceMatchesEmployment(body.employmentType ?? vacancy.employmentType, finalWorkplace);

      // Rad etilgan e'lon tahrirlansa — qayta moderatsiyaga tushadi (audit ISSUE-024). Ilgari undan chiqish
      // yo'li yo'q edi: PATCH faqat faol/yopilgan/qoralama o'rtasida ishlaydi. Admin tahriri holatni o'zgartirmaydi.
      const resubmit = vacancy.status === "rejected" && req.user!.role !== "admin";

      const updated = await prisma.vacancy.update({
        where: { id },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.requirements !== undefined ? { requirements: body.requirements } : {}),
          ...(body.conditions !== undefined ? { conditions: body.conditions } : {}),
          ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
          ...(body.regionId !== undefined ? { regionId: body.regionId } : {}),
          ...(body.employmentType !== undefined ? { employmentType: body.employmentType } : {}),
          ...(body.scheduleType !== undefined ? { scheduleType: body.scheduleType } : {}),
          ...(body.workplaceType !== undefined ? { workplaceType: body.workplaceType } : {}),
          ...(body.isSalaryHidden !== undefined ? { isSalaryHidden: body.isSalaryHidden } : {}),
          ...(body.experienceRequired !== undefined
            ? { experienceRequired: body.experienceRequired }
            : {}),
          ...(body.salaryMin !== undefined ? { salaryMin: body.salaryMin } : {}),
          ...(body.salaryMax !== undefined ? { salaryMax: body.salaryMax } : {}),
          ...(body.applyWithoutResume !== undefined
            ? { applyWithoutResume: body.applyWithoutResume }
            : {}),
          ...(body.contactEmail !== undefined ? { contactEmail: body.contactEmail || null } : {}),
          ...(body.contactTelegram !== undefined
            ? { contactTelegram: body.contactTelegram || null }
            : {}),
          ...(body.contactPhone !== undefined ? { contactPhone: body.contactPhone || null } : {}),
          // Avto-tasdiq muddati navbatga tushgan paytdan hisoblanadi
          ...(resubmit ? { status: "moderation" as const, moderationSubmittedAt: new Date(), autoApprovedAt: null } : {}),
          // Tahrirdan keyin qoidadan yana o'tmasa — "to'ldiring" xabari qaytadan yuborilishi mumkin
          ...(resubmit || vacancy.status === "moderation" ? { moderationNudgedAt: null } : {}),
        },
      });

      void syncVacancyIndex(updated.id, updated.status);
      bumpDataVersion();
      return updated;
    }
  );

  // Vakansiya holatini o'zgartirish (faollashtirish / yopish)
  app.patch(
    "/api/vacancies/:id/status",
    { preHandler: [requireAuth, requireRole("employer", "admin")] },
    async (req, reply) => {
      const { id } = idParams.parse(req.params);
      const { status } = z.object({ status: z.enum(["active", "archived"]) }).parse(req.body);
      const vacancy = await ownedVacancy(id, req.user!.sub, req.user!.role);

      // Holat allaqachon shu — hech narsa o'zgarmaydi
      if (vacancy.status === status) return vacancy;

      // Ilgari holat tekshirilmasdi: ish beruvchi rad etilgan yoki moderatsiyadagi
      // vakansiyani to'g'ridan-to'g'ri "faol" qilib, moderatsiyani chetlab o'tardi.
      // Endi faqat: faol/rad etilgan/moderatsiyadagi -> yopilgan, yopilgan/qoralama -> faol. Admin — cheklovsiz.
      // Rad etilgan yoki moderatsiyadagi (arizasi bor) e'lonni ham yopish mumkin (audit R3, employer-flows-15):
      // ilgari u dashboard'da qotib qolardi — na yopib, na o'chirib bo'lardi.
      const isAdmin = req.user!.role === "admin";
      const allowedFrom: Record<typeof status, readonly string[]> = {
        active: ["archived", "draft"],
        archived: ["active", "rejected", "moderation"],
      };
      if (!isAdmin && !allowedFrom[status].includes(vacancy.status)) {
        throw Errors.conflict("Bu holatdagi vakansiyaning holatini o'zgartirib bo'lmaydi");
      }

      if (status === "active") {
        // Admin yopgan e'lonni ish beruvchi qayta ocholmaydi (audit R3, D-070)
        if (!isAdmin) assertNotAdminLocked(vacancy);
        // Qayta e'lon qilish — yangi e'lon bilan bir xil shartlar: tasdiqlangan telefon (audit ISSUE-087),
        // kategoriya va ish joylashuvi (audit ISSUE-059). Eski e'londa `workplaceType` bo'lmasa, bandlik
        // turi "remote" bo'lsa masofaviy hisoblanadi; aks holda ish beruvchi avval tahrirlab to'ldiradi.
        if (!isAdmin) await requirePhoneVerified(req, reply);
        await assertVacancyPlacement({
          categoryId: vacancy.categoryId,
          regionId: vacancy.regionId,
          workplaceType: effectiveWorkplaceType({}, vacancy),
        });
      }

      // Hech qachon e'lon qilinmagan (qoralama) e'lon birinchi marta chiqarilganda — oldindan moderatsiya.
      // Ilgari tasdiqlangan e'lonni qayta ochish moderatsiyasiz.
      let nextStatus: "active" | "archived" | "moderation" = status;
      if (status === "active" && !isAdmin && !vacancy.publishedAt) {
        const company = await prisma.company.findUnique({ where: { id: vacancy.companyId }, select: { isVerified: true } });
        if (company && requiresPremoderation(company)) nextStatus = "moderation";
      }

      const updated = await prisma.vacancy.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(nextStatus === "moderation" ? { moderationSubmittedAt: new Date(), autoApprovedAt: null } : {}),
          ...(nextStatus === "active" && !vacancy.publishedAt ? { publishedAt: new Date() } : {}),
          // Faollashtirish qulfni ochadi; admin yopsa qulf qo'yiladi (audit R3, D-070)
          ...(nextStatus === "active" ? { adminArchivedAt: null } : {}),
          // Rad etilgan yoki moderatsiyadagi e'lonni ish beruvchi yopsa ham qulf qo'yiladi: aks holda
          // "moderatsiya -> yopilgan -> faol" yo'li tekshiruvni chetlab o'tardi (audit R3 ikkinchi audit, backend-2).
          // Qayta e'lon qilish — tahrirlash (moderatsiyaga qaytadi) yoki admin orqali.
          ...(status === "archived" && (isAdmin || vacancy.status === "rejected" || vacancy.status === "moderation")
            ? { adminArchivedAt: new Date() }
            : {}),
        },
      });
      void syncVacancyIndex(updated.id, updated.status);
      bumpDataVersion();
      return updated;
    }
  );

  // Vakansiyani butunlay o'chirish
  app.delete(
    "/api/vacancies/:id",
    { preHandler: [requireAuth, requireRole("employer", "admin")] },
    async (req, reply) => {
      const { id } = idParams.parse(req.params);
      await ownedVacancy(id, req.user!.sub, req.user!.role);
      // Arizasi bor e'lon o'chirilmaydi: cascade nomzodlarning arizalari va holat tarixini jimgina
      // yo'qotardi (audit ISSUE-025). Bunday e'lon yopiladi (arxivlanadi) — nomzodlar tarixi qoladi.
      // ADMIN uchun ham (audit R3, D-070 / data-integrity-9): u ham o'chirmaydi, arxivlaydi va qulflaydi.
      const applications = await prisma.application.count({ where: { vacancyId: id } });
      if (applications > 0) {
        if (req.user!.role !== "admin") {
          throw new AppError(
            409,
            "VACANCY_HAS_APPLICATIONS",
            "Bu vakansiyaga arizalar kelgan — uni o'chirib bo'lmaydi, yopish (arxivlash) mumkin"
          );
        }
        await prisma.vacancy.update({ where: { id }, data: { status: "archived", adminArchivedAt: new Date() } });
        void syncVacancyIndex(id, "archived");
        bumpDataVersion();
        return reply.status(200).send({ ok: true, archived: true, id });
      }
      await prisma.vacancy.delete({ where: { id } });
      void syncVacancyIndex(id, "archived");
      bumpDataVersion();
      return reply.status(200).send({ ok: true });
    }
  );
}
