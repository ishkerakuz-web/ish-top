import type { FastifyInstance } from "fastify";
import type { ModerationEntity, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { Errors } from "../../common/errors.js";
import { adminOnly, moderatorOnly } from "./admin.shared.js";
import { idParams, objectId } from "../../common/validation.js";
import { maskPhone } from "../../common/phone.js";
import { effectiveWorkplaceType, placementIssue } from "../vacancies/vacancies.rules.js";
import { autoApproveAt } from "../moderation/auto-approve.service.js";
import { bulkApply, deleteReview, moderateReview, moderateVacancy } from "../moderation/moderation.service.js";

/**
 * Moderatsiya ish joyi: menyu hisoblagichlari, vakansiyani to'liq ko'rish, ommaviy qarorlar,
 * moderatsiya jurnali va (faqat admin) foydalanuvchi kartochkasi.
 */


const BULK_MAX = 100;
const idList = z.array(objectId()).min(1).max(BULK_MAX);

/** Jurnal va tafsilotlarda "kim qaror qildi" — email yoki jamoa profilidagi ism. */
async function actorNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, email: true, staffProfile: { select: { fullName: true } } },
  });
  return new Map(users.map((u) => [u.id, u.staffProfile?.fullName || u.email]));
}

function eventView(e: { id: string; entityType: string; entityId: string; action: string; actorId: string | null; reason: string | null; meta: Prisma.JsonValue; createdAt: Date }, names: Map<string, string>) {
  return {
    id: e.id,
    entityType: e.entityType,
    entityId: e.entityId,
    action: e.action,
    // null — tizim (avto-tasdiq)
    actorName: e.actorId ? (names.get(e.actorId) ?? null) : null,
    actorId: e.actorId,
    reason: e.reason,
    meta: e.meta ?? null,
    createdAt: e.createdAt,
  };
}

