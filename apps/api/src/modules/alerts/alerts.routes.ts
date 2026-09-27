import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { Errors } from "../../common/errors.js";
import { requireAuth, requireRole } from "../../common/auth-guard.js";
import { idParams } from "../../common/validation.js";
import { parseQueryParams, paramsToUrl } from "./alerts.service.js";

/**
 * Saqlangan qidiruvlar ("Bu so'rov bo'yicha yangi vakansiya chiqsa xabar bering").
 * Ro'yxatdan foydalanuvchi obunani yoqadi/o'chiradi, chastotani tanlaydi.
 */

const paramsSchema = z.object({
  text: z.string().max(200).optional(),
  categorySlug: z.string().max(80).optional(),
  area: z.string().max(80).optional(),
  experience: z.string().max(40).optional(),
  employment: z.string().max(40).optional(),
  salary: z.coerce.number().int().min(0).optional(),
  salaryTo: z.coerce.number().int().min(0).optional(),
  company: z.string().max(2000).optional(),
  verified: z.boolean().optional(),
  premium: z.boolean().optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  queryParams: paramsSchema,
  frequency: z.enum(["instant", "daily"]).default("daily"),
  emailAlertsEnabled: z.boolean().default(true),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  frequency: z.enum(["instant", "daily"]).optional(),
  emailAlertsEnabled: z.boolean().optional(),
});

/** Bo'sh maydonlarni tashlab, saqlanadigan toza obyekt qaytaradi. */
function cleanParams(input: z.infer<typeof paramsSchema>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "" && value !== false) out[key] = value;
  }
  return out;
}

const MAX_PER_USER = 20;

export async function alertRoutes(app: FastifyInstance) {
  app.get(
    "/api/saved-searches",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req) => {
      const rows = await prisma.savedSearch.findMany({
        where: { userId: req.user!.sub },
        orderBy: { createdAt: "desc" },
      });
      return {
        items: rows.map((s: (typeof rows)[number]) => {
          const params = parseQueryParams(s.queryParams);
          return {
            id: s.id,
            name: s.name,
            params,
            url: paramsToUrl(params),
            frequency: s.frequency,
            emailAlertsEnabled: s.emailAlertsEnabled,
            lastNotifiedAt: s.lastNotifiedAt,
            createdAt: s.createdAt,
          };
        }),
      };
    }
  );

  app.post(
    "/api/saved-searches",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req, reply) => {
      const body = createSchema.parse(req.body);
      const userId = req.user!.sub;

      const count = await prisma.savedSearch.count({ where: { userId } });
      if (count >= MAX_PER_USER) {
        throw Errors.badRequest(`Ko'pi bilan ${MAX_PER_USER} ta obuna saqlash mumkin`);
      }

      const created = await prisma.savedSearch.create({
        data: {
          userId,
          name: body.name,
          queryParams: cleanParams(body.queryParams),
          frequency: body.frequency,
          emailAlertsEnabled: body.emailAlertsEnabled,
          // Yaratilgan payt belgilanadi — eski vakansiyalar "yangilik" bo'lib ketmasin
          lastNotifiedAt: new Date(),
        },
      });

      const params = parseQueryParams(created.queryParams);
      return reply.status(201).send({
        id: created.id,
        name: created.name,
        params,
        url: paramsToUrl(params),
        frequency: created.frequency,
        emailAlertsEnabled: created.emailAlertsEnabled,
        lastNotifiedAt: created.lastNotifiedAt,
        createdAt: created.createdAt,
      });
    }
  );

  app.patch(
    "/api/saved-searches/:id",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req) => {
      // Noto'g'ri formatdagi ID Prisma'ga yetmaydi — 400 VALIDATION_ERROR (audit R3, gap2-7)
      const { id } = idParams.parse(req.params);
      const body = updateSchema.parse(req.body);
      const found = await prisma.savedSearch.findUnique({ where: { id }, select: { userId: true } });
      if (!found) throw Errors.notFound();
      if (found.userId !== req.user!.sub) throw Errors.forbidden();

      const updated = await prisma.savedSearch.update({ where: { id }, data: body });
      return { id: updated.id, ok: true };
    }
  );

  app.delete(
    "/api/saved-searches/:id",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req) => {
      // audit R3, gap2-7: DELETE ham bir xil qoida bilan tekshiriladi
      const { id } = idParams.parse(req.params);
      const found = await prisma.savedSearch.findUnique({ where: { id }, select: { userId: true } });
      if (!found) throw Errors.notFound();
      if (found.userId !== req.user!.sub) throw Errors.forbidden();
      await prisma.savedSearch.delete({ where: { id } });
      return { ok: true };
    }
  );
}
