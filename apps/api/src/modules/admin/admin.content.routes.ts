import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { Errors } from "../../common/errors.js";
import { boolish, idParams } from "../../common/validation.js";
import { bumpDataVersion } from "../../common/cache.js";
import { effectiveWorkplaceType, placementIssue } from "../vacancies/vacancies.rules.js";
import { notify } from "../notifications/notifications.service.js";
import { deleteReview, moderateReview, moderateVacancy } from "../moderation/moderation.service.js";
import { recordModeration } from "../../common/moderation-log.js";
import { autoApproveAt } from "../moderation/auto-approve.service.js";
import {
  RELATION_MATCH_LIMIT,
  applicationCounts,
  like,
  moderatorOnly,
  openReportCounts,
  pageSchema,
  paging,
  searchText,
  textVariants,
} from "./admin.shared.js";

/**
 * Admin: vakansiya, kompaniya va sharhlar moderatsiyasi (admin va moderator).
 *
 * `admin.routes.ts` 1000 qatordan oshib ketgani uchun bo'limlarga ajratildi; umumiy
 * qo'riqchi va yordamchilar `admin.shared.ts` da.
 */
export async function adminContentRoutes(app: FastifyInstance) {
  // Vakansiyalar moderatsiyasi
  // ---------------------------------------------------------
  app.get("/api/admin/vacancies", moderatorOnly, async (req) => {
    const query = pageSchema
      .extend({
        status: z.enum(["draft", "moderation", "active", "archived", "rejected"]).optional(),
        // Admin ko'rmasdan, muddat tugagani uchun faollashganlar — keyin qayta ko'rib chiqish uchun
        autoApproved: boolish().optional(),
      })
      .parse(req.query);
    const { page, pageSize, skip, take } = paging(query);

    // Kompaniya nomi bo'yicha qidiruv relation filter emas, oldindan yechilgan `companyId` ro'yxati
    // orqali (audit R3, employer-flows-12, scale-10k-12)
    const text = searchText(query.text);
    const variants = textVariants(text);
    let companyIds: string[] = [];
    if (variants.length) {
      const companies = await prisma.company.findMany({
        where: { OR: variants.map((v) => ({ name: like(v) })) },
        select: { id: true },
        take: RELATION_MATCH_LIMIT,
      });
      companyIds = companies.map((c) => c.id);
    }
    const where: Prisma.VacancyWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.autoApproved ? { autoApprovedAt: { not: null } } : {}),
      ...(variants.length
        ? {
            OR: [
              ...variants.map((v) => ({ title: like(v) })),
              ...(companyIds.length ? [{ companyId: { in: companyIds } }] : []),
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.vacancy.findMany({
        where,
        // Moderatsiya navbati — eng uzoq kutayotgani birinchi (avto-tasdiq muddati yaqinlashganlar)
        orderBy: query.status === "moderation" ? [{ moderationSubmittedAt: "asc" }, { updatedAt: "asc" }] : { createdAt: "desc" },
        skip,
        take,
        include: {
          company: { select: { name: true, slug: true, isVerified: true, owner: { select: { isBlocked: true } } } },
          region: { select: { name: true } },
        },
      }),
      prisma.vacancy.count({ where }),
    ]);
    const ids = rows.map((v: (typeof rows)[number]) => v.id);
    const [counts, reports, issues] = await Promise.all([
      applicationCounts(ids),
      openReportCounts(ids),
      // Navbatdagi e'lon nega avtomatik o'tmayotgani (admin ham tasdiqlay olmaydi — egasi to'ldirishi kerak)
      Promise.all(
        rows.map(async (v: (typeof rows)[number]) =>
          v.status === "moderation"
            ? [v.id, await placementIssue({ categoryId: v.categoryId, regionId: v.regionId, workplaceType: effectiveWorkplaceType({}, v) })] as const
            : [v.id, null] as const
        )
      ).then((pairs) => new Map(pairs)),
    ]);

    return {
      items: rows.map((v: (typeof rows)[number]) => ({
        id: v.id,
        slug: v.slug,
        title: v.title,
        status: v.status,
        companyName: v.company.name,
        companySlug: v.company.slug,
        companyVerified: v.company.isVerified,
        regionName: v.region?.name ?? null,
        salaryMin: v.salaryMin,
        salaryMax: v.salaryMax,
        isPremium: v.isPremium,
        viewsCount: v.viewsCount,
        applicationCount: counts.get(v.id) ?? 0,
        rejectionReason: v.rejectionReason,
        // Admin yopgan e'lon (audit R3, D-070): ish beruvchi uni qayta ocholmaydi
        adminArchivedAt: v.adminArchivedAt,
        // Avto-tasdiq (eski hujjatlarda navbatga tushish vaqti yo'q — `updatedAt`)
        autoApproveAt: v.status === "moderation" ? autoApproveAt(v.moderationSubmittedAt ?? v.updatedAt) : null,
        autoApprovedAt: v.autoApprovedAt,
        placementIssue: issues.get(v.id) ?? null,
        ownerBlocked: v.company.owner.isBlocked,
        openReports: reports.get(v.id) ?? 0,
        createdAt: v.createdAt,
      })),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
  });

  app.patch("/api/admin/vacancies/:id/moderate", moderatorOnly, async (req) => {
    const { id } = idParams.parse(req.params);
    const { status, reason, isPremium } = z
      .object({
        status: z.enum(["active", "rejected", "archived"]).optional(),
        reason: z.string().max(500).optional(),
        isPremium: z.boolean().optional(),
      })
      .parse(req.body);

    const updated = await moderateVacancy(id, { status, reason, isPremium }, req.user!.sub);

    return {
      id: updated.id,
      status: updated.status,
      isPremium: updated.isPremium,
      adminArchivedAt: updated.adminArchivedAt,
      autoApprovedAt: updated.autoApprovedAt,
    };
  });

  // ---------------------------------------------------------
  // Kompaniyalar
  // ---------------------------------------------------------
  app.get("/api/admin/companies", moderatorOnly, async (req) => {
    const query = pageSchema
      .extend({ verified: boolish().optional(), requested: boolish().optional() })
      .parse(req.query);
    const { page, pageSize, skip, take } = paging(query);

    // Maxsus regex belgilari zararsizlantiriladi (audit R3, admin-staff-11)
    const text = searchText(query.text);
    const variants = textVariants(text);
    const where: Prisma.CompanyWhereInput = {
      ...(query.verified !== undefined ? { isVerified: query.verified } : {}),
      // Tasdiq so'rovi yuborganlar (hali qaror qilinmagan)
      ...(query.requested ? { isVerified: false, verificationRequestedAt: { not: null } } : {}),
      ...(variants.length ? { OR: variants.map((v) => ({ name: like(v) })) } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.company.findMany({
        where,
        orderBy: query.requested ? { verificationRequestedAt: "asc" } : { createdAt: "desc" },
        skip,
        take,
        include: {
          owner: { select: { email: true } },
          subscriptionPlan: { select: { name: true, slug: true } },
          _count: { select: { vacancies: true, reviews: true } },
        },
      }),
      prisma.company.count({ where }),
    ]);

    return {
      items: rows.map((c: (typeof rows)[number]) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        ownerEmail: c.owner.email,
        ownerUserId: c.ownerUserId,
        isVerified: c.isVerified,
        legalName: c.legalName,
        stir: c.stir,
        website: c.website,
        verificationRequestedAt: c.verificationRequestedAt,
        verificationNote: c.verificationNote,
        planName: c.subscriptionPlan?.name ?? null,
        subscriptionExpiresAt: c.subscriptionExpiresAt,
        vacancyCount: c._count.vacancies,
        reviewCount: c._count.reviews,
        createdAt: c.createdAt,
      })),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
  });

  app.patch("/api/admin/companies/:id/verify", moderatorOnly, async (req) => {
    const { id } = idParams.parse(req.params);
    // `isVerified: false` + `note` — so'rovni rad etish (egasiga sabab bilan xabar)
    const { isVerified, note } = z
      .object({ isVerified: z.boolean(), note: z.string().trim().max(500).optional() })
      .parse(req.body);
    const before = await prisma.company.findUnique({
      where: { id },
      select: { isVerified: true, verificationRequestedAt: true },
    });
    if (!before) throw Errors.notFound();
    const company = await prisma.company.update({
      where: { id },
      data: {
        isVerified,
        // Qaror qilindi — so'rov yopiladi
        verificationRequestedAt: null,
        verificationNote: isVerified ? null : (note ?? null),
      },
      select: { id: true, isVerified: true, ownerUserId: true, name: true },
    });
    bumpDataVersion();

    const rejectedRequest = !isVerified && !before.isVerified && Boolean(before.verificationRequestedAt);
    recordModeration({
      entityType: "company",
      entityId: id,
      action: isVerified ? "verified" : rejectedRequest ? "verification_rejected" : "unverified",
      actorId: req.user!.sub,
      reason: note,
      meta: { company: company.name },
    });

    if (isVerified && !before.isVerified) {
      void notify({
        userId: company.ownerUserId,
        type: "system",
        title: "Kompaniya tasdiqlandi",
        body: `"${company.name}" endi tasdiqlangan ish beruvchi belgisiga ega.`,
        url: "/profile",
        i18n: { key: "company.verified", params: { companyName: company.name } },
      });
    }
    if (rejectedRequest) {
      void notify({
        userId: company.ownerUserId,
        type: "system",
        title: "Tasdiq so'rovi rad etildi",
        body: `"${company.name}" tasdiqlanmadi${note ? `: ${note}` : ""}`,
        url: "/profile",
        i18n: { key: "company.verificationRejected", params: { companyName: company.name, reason: note ?? "" } },
      });
    }
    return { id: company.id, isVerified: company.isVerified };
  });

  // ---------------------------------------------------------
  // Sharhlar moderatsiyasi
  // ---------------------------------------------------------
  app.get("/api/admin/reviews", moderatorOnly, async (req) => {
    const query = pageSchema
      .extend({ status: z.enum(["pending", "approved", "rejected"]).optional(), autoApproved: boolish().optional() })
      .parse(req.query);
    const { page, pageSize, skip, take } = paging(query);
    const where: Prisma.CompanyReviewWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.autoApproved ? { autoApprovedAt: { not: null } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.companyReview.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          company: { select: { name: true, slug: true } },
          user: {
            select: { email: true, jobSeekerProfile: { select: { firstName: true, lastName: true } } },
          },
        },
      }),
      prisma.companyReview.count({ where }),
    ]);

    return {
      items: rows.map((r: (typeof rows)[number]) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        status: r.status,
        companyName: r.company.name,
        companySlug: r.company.slug,
        authorName:
          [r.user.jobSeekerProfile?.firstName, r.user.jobSeekerProfile?.lastName]
            .filter(Boolean)
            .join(" ") || r.user.email,
        autoApproveAt: r.status === "pending" ? autoApproveAt(r.submittedAt ?? r.createdAt) : null,
        autoApprovedAt: r.autoApprovedAt,
        createdAt: r.createdAt,
      })),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
  });

  app.patch("/api/admin/reviews/:id", moderatorOnly, async (req) => {
    const { id } = idParams.parse(req.params);
    const { status } = z.object({ status: z.enum(["pending", "approved", "rejected"]) }).parse(req.body);
    const review = await moderateReview(id, status, req.user!.sub);
    return { id: review.id, status: review.status };
  });

  app.delete("/api/admin/reviews/:id", moderatorOnly, async (req) => {
    const { id } = idParams.parse(req.params);
    await deleteReview(id, req.user!.sub);
    return { ok: true };
  });

  // ---------------------------------------------------------
  // To'lovlar (monetizatsiya o'chiq — faqat eski yozuvlarni ko'rish/tasdiqlash)
}
