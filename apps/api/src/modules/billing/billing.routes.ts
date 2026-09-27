import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { Errors } from "../../common/errors.js";
import { requireAuth, requireRole } from "../../common/auth-guard.js";
import { features } from "../../common/env.js";
import {
  createCheckout,
  getSubscriptionState,
  markPaymentPaid,
  verifyWebhookAuth,
} from "./billing.service.js";
import { notify } from "../notifications/notifications.service.js";

const checkoutSchema = z.object({
  planSlug: z.string().min(2).max(40),
  provider: z.enum(["payme", "click"]).default("payme"),
});

/** Reja `features` maydoni Json — UI uchun satrlar ro'yxatiga keltiramiz. */
function featureList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((f): f is string => typeof f === "string") : [];
}

export async function billingRoutes(app: FastifyInstance) {
  // Ochiq tariflar ro'yxati (narx sahifasi)
  app.get("/api/plans", async () => {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return {
      items: plans.map((p: (typeof plans)[number]) => ({
        slug: p.slug,
        name: p.name,
        price: p.price,
        currency: p.currency,
        durationDays: p.durationDays,
        maxActiveVacancies: p.maxActiveVacancies,
        maxFeaturedVacancies: p.maxFeaturedVacancies,
        canSearchCandidates: p.canSearchCandidates,
        features: featureList(p.features),
      })),
      providers: {
        payme: features.payme,
        click: features.click,
      },
    };
  });

  // Ish beruvchining amaldagi obunasi va limit sarfi
  app.get(
    "/api/employer/subscription",
    { preHandler: [requireAuth, requireRole("employer", "admin")] },
    async (req) => {
      const company = await prisma.company.findFirst({
        where: { ownerUserId: req.user!.sub },
        select: { id: true },
      });
      if (!company) {
        return {
          subscription: null,
          message: "Avval kompaniya profilini to'ldiring",
        };
      }
      const state = await getSubscriptionState(company.id);
      return { subscription: state };
    }
  );

  // To'lovlar tarixi (ish beruvchi o'zinikini ko'radi)
  app.get(
    "/api/employer/payments",
    { preHandler: [requireAuth, requireRole("employer", "admin")] },
    async (req) => {
      const company = await prisma.company.findFirst({
        where: { ownerUserId: req.user!.sub },
        select: { id: true },
      });
      if (!company) return { items: [] };
      const rows = await prisma.payment.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: "desc" },
        include: { plan: { select: { name: true, slug: true } } },
        take: 50,
      });
      return {
        items: rows.map((p: (typeof rows)[number]) => ({
          id: p.id,
          transactionId: p.transactionId,
          planName: p.plan.name,
          amount: p.amount,
          status: p.status,
          provider: p.provider,
          paidAt: p.paidAt,
          createdAt: p.createdAt,
        })),
      };
    }
  );

  // Tarifni sotib olish — to'lov yozuvi + provayder havolasi
  app.post(
    "/api/employer/subscription/checkout",
    { preHandler: [requireAuth, requireRole("employer")] },
    async (req) => {
      const body = checkoutSchema.parse(req.body);
      const company = await prisma.company.findFirst({
        where: { ownerUserId: req.user!.sub },
        select: { id: true },
      });
      if (!company) throw Errors.badRequest("Avval kompaniya profilini to'ldiring");
      return createCheckout(company.id, body.planSlug, body.provider);
    }
  );

  // ---------------------------------------------------------
  // Provayder webhook'lari
  // ---------------------------------------------------------

  app.post("/api/payments/:provider/callback", async (req, reply) => {
    const { provider } = req.params as { provider: string };
    if (provider !== "payme" && provider !== "click") {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Noma'lum provayder" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!verifyWebhookAuth(provider, req.headers as Record<string, unknown>, body)) {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Imzo tekshiruvidan o'tmadi" });
    }

    // Payme buyurtma raqamini `params.account.order_id` ichida,
    // Click esa `merchant_trans_id` maydonida uzatadi.
    const account = (body.params as { account?: Record<string, unknown> } | undefined)?.account;
    const transactionId = String(
      account?.order_id ?? body.merchant_trans_id ?? body.transaction_param ?? ""
    );
    if (!transactionId) {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "Tranzaksiya raqami yo'q" });
    }

    await markPaymentPaid(transactionId);

    // Ish beruvchini xabardor qilamiz
    const payment = await prisma.payment.findUnique({
      where: { transactionId },
      include: { company: { select: { ownerUserId: true } }, plan: { select: { name: true } } },
    });
    if (payment) {
      void notify({
        userId: payment.company.ownerUserId,
        type: "system",
        title: "To'lov qabul qilindi",
        body: `"${payment.plan.name}" tarifi faollashtirildi.`,
        url: "/profile",
        // Web matnni o'z tilida chizadi (audit R3, D-059)
        i18n: { key: "payment.confirmed", params: { planName: payment.plan.name } },
      });
    }

    return reply.send({ result: { state: 2 }, ok: true });
  });
}
