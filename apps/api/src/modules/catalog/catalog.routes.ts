import type { FastifyInstance } from "fastify";
import { prisma } from "../../common/prisma.js";

export async function catalogRoutes(app: FastifyInstance) {
  // Hududlar ro'yxati (faqat viloyatlar — umumiy "O'zbekiston" tashqari)
  app.get("/api/regions", async () => {
    const items = await prisma.region.findMany({
      where: { parentId: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
    return { items };
  });

  // Kategoriyalar ro'yxati (vakansiya joylash uchun)
  app.get("/api/categories", async () => {
    const items = await prisma.vacancyCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
    return { items };
  });
}
