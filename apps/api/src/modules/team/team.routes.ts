import crypto from "node:crypto";
import argon2 from "argon2";
import type { FastifyInstance } from "fastify";
import type { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { AppError, Errors } from "../../common/errors.js";
import { requireAuth, requireStaff } from "../../common/auth-guard.js";
import { isObjectId } from "../../common/validation.js";
import { env } from "../../common/env.js";
import { escapeHtml, renderEmail, sendMail } from "../../common/mailer.js";
import { issueTokens, normalizeEmail, revokeUserSessions } from "../auth/auth.service.js";
import { closeUserSockets } from "../../common/realtime.js";
import { recordSecurityEvent } from "../../common/security-events.js";
import { setRefreshCookie } from "../auth/auth.routes.js";
import { STAFF_ROLES } from "../articles/articles.permissions.js";

/** Jamoa: kontent rollari + moderator (moderator maqolalar bo'limiga kirmaydi). */
const TEAM_ROLES: UserRole[] = [...STAFF_ROLES, "moderator"];

/**
 * Kontent jamoasi: a'zolar, taklif, rol va faollik. Boshqaruv faqat SUPER_ADMIN
 * (`admin`) uchun. Jamoaga ochiq ro'yxatdan o'tish YO'Q — hisob faqat taklif
 * havolasi orqali ochiladi.
 *
 * Taklif tokeni: 32 bayt tasodifiy, bazada faqat SHA-256 hash; havola 7 kun
 * amal qiladi va bir marta ishlatiladi. Bir email'ga yangi taklif eskisini bekor qiladi.
 */

const adminOnly = { preHandler: [requireAuth, requireStaff("admin")] };
const strictRateLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const staffRole = z.enum(["admin", "content_editor", "content_author", "moderator"]);

const ROLE_NAMES: Record<string, string> = {
  admin: "super administrator",
  content_editor: "muharrir",
  content_author: "muallif",
  moderator: "moderator",
};

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/**
 * Oxirgi faol admin himoyasi (audit R3, D-077; auth-core-10, admin-staff-5).
 *
 * Adminni bloklash yoki rolini tushirish faqat BOSHQA faol admin qolganda mumkin —
 * aks holda panelga kirish yo'li butunlay yopilardi va uni faqat baza orqali ochib bo'lardi.
 * Admin boshqaruvi ikki joyda (admin.routes.ts foydalanuvchilar, team.routes.ts jamoa),
 * shuning uchun qoida shu yerda bir marta yozilgan.
 */
export async function assertNotLastActiveAdmin(userId: string): Promise<void> {
  const others = await prisma.user.count({ where: { role: "admin", isBlocked: false, id: { not: userId } } });
  if (others === 0) {
    throw new AppError(
      409,
      "LAST_ADMIN",
      "Bu saytdagi yagona faol administrator — uni bloklash yoki rolini o'zgartirish mumkin emas. Avval boshqa administrator tayinlang."
    );
  }
}

/**
 * Kutilayotgan taklif: qabul ham, bekor ham qilinmagan. MongoDB'da Prisma
 * `field: null` faqat aniq `null` ni topadi — maydon umuman yozilmagan hujjat
 * (yangi taklif) uchun `isSet: false` ham kerak.
 */
const PENDING = {
  AND: [
    { OR: [{ acceptedAt: null }, { acceptedAt: { isSet: false } }] },
    { OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }] },
  ],
};

const memberSelect = {
  id: true,
  email: true,
  role: true,
  isBlocked: true,
  createdAt: true,
  staffProfile: { select: { fullName: true, position: true } },
  _count: { select: { articles: true } },
} as const;

function memberView(
  u: {
    id: string;
    email: string;
    role: UserRole;
    isBlocked: boolean;
    createdAt: Date;
    staffProfile: { fullName: string; position: string | null } | null;
    _count: { articles: number };
  },
  selfId: string
) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    isBlocked: u.isBlocked,
    name: u.staffProfile?.fullName ?? null,
    position: u.staffProfile?.position ?? null,
    articleCount: u._count.articles,
    joinedAt: u.createdAt,
    isSelf: u.id === selfId,
  };
}

/** Token bo'yicha taklif holati: yaroqsiz — 404, ishlatilgan/muddati o'tgan — 410. */
async function findUsableInvite(token: string) {
  const invite = token.length >= 20 && token.length <= 100 ? await prisma.staffInvite.findUnique({ where: { tokenHash: hashToken(token) } }) : null;
  if (!invite || invite.revokedAt) throw new AppError(404, "INVITE_NOT_FOUND", "Taklif topilmadi yoki bekor qilingan");
  if (invite.acceptedAt) throw new AppError(410, "INVITE_USED", "Bu taklif allaqachon qabul qilingan");
  if (invite.expiresAt.getTime() < Date.now()) throw new AppError(410, "INVITE_EXPIRED", "Taklif muddati tugagan. Administratordan yangi taklif so'rang");
  return invite;
}

