import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { objectId } from "../../common/validation.js";
import { prisma } from "../../common/prisma.js";
import { AppError, Errors } from "../../common/errors.js";
import { requireAuth, requireRole, requirePhoneVerified } from "../../common/auth-guard.js";
import { verifyAccessToken } from "../../common/jwt.js";
import { uniqueSlug } from "../../common/slug.js";
import { removeUploadedFile, saveUpload } from "../../common/uploads.js";
import { bumpDataVersion } from "../../common/cache.js";
import { primaryCompany } from "../../common/ownership.js";
import { notify } from "../notifications/notifications.service.js";
import { indexVacancy, isSearchEngineEnabled } from "../search/search.service.js";
import { PUBLIC_COMPANY_SELECT, VACANCY_CARD_SELECT, withPublicSalary } from "../vacancies/vacancies.service.js";
import { listCompanies, listCompaniesQuery, similarCompanies } from "./companies.list.js";

/** Shu modul yozadigan logo fayllari prefiksi — o'chirishda boshqa fayllarga tegilmaydi. */
const LOGO_PREFIX = "company-logo-";
/** Yuklash endpointlari uchun alohida, qattiqroq limit (audit ISSUE-043). */
const UPLOAD_RATE_LIMIT = { rateLimit: { max: 20, timeWindow: "1 minute" } };
/** Ochiq kompaniya sahifasi ro'yxatlari chegarasi; umumiy son va reyting alohida hisoblanadi (audit ISSUE-047). */
const COMPANY_REVIEWS_LIMIT = 200;
const COMPANY_VACANCIES_LIMIT = 100;

const createCompanySchema = z.object({
  name: z.string().trim().min(2).max(160),
  legalName: z.string().trim().max(200).optional(),
  stir: z.string().trim().max(20).optional(),
  description: z.string().max(2000).optional(),
  website: z.string().max(200).optional(),
  regionId: objectId().optional(),
});

const updateCompanySchema = z.object({
  // Bo'sh joydan iborat nom saqlanmasin va yaratish sxemasi bilan bir xil bo'lsin (audit R3, employer-flows-19)
  name: z.string().trim().min(2).max(160),
  description: z.string().max(2000).nullable().optional(),
  website: z.string().max(200).nullable().optional(),
  regionId: objectId().nullable().optional(),
  industry: z.string().max(120).nullable().optional(),
  employeeCount: z.string().max(40).nullable().optional(),
  foundedYear: z.coerce.number().int().min(1000).max(9999).nullable().optional(),
});

const invalidWebsite = () => new AppError(400, "VALIDATION_ERROR", "website: Sayt manzili noto'g'ri");

/**
 * "guthib.com" -> "https://guthib.com" (protokol qo'shilmagan bo'lsa). Faqat http(s) va domenli
 * manzil saqlanadi (audit ISSUE-037): "javascript:..." kabi qiymat kompaniya sahifasidagi havolaga tushmasin.
 */
function normalizeWebsite(value?: string | null): string | null {
  const t = (value ?? "").trim();
  if (!t) return null;
  const candidate = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw invalidWebsite();
  }
  if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) throw invalidWebsite();
  return candidate;
}

/**
 * Sayt manzillarini "bir xilmi?" deb solishtirish. Eski ma'lumotda manzil protokolsiz
 * ("guthib.com") saqlangan bo'lishi mumkin — normalizatsiyadan keyin ("https://guthib.com")
 * u o'zgargandek ko'rinib, tasdiq belgisini bekorga tushirmasin (audit R3, D-073).
 */
