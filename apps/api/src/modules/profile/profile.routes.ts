import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { objectId } from "../../common/validation.js";
import { prisma } from "../../common/prisma.js";
import { AppError, Errors } from "../../common/errors.js";
import { requireAuth, requireRole } from "../../common/auth-guard.js";
import { normalizePhone as toE164 } from "../../common/phone.js";
import { removeUploadedFile, saveUpload } from "../../common/uploads.js";

/** Shu modul yozadigan PDF rezyume fayllari prefiksi — o'chirishda boshqa fayllarga tegilmaydi. */
const RESUME_PREFIX = "resume-";

const updateSchema = z.object({
  firstName: z.string().max(60).optional(),
  lastName: z.string().max(60).optional(),
  phone: z.string().max(30).nullable().optional(),
  // `additionalPhone` — TASDIQLANMAGAN qo'shimcha aloqa raqami (audit R3, telegram-14).
  // U identity ham, parol tiklash kanali ham EMAS: tiklash faqat Telegram orqali tasdiqlangan
  // asosiy yoki zaxira raqam bilan ishlaydi (D-045, D-047).
  additionalPhone: z.string().max(30).nullable().optional(),
  headline: z.string().max(140).nullable().optional(),
  regionId: objectId().nullable().optional(),
  isOpenToWork: z.boolean().optional(),
});

/** Faqat raqamlar — turli formatdagi bir xil raqamni solishtirish uchun. */
function phoneDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/[^0-9]/g, "");
}

/**
 * Telefon formatini tekshiradi va "+<raqamlar>" ko'rinishiga keltiradi (audit R3, telegram-14).
 * Ilgari bu maydonlar istalgan 30 belgili satrni qabul qilardi.
 *
 * Qoida `common/phone.ts` da — BITTA manba (D-044): bot, tiklash oqimi, yagonalik tekshiruvi
 * (`phoneOwner`) va profil bir xil normalizatsiyadan foydalanadi. Bu yerda nusxa saqlansa,
 * qoida o'zgarganda profil boshqa formatda yozib, raqam egasi topilmay qolardi.
 */
function normalizePhone(value: string): string {
  const phone = toE164(value);
  if (!phone) throw Errors.badRequest("Telefon raqami noto'g'ri (masalan +998901234567)");
  return phone;
}

async function loadProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { jobSeekerProfile: { include: { region: true } } },
  });
  if (!user) throw Errors.unauthorized();
  const p = user.jobSeekerProfile;
  return {
    email: user.email,
    role: user.role,
    phone: user.phone,
    isPhoneVerified: user.isPhoneVerified,
    additionalPhone: p?.additionalPhone ?? null,
    firstName: p?.firstName ?? "",
    lastName: p?.lastName ?? "",
    headline: p?.headline ?? null,
    regionId: p?.regionId ?? null,
    regionName: p?.region?.name ?? null,
    isOpenToWork: p?.isOpenToWork ?? true,
    // Egasi o'z faylini ochishi uchun havola qoladi, lekin fayl endi statik `/uploads/` orqali
    // berilmaydi: uni GET /api/resume-files/me qaytaradi (audit R3, D-058).
    resumeUrl: p?.resumeUrl ?? null,
    hasResumeFile: Boolean(p?.resumeUrl),
  };
}

