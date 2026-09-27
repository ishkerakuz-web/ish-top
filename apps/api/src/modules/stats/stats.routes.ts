import type { FastifyInstance } from "fastify";
import { prisma } from "../../common/prisma.js";
import { cached } from "../../common/cache.js";
import { startOfTashkentDay } from "../../common/time.js";
import { salaryQuerySchema, salaryStats } from "./salary.stats.js";

/**
 * Bosh sahifa ko'rsatkichlari (real bazadan). Har bosh sahifa ochilishida uchta count
 * bajarilmasin (audit ISSUE-052): 60 soniya kesh, vakansiya/kompaniya yozilganda
 * darhol yangilanadi. "Bugungi arizalar" soni 60 s gacha kechikishi mumkin: ariza yozilishi
 * barcha keshlarni bekor qilmaydi (audit PHASE 6, U14). "Bugun" — Toshkent vaqti bo'yicha (server UTC'da ishlaydi).
 */
const homeStats = cached(
  60_000,
  async () => {
    const [vacancies, companies, applicationsToday] = await Promise.all([
      prisma.vacancy.count({ where: { status: "active" } }),
      prisma.company.count(),
      prisma.application.count({ where: { createdAt: { gte: startOfTashkentDay() } } }),
    ]);
    return { vacancies, companies, applicationsToday };
  },
  // Faqat vakansiya va kompaniya yozuvlari (audit R3, db-perf-6): sharh yozilishi bosh
  // sahifa sonlarini qaytadan hisoblatmaydi
  ["vacancies", "companies"]
);

/**
 * Statistika: bosh sahifa ko'rsatkichlari va maosh tahlili
 * (hisob-kitob — salary.stats.ts).
 */
export async function statsRoutes(app: FastifyInstance) {
  app.get("/api/stats", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=60");
    return homeStats();
  });

  // Maosh statistikasi: ?role=&q=&categorySlug=&area=&experience=
  app.get("/api/stats/salary", async (req, reply) => {
    const query = salaryQuerySchema.parse(req.query);
    reply.header("Cache-Control", "public, max-age=300");
    return salaryStats(query);
  });
}