/**
 * Taklif qilgan admin bloklansa yoki roli olinsa, uning KUTILAYOTGAN takliflari bekor
 * qilinadi (audit R3, D-077; gap2-3): aks holda 7 kunlik havola bilan hali ham yangi
 * admin hisobi ochish mumkin edi. Qabul qilingan takliflarga tegilmaydi.
 */
export async function revokePendingStaffInvites(invitedById: string): Promise<number> {
  const result = await prisma.staffInvite.updateMany({
    where: { invitedById, ...PENDING },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function teamRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------
  // Jamoa ro'yxati va kutilayotgan takliflar
  // ---------------------------------------------------------
  app.get("/api/admin/team", adminOnly, async (req) => {
    const now = Date.now();
    const [members, invites] = await Promise.all([
      prisma.user.findMany({ where: { role: { in: TEAM_ROLES } }, orderBy: { createdAt: "asc" }, select: memberSelect }),
      prisma.staffInvite.findMany({
        where: PENDING,
        orderBy: { createdAt: "desc" },
        include: { invitedBy: { select: { email: true, staffProfile: { select: { fullName: true } } } } },
      }),
    ]);
    return {
      members: members.map((m) => memberView(m, req.user!.sub)),
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        expired: i.expiresAt.getTime() < now,
        invitedBy: i.invitedBy.staffProfile?.fullName || i.invitedBy.email.split("@")[0],
      })),
    };
  });

  // Taklif yaratish: email + rol. Havola javobda BIR MARTA qaytadi (bazada hash).
  app.post("/api/admin/team/invites", adminOnly, async (req, reply) => {
    const body = z.object({ email: z.string().trim().email().max(160), role: staffRole }).parse(req.body);
    const email = normalizeEmail(body.email);
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new AppError(409, "EMAIL_TAKEN", "Bu email bilan hisob allaqachon mavjud");
    }

    const now = new Date();
    await prisma.staffInvite.updateMany({ where: { email, ...PENDING }, data: { revokedAt: now } });
    const token = crypto.randomBytes(32).toString("base64url");
    const invite = await prisma.staffInvite.create({
      data: { email, role: body.role, tokenHash: hashToken(token), invitedById: req.user!.sub, expiresAt: new Date(now.getTime() + INVITE_TTL_MS) },
    });
    const link = `${env.WEB_ORIGIN}/admin/invite?token=${token}`;

    const emailSent = await sendMail({
      to: email,
      subject: body.role === "moderator" ? "ISH BOR! moderatsiya jamoasiga taklif" : "ISH BOR! kontent jamoasiga taklif",
      html: renderEmail({
        title: body.role === "moderator" ? "Sizni ISH BOR! moderatsiya jamoasiga taklif qilishdi" : "Sizni ISH BOR! kontent jamoasiga taklif qilishdi",
        body: `<p>Sizga <b>${escapeHtml(ROLE_NAMES[body.role])}</b> sifatida ${body.role === "moderator" ? "vakansiya, sharh va murojaatlar moderatsiyasida" : "maqolalar bo'limida"} ishlash taklif qilindi.</p><p>Havola 7 kun amal qiladi va faqat bir marta ishlatiladi.</p>`,
        ctaLabel: "Taklifni qabul qilish",
        ctaHref: link,
        footerNote: "Agar bu taklifni kutmagan bo'lsangiz, xatni e'tiborsiz qoldiring.",
      }),
    });

    return reply.status(201).send({
      invite: { id: invite.id, email: invite.email, role: invite.role, createdAt: invite.createdAt, expiresAt: invite.expiresAt, expired: false },
      link,
      emailSent,
    });
  });

  app.delete("/api/admin/team/invites/:id", adminOnly, async (req) => {
    const { id } = req.params as { id: string };
    if (!isObjectId(id)) throw Errors.notFound();
    const result = await prisma.staffInvite.updateMany({ where: { id, ...PENDING }, data: { revokedAt: new Date() } });
    if (result.count === 0) throw Errors.notFound("Taklif topilmadi");
    return { ok: true };
  });

  // A'zoni o'zgartirish: rol, faollik (bloklash), ism va lavozim
  app.patch("/api/admin/team/:id", adminOnly, async (req) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({
        role: staffRole.optional(),
        isBlocked: z.boolean().optional(),
        fullName: z.string().trim().min(2).max(80).optional(),
        position: z.string().trim().max(80).nullable().optional(),
      })
      .parse(req.body);
    if (!isObjectId(id)) throw Errors.notFound();
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, staffProfile: { select: { id: true } } } });
    if (!target || !TEAM_ROLES.includes(target.role)) throw Errors.notFound("Jamoa a'zosi topilmadi");

    const self = id === req.user!.sub;
    if (self && body.role !== undefined && body.role !== target.role) throw Errors.badRequest("O'z rolingizni o'zgartira olmaysiz");
    if (self && body.isBlocked) throw Errors.badRequest("O'zingizni faolsizlantira olmaysiz");
    // Oxirgi faol admin (audit R3, D-077): rolini tushirish ham, faolsizlantirish ham mumkin emas
    const demotesAdmin = target.role === "admin" && body.role !== undefined && body.role !== "admin";
    if (demotesAdmin || (target.role === "admin" && body.isBlocked === true)) {
      await assertNotLastActiveAdmin(id);
    }
    if (body.position !== undefined && body.fullName === undefined && !target.staffProfile) {
      throw Errors.badRequest("Avval ismni kiriting");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.isBlocked !== undefined ? { isBlocked: body.isBlocked } : {}),
        ...(body.fullName !== undefined || body.position !== undefined
          ? {
              staffProfile: {
                upsert: {
                  create: { fullName: body.fullName ?? "", position: body.position || null },
                  update: {
                    ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
                    ...(body.position !== undefined ? { position: body.position || null } : {}),
                  },
                },
              },
            }
          : {}),
      },
      select: memberSelect,
    });
    // Xavfsizlik jurnali (audit R3, D-050): jamoa a'zosining roli va faolligi ham iz qoldiradi
    const roleChanged = body.role !== undefined && body.role !== target.role;
    if (roleChanged) {
      recordSecurityEvent({
        type: "role_changed",
        userId: id,
        actorId: req.user!.sub,
        meta: { from: target.role, to: body.role as string },
      });
    }
    if (body.isBlocked !== undefined) {
      recordSecurityEvent({
        type: body.isBlocked ? "user_blocked" : "user_unblocked",
        userId: id,
        actorId: req.user!.sub,
      });
    }
    // Faolsizlantirish yoki rol o'zgarishi eski refresh tokenlar va ochiq socketlarni ham tugatadi
    if (roleChanged || body.isBlocked === true) {
      await revokeUserSessions(id);
      closeUserSockets(id);
      recordSecurityEvent({
        type: "sessions_invalidated",
        userId: id,
        actorId: req.user!.sub,
        meta: { reason: roleChanged ? "role_changed" : "user_blocked" },
      });
    }
    // Bloklangan yoki admin rolidan tushirilgan a'zoning kutilayotgan takliflari bekor bo'ladi (D-077, gap2-3)
    if (body.isBlocked === true || demotesAdmin) {
      await revokePendingStaffInvites(id);
    }
    return memberView(updated, req.user!.sub);
  });

  // ---------------------------------------------------------
  // Taklif havolasi (ochiq, token bilan)
  // ---------------------------------------------------------
  app.get("/api/staff-invites/:token", strictRateLimit, async (req) => {
    const { token } = req.params as { token: string };
    const invite = await findUsableInvite(token);
    return { email: invite.email, role: invite.role, expiresAt: invite.expiresAt };
  });

  app.post("/api/staff-invites/:token/accept", strictRateLimit, async (req, reply) => {
    const { token } = req.params as { token: string };
    const body = z
      .object({
        fullName: z.string().trim().min(2).max(80),
        position: z.string().trim().max(80).optional(),
        password: z.string().min(8).max(128),
      })
      .parse(req.body);
    const invite = await findUsableInvite(token);
    if (await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } })) {
      throw new AppError(409, "EMAIL_TAKEN", "Bu email bilan hisob allaqachon mavjud");
    }

    // Taklif avval "egallanadi" — bir vaqtdagi ikkita so'rovdan faqat bittasi o'tadi
    const claimedAt = new Date();
    const claim = await prisma.staffInvite.updateMany({
      where: { id: invite.id, ...PENDING },
      data: { acceptedAt: claimedAt },
    });
    if (claim.count === 0) throw new AppError(410, "INVITE_USED", "Bu taklif allaqachon qabul qilingan");

    try {
      const user = await prisma.user.create({
        data: {
          email: invite.email,
          passwordHash: await argon2.hash(body.password),
          role: invite.role,
          isEmailVerified: true,
          staffProfile: { create: { fullName: body.fullName, position: body.position || null } },
        },
      });
      const tokens = issueTokens(user.id, user.role, user.tokenVersion);
      setRefreshCookie(reply, tokens.refreshToken);
      return reply.send({ accessToken: tokens.accessToken, role: user.role });
    } catch (error) {
      await prisma.staffInvite.update({ where: { id: invite.id }, data: { acceptedAt: null } }).catch(() => undefined);
      throw error;
    }
  });
}