function sameWebsite(a: string | null, b: string | null): boolean {
  const norm = (value: string | null) =>
    (value ?? "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
  return norm(a) === norm(b);
}

/** Nom o'zgarganda bir kompaniya uchun qayta indekslanadigan faol vakansiyalar chegarasi. */
const RESYNC_VACANCY_LIMIT = 500;

/**
 * audit R3, gap1-7: qidiruv indeksidagi hujjatga kompaniya nomi NUSXA qilib yoziladi. Nom o'zgarganda
 * faol vakansiyalar qayta indekslanmasa, ular eski nom bo'yicha topilaveradi va yangi nom bo'yicha
 * umuman topilmaydi (keyingi to'liq reindeksgacha). Javob kutilmaydi: fon rejimida, ketma-ket
 * (Meili va baza bir vaqtda yuklanmasin). MongoDB drayverida nom jonli o'qiladi — hech narsa qilinmaydi.
 */
function resyncCompanyVacanciesInIndex(app: FastifyInstance, companyId: string): void {
  if (!isSearchEngineEnabled()) return;
  void (async () => {
    try {
      const rows = await prisma.vacancy.findMany({
        where: { companyId, status: "active" },
        select: { id: true },
        orderBy: { id: "asc" },
        take: RESYNC_VACANCY_LIMIT + 1,
      });
      if (rows.length > RESYNC_VACANCY_LIMIT) {
        app.log.warn(
          { companyId },
          `[search] kompaniya nomi o'zgardi: faol vakansiyalar ${RESYNC_VACANCY_LIMIT} tadan ko'p, qolgani keyingi to'liq reindeksda yangilanadi`
        );
      }
      for (const row of rows.slice(0, RESYNC_VACANCY_LIMIT)) await indexVacancy(row.id);
    } catch (error) {
      app.log.warn({ companyId }, `[search] kompaniya vakansiyalarini qayta indekslash xatosi: ${(error as Error)?.message ?? error}`);
    }
  })();
}

/**
 * audit R3, D-073 (authz-idor-5, employer-flows-2, gap2-2): tasdiqlangan kompaniyaning identity
 * maydonlari — nom, sayt va logo — o'zgarsa belgi bekor qilinadi. Ilgari tasdiq bir martalik bayroq
 * edi: tasdiqlangan kichik firma nomini va logosini tanilgan brendga almashtirib, belgini,
 * `verified=1` filtridagi o'rnini va katalogdagi ustunligini saqlab qolardi.
 * Egasi xabardor qilinadi; qayta tasdiqlashni admin bajaradi.
 */
function notifyVerificationRemoved(ownerUserId: string, companyName: string): void {
  void notify({
    userId: ownerUserId,
    type: "system",
    title: "Tasdiq belgisi bekor qilindi",
    body: `"${companyName}" ma'lumotlari o'zgargani uchun tasdiqlangan ish beruvchi belgisi olib tashlandi. Admin qayta ko'rib chiqadi.`,
    url: "/profile",
    // audit R3, D-059: saqlanadigan matn o'zbekcha qoladi, web shu kalit bo'yicha tarjima qiladi
    payload: { i18n: { key: "company.verificationRemoved", params: { companyName } } },
  });
}

/**
 * audit R3, D-075 (employer-flows-8): ochiq sharhlar ro'yxatida muallifning `userId` si qaytarilmaydi —
 * u nomzod shu kompaniyaga ariza berganini oshkor qilar va bir odamni kompaniyalar bo'ylab bog'lardi.
 * "Mening sharhim" bayrog'i endi serverda, ixtiyoriy token bo'yicha hisoblanadi. Bu faqat UI
 * ko'rsatkichi (tahrirlash/o'chirish tugmasi): huquqni POST va DELETE /api/reviews/:id baribir
 * qayta tekshiradi, shuning uchun bu yerda qo'shimcha baza so'rovi (blok, tokenVersion) qilinmaydi.
 */
function optionalViewerId(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return verifyAccessToken(header.slice(7)).sub;
  } catch {
    return null;
  }
}

/**
 * audit R3, employer-flows-8: begonaga familiya faqat bosh harfi bilan ko'rinadi ("Aziz K."), shuning
 * uchun ish beruvchi sharh muallifini arizalar ro'yxatidagi to'liq ism bilan solishtirib topa olmaydi.
 * Muallifning o'ziga (mine) to'liq ism qaytadi — o'z sharhini tanishi kerak.
 */
function reviewAuthorProfile(
  profile: { firstName: string; lastName: string } | null,
  mine: boolean
): { firstName: string; lastName: string } | null {
  if (!profile || mine) return profile;
  const initial = [...profile.lastName.trim()][0];
  return { firstName: profile.firstName, lastName: initial ? `${initial}.` : "" };
}

