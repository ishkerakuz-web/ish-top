import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { AppError } from "../../common/errors.js";
import { objectId } from "../../common/validation.js";
import { requireAuth, requireRole, requirePhoneVerified } from "../../common/auth-guard.js";
import { ownedVacancyIds, primaryCompany } from "../../common/ownership.js";
import { apostropheVariants, searchKey, tokenize } from "../../common/search-text.js";

/** Sahifalash chegarasi: undan keyingi sahifa taklif qilinmaydi (audit PHASE 6, U25). */
const MAX_PAGE = 200;
/**
 * Oldindan aniqlanadigan ID to'plamlari (audit R3, D-068 / db-perf-3): relation filter ($lookup)
 * o'rniga chegaralangan indeksli so'rovlar. Chegaradan oshgan ma'lumotda ro'yxat to'liq bo'lmasligi
 * mumkin — 10K foydalanuvchi maqsadida bu chegaralarga yetilmaydi.
 */
const PUBLISHED_RESUME_LIMIT = 20000;
const BLOCKED_USER_LIMIT = 5000;
const SKILL_MATCH_LIMIT = 50000;

const querySchema = z.object({
  text: z.string().trim().max(100).optional(),
  region: objectId().optional(),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(50),
});

const like = (value: string) => ({ contains: value, mode: "insensitive" as const });

/**
 * Bitta so'zning matn maydonlaridagi mosligi — tutuq belgisining har bir varianti bilan
 * (audit R3, D-080 / gap1-1). Prisma MongoDB'da `contains` qiymatini o'zi ekranlaydi,
 * shuning uchun regex o'rniga variantlar OR bilan beriladi.
 */
function matchesTerm(term: string): Prisma.JobSeekerProfileWhereInput[] {
  return apostropheVariants(term).flatMap((variant) => [
    { firstName: like(variant) },
    { lastName: like(variant) },
    { headline: like(variant) },
  ]);
}

/**
 * Nomzodlar bazasi telefoni tasdiqlangan ish beruvchi uchun (audit R3, D-071 / authz-idor-6).
 * Admin istisno: uning hisobida telefon bo'lmasligi mumkin.
 */
async function requireVerifiedEmployer(req: FastifyRequest, reply: FastifyReply) {
  if (req.user?.role === "admin") return;
  await requirePhoneVerified(req, reply);
}

/**
 * Ish beruvchi uchun nomzodlar (ochiq rezyumesi borlar) qidiruvi.
 *
 * Audit qarorlari:
 * - ISSUE-007: platforma bepul — tarif tekshiruvi (402 PLAN_FEATURE_LOCKED) olib tashlandi.
 * - ISSUE-008: aloqa ma'lumoti (email, telefon) faqat shu ish beruvchi vakansiyasiga ariza
 *   yuborgan nomzodlar uchun qaytadi. Aks holda istalgan ro'yxatdan o'tgan ish beruvchi barcha
 *   nomzodlarning kontaktlarini yig'ib olishi mumkin edi. Boshqa nomzodga "Xabar yozish"
 *   (telefon tasdiqlangan suhbat) orqali murojaat qilinadi.
 * - Faqat chop etilgan rezyumelar, bloklangan hisoblar chiqmaydi; `region` ObjectId tekshiriladi.
 * - R3 (D-071): telefon tasdig'i va foydalanuvchi bo'yicha kvota (soatiga 300 so'rov).
 * - R3 (db-perf-3, scale-10k-3): `user` va `resumes` relation filtrlari o'rniga oldindan
 *   aniqlangan ID'lar — har profil uchun $lookup qilinmaydi.
 */