export async function adminModerationRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------
  // Menyu hisoblagichlari (navbatdagilar soni)
  // ---------------------------------------------------------
  app.get("/api/admin/counters", moderatorOnly, async (req) => {
    const isAdmin = req.user!.role === "admin";
    const [vacancies, reviews, companies, support, autoApproved, recovery] = await Promise.all([
      prisma.vacancy.count({ where: { status: "moderation" } }),
      prisma.companyReview.count({ where: { status: "pending" } }),
      prisma.company.count({ where: { isVerified: false, verificationRequestedAt: { not: null } } }),
      prisma.supportTicket.count({ where: { status: { in: ["open", "in_progress"] } } }),
      prisma.vacancy.count({ where: { status: "active", autoApprovedAt: { not: null } } }),
      // Qo'lda tiklash so'rovlari — faqat admin bo'limi
      isAdmin ? prisma.recoveryRequest.count({ where: { status: "pending" } }) : Promise.resolve(0),
    ]);
    return { vacancies, reviews, companies, support, autoApproved, recovery };
  });

  // ---------------------------------------------------------
  // Vakansiyani to'liq ko'rish (tasdiqlashdan oldin matn, aloqa, shikoyatlar, tarix)
  // ---------------------------------------------------------
  app.get("/api/admin/vacancies/:id", moderatorOnly, async (req) => {
    const { id } = idParams.parse(req.params);
    const v = await prisma.vacancy.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            isVerified: true,
            website: true,
            ownerUserId: true,
            createdAt: true,
            owner: { select: { email: true, isBlocked: true, isPhoneVerified: true, phone: true } },
          },
        },
        category: { select: { name: true } },
        region: { select: { name: true } },
      },
    });
    if (!v) throw Errors.notFound();

    const [events, reports, companyVacancies, applications] = await Promise.all([
      prisma.moderationEvent.findMany({
        where: { entityType: "vacancy", entityId: id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.supportTicket.findMany({
        where: { vacancyId: id, kind: "vacancy_report" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, subject: true, message: true, status: true, createdAt: true },
      }),
      prisma.vacancy.groupBy({ by: ["status"], where: { companyId: v.companyId }, _count: { _all: true } }),
      prisma.application.count({ where: { vacancyId: id } }),
    ]);
    const names = await actorNames(events.map((e) => e.actorId));
    const issue =
      v.status === "moderation"
        ? await placementIssue({ categoryId: v.categoryId, regionId: v.regionId, workplaceType: effectiveWorkplaceType({}, v) })
        : null;

    return {
      id: v.id,
      slug: v.slug,
      title: v.title,
      status: v.status,
      description: v.description,
      requirements: v.requirements,
      conditions: v.conditions,
      categoryName: v.category?.name ?? null,
      regionName: v.region?.name ?? null,
      address: v.address,
      employmentType: v.employmentType,
      scheduleType: v.scheduleType,
      workplaceType: effectiveWorkplaceType({}, v),
      experienceRequired: v.experienceRequired,
      salaryMin: v.salaryMin,
      salaryMax: v.salaryMax,
      currency: v.currency,
      isSalaryHidden: v.isSalaryHidden,
      contactEmail: v.contactEmail,
      contactTelegram: v.contactTelegram,
      contactPhone: v.contactPhone,
      images: v.images,
      isPremium: v.isPremium,
      rejectionReason: v.rejectionReason,
      placementIssue: issue,
      autoApproveAt: v.status === "moderation" ? autoApproveAt(v.moderationSubmittedAt ?? v.updatedAt) : null,
      autoApprovedAt: v.autoApprovedAt,
      moderationSubmittedAt: v.moderationSubmittedAt,
      publishedAt: v.publishedAt,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      viewsCount: v.viewsCount,
      applicationCount: applications,
      company: {
        id: v.company.id,
        name: v.company.name,
        slug: v.company.slug,
        isVerified: v.company.isVerified,
        website: v.company.website,
        createdAt: v.company.createdAt,
        ownerUserId: v.company.ownerUserId,
        ownerEmail: v.company.owner.email,
        ownerBlocked: v.company.owner.isBlocked,
        ownerPhoneMasked: v.company.owner.isPhoneVerified ? maskPhone(v.company.owner.phone) : null,
        vacancies: Object.fromEntries(companyVacancies.map((g) => [g.status, g._count._all])),
      },
      reports,
      history: events.map((e) => eventView(e, names)),
    };
  });

  // ---------------------------------------------------------
  // Ommaviy qarorlar (har biri alohida tekshiriladi va jurnalga yoziladi)
  // ---------------------------------------------------------
  app.post("/api/admin/vacancies/bulk", moderatorOnly, async (req) => {
    const body = z
      .object({ ids: idList, status: z.enum(["active", "rejected", "archived"]), reason: z.string().trim().max(500).optional() })
      .parse(req.body);
    return bulkApply(body.ids, (id) => moderateVacancy(id, { status: body.status, reason: body.reason }, req.user!.sub));
  });

  app.post("/api/admin/reviews/bulk", moderatorOnly, async (req) => {
    const body = z.object({ ids: idList, action: z.enum(["approved", "rejected", "delete"]) }).parse(req.body);
    return bulkApply<unknown>(body.ids, (id) =>
      body.action === "delete" ? deleteReview(id, req.user!.sub) : moderateReview(id, body.action, req.user!.sub)
    );
  });

  // ---------------------------------------------------------
  // Moderatsiya jurnali
  // ---------------------------------------------------------
  app.get("/api/admin/moderation-log", moderatorOnly, async (req) => {
    const query = z
      .object({
        entityType: z.enum(["vacancy", "review", "company", "ticket"]).optional(),
        entityId: objectId().optional(),
        // "system" — faqat avto-tasdiq kabi tizim qarorlari
        actor: z.union([z.literal("system"), objectId()]).optional(),
        page: z.coerce.number().int().min(1).max(10_000).optional(),
      })
      .parse(req.query);
    const page = query.page ?? 1;
    const pageSize = 50;
    const where: Prisma.ModerationEventWhereInput = {
      ...(query.entityType ? { entityType: query.entityType as ModerationEntity } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actor === "system"
        ? { OR: [{ actorId: null }, { actorId: { isSet: false } }] }
        : query.actor
          ? { actorId: query.actor }
          : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.moderationEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.moderationEvent.count({ where }),
    ]);
    const names = await actorNames(rows.map((e) => e.actorId));
    return {
      items: rows.map((e) => eventView(e, names)),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
  });

  // ---------------------------------------------------------
  // Foydalanuvchi kartochkasi (faqat admin): hisob, kompaniya, e'lonlar, arizalar, sharhlar,
  // murojaatlar va xavfsizlik hodisalari bir joyda
  // ---------------------------------------------------------
  app.get("/api/admin/users/:id", adminOnly, async (req) => {
    const { id } = idParams.parse(req.params);
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        jobSeekerProfile: { select: { firstName: true, lastName: true, headline: true, region: { select: { name: true } } } },
        staffProfile: { select: { fullName: true, position: true } },
        ownedCompanies: {
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, slug: true, isVerified: true, verificationRequestedAt: true, createdAt: true },
        },
      },
    });
    if (!user) throw Errors.notFound("Foydalanuvchi topilmadi");

    const companyIds = user.ownedCompanies.map((c) => c.id);
    const [vacancies, vacancyTotal, applications, applicationTotal, reviews, tickets, events] = await Promise.all([
      companyIds.length
        ? prisma.vacancy.findMany({
            where: { companyId: { in: companyIds } },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, slug: true, title: true, status: true, autoApprovedAt: true, createdAt: true },
          })
        : Promise.resolve([]),
      companyIds.length ? prisma.vacancy.count({ where: { companyId: { in: companyIds } } }) : Promise.resolve(0),
      prisma.application.findMany({
        where: { jobSeekerId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          status: true,
          createdAt: true,
          vacancy: { select: { title: true, slug: true, status: true, company: { select: { name: true } } } },
        },
      }),
      prisma.application.count({ where: { jobSeekerId: id } }),
      prisma.companyReview.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, rating: true, comment: true, status: true, createdAt: true, company: { select: { name: true, slug: true } } },
      }),
      prisma.supportTicket.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, kind: true, subject: true, status: true, message: true, createdAt: true },
      }),
      prisma.securityEvent.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]);

    return {
      id: user.id,
      email: user.email,
      // Telefon niqoblangan (D-050)
      phoneMasked: user.isPhoneVerified ? maskPhone(user.phone) : null,
      role: user.role,
      isBlocked: user.isBlocked,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      telegramLinked: Boolean(user.telegramChatId),
      createdAt: user.createdAt,
      name:
        [user.jobSeekerProfile?.firstName, user.jobSeekerProfile?.lastName].filter(Boolean).join(" ") ||
        user.staffProfile?.fullName ||
        null,
      headline: user.jobSeekerProfile?.headline ?? user.staffProfile?.position ?? null,
      regionName: user.jobSeekerProfile?.region?.name ?? null,
      companies: user.ownedCompanies,
      vacancies: { items: vacancies, total: vacancyTotal },
      applications: {
        items: applications.map((a) => ({
          id: a.id,
          status: a.status,
          createdAt: a.createdAt,
          vacancyTitle: a.vacancy.title,
          vacancySlug: a.vacancy.slug,
          vacancyStatus: a.vacancy.status,
          companyName: a.vacancy.company.name,
        })),
        total: applicationTotal,
      },
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        status: r.status,
        createdAt: r.createdAt,
        companyName: r.company.name,
        companySlug: r.company.slug,
      })),
      tickets,
      securityEvents: events.map((e) => ({ id: e.id, type: e.type, meta: e.meta ?? null, actorId: e.actorId, createdAt: e.createdAt })),
    };
  });
}