export async function companyRoutes(app: FastifyInstance) {
  // Kompaniyalar katalogi: qidiruv, filtrlar, saralash va cursor sahifalash
  // (batafsil: companies.list.ts). Javob: { items, nextCursor, total }.
  // `saved=1` faqat kirgan foydalanuvchi uchun — boshqa hollarda token shart emas.
  app.get("/api/companies", async (req, reply) => {
    const query = listCompaniesQuery.parse(req.query);
    if (query.saved) {
      // Boshqa yo'llar kabi: token, blok holati va seans versiyasi bazadan tekshiriladi (audit PHASE 6, V5)
      await requireAuth(req, reply);
      return listCompanies(query, req.user!.sub);
    }
    // audit R3, gap4-1 / D-077: katalog keshi companies.list.ts ichida — uning kalitiga bloklangan
    // egalar ro'yxatining barmoq izi kiradi. Bu yerda IKKINCHI kesh bo'lganda admin bloklagan ish
    // beruvchining kompaniyasi katalogda yana 60 s ko'rinib turardi (bloklash har doim ham
    // bumpDataVersion() chaqirmaydi), shuning uchun bu yerda keshlanmaydi.
    return listCompanies(query);
  });

  // Ish beruvchining o'z kompaniyasi (profil uchun)
  app.get(
    "/api/employer/company",
    { preHandler: [requireAuth, requireRole("employer")] },
    async (req) => {
      const company = await prisma.company.findFirst({
        where: { ownerUserId: req.user!.sub },
        // Eski ma'lumotda bir nechta kompaniya bo'lsa ham har safar bir xil (birinchisi) qaytadi
        orderBy: { createdAt: "asc" },
        include: { region: true },
      });
      return { company };
    }
  );

  // Ish beruvchi kompaniya ma'lumotini yaratadi/yangilaydi
  app.put(
    "/api/employer/company",
    { preHandler: [requireAuth, requireRole("employer")] },
    async (req) => {
      const body = updateCompanySchema.parse(req.body);
      // Sayt berilmasa (qisman yangilash) — tegilmaydi, boshqa ixtiyoriy maydonlar kabi (audit R3, D-073).
      // Ilgari `undefined` ham `null` ga aylanardi: faqat nomni yuborgan mijoz saytni o'chirib yuborar,
      // tasdiqlangan kompaniyada esa bu "sayt o'zgardi" deb belgini ham bekorga tushirardi.
      const website = body.website === undefined ? undefined : normalizeWebsite(body.website);
      const existing = await primaryCompany(req.user!.sub);

      if (existing) {
        const nameChanged = body.name !== existing.name;
        // audit R3, D-073: tasdiqlangan kompaniyada nom yoki sayt o'zgarsa belgi bekor bo'ladi.
        // Solishtirishda faqat mazmunli farq hisobga olinadi (bo'sh joy, protokol, oxirgi "/").
        const verificationReset =
          existing.isVerified &&
          (body.name !== existing.name.trim() ||
            (website !== undefined && !sameWebsite(website, existing.website)));
        const updated = await prisma.company.update({
          where: { id: existing.id },
          data: {
            name: body.name,
            description: body.description,
            website,
            regionId: body.regionId,
            industry: body.industry,
            employeeCount: body.employeeCount,
            foundedYear: body.foundedYear,
            ...(verificationReset ? { isVerified: false } : {}),
          },
          include: { region: true },
        });
        // Nom, soha va hudud katalog va facets keshlarida ko'rinadi — darhol yangilansin (audit PHASE 6)
        bumpDataVersion();
        if (verificationReset) notifyVerificationRemoved(updated.ownerUserId, updated.name);
        // audit R3, gap1-7: indeksdagi companyName eskirmasin (slug PUT'da o'zgarmaydi)
        if (nameChanged) resyncCompanyVacanciesInIndex(app, updated.id);
        return { company: updated };
      }

      const created = await prisma.company.create({
        data: {
          ownerUserId: req.user!.sub,
          name: body.name,
          description: body.description,
          website,
          regionId: body.regionId,
          industry: body.industry,
          employeeCount: body.employeeCount,
          foundedYear: body.foundedYear,
          slug: uniqueSlug(body.name, "kompaniya"),
        },
        include: { region: true },
      });
      bumpDataVersion();
      return { company: created };
    }
  );

  // Kompaniya logosini yuklash (PNG/JPG/WebP, maks 5MB — multipart limiti)
  app.post(
    "/api/employer/company/logo",
    { preHandler: [requireAuth, requireRole("employer")], config: UPLOAD_RATE_LIMIT },
    async (req, reply) => {
      if (!req.isMultipart()) throw Errors.badRequest("Fayl multipart/form-data sifatida yuborilishi kerak");
      const company = await primaryCompany(req.user!.sub);
      if (!company) throw Errors.badRequest("Avval kompaniya ma'lumotlarini saqlang");

      const data = await req.file();
      if (!data) throw Errors.badRequest("Fayl topilmadi");
      // SVG qabul qilinmaydi — ichida skript bo'lishi mumkin (audit ISSUE-002). Tur mijoz
      // sarlavhasidan emas, fayl baytlaridan aniqlanadi (audit ISSUE-043).
      const logoUrl = await saveUpload(data, LOGO_PREFIX, ["png", "jpg", "webp"], "Faqat PNG, JPG yoki WebP rasm qabul qilinadi", "public");

      // audit R3, D-073: logo ham kompaniya identity'si — tasdiqlangan kompaniyada belgi bekor bo'ladi
      await prisma.company.update({
        where: { id: company.id },
        data: { logoUrl, ...(company.isVerified ? { isVerified: false } : {}) },
      });
      // Katalog keshi yangi logoni darhol ko'rsatsin (audit PHASE 6)
      bumpDataVersion();
      if (company.isVerified) notifyVerificationRemoved(company.ownerUserId, company.name);
      // Eski logo faylini tozalaymiz (disk to'lib ketmasin)
      removeUploadedFile(company.logoUrl, LOGO_PREFIX);
      return reply.send({ logoUrl });
    }
  );

  // Logoni olib tashlash
  app.delete(
    "/api/employer/company/logo",
    { preHandler: [requireAuth, requireRole("employer")] },
    async (req) => {
      const company = await primaryCompany(req.user!.sub);
      if (!company) throw Errors.notFound();
      // audit R3, D-073: logoni olib tashlash ham identity o'zgarishi — belgi bekor bo'ladi
      const verificationReset = company.isVerified && company.logoUrl !== null;
      await prisma.company.update({
        where: { id: company.id },
        data: { logoUrl: null, ...(verificationReset ? { isVerified: false } : {}) },
      });
      bumpDataVersion();
      if (verificationReset) notifyVerificationRemoved(company.ownerUserId, company.name);
      removeUploadedFile(company.logoUrl, LOGO_PREFIX);
      return { ok: true };
    }
  );

  // Ochiq kompaniya sahifasi. Faqat ko'rsatiladigan maydonlar (audit ISSUE-032): ilgari egasining ID'si,
  // STIR, yuridik nom va tarif maydonlari mehmonga qaytardi. Ro'yxatlar cheklangan (audit ISSUE-047).
  app.get("/api/companies/:slug", async (req) => {
    const { slug } = req.params as { slug: string };
    // audit R3, D-075: "mening sharhim" bayrog'i uchun ixtiyoriy token (yo'q bo'lsa hammasi mine: false)
    const viewerId = optionalViewerId(req);
    const company = await prisma.company.findUnique({
      where: { slug },
      select: {
        ...PUBLIC_COMPANY_SELECT,
        // audit R3, gap4-1 / D-077: egasi bloklangan kompaniya ochiq sahifada ko'rinmaydi.
        // Javobga tushmaydi — pastda `owner` olib tashlanadi.
        owner: { select: { isBlocked: true } },
        reviews: {
          where: { status: "approved" },
          orderBy: { createdAt: "desc" },
          take: COMPANY_REVIEWS_LIMIT,
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            // audit R3, D-075: faqat `mine` ni hisoblash uchun o'qiladi, javobga tushmaydi
            userId: true,
            user: { select: { jobSeekerProfile: { select: { firstName: true, lastName: true } } } },
          },
        },
        vacancies: {
          where: { status: "active" },
          orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
          take: COMPANY_VACANCIES_LIMIT,
          select: VACANCY_CARD_SELECT,
        },
        _count: {
          select: {
            vacancies: { where: { status: "active" } },
            reviews: { where: { status: "approved" } },
          },
        },
      },
    });
    // Bloklangan egasi kompaniyasi mavjud emasdek javob beradi (audit R3, gap4-1)
    if (!company || company.owner.isBlocked) throw Errors.notFound("Kompaniya topilmadi");

    const summary = await prisma.companyReview.aggregate({
      where: { companyId: company.id, status: "approved" },
      _avg: { rating: true },
      _count: { _all: true },
    });

    // `owner` va sharhlardagi `userId` ichki maydonlar — ochiq javobdan chiqariladi (audit R3, D-075)
    const { owner: _owner, reviews, ...publicCompany } = company;

    return {
      ...publicCompany,
      reviews: reviews.map(({ userId, user, ...review }) => {
        const mine = viewerId !== null && userId === viewerId;
        return {
          ...review,
          mine,
          user: { jobSeekerProfile: reviewAuthorProfile(user?.jobSeekerProfile ?? null, mine) },
        };
      }),
      vacancies: company.vacancies.map(withPublicSalary),
      // Ro'yxat cheklangan bo'lsa ham reyting va son to'liq to'plamdan
      reviewSummary: {
        rating: summary._avg.rating === null ? null : Math.round(summary._avg.rating * 10) / 10,
        count: summary._count._all,
      },
    };
  });

  // Ochiq kompaniya sahifasidagi "O'xshash kompaniyalar"
  app.get("/api/companies/:slug/similar", async (req) => {
    const { slug } = req.params as { slug: string };
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(10).optional() }).parse(req.query);
    // audit R3, gap4-1: asosiy kompaniya ochiq bo'lmasa (egasi bloklangan) o'xshashlar ham qaytmaydi.
    // Ro'yxatning o'zidan bloklangan egalarni chiqarish companies.list.ts zimmasida (api-search-vacancies).
    const base = await prisma.company.findUnique({
      where: { slug },
      select: { owner: { select: { isBlocked: true } } },
    });
    if (!base || base.owner.isBlocked) throw Errors.notFound("Kompaniya topilmadi");
    return similarCompanies(slug, limit);
  });

  app.post(
    "/api/companies",
    { preHandler: [requireAuth, requireRole("employer")] },
    async (req, reply) => {
      const body = createCompanySchema.parse(req.body);
      // Bitta ish beruvchi — bitta kompaniya (audit ISSUE-037). Profil PUT /api/employer/company orqali tahrirlanadi.
      if (await primaryCompany(req.user!.sub)) throw Errors.conflict("Sizda allaqachon kompaniya bor");
      const company = await prisma.company.create({
        data: {
          ...body,
          website: normalizeWebsite(body.website),
          ownerUserId: req.user!.sub,
          slug: uniqueSlug(body.name, "kompaniya"),
        },
      });
      bumpDataVersion();
      return reply.status(201).send(company);
    }
  );

  // Tasdiq so'rovi: ish beruvchi yuridik nom va STIR bilan yuboradi; admin/moderator ko'rib chiqadi.
  // STIR — 9 raqamli soliq identifikatori (O'zbekiston).
  app.post(
    "/api/employer/company/verification",
    { preHandler: [requireAuth, requireRole("employer"), requirePhoneVerified], config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req) => {
      const body = z
        .object({
          legalName: z.string().trim().min(2).max(200),
          stir: z.string().trim().regex(/^\d{9}$/, "stir: STIR 9 ta raqamdan iborat bo'lishi kerak"),
        })
        .parse(req.body);
      const company = await primaryCompany(req.user!.sub);
      if (!company) throw Errors.badRequest("Avval kompaniya profilini to'ldiring");
      if (company.isVerified) throw new AppError(409, "ALREADY_VERIFIED", "Kompaniya allaqachon tasdiqlangan");
      const updated = await prisma.company.update({
        where: { id: company.id },
        data: {
          legalName: body.legalName,
          stir: body.stir,
          verificationRequestedAt: new Date(),
          verificationNote: null,
        },
        select: { id: true, isVerified: true, legalName: true, stir: true, verificationRequestedAt: true, verificationNote: true },
      });
      return { company: updated };
    }
  );
}
