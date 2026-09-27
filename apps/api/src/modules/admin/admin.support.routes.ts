import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { AppError, Errors } from "../../common/errors.js";
import { requireAuth, requireStaff } from "../../common/auth-guard.js";
import { idParams } from "../../common/validation.js";
import { features } from "../../common/env.js";
import { escapeHtml, renderEmail, sendMail } from "../../common/mailer.js";
import { recordModeration } from "../../common/moderation-log.js";

/**
 * Murojaatlar qutisi: aloqa formasi xabarlari va vakansiya shikoyatlari. Ilgari ular faqat admin
 * Telegram chatiga borardi — holati, kim ko'rgani va qaysi e'longa tegishli ekani hech qayerda qolmasdi.
 */
const moderatorOnly = { preHandler: [requireAuth, requireStaff("admin", "moderator")] };

const pageSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "dismissed"]).optional(),
  kind: z.enum(["contact", "vacancy_report"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});

export async function adminSupportRoutes(app: FastifyInstance) {
  app.get("/api/admin/support", moderatorOnly, async (req) => {
    const query = pageSchema.parse(req.query);
    const page = query.page ?? 1;
    const pageSize = 25;
    const where: Prisma.SupportTicketWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.supportTicket.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.supportTicket.count({ where }),
    ]);

    // Bog'langan vakansiya va hisoblar bitta so'rovda (N+1 yo'q)
    const vacancyIds = [...new Set(rows.map((r) => r.vacancyId).filter((v): v is string => Boolean(v)))];
    const userIds = [...new Set(rows.map((r) => r.userId).filter((v): v is string => Boolean(v)))];
    const [vacancies, users] = await Promise.all([
      vacancyIds.length
        ? prisma.vacancy.findMany({
            where: { id: { in: vacancyIds } },
            select: { id: true, title: true, slug: true, status: true, company: { select: { name: true } } },
          })
        : Promise.resolve([]),
      userIds.length
        ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, role: true } })
        : Promise.resolve([]),
    ]);
    const vacancyById = new Map(vacancies.map((v) => [v.id, v]));
    const userById = new Map(users.map((u) => [u.id, u]));

    return {
      items: rows.map((r) => {
        const v = r.vacancyId ? vacancyById.get(r.vacancyId) : undefined;
        const u = r.userId ? userById.get(r.userId) : undefined;
        return {
          id: r.id,
          kind: r.kind,
          status: r.status,
          subject: r.subject,
          name: r.name,
          email: r.email,
          message: r.message,
          adminNote: r.adminNote,
          handledAt: r.handledAt,
          repliedAt: r.repliedAt,
          createdAt: r.createdAt,
          account: u ? { id: u.id, email: u.email, role: u.role } : null,
          vacancy: v ? { id: v.id, title: v.title, slug: v.slug, status: v.status, companyName: v.company.name } : null,
        };
      }),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
      // Emailga javob faqat SMTP sozlangan bo'lsa
      canReply: features.email,
    };
  });

  app.patch("/api/admin/support/:id", moderatorOnly, async (req) => {
    const { id } = idParams.parse(req.params);
    const body = z
      .object({
        status: z.enum(["open", "in_progress", "resolved", "dismissed"]).optional(),
        adminNote: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(req.body);
    const before = await prisma.supportTicket.findUnique({ where: { id }, select: { status: true, kind: true, subject: true } });
    if (!before) throw Errors.notFound();
    const closing = body.status === "resolved" || body.status === "dismissed";
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.adminNote !== undefined ? { adminNote: body.adminNote || null } : {}),
        handledById: req.user!.sub,
        ...(closing ? { handledAt: new Date() } : {}),
      },
    });
    if (body.status && body.status !== before.status) {
      recordModeration({
        entityType: "ticket",
        entityId: id,
        action: "ticket_status",
        actorId: req.user!.sub,
        reason: body.adminNote ?? undefined,
        meta: { from: before.status, to: body.status, kind: before.kind, subject: before.subject },
      });
    }
    return { id: ticket.id, status: ticket.status, adminNote: ticket.adminNote };
  });

  // Murojaatchiga emailga javob (SMTP sozlangan bo'lsa). Javob yuborilsa murojaat "hal qilindi".
  app.post("/api/admin/support/:id/reply", moderatorOnly, async (req) => {
    const { id } = idParams.parse(req.params);
    const { message } = z.object({ message: z.string().trim().min(3).max(4000) }).parse(req.body);
    if (!features.email) throw new AppError(503, "EMAIL_DISABLED", "Email xizmati sozlanmagan");
    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw Errors.notFound();
    if (!ticket.email) throw new AppError(409, "NO_EMAIL", "Murojaatchi email qoldirmagan");

    const sent = await sendMail({
      to: ticket.email,
      subject: "ISH BOR! — murojaatingizga javob",
      html: renderEmail({
        title: "Murojaatingizga javob",
        body: `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p><hr><p style="color:#667085">Sizning xabaringiz:<br>${escapeHtml(ticket.message.slice(0, 1500)).replace(/\n/g, "<br>")}</p>`,
      }),
    });
    if (!sent) throw new AppError(502, "EMAIL_SEND_FAILED", "Xatni yuborib bo'lmadi");

    const now = new Date();
    await prisma.supportTicket.update({
      where: { id },
      data: { repliedAt: now, status: "resolved", handledAt: now, handledById: req.user!.sub },
    });
    recordModeration({
      entityType: "ticket",
      entityId: id,
      action: "ticket_reply",
      actorId: req.user!.sub,
      meta: { kind: ticket.kind, subject: ticket.subject },
    });
    return { ok: true as const };
  });
}
