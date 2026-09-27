import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { AppError, Errors } from "../../common/errors.js";
import { idParams } from "../../common/validation.js";
import { closeUserSockets } from "../../common/realtime.js";
import { maskPhone } from "../../common/phone.js";
import { recordSecurityEvent } from "../../common/security-events.js";
import { revokeUserSessions } from "../auth/auth.service.js";
import { assertNotLastActiveAdmin, revokePendingStaffInvites } from "../team/team.routes.js";
import {
  RECOVERY_CONTINUE_TTL_MS,
  RELATION_MATCH_LIMIT,
  adminOnly,
  archiveOwnerVacancies,
  like,
  pageSchema,
  paging,
  searchText,
  textVariants,
} from "./admin.shared.js";

/**
 * Admin: foydalanuvchilar, bloklash, rol, xavfsizlik jurnali va hisobni tiklash so'rovlari.
 *
 * `admin.routes.ts` 1000 qatordan oshib ketgani uchun bo'limlarga ajratildi; umumiy
 * qo'riqchi va yordamchilar `admin.shared.ts` da.
 */
export async function adminUserRoutes(app: FastifyInstance) {
  // Foydalanuvchilar
  // ---------------------------------------------------------
  app.get("/api/admin/users", adminOnly, async (req) => {
    const query = pageSchema.extend({ role: z.enum(["job_seeker", "employer", "admin"]).optional() }).parse(req.query);
    const { page, pageSize, skip, take } = paging(query);

    // Ism bo'yicha qidiruv relation filter ($lookup) emas, oldindan yechilgan `userId` ro'yxati
    // orqali (audit R3, admin-staff-11): ilgari har hujjat uchun $lookup ikki marta (ro'yxat + count) ishlardi.
    const text = searchText(query.text);
    const variants = textVariants(text);
    let profileUserIds: string[] = [];
    if (variants.length) {
      const profiles = await prisma.jobSeekerProfile.findMany({
        where: { OR: variants.flatMap((v) => [{ firstName: like(v) }, { lastName: like(v) }]) },
        select: { userId: true },
        take: RELATION_MATCH_LIMIT,
      });
      profileUserIds = profiles.map((r) => r.userId);
    }
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(variants.length
        ? {
            OR: [
              ...variants.flatMap((v) => [{ email: like(v) }, { phone: like(v) }]),
              ...(profileUserIds.length ? [{ id: { in: profileUserIds } }] : []),
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          jobSeekerProfile: { select: { firstName: true, lastName: true } },
          ownedCompanies: { select: { name: true, slug: true }, orderBy: { createdAt: "asc" }, take: 1 },
          _count: { select: { applications: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: rows.map((u: (typeof rows)[number]) => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isBlocked: u.isBlocked,
        isPhoneVerified: u.isPhoneVerified,
        telegramLinked: Boolean(u.telegramChatId),
        name: [u.jobSeekerProfile?.firstName, u.jobSeekerProfile?.lastName].filter(Boolean).join(" ") || null,
        companyName: u.ownedCompanies[0]?.name ?? null,
        applicationCount: u._count.applications,
        createdAt: u.createdAt,
      })),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
  });

  app.patch("/api/admin/users/:id/block", adminOnly, async (req) => {
    const { id } = idParams.parse(req.params);
    const { isBlocked } = z.object({ isBlocked: z.boolean() }).parse(req.body);
    if (id === req.user!.sub) throw Errors.badRequest("O'zingizni bloklay olmaysiz");

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isBlocked: true } });
    if (!target) throw Errors.notFound("Foydalanuvchi topilmadi");
    // Oxirgi faol adminni bloklab, panelni butunlay yopib bo'lmaydi (audit R3, D-077)
    if (isBlocked && target.role === "admin" && !target.isBlocked) await assertNotLastActiveAdmin(id);

    const user = await prisma.user.update({ where: { id }, data: { isBlocked } });
    // Xavfsizlik jurnali (audit R3, D-050): admin amallari iz qoldiradi
    recordSecurityEvent({ type: isBlocked ? "user_blocked" : "user_unblocked", userId: id, actorId: req.user!.sub });

    if (isBlocked) {
      // Blok darhol kuchga kiradi: refresh tokenlar bekor qilinadi va ochiq WebSocket ulanishlari
      // yopiladi (audit ISSUE-035). Access token har autentifikatsiyalangan so'rovda bazadan tekshiriladi (audit PHASE 6, V5).
      await revokeUserSessions(id);
      closeUserSockets(id);
      recordSecurityEvent({ type: "sessions_invalidated", userId: id, actorId: req.user!.sub, meta: { reason: "user_blocked" } });

      // Uning faol vakansiyalari ham saytdan olinadi va qulflanadi (audit R3, D-070)
      await archiveOwnerVacancies(id, "user_blocked", req.log);
      // Bloklangan adminning kutilayotgan staff takliflari bekor bo'ladi (audit R3, D-077, gap2-3)
      const revoked = await revokePendingStaffInvites(id);
      if (revoked > 0) {
        recordSecurityEvent({ type: "user_blocked", userId: id, actorId: req.user!.sub, meta: { invitesRevoked: revoked } });
      }
    }

    return { id: user.id, isBlocked: user.isBlocked };
  });

  app.patch("/api/admin/users/:id/role", adminOnly, async (req) => {
    const { id } = idParams.parse(req.params);
    const { role } = z.object({ role: z.enum(["job_seeker", "employer", "admin"]) }).parse(req.body);
    if (id === req.user!.sub) throw Errors.badRequest("O'z rolingizni o'zgartira olmaysiz");
    const previous = await prisma.user.findUnique({ where: { id }, select: { role: true, isBlocked: true } });
    if (!previous) throw Errors.notFound("Foydalanuvchi topilmadi");
    // Oxirgi faol adminning rolini tushirib bo'lmaydi (audit R3, D-077)
    if (previous.role === "admin" && role !== "admin" && !previous.isBlocked) await assertNotLastActiveAdmin(id);
    const user = await prisma.user.update({ where: { id }, data: { role } });
    // Ish beruvchi rolidan chiqqan hisobning faol e'lonlari yetim qolmaydi: bloklashdagi kabi
    // arxivlanadi va qulflanadi (audit R3, D-077; employer-flows-5, data-integrity-6, admin-staff-7)
    if (previous.role === "employer" && role !== "employer") {
      await archiveOwnerVacancies(id, "role_changed", req.log);
    }
    // Admin rolidan tushirilgan hisobning kutilayotgan staff takliflari bekor bo'ladi (D-077, gap2-3)
    if (previous.role === "admin" && role !== "admin") await revokePendingStaffInvites(id);
    // Eski rol yozilgan tokenlar bilan davom etib bo'lmasin: qayta kirishda yangi rol olinadi
    await revokeUserSessions(id);
    closeUserSockets(id);
    recordSecurityEvent({
      type: "role_changed",
      userId: id,
      actorId: req.user!.sub,
      meta: { from: previous?.role ?? "", to: role },
    });
    recordSecurityEvent({ type: "sessions_invalidated", userId: id, actorId: req.user!.sub, meta: { reason: "role_changed" } });
    return { id: user.id, role: user.role };
  });

  // ---------------------------------------------------------

  // ---------------------------------------------------------
  app.get("/api/admin/recovery-requests", adminOnly, async (req) => {
    const query = pageSchema
      .extend({ status: z.enum(["pending", "approved", "rejected", "completed", "expired"]).optional() })
      .parse(req.query);
    const { page, pageSize, skip, take } = paging(query);
    const where: Prisma.RecoveryRequestWhereInput = query.status ? { status: query.status } : {};

    const [rows, total] = await Promise.all([
      prisma.recoveryRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.recoveryRequest.count({ where }),
    ]);

    // Hisoblar bitta so'rovda (N+1 yo'q)
    const userIds = [...new Set(rows.map((r) => r.userId).filter((v): v is string => Boolean(v)))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            role: true,
            createdAt: true,
            isBlocked: true,
            phone: true,
            isPhoneVerified: true,
            backupPhone: true,
            telegramChatId: true,
          },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    return {
      items: rows.map((r) => {
        const account = r.userId ? byId.get(r.userId) : undefined;
        return {
          id: r.id,
          email: r.email,
          fullName: r.fullName,
          details: r.details,
          contact: r.contact,
          status: r.status,
          createdAt: r.createdAt,
          reviewedAt: r.reviewedAt,
          reviewNote: r.reviewNote,
          continueExpiresAt: r.continueExpiresAt,
          // Telefon raqamlari NIQOBLANGAN holda (D-050): admin panelida to'liq raqam ko'rinmaydi
          account: account
            ? {
                exists: true,
                id: account.id,
                role: account.role,
                createdAt: account.createdAt,
                isBlocked: account.isBlocked,
                phoneMasked: account.isPhoneVerified ? maskPhone(account.phone) : null,
                backupPhoneMasked: maskPhone(account.backupPhone),
                telegramLinked: Boolean(account.telegramChatId),
              }
            : { exists: false },
        };
      }),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
  });

  /** Tasdiqlash: tiklash kanallari tozalanadi va so'rov 72 soat davomida davom ettiriladi. */
  app.post("/api/admin/recovery-requests/:id/approve", adminOnly, async (req) => {
    const { id } = idParams.parse(req.params);
    const { note } = z.object({ note: z.string().trim().max(500).optional() }).parse(req.body ?? {});

    const request = await prisma.recoveryRequest.findUnique({ where: { id } });
    if (!request) throw Errors.notFound();
    if (request.status !== "pending") {
      throw new AppError(409, "REQUEST_NOT_PENDING", "So'rov allaqachon ko'rib chiqilgan");
    }
    if (!request.userId) {
      throw new AppError(409, "ACCOUNT_NOT_FOUND", "Bu email bilan hisob yo'q — so'rovni rad eting");
    }
    const user = await prisma.user.findUnique({ where: { id: request.userId }, select: { id: true, telegramChatId: true } });
    if (!user) throw new AppError(409, "ACCOUNT_NOT_FOUND", "Hisob topilmadi — so'rovni rad eting");

    const continueExpiresAt = new Date(Date.now() + RECOVERY_CONTINUE_TTL_MS);
    const claimed = await prisma.recoveryRequest.updateMany({
      where: { id, status: "pending" },
      data: {
        status: "approved",
        reviewedById: req.user!.sub,
        reviewNote: note ?? null,
        reviewedAt: new Date(),
        continueExpiresAt,
      },
    });
    if (claimed.count !== 1) throw new AppError(409, "REQUEST_NOT_PENDING", "So'rov allaqachon ko'rib chiqilgan");

    // Tiklash kanallari tozalanadi: eski telefon va Telegram bog'lanishi bekor qilinadi
    await prisma.user.update({
      where: { id: user.id },
      data: {
        phone: null,
        isPhoneVerified: false,
        phoneVerifiedAt: null,
        telegramChatId: null,
        backupPhone: null,
        backupPhoneVerifiedAt: null,
        backupTelegramId: null,
      },
    });
    await revokeUserSessions(user.id);
    closeUserSockets(user.id);

    recordSecurityEvent({ type: "manual_recovery_approved", userId: user.id, actorId: req.user!.sub, meta: { requestId: id } });
    recordSecurityEvent({ type: "sessions_invalidated", userId: user.id, actorId: req.user!.sub, meta: { reason: "manual_recovery" } });
    if (user.telegramChatId) {
      recordSecurityEvent({ type: "telegram_unlinked", userId: user.id, actorId: req.user!.sub, meta: { reason: "manual_recovery" } });
    }

    return { ok: true as const, id, status: "approved" as const, continueExpiresAt };
  });

  app.post("/api/admin/recovery-requests/:id/reject", adminOnly, async (req) => {
    const { id } = idParams.parse(req.params);
    const { note } = z.object({ note: z.string().trim().max(500).optional() }).parse(req.body ?? {});

    const request = await prisma.recoveryRequest.findUnique({ where: { id }, select: { userId: true, status: true } });
    if (!request) throw Errors.notFound();
    const rejected = await prisma.recoveryRequest.updateMany({
      where: { id, status: "pending" },
      data: { status: "rejected", reviewedById: req.user!.sub, reviewNote: note ?? null, reviewedAt: new Date() },
    });
    if (rejected.count !== 1) throw new AppError(409, "REQUEST_NOT_PENDING", "So'rov allaqachon ko'rib chiqilgan");
    // Hisobsiz (noma'lum email) so'rov ham jurnalga tushadi: admin qarori har doim iz qoldiradi
    recordSecurityEvent({
      type: "manual_recovery_rejected",
      userId: request.userId,
      actorId: req.user!.sub,
      meta: { requestId: id },
    });
    return { ok: true as const, id, status: "rejected" as const };
  });


  /** Bitta foydalanuvchining oxirgi xavfsizlik hodisalari (maxfiy qiymatlarsiz). */
  app.get("/api/admin/users/:id/security-events", adminOnly, async (req) => {
    const { id } = idParams.parse(req.params);
    const rows = await prisma.securityEvent.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return {
      items: rows.map((e) => ({
        id: e.id,
        type: e.type,
        meta: e.meta ?? null,
        actorId: e.actorId,
        createdAt: e.createdAt,
      })),
    };
  });
}
