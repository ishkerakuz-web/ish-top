import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { AppError, Errors } from "../../common/errors.js";
import { safeInternalPath } from "../../common/validation.js";
import { features } from "../../common/env.js";
import { notify } from "../notifications/notifications.service.js";
import { reindexAll } from "../search/search.service.js";
import { acquireLock, releaseLock } from "../../common/redis.js";
import { runAlertSweep } from "../alerts/alerts.service.js";
import { markPaymentPaid } from "../billing/billing.service.js";
import { runAutoApproveSweep } from "../moderation/auto-approve.service.js";
import {
  BROADCAST_BATCH,
  BROADCAST_LOCK,
  BROADCAST_LOCK_TTL_MS,
  BROADCAST_MIN_GAP_MS,
  adminOnly,
  pageSchema,
  paging,
  sleep,
} from "./admin.shared.js";

/**
 * Admin: to'lovlar, ommaviy xabar va texnik amallar (indeks, obunalar, avto-tasdiq).
 *
 * `admin.routes.ts` 1000 qatordan oshib ketgani uchun bo'limlarga ajratildi; umumiy
 * qo'riqchi va yordamchilar `admin.shared.ts` da.
 */
/** Ommaviy xabar shu nusxada ketyaptimi (Redis qulfi bilan birga ishlaydi). */
let broadcastRunning = false;

