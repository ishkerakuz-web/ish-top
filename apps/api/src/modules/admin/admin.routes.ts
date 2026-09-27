import type { FastifyInstance } from "fastify";
import { prisma } from "../../common/prisma.js";
import { DAY_MS, startOfTashkentDay, tashkentDayKey } from "../../common/time.js";
import { features } from "../../common/env.js";
import { isSearchEngineEnabled } from "../search/search.service.js";
import { autoApproveHours } from "../moderation/auto-approve.service.js";
import { adminUserRoutes } from "./admin.users.routes.js";
import { adminContentRoutes } from "./admin.content.routes.js";
import { adminOpsRoutes } from "./admin.ops.routes.js";
import {
  adminOnly,
  countByDay,
} from "./admin.shared.js";

/**
 * Admin paneli. Bu fayl umumiy ko'rsatkichlarni beradi va bo'limlarni ulaydi:
 *   - `admin.users.routes.ts`   — foydalanuvchilar, bloklash, rol, tiklash so'rovlari
 *   - `admin.content.routes.ts` — vakansiya, kompaniya, sharh moderatsiyasi
 *   - `admin.ops.routes.ts`     — to'lovlar, ommaviy xabar, texnik amallar
 *   - `admin.moderation.routes.ts`, `admin.support.routes.ts` — server.ts da ulanadi
 *
 * Rol va blok holati TOKENDAN emas, har so'rovda BAZADAN tekshiriladi (audit ISSUE-035).
 */
export async function adminRoutes(app: FastifyInstance) {
  await app.register(adminUserRoutes);
  await app.register(adminContentRoutes);
  await app.register(adminOpsRoutes);

  // Umumiy ko'rsatkichlar
  // ---------------------------------------------------------
  app.get("/api/admin/overview", adminOnly, async () => {
    const now = new Date();
    // "Bugun" — Toshkent kalendar kuni boshidan (grafik va bosh sahifa statistikasi bilan bir xil;
    // ilgari so'nggi 24 soat sanalardi — audit PHASE 6, U19)
    const todayStart = startOfTashkentDay(now.getTime());
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

    const [
      users,
      seekers,
      employers,
      blocked,
      companies,
      verifiedCompanies,
      vacanciesActive,
      vacanciesModeration,
      applications,
      applicationsToday,
      newUsersWeek,
      reviewsPending,
      paymentsPaid,
      revenueRows,
      ticketsOpen,
      verificationRequests,
      autoApprovedUnreviewed,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "job_seeker" } }),
      prisma.user.count({ where: { role: "employer" } }),
      prisma.user.count({ where: { isBlocked: true } }),
      prisma.company.count(),
      prisma.company.count({ where: { isVerified: true } }),
      prisma.vacancy.count({ where: { status: "active" } }),
      prisma.vacancy.count({ where: { status: "moderation" } }),
      prisma.application.count(),
      prisma.application.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.companyReview.count({ where: { status: "pending" } }),
      prisma.payment.count({ where: { status: "paid" } }),
      prisma.payment.aggregate({ where: { status: "paid" }, _sum: { amount: true } }),
      prisma.supportTicket.count({ where: { status: { in: ["open", "in_progress"] } } }),
      prisma.company.count({ where: { isVerified: false, verificationRequestedAt: { not: null } } }),
      prisma.vacancy.count({ where: { status: "active", autoApprovedAt: { not: null } } }),
    ]);

    // Oxirgi 14 kunlik ro'yxatdan o'tish/ariza dinamikasi — Toshkent kunlari bo'yicha
    // (ilgari server vaqti va UTC aralashib, kun chegarasi 5 soatga siljirdi; audit ISSUE-052)
    const since = new Date(todayStart.getTime() - 13 * DAY_MS);
    const [usersByDay, appsByDay] = await Promise.all([countByDay("users", since), countByDay("applications", since)]);
    const days = Array.from({ length: 14 }, (_, i) => {
      const date = tashkentDayKey(new Date(since.getTime() + i * DAY_MS));
      return { date, users: usersByDay.get(date) ?? 0, applications: appsByDay.get(date) ?? 0 };
    });

    return {
      users: { total: users, seekers, employers, blocked, newThisWeek: newUsersWeek },
      companies: { total: companies, verified: verifiedCompanies },
      vacancies: { active: vacanciesActive, moderation: vacanciesModeration },
      applications: { total: applications, today: applicationsToday },
      reviews: { pending: reviewsPending },
      payments: { paid: paymentsPaid, revenue: revenueRows._sum.amount ?? 0 },
      // Monetizatsiya o'chiq (audit R3, D-065): panel tushum/tarif ko'rinishlarini shu bayroq bo'yicha yashiradi
      billingEnabled: features.billing,
      search: { engine: isSearchEngineEnabled() ? "meilisearch" : "mongodb" },
      // 0 — avto-tasdiq o'chiq
      moderation: {
        autoApproveHours: autoApproveHours(),
        // Admin ko'rmasdan e'lon qilingan va hali "tekshirildi" deb belgilanmaganlar
        autoApprovedUnreviewed,
      },
      support: { open: ticketsOpen },
      verificationRequests,
      chart: days,
    };
  });

  // ---------------------------------------------------------
}
