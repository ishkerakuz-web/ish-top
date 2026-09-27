import type { FastifyInstance } from "fastify";
import { prisma } from "../../common/prisma.js";
import { Errors } from "../../common/errors.js";
import { requireAuth, requireRole } from "../../common/auth-guard.js";
import { z } from "zod";
import { objectId } from "../../common/validation.js";
import { withPublicSalary } from "../vacancies/vacancies.service.js";

const vacancyParams = z.object({ vacancyId: objectId() });
const companyParams = z.object({ companyId: objectId() });

/** Saqlanganlar sahifasidagi eng ko'p vakansiya (eng yangi saqlanganlari). */
const FAVORITES_LIMIT = 500;

/**
 * Sevimli vakansiyalar ("keyinroq ko'raman" ro'yxati).
 * Faqat ish izlovchi uchun — ish beruvchida nomzodlar ro'yxati bor.
 */
export async function favoriteRoutes(app: FastifyInstance) {
  // To'liq ro'yxat (sevimlilar sahifasi)
  app.get(
    "/api/favorites",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req) => {
      const rows = await prisma.favorite.findMany({
        // Qoralama, moderatsiyadagi va rad etilgan e'lon mazmuni saqlanganlar orqali ochilmaydi (audit ISSUE-038).
        // Yopilgan (arxiv) e'lon ro'yxatda qoladi — UI uni "yopilgan" deb belgilaydi.
        where: { userId: req.user!.sub, vacancy: { status: { in: ["active", "archived"] } } },
        orderBy: { createdAt: "desc" },
        take: FAVORITES_LIMIT,
        include: {
          vacancy: {
            // Kartaga kerakli maydonlar; kompaniyaning ichki maydonlari (egasi, STIR) nomzodga chiqmaydi
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
              scheduleType: true,
              experienceRequired: true,
              isPremium: true,
              isUrgent: true,
              publishedAt: true,
              region: { select: { name: true, slug: true } },
              category: { select: { name: true, slug: true } },
              company: { select: { name: true, slug: true, logoUrl: true, isVerified: true } },
            },
          },
        },
      });
      return {
        items: rows.map((f: (typeof rows)[number]) => ({
          ...withPublicSalary(f.vacancy),
          favoritedAt: f.createdAt,
          isClosed: f.vacancy.status !== "active",
        })),
      };
    }
  );

  // Faqat ID'lar — ro'yxat/qidiruv sahifasida yuraklarni bo'yash uchun (yengil)
  app.get(
    "/api/favorites/ids",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req) => {
      const rows = await prisma.favorite.findMany({
        where: { userId: req.user!.sub },
        select: { vacancyId: true },
      });
      return { ids: rows.map((r: { vacancyId: string }) => r.vacancyId) };
    }
  );

  app.post(
    "/api/favorites/:vacancyId",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req, reply) => {
      const { vacancyId } = vacancyParams.parse(req.params);
      // Faqat ochiq e'lonni saqlash mumkin (qoralama ID'si bilan uning mazmunini o'qib bo'lmasin)
      const vacancy = await prisma.vacancy.findFirst({
        where: { id: vacancyId, status: "active" },
        select: { id: true },
      });
      if (!vacancy) throw Errors.notFound("Vakansiya topilmadi");

      // Ikki marta bosilsa xato bermaydi — allaqachon borini qaytaramiz
      await prisma.favorite.upsert({
        where: { userId_vacancyId: { userId: req.user!.sub, vacancyId } },
        update: {},
        create: { userId: req.user!.sub, vacancyId },
      });
      return reply.status(201).send({ ok: true, favorited: true });
    }
  );

  app.delete(
    "/api/favorites/:vacancyId",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req) => {
      const { vacancyId } = vacancyParams.parse(req.params);
      await prisma.favorite.deleteMany({ where: { userId: req.user!.sub, vacancyId } });
      return { ok: true, favorited: false };
    }
  );

  // ---- Saqlangan kompaniyalar ----
  // Ro'yxatning o'zi `GET /api/companies?saved=1` (filtr va saralash bilan birga).

  app.get(
    "/api/favorites/companies/ids",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req) => {
      const rows = await prisma.savedCompany.findMany({
        where: { userId: req.user!.sub },
        select: { companyId: true },
      });
      return { ids: rows.map((r: { companyId: string }) => r.companyId) };
    }
  );

  app.post(
    "/api/favorites/companies/:companyId",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req, reply) => {
      const { companyId } = companyParams.parse(req.params);
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
      if (!company) throw Errors.notFound("Kompaniya topilmadi");

      await prisma.savedCompany.upsert({
        where: { userId_companyId: { userId: req.user!.sub, companyId } },
        update: {},
        create: { userId: req.user!.sub, companyId },
      });
      return reply.status(201).send({ ok: true, saved: true });
    }
  );

  app.delete(
    "/api/favorites/companies/:companyId",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req) => {
      const { companyId } = companyParams.parse(req.params);
      await prisma.savedCompany.deleteMany({ where: { userId: req.user!.sub, companyId } });
      return { ok: true, saved: false };
    }
  );
}