export async function adminOpsRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------
  app.get("/api/admin/payments", adminOnly, async (req) => {
    const query = pageSchema
      .extend({ status: z.enum(["pending", "paid", "failed", "refunded"]).optional() })
      .parse(req.query);
    const { page, pageSize, skip, take } = paging(query);
    const where: Prisma.PaymentWhereInput = query.status ? { status: query.status } : {};

    const [rows, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          company: { select: { name: true, slug: true } },
          plan: { select: { name: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      items: rows.map((p: (typeof rows)[number]) => ({
        id: p.id,
        transactionId: p.transactionId,
        companyName: p.company.name,
        planName: p.plan.name,
        amount: p.amount,
        status: p.status,
        provider: p.provider,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
  });

  // Provayder ulanmagan bo'lsa — to'lovni admin qo'lda tasdiqlaydi.
  // Monetizatsiya o'chiq bo'lsa endpoint umuman yo'q (audit R3, D-065; monetization-3, admin-staff-14):
  // ilgari bepul platformada ham tarif "faollashtirildi" degan bildirishnoma yuborardi.
  app.post("/api/admin/payments/:transactionId/confirm", adminOnly, async (req) => {
    if (!features.billing) throw Errors.notFound("To'lovlar moduli o'chirilgan");
    const { transactionId } = z.object({ transactionId: z.string().min(1).max(64) }).parse(req.params);
    await markPaymentPaid(transactionId);

    const payment = await prisma.payment.findUnique({
      where: { transactionId },
      include: { company: { select: { ownerUserId: true } }, plan: { select: { name: true } } },
    });
    if (payment) {
      void notify({
        userId: payment.company.ownerUserId,
        type: "system",
        title: "To'lov tasdiqlandi",
        body: `"${payment.plan.name}" tarifi faollashtirildi.`,
        // Tariflar sahifasi ko'rsatilmaydi (platforma bepul) — havola profilga
        url: "/profile",
        i18n: { key: "payment.confirmed", params: { planName: payment.plan.name } },
      });
    }
    return { ok: true };
  });

  // ---------------------------------------------------------
  // Xizmat amallari
  // ---------------------------------------------------------

  // Qidiruv indeksini qayta qurish

  // Ommaviy xabar (tanlangan rolga)
  app.post("/api/admin/broadcast", adminOnly, async (req, reply) => {
    const { title, body, role, url } = z
      .object({
        title: z.string().trim().min(3).max(140),
        body: z.string().trim().min(3).max(1000),
        role: z.enum(["all", "job_seeker", "employer"]).default("all"),
        url: z.string().max(200).optional(),
      })
      .parse(req.body);

    if (broadcastRunning || !(await acquireLock(BROADCAST_LOCK, BROADCAST_LOCK_TTL_MS, "deny"))) {
      throw new AppError(409, "BROADCAST_RUNNING", "Oldingi ommaviy xabar hali yuborilmoqda — tugagach qayta urinib ko'ring");
    }

    const where: Prisma.UserWhereInput = { isBlocked: false, ...(role === "all" ? {} : { role }) };
    // Faqat sayt ichidagi yo'l: "//host" va "/\host" tashqi saytga ochiladi (audit ISSUE-054)
    const target = safeInternalPath(url) ?? "/";
    const log = req.log;
    let total: number;
    let record: { id: string };
    try {
      total = await prisma.user.count({ where });
      // Tarix: kim, kimga, qancha yetkazildi
      record = await prisma.broadcast.create({
        data: { title, body, audience: role, url: target, actorId: req.user!.sub, total },
        select: { id: true },
      });
    } catch (err) {
      // Yuborish boshlanmadi — qulf 6 soat osilib qolmasin
      await releaseLock(BROADCAST_LOCK).catch(() => undefined);
      throw err;
    }

    // Minglab foydalanuvchida HTTP so'rov kutib qolmasin (audit ISSUE-054): javob darhol (202),
    // yuborish fonda, foydalanuvchilar 500 talik bo'laklarda o'qiladi.
    broadcastRunning = true;
    void (async () => {
      let delivered = 0;
      try {
        // Keyset sahifalash (id > oxirgi): Prisma `cursor` hujjati (chegaradagi foydalanuvchi) skan paytida
        // o'chirilsa sikl erta tugab, qolganlarga xabar bormasdi (audit PHASE 6, U15)
        let lastId: string | undefined;
        for (;;) {
          const batch = await prisma.user.findMany({
            where: lastId ? { ...where, id: { gt: lastId } } : where,
            select: { id: true },
            orderBy: { id: "asc" },
            take: BROADCAST_BATCH,
          });
          if (batch.length === 0) break;
          for (const user of batch) {
            const startedAt = Date.now();
            // Tashqi kanallar kutiladi va foydalanuvchilar orasida kamida 40 ms (≈25/s) — audit PHASE 6, V9
            await notify({ userId: user.id, type: "system", title, body, url: target, awaitChannels: true });
            delivered += 1;
            if (delivered % 100 === 0) {
              await prisma.broadcast.update({ where: { id: record.id }, data: { delivered } }).catch(() => undefined);
            }
            const wait = BROADCAST_MIN_GAP_MS - (Date.now() - startedAt);
            if (wait > 0) await sleep(wait);
          }
          lastId = batch[batch.length - 1].id;
          if (batch.length < BROADCAST_BATCH) break;
        }
        log.info({ delivered }, "Ommaviy xabar yuborildi");
        await prisma.broadcast
          .update({ where: { id: record.id }, data: { delivered, status: "done", finishedAt: new Date() } })
          .catch(() => undefined);
      } catch (err) {
        log.error({ err, delivered }, "Ommaviy xabar yuborish to'xtadi");
        await prisma.broadcast
          .update({ where: { id: record.id }, data: { delivered, status: "failed", finishedAt: new Date() } })
          .catch(() => undefined);
      } finally {
        broadcastRunning = false;
        await releaseLock(BROADCAST_LOCK).catch(() => undefined);
      }
    })();

    return reply.status(202).send({ sent: total, id: record.id });
  });

  // Ommaviy xabarlar tarixi (oxirgilari)
  app.get("/api/admin/broadcasts", adminOnly, async () => {
    const rows = await prisma.broadcast.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
    return {
      items: rows.map((b) => ({
        id: b.id,
        title: b.title,
        audience: b.audience,
        total: b.total,
        delivered: b.delivered,
        status: b.status,
        createdAt: b.createdAt,
        finishedAt: b.finishedAt,
      })),
    };
  });
  // ---------------------------------------------------------
  // Qo'lda tiklash so'rovlari (audit R3, D-049; telegram-6, admin-staff-2)
  //
  // Admin FAQAT egalikni tasdiqlaydi: parol, reset havolasi yoki tokenni ko'rmaydi va
  // parol o'rnata olmaydi. Tasdiqlanganda hisobdagi telefon va Telegram bog'lanishlari
  // tozalanadi, barcha seanslar bekor bo'ladi va foydalanuvchi 72 soat ichida botda yangi
  // raqamini tasdiqlab, reset havolasini oladi.

  app.post("/api/admin/search/reindex", adminOnly, async () => reindexAll());

  // Obuna xabarnomalarini hoziroq tekshirish
  app.post("/api/admin/alerts/run", adminOnly, async () => runAlertSweep());

  // Muddati o'tgan moderatsiya navbatini hoziroq avto-tasdiqlash (fon jadvalini kutmasdan)
  app.post("/api/admin/moderation/auto-approve/run", adminOnly, async (req) => runAutoApproveSweep(req.log));

}