export async function candidateRoutes(app: FastifyInstance) {
  app.get(
    "/api/candidates",
    {
      preHandler: [requireAuth, requireRole("employer", "admin"), requireVerifiedEmployer],
      // Kvota foydalanuvchi bo'yicha (audit R3, D-071): `preHandler` bosqichida — requireAuth
      // allaqachon `req.user` ni to'ldirgan bo'ladi.
      config: {
        rateLimit: {
          max: 300,
          timeWindow: "1 hour",
          hook: "preHandler" as const,
          keyGenerator: (req: FastifyRequest) => req.user?.sub ?? req.ip,
        },
      },
    },
    async (req) => {
      const isAdmin = req.user!.role === "admin";
      if (!isAdmin && !(await primaryCompany(req.user!.sub))) {
        // Alohida kod: web buni tarmoq xatosidan farqlab, kompaniya profiliga yo'naltiradi (audit PHASE 6, U5)
        throw new AppError(400, "COMPANY_REQUIRED", "Avval kompaniya profilini to'ldiring");
      }

      const query = querySchema.parse(req.query);
      // Vakansiya va kompaniya qidiruvi bilan bitta qoida: tinish belgilari tozalanadi,
      // takrorlar tashlanadi, 2+ belgili ko'pi bilan 8 ta so'z (audit R3, D-080 / gap1-6)
      const terms = tokenize(query.text);
      // Xotiradagi solishtirish uchun kalit: kichik harf + bitta tutuq belgisi
      const termKeys = terms.map(searchKey);

      // 1-bosqich: chop etilgan rezyumelar (`Resume @@index([status])`) va bloklangan hisoblar —
      // ikkalasi ham ID to'plami sifatida, relation filtersiz.
      const [publishedResumes, blocked] = await Promise.all([
        prisma.resume.findMany({
          where: { status: "published" },
          select: { id: true, jobSeekerId: true, title: true },
          take: PUBLISHED_RESUME_LIMIT,
        }),
        prisma.user.findMany({ where: { isBlocked: true }, select: { id: true }, take: BLOCKED_USER_LIMIT }),
      ]);
      const publishedProfileIds = [...new Set(publishedResumes.map((resume) => resume.jobSeekerId))];
      if (publishedProfileIds.length === 0) {
        return { items: [], page: query.page, pageSize: query.pageSize, hasMore: false };
      }

      // 2-bosqich: matn. Har bir so'z profil maydonlarida (ism, familiya, lavozim) YOKI
      // rezyume matnida (sarlavha, ko'nikmalar) uchrashi kerak (audit R3, gap1-9 / D-080).
      // So'zlar maydon guruhiga BOG'LANMAYDI: "Aziz React" so'rovida "Aziz" ismdan, "React"
      // ko'nikmadan topilsa ham nomzod chiqadi — shuning uchun har so'z uchun alohida to'plam.
      let termProfileIds: string[][] = [];
      if (terms.length > 0) {
        const skillRows = await prisma.resumeSkill.findMany({
          where: { OR: terms.flatMap((term) => apostropheVariants(term).map((variant) => ({ skillName: like(variant) }))) },
          select: { resumeId: true, skillName: true },
          take: SKILL_MATCH_LIMIT,
        });
        const skillsByResume = new Map<string, string[]>();
        for (const row of skillRows) {
          const names = skillsByResume.get(row.resumeId);
          if (names) names.push(searchKey(row.skillName));
          else skillsByResume.set(row.resumeId, [searchKey(row.skillName)]);
        }
        const perTerm = termKeys.map(() => new Set<string>());
        for (const resume of publishedResumes) {
          const title = searchKey(resume.title);
          const names = skillsByResume.get(resume.id) ?? [];
          termKeys.forEach((term, index) => {
            if (title.includes(term) || names.some((name) => name.includes(term))) perTerm[index].add(resume.jobSeekerId);
          });
        }
        termProfileIds = perTerm.map((ids) => [...ids]);
      }

      const where: Prisma.JobSeekerProfileWhereInput = {
        id: { in: publishedProfileIds },
        isOpenToWork: true,
        ...(blocked.length ? { userId: { notIn: blocked.map((user) => user.id) } } : {}),
        ...(query.region ? { regionId: query.region } : {}),
        ...(terms.length
          ? {
              AND: terms.map((term, index) => ({
                OR: [
                  ...matchesTerm(term),
                  ...(termProfileIds[index]?.length ? [{ id: { in: termProfileIds[index] } }] : []),
                ],
              })),
            }
          : {}),
      };

      // Bitta ortiqcha yozuv olinadi — `hasMore` aniq: roppa-rosa pageSize ta bo'lsa bo'sh sahifa taklif qilinmaydi (audit PHASE 6, U25)
      const rows = await prisma.jobSeekerProfile.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize + 1,
        orderBy: { userId: "asc" },
        include: {
          // `role` va `isBlocked` faqat tekshirish uchun — javobga chiqmaydi
          user: { select: { id: true, email: true, phone: true, role: true, isBlocked: true } },
          region: { select: { name: true } },
          resumes: {
            where: { status: "published" },
            orderBy: { updatedAt: "desc" },
            take: 1,
            include: {
              skills: true,
              experience: { orderBy: { startDate: "desc" } },
              education: { orderBy: { startYear: "desc" } },
            },
          },
        },
      });

      const hasMore = rows.length > query.pageSize && query.page < MAX_PAGE;
      // Bloklangan yoki roli o'zgargan hisob (oldindan olingan ro'yxatdan chetda qolgan bo'lsa ham)
      // va chop etilgan rezyumesi qolmagan profil ro'yxatga tushmaydi — maxfiylik qoidasi kafolati.
      const profiles = rows
        .slice(0, query.pageSize)
        .filter((profile) => !profile.user.isBlocked && profile.user.role === "job_seeker" && profile.resumes.length > 0);
      const userIds = profiles.map((p) => p.user.id);

      // Kimning aloqa ma'lumotini ko'rsatish mumkin: admin — hammasi; ish beruvchi — o'ziga ariza yuborganlar
      let contactable = new Set<string>();
      if (isAdmin) {
        contactable = new Set(userIds);
      } else if (userIds.length) {
        const vacancyIds = await ownedVacancyIds(req.user!.sub);
        if (vacancyIds.length) {
          const applied = await prisma.application.findMany({
            where: { vacancyId: { in: vacancyIds }, jobSeekerId: { in: userIds } },
            select: { jobSeekerId: true },
          });
          contactable = new Set(applied.map((a) => a.jobSeekerId));
        }
      }

      // Nomzodlarning o'zaro baho (peer rating) o'rtachasi — bitta groupBy so'rov
      const ratingRows = userIds.length
        ? await prisma.peerRating.groupBy({
            by: ["ratedUserId"],
            where: { ratedUserId: { in: userIds } },
            _avg: { score: true },
            _count: { _all: true },
          })
        : [];
      const ratingMap = new Map(
        ratingRows.map((r) => [
          r.ratedUserId,
          { avg: Math.round((r._avg.score ?? 0) * 10) / 10, count: r._count._all },
        ])
      );

      const items = profiles.map((p) => {
        const r = p.resumes[0];
        const rating = ratingMap.get(p.user.id);
        const canContact = contactable.has(p.user.id);
        return {
          userId: p.user.id,
          ratingAvg: rating?.avg ?? null,
          ratingCount: rating?.count ?? 0,
          email: canContact ? p.user.email : null,
          phone: canContact ? p.user.phone : null,
          firstName: p.firstName,
          lastName: p.lastName,
          headline: p.headline,
          regionName: p.region?.name ?? null,
          isOpenToWork: p.isOpenToWork,
          resume: r
            ? {
                title: r.title,
                summary: r.summary,
                desiredSalary: r.desiredSalary,
                skills: r.skills.map((s) => ({ skillName: s.skillName })),
                experience: r.experience.map((e) => ({
                  companyName: e.companyName,
                  position: e.position,
                  startDate: e.startDate.toISOString(),
                  endDate: e.endDate ? e.endDate.toISOString() : null,
                  isCurrent: e.isCurrent,
                  description: e.description,
                })),
                education: r.education.map((e) => ({
                  institution: e.institution,
                  degree: e.degree,
                  field: e.field,
                  startYear: e.startYear,
                  endYear: e.endYear,
                })),
              }
            : null,
        };
      });

      return { items, page: query.page, pageSize: query.pageSize, hasMore };
    }
  );
}
