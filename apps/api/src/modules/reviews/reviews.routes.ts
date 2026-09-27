import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { AppError, Errors } from "../../common/errors.js";
import { idParams } from "../../common/validation.js";
import { bumpDataVersion } from "../../common/cache.js";
import { requireAuth, requireRole, requirePhoneVerified } from "../../common/auth-guard.js";
import { env } from "../../common/env.js";

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export async function reviewRoutes(app: FastifyInstance) {
  // Kompaniyaga 5 yulduzli sharh qoldirish (slug bo'yicha).
  // Yangi sharh avval moderatsiyaga tushadi (REVIEW_PREMODERATION, sukut yoqiq): admin ko'rmasa
  // 24 soatdan keyin avtomatik chop etiladi. O'chirilsa — darhol ko'rinadi (eski xulq).
  app.post(
    "/api/companies/:slug/reviews",
    { preHandler: [requireAuth, requireRole("job_seeker"), requirePhoneVerified] },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const body = reviewSchema.parse(req.body);

      // audit R3, gap4-1: egasi bloklangan kompaniya ochiq sahifada yo'q — unga sharh ham yozilmaydi
      const company = await prisma.company.findUnique({
        where: { slug },
        select: { id: true, owner: { select: { isBlocked: true } } },
      });
      if (!company || company.owner.isBlocked) throw Errors.notFound("Kompaniya topilmadi");

      // Faqat shu kompaniyaga ariza yuborgan nomzod sharh qoldira oladi (haqqoniylik uchun)
      const hasApplied = await prisma.application.findFirst({
        where: { jobSeekerId: req.user!.sub, vacancy: { companyId: company.id } },
        select: { id: true },
      });
      if (!hasApplied) {
        return reply.status(403).send({
          error: "FORBIDDEN",
          message: "Sharh qoldirish uchun avval bu kompaniyaga ariza yuborgan bo'lishingiz kerak",
        });
      }

      // Har bir foydalanuvchidan bitta sharh — mavjud bo'lsa yangilanadi
      const existing = await prisma.companyReview.findFirst({
        where: { companyId: company.id, userId: req.user!.sub },
        select: { id: true, status: true },
      });
      const review = existing
        ? await prisma.companyReview.update({
            where: { id: existing.id },
            data: {
              rating: body.rating,
              comment: body.comment ?? null,
              // Admin rad etgan (yoki qayta ko'rib chiqishga qo'ygan) sharh tahrirlansa — moderatsiyaga
              // tushadi, o'z-o'zidan tasdiqlanmaydi (audit ISSUE-027). Tasdiqlangan sharh tasdiqlanganicha qoladi.
              status: existing.status === "approved" ? "approved" : "pending",
              // Avto-tasdiq muddati qayta yuborilgan paytdan hisoblanadi
              ...(existing.status === "approved" ? {} : { submittedAt: new Date(), autoApprovedAt: null }),
            },
          })
        : await prisma.companyReview.create({
            data: {
              companyId: company.id,
              userId: req.user!.sub,
              rating: body.rating,
              comment: body.comment ?? null,
              ...(env.REVIEW_PREMODERATION ? { status: "pending" as const, submittedAt: new Date() } : { status: "approved" as const }),
            },
          });

      bumpDataVersion();

      // Muallif ismi bilan qaytaramiz (UI darrov ko'rsatishi uchun)
      const profile = await prisma.jobSeekerProfile.findUnique({
        where: { userId: req.user!.sub },
        select: { firstName: true, lastName: true },
      });
      const authorName =
        [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Nomzod";

      return reply.status(existing ? 200 : 201).send({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        authorName,
        mine: true,
        status: review.status,
      });
    }
  );

  // Sharhni o'chirish — admin har qanday holatdagi sharhni; muallif esa FAQAT tasdiqlangan
  // (ochiq ko'rinayotgan) sharhini o'chira oladi (audit R3, D-075 / gap2-1). Ilgari muallif
  // rad etilgan sharhini o'chirib, xuddi shu matnni qaytadan yuborardi: @@unique([companyId,userId])
  // slot bo'shab qolgani uchun POST "create" yo'liga tushib, sharh darrov "approved" bo'lardi —
  // moderatsiya (va admin o'chirishi) shu tarzda chetlab o'tilardi. Endi slot band qoladi va
  // qayta yuborish "update" yo'li orqali `pending` ga tushadi.
  app.delete("/api/reviews/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const review = await prisma.companyReview.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!review) throw Errors.notFound();
    const isAdmin = req.user!.role === "admin";
    if (review.userId !== req.user!.sub && !isAdmin) throw Errors.forbidden();
    if (!isAdmin && review.status !== "approved") {
      throw new AppError(
        403,
        "REVIEW_UNDER_MODERATION",
        "Moderatsiyadagi yoki rad etilgan sharhni faqat admin o'chira oladi. Sharhni tahrirlab qayta yuborishingiz mumkin."
      );
    }
    await prisma.companyReview.delete({ where: { id } });
    bumpDataVersion();
    return reply.status(200).send({ ok: true });
  });
}