export async function profileRoutes(app: FastifyInstance) {
  /**
   * Hisob ma'lumotlari — HAR QANDAY rol uchun (audit: profile-1).
   *
   * Ilgari bu yo'l faqat `job_seeker` uchun edi, shuning uchun admin yoki kontent
   * jamoasi a'zosi o'z hisob sahifasini ocha olmasdi ("Ma'lumotlarni yuklab bo'lmadi").
   * Javob nomzodga xos maydonlarni (rezyume, hudud, ko'nikmalar) bo'sh qaytaradi —
   * ular admin uchun shunchaki mavjud emas. YOZISH (PATCH) avvalgidek faqat nomzodda:
   * admin hisobiga nomzod profili yaratilmaydi.
   */
  app.get("/api/profile", { preHandler: [requireAuth] }, async (req) => loadProfile(req.user!.sub));

  app.patch(
    "/api/profile",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req) => {
      const body = updateSchema.parse(req.body);
      const userId = req.user!.sub;

      // Asosiy telefon Telegram orqali tasdiqlangan bo'lsa — bu yerda o'zgartirilmaydi:
      // raqamni almashtirish faqat Telegram oqimi orqali (POST /api/auth/phone/change, D-048).
      // Ilgari bunday urinish jimgina e'tiborsiz qolardi (audit R3, telegram-14).
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { isPhoneVerified: true, phone: true, jobSeekerProfile: { select: { additionalPhone: true } } },
      });

      /*
       * Qo'shimcha aloqa raqami ham formatga tekshiriladi (tasdiqlanmagan qoladi), LEKIN
       * ESKI MA'LUMOT buzilmaydi: bu maydon ilgari erkin matn edi, shuning uchun saqlangan
       * qiymat o'zgarmagan bo'lsa (raqamlari bir xil) u qanday bo'lsa shunday qoladi.
       * Busiz eski, formatga to'g'ri kelmaydigan raqami bor foydalanuvchi ismini yoki
       * hududini ham saqlay olmay qolardi (sayt bu maydonni har saqlashda qayta yuboradi).
       * Yangi kiritilgan qiymat esa har doim tekshiriladi (audit R3, telegram-14).
       */
      const storedAdditional = current?.jobSeekerProfile?.additionalPhone ?? null;
      const additionalPhone =
        body.additionalPhone === undefined
          ? undefined
          : body.additionalPhone === null || body.additionalPhone.trim() === ""
            ? null
            : storedAdditional && phoneDigits(body.additionalPhone) === phoneDigits(storedAdditional)
              ? storedAdditional
              : normalizePhone(body.additionalPhone);

      // Telefon yozuvi faqat IKKALA maydon ham tekshiruvdan o'tgandan keyin (qisman yozuv bo'lmasin)
      if (body.phone !== undefined) {
        const normalized = body.phone === null || body.phone.trim() === "" ? null : normalizePhone(body.phone);
        if (current?.isPhoneVerified) {
          // Bir xil raqam qayta yuborilsa (format boshqacha bo'lsa ham) — o'zgarish yo'q, xato ham yo'q.
          // Saqlangan qiymat ham normalizatsiya qilinadi: eski, mahalliy formatdagi (9 xonali) raqam
          // bilan ham profil saqlanaveradi, aks holda foydalanuvchi ism/hududini ham o'zgartira olmasdi.
          if (normalized !== toE164(current.phone)) {
            throw new AppError(
              409,
              "USE_PHONE_CHANGE",
              "Tasdiqlangan telefon raqamini bu yerdan o'zgartirib bo'lmaydi — Telegram orqali raqam almashtirish oqimidan foydalaning."
            );
          }
        } else {
          await prisma.user.update({ where: { id: userId }, data: { phone: normalized } });
        }
      }

      await prisma.jobSeekerProfile.upsert({
        where: { userId },
        update: {
          firstName: body.firstName,
          lastName: body.lastName,
          additionalPhone: additionalPhone,
          headline: body.headline,
          regionId: body.regionId,
          isOpenToWork: body.isOpenToWork,
        },
        create: {
          userId,
          firstName: body.firstName ?? "",
          lastName: body.lastName ?? "",
          additionalPhone: additionalPhone ?? null,
          headline: body.headline ?? null,
          regionId: body.regionId ?? null,
          isOpenToWork: body.isOpenToWork ?? true,
        },
      });

      return loadProfile(userId);
    }
  );

  // Rezyume (PDF) yuklash
  app.post(
    "/api/profile/resume",
    {
      preHandler: [requireAuth, requireRole("job_seeker")],
      // Yuklash uchun alohida, qattiqroq limit (audit ISSUE-043)
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      if (!req.isMultipart()) throw Errors.badRequest("Fayl multipart/form-data sifatida yuborilishi kerak");
      const data = await req.file();
      if (!data) throw Errors.badRequest("Fayl topilmadi");

      // Fayl nomi tasodifiy (ilgari `resume-<userId>-<vaqt>.pdf` — taxmin qilib topilardi), turi
      // PDF baytlaridan aniqlanadi (audit ISSUE-029, ISSUE-043)
      const resumeUrl = await saveUpload(data, RESUME_PREFIX, ["pdf"], "Faqat PDF fayl qabul qilinadi", "private");
      const userId = req.user!.sub;
      const previous = await prisma.jobSeekerProfile.findUnique({ where: { userId }, select: { resumeUrl: true } });

      try {
        await prisma.jobSeekerProfile.upsert({
          where: { userId },
          update: { resumeUrl },
          create: { userId, firstName: "", lastName: "", resumeUrl },
        });
      } catch (error) {
        // Baza yozmasa yangi fayl "egasiz" bo'lib diskda qolmasin (audit R3, files-xss-6)
        removeUploadedFile(resumeUrl, RESUME_PREFIX);
        throw error;
      }
      // Almashtirilgan eski fayl diskda va havola orqali ochiq qolmasin
      removeUploadedFile(previous?.resumeUrl, RESUME_PREFIX);
      return reply.send({ resumeUrl, hasResumeFile: true });
    }
  );

  app.delete(
    "/api/profile/resume",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req) => {
      const userId = req.user!.sub;
      const profile = await prisma.jobSeekerProfile.findUnique({ where: { userId }, select: { resumeUrl: true } });
      if (profile?.resumeUrl) {
        await prisma.jobSeekerProfile.update({ where: { userId }, data: { resumeUrl: null } });
        // Fayl ham diskdan o'chiriladi — ilgari faqat havola tozalanib, fayl URL orqali ochiq qolardi
        removeUploadedFile(profile.resumeUrl, RESUME_PREFIX);
      }
      return { ok: true };
    }
  );
}
