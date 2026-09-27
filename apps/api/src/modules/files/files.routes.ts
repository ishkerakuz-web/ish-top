import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { Errors } from "../../common/errors.js";
import { objectId } from "../../common/validation.js";
import { requireAuth, requireRole } from "../../common/auth-guard.js";
import { fileNameFromUrl } from "../../common/uploads.js";
import { getFile } from "../../common/storage.js";

/**
 * PDF rezyume fayllari (audit R3, D-058).
 *
 * Ilgari fayl `/uploads/resume-<hex>.pdf` manzilida hech qanday tekshiruvsiz ochiq edi:
 * havolani bilgan har kim (yoki uni loglardan, keshdan topgan) nomzodning shaxsiy
 * ma'lumotini yuklab olardi va havola hech qachon bekor bo'lmasdi.
 * Endi statik marshrut `.pdf` so'rovini bermaydi (server.ts), fayl esa faqat shu yerdan:
 * - nomzodning o'zi;
 * - shu nomzod ariza yuborgan vakansiya kompaniyasining egasi;
 * - admin.
 */
/**
 * Demo seed media fayllarini `demo-` prefiksi bilan yozadi (`/uploads/demo-resume-...pdf`),
 * shuning uchun o'qishda ikkala prefiks ham qabul qilinadi — aks holda demo hisoblarning
 * rezyumesi statik yo'l yopilgandan keyin umuman ochilmay qolardi (audit R3, D-058).
 * Qiymat foydalanuvchidan kelmaydi: `resumeUrl` ni faqat yuklash marshruti va demo seed yozadi.
 */
const RESUME_PREFIXES = ["resume-", "demo-resume-"] as const;

const applicationParams = z.object({ applicationId: objectId() });

async function sendResumeFile(reply: FastifyReply, resumeUrl: string | null | undefined) {
  // Nom faqat shu ilova (yoki demo seed) yozgan prefiks bilan va xavfsiz belgilardan iborat ekani tekshiriladi
  const name = fileNameFromUrl(resumeUrl, RESUME_PREFIXES);
  if (!name) throw Errors.notFound("Rezyume fayli topilmadi");

  // Fayl lokal diskdan yoki S3-mos xotiradan o'qiladi — qaysi biri ekanini bu modul bilmaydi.
  // Bazada havola bor, lekin fayl yo'q bo'lsa (eski deploy, Volume ulanmagan) — 404.
  const file = await getFile(name);
  if (!file) throw Errors.notFound("Rezyume fayli topilmadi");
  const { stream, size } = file;

  reply.header("Content-Type", "application/pdf").header("Content-Disposition", 'inline; filename="resume.pdf"');
  // Hajm noma'lum bo'lsa (xotira uni bermadi) sarlavha qo'yilmaydi — noto'g'ri 0 javobni buzardi
  if (size > 0) reply.header("Content-Length", String(size));
  reply
    // Shaxsiy ma'lumot: proxy va brauzer keshida qolmasin, qidiruv tizimiga tushmasin
    .header("Cache-Control", "private, no-store")
    .header("X-Content-Type-Options", "nosniff")
    .header("X-Robots-Tag", "noindex");
  return reply.send(stream);
}

export async function fileRoutes(app: FastifyInstance) {
  // Nomzodning o'z rezyume fayli
  app.get(
    "/api/resume-files/me",
    {
      preHandler: [requireAuth, requireRole("job_seeker")],
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const profile = await prisma.jobSeekerProfile.findUnique({
        where: { userId: req.user!.sub },
        select: { resumeUrl: true },
      });
      return sendResumeFile(reply, profile?.resumeUrl);
    }
  );

  // Ariza bo'yicha: vakansiya kompaniyasining egasi, admin yoki arizani yuborgan nomzodning o'zi
  app.get(
    "/api/resume-files/application/:applicationId",
    {
      preHandler: [requireAuth],
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const { applicationId } = applicationParams.parse(req.params);

      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        select: {
          jobSeekerId: true,
          vacancy: { select: { company: { select: { ownerUserId: true } } } },
        },
      });
      if (!application) throw Errors.notFound();

      const userId = req.user!.sub;
      const role = req.user!.role;
      const isOwner = role === "employer" && application.vacancy.company.ownerUserId === userId;
      const isApplicant = application.jobSeekerId === userId;
      if (role !== "admin" && !isOwner && !isApplicant) throw Errors.forbidden();

      const profile = await prisma.jobSeekerProfile.findUnique({
        where: { userId: application.jobSeekerId },
        select: { resumeUrl: true },
      });
      return sendResumeFile(reply, profile?.resumeUrl ?? null);
    }
  );
}
