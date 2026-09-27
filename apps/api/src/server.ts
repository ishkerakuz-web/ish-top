import "dotenv/config";
import crypto from "node:crypto";
import Fastify from "fastify";
import type { FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { env, isProd, allowedOrigins, features } from "./common/env.js";
import { startHeartbeat, stopHeartbeat, releasePresence } from "./common/realtime.js";
import { rawRedis, redisState, closeRedis } from "./common/redis.js";
import { startCounterFlush, stopCounterFlush, flushCounters } from "./common/counters.js";
import { prisma } from "./common/prisma.js";
import { AppError } from "./common/errors.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { vacancyRoutes } from "./modules/vacancies/vacancies.routes.js";
import { companyRoutes } from "./modules/companies/companies.routes.js";
import { applicationRoutes } from "./modules/applications/applications.routes.js";
import { reviewRoutes } from "./modules/reviews/reviews.routes.js";
import { seoRoutes } from "./modules/seo/seo.routes.js";
import { ogRoutes } from "./modules/og/og.routes.js";
import { articleRoutes } from "./modules/articles/articles.routes.js";
import { articleAdminRoutes } from "./modules/articles/articles.admin.routes.js";
import { backfillArticles } from "./modules/articles/articles.backfill.js";
import { teamRoutes } from "./modules/team/team.routes.js";
import { statsRoutes } from "./modules/stats/stats.routes.js";
import { profileRoutes } from "./modules/profile/profile.routes.js";
import { catalogRoutes } from "./modules/catalog/catalog.routes.js";
import { resumeRoutes } from "./modules/resume/resume.routes.js";
import { chatRoutes } from "./modules/chat/chat.routes.js";
import { candidateRoutes } from "./modules/candidates/candidates.routes.js";
import { telegramRoutes } from "./modules/telegram/telegram.routes.js";
import { supportRoutes } from "./modules/support/support.routes.js";
import { fileRoutes } from "./modules/files/files.routes.js";
import { startTelegramBot, stopTelegramBot } from "./modules/telegram/telegram.service.js";
import { notificationRoutes } from "./modules/notifications/notifications.routes.js";
import { favoriteRoutes } from "./modules/favorites/favorites.routes.js";
import { alertRoutes } from "./modules/alerts/alerts.routes.js";
import { startAlertScheduler, stopAlertScheduler } from "./modules/alerts/alerts.service.js";
import { startAutoApproveScheduler, stopAutoApproveScheduler } from "./modules/moderation/auto-approve.service.js";
import { billingRoutes } from "./modules/billing/billing.routes.js";
import { ensurePlans } from "./modules/billing/billing.service.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { adminModerationRoutes } from "./modules/admin/admin.moderation.routes.js";
import { adminSupportRoutes } from "./modules/admin/admin.support.routes.js";
import { warmSearchIndex } from "./modules/search/search.service.js";
import { ensureCatalog } from "./common/ensure-catalog.js";
import { ensureAdminUser } from "./common/ensure-admin.js";
import { UPLOAD_DIR, ensureUploadDir, storageKind, getFile, contentTypeOf } from "./common/storage.js";

/**
 * Loglarga sirlar tushmasin (audit ISSUE-030, R3 headers-infra-12).
 *
 * Sir tashuvchi query parametrlari (`token`, `access_token`, `reset`, `code`, `requestCode`,
 * `...Secret`, `...Password`, `challenge`) qiymati niqoblanadi - nom ANIQ ro'yxatda emas,
 * naqsh bo'yicha, shuning uchun yangi parametr ham qamrab olinadi. Yo'l ichidagi sirlar
 * (staff taklif tokeni va `/api/auth/recovery/...` yo'llari) ham kesiladi. Qolgan maydonlar
 * Fastify'ning standart req serializer'i bilan bir xil.
 */
const SECRET_QUERY_PARAM =
  /([?&](?:[a-z0-9_.-]*(?:token|secret|password)|reset|code|requestcode|request_code|apikey|api_key|ssrkey|ssr_key|challenge|payload)=)[^&#]*/gi;

function redactUrl(url: string | undefined): string | undefined {
  return url
    ?.replace(SECRET_QUERY_PARAM, "$1[redacted]")
    .replace(/(\/api\/staff-invites\/)[^/?#]+/i, "$1[redacted]")
    .replace(/(\/api\/auth\/recovery\/[a-z-]+\/)[^/?#]+/i, "$1[redacted]");
}

/**
 * SSR so'rovlari uchun alohida rate-limit kaliti (audit R3, D-074; scale-10k-1, headers-infra-11).
 *
 * Saytning SSR serveri (Vercel yoki o'z serveringiz) API'ga `x-ssr-key` bilan keladi. Barcha SSR
 * so'rovlari bir nechta UMUMIY egress IP'dan kelgani uchun ular brauzerlar bilan bitta IP bucket'ida
 * edi: 20 ming sahifani crawl qilish yoki oddiy trafik 429 berardi. Kalit faqat server muhitida
 * bo'ladi (VITE_ emas) va brauzerga hech qachon yetmaydi.
 */
const SSR_RATE_LIMIT_MAX = 6000;

function isSsrRequest(req: FastifyRequest): boolean {
  const expected = env.SSR_API_KEY;
  if (!expected) return false;
  const header = req.headers["x-ssr-key"];
  const given = typeof header === "string" ? header : Array.isArray(header) ? header[0] : undefined;
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // Uzunlik farqi ham sir haqida ma'lumot bermasin: timingSafeEqual faqat teng uzunlikda ishlaydi
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const app = Fastify({
  logger: {
    serializers: {
      req(request: { method?: string; url?: string; hostname?: string; ip?: string; socket?: { remotePort?: number } }) {
        return {
          method: request.method,
          url: redactUrl(request.url),
          hostname: request.hostname,
          remoteAddress: request.ip,
          remotePort: request.socket?.remotePort,
        };
      },
    },
  },
  // Railway (va har qanday reverse-proxy) ortida haqiqiy mijoz IP'si X-Forwarded-For'da keladi.
  // Busiz rate-limit hamma so'rovni bitta proxy IP'siga yozib, butun saytni bloklardi.
  // `TRUST_PROXY` sukuti endi hop soni "1" (audit R3, D-053): `true` bilan mijoz soxtalashtirgan
  // X-Forwarded-For eng chapdagi qiymat sifatida olinib, IP bo'yicha har qanday limit chetlab o'tilardi.
  // Amaldagi qiymat startupda log qilinadi — deploydan keyin `request.ip` ni X-Real-IP bilan solishtiring.
  trustProxy: env.TRUST_PROXY,
});

// Xavfsizlik sarlavhalari (CSP, HSTS, COOP, X-Frame-Options, X-Content-Type-Options...).
// Eslatma: bular API javoblariga qo'llanadi. Web (Vike) alohida origin'da bo'lgani uchun
// crossOriginResourcePolicy "cross-origin" — aks holda yuklangan avatar/OG rasmlari bloklanadi.
await app.register(helmet, {
  // API HTML qaytarmaydi — faqat JSON, XML, PNG (OG) va PDF. Shuning uchun siyosat eng qat'iy:
  // hech qanday skript manbasi yo'q. Ilgari bu yerda `script-src 'self' 'unsafe-inline'` turardi —
  // refresh cookie saqlanadigan origin'da keraksiz inline skript ruxsati edi (audit R3, files-xss-5).
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      // Brauzerning o'z PDF ko'ruvchisi uchun (rezyume `Content-Disposition: inline` bilan beriladi)
      objectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      // Dev http'da so'rovlarni https'ga majburiy o'girmaymiz
      ...(isProd ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  // HSTS faqat prod (HTTPS)da — dev http'da brauzer baribar e'tiborsiz qoldiradi
  strictTransportSecurity: isProd
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
});

// Ruxsat etilgan manzillar `env.ts` da yig'iladi: WEB_ORIGIN + CORS_EXTRA_ORIGINS (+ dev'da mahalliy portlar).
// Audit ISSUE-004: ilgari istalgan `*.vercel.app` credentials bilan ruxsat olardi — begona Vercel sayti
// refresh cookie orqali access token olishi mumkin edi. Endi preview'lar faqat operator bergan ANIQ
// `CORS_PREVIEW_ORIGIN_REGEX` bilan (to'liq moslik) yoki `CORS_EXTRA_ORIGINS` ro'yxatida.
const PREVIEW_ORIGIN = env.CORS_PREVIEW_ORIGIN_REGEX ? new RegExp(`^(?:${env.CORS_PREVIEW_ORIGIN_REGEX})$`, "i") : null;

await app.register(cors, {
  origin(origin, cb) {
    // origin bo'lmasa — bu brauzerdan kelmagan so'rov (SSR, curl, mobil ilova).
    // Bunda CORS umuman qo'llanmaydi, bloklashning ma'nosi yo'q.
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin) || PREVIEW_ORIGIN?.test(origin)) return cb(null, true);
    // 403 (500 emas): begona saytdan kelgan so'rov handler'gacha yetmaydi
    cb(Object.assign(new Error("CORS: bu manzilga ruxsat yo'q"), { statusCode: 403, code: "CORS_FORBIDDEN" }), false);
  },
  credentials: true,
  // Preflight (OPTIONS) javobi brauzerda 10 daqiqa keshlansin: aks holda HAR BIR autentifikatsiyalangan
  // so'rov qo'shimcha to'liq aylanma yo'l qilardi (audit R3, headers-infra-9). Chrome maksimumi 7200 s.
  maxAge: 600,
});
await app.register(cookie);
await app.register(rateLimit, {
  /**
   * Redis sozlangan bo'lsa chegara NUSXALAR ORASIDA umumiy (audit: scale-redis-1).
   * Busiz uchta nusxali deployda amaldagi chegara uch barobar bo'lib ketardi.
   *
   * `skipOnError` MAJBURIY: plaginning sukuti `false`, ya'ni Redis javob bermasa
   * u xato tashlaydi va BUTUN sayt 500 qaytaradi (lokal sinovda aynan shunday
   * bo'ldi — `REDIS_URL` ko'rsatilgan, lekin Redis ishga tushirilmagan edi).
   * `true` bilan xato jimgina o'tkazib yuboriladi: chegara vaqtincha nusxa
   * ichida hisoblanadi, sayt esa ishlayveradi (Rule K).
   */
  redis: rawRedis() ?? undefined,
  skipOnError: true,
  // SSR (server-to-server) so'rovlari alohida, kengroq bucket'da; brauzerlar avvalgidek IP bo'yicha
  keyGenerator: (req) => (isSsrRequest(req) ? "ssr" : req.ip),
  max: (_req, key) => (key === "ssr" ? SSR_RATE_LIMIT_MAX : env.RATE_LIMIT_MAX),
  timeWindow: "1 minute",
  // Javob boshqa xatolar shaklida (`error`/`message`), matni o'zbekcha (audit ISSUE-073)
  errorResponseBuilder: (_req, context) => ({
    statusCode: 429,
    code: "RATE_LIMITED",
    error: "RATE_LIMITED",
    message: `Juda ko'p so'rov. ${Math.max(1, Math.ceil(context.ttl / 1000))} soniyadan so'ng qayta urinib ko'ring.`,
  }),
});
// Fayl bo'lmagan qismlar uchun ham aniq chegara (audit R3, files-xss-3): busiz busboy `fields: Infinity`
// va qism boshiga 1 MB bilan ishlar edi — istalgan kirgan foydalanuvchi fayl qismigacha xotirani to'ldirardi.
await app.register(multipart, {
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, fieldSize: 1024, parts: 12, headerPairs: 50 },
});

ensureUploadDir();
// /uploads/ — foydalanuvchi yuklagan fayllar (audit ISSUE-002). Fayl hujjat sifatida to'g'ridan-to'g'ri
// ochilganda ichidagi skript ishlamasin: CSP sandbox + nosniff. PDF'ga sandbox qo'yilmaydi — brauzer
// PDF ko'ruvchisi ishlashi uchun (PDF skripti sayt origin'iga kira olmaydi).
//
// Audit PHASE 6, V3: qaror URL oxiridan emas, haqiqatda berilayotgan Content-Type'dan chiqariladi.
// Fastify `useSemicolonDelimiter` (sukut true) bilan `/uploads/X.svg;.pdf` X.svg faylini beradi, URL esa
// ".pdf" bilan tugagani uchun eski SVG sandbox'siz ochilib, skripti ishlardi. @fastify/send Content-Type'ni
// (`reply.header` orqali) fayl oqimi `reply.send()` ga berilishidan OLDIN qo'yadi — onSend'da u tayyor.
function uploadsPathname(req: FastifyRequest): string | null {
  // Absolute-form so'rov qatori ("GET http://host/uploads/x.pdf") `req.url` ga to'liq URI beradi —
  // avval pathname ajratiladi, aks holda "/uploads/" tekshiruvi chetlab o'tilardi (audit R3, backend-10).
  let raw = req.url;
  if (!raw.startsWith("/")) {
    try {
      raw = new URL(raw).pathname;
    } catch {
      // URL emas — xom qiymat bilan tekshiriladi
    }
  }
  let path = raw.split(/[?#;]/, 1)[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    // Noto'g'ri foizli kodlash — xom yo'l bilan tekshiriladi
  }
  return path.toLowerCase().startsWith("/uploads/") ? path : null;
}

function isUploadsRequest(req: FastifyRequest): boolean {
  // Static marshrut ("/uploads/*"): foizli kodlangan yo'l ("/%75ploads/...") ham shu marshrutga tushadi
  if (req.routeOptions.url?.startsWith("/uploads/")) return true;
  return uploadsPathname(req) !== null;
}

/**
 * PDF rezyume statik `/uploads/` orqali BERILMAYDI (audit R3, D-058).
 *
 * Ilgari `/uploads/resume-<hex>.pdf` — muddatsiz, tekshiruvsiz "bearer" havola edi: uni bilgan
 * har kim nomzodning shaxsiy ma'lumotini yuklab olardi. Endi fayl faqat `/api/resume-files/*`
 * orqali, vakolatli foydalanuvchiga beriladi.
 *
 * Yozilayotgan vaqtinchalik (".part") fayllar va nuqta bilan boshlanadigan nomlar ham berilmaydi
 * (audit R3, files-xss-6). Tekshiruv dekodlangan, `?`, `#` va `;` da kesilgan yo'l bo'yicha —
 * `/uploads/x.pdf;y` yoki `/uploads/x.PDF` bilan chetlab o'tib bo'lmaydi.
 *
 * Kengaytmadan tashqari fayl NOMI ham tekshiriladi: rezyume fayllari doim `resume-` (demo seed'da
 * `demo-resume-`) bilan boshlanadi. Busiz kengaytma bilan o'ynash (masalan Windows'da oxiridagi
 * nuqtani tashlab yuboradigan `/uploads/resume-x.pdf.`) tekshiruvni chetlab o'tardi.
 */
app.addHook("onRequest", async (req, reply) => {
  const pathname = uploadsPathname(req);
  if (!pathname) return;
  const name = pathname.slice("/uploads/".length).toLowerCase();
  const base = name.slice(name.lastIndexOf("/") + 1);
  if (
    base.startsWith("resume-") ||
    base.startsWith("demo-resume-") ||
    name.endsWith(".pdf") ||
    name.endsWith(".part") ||
    base.startsWith(".") ||
    name.includes("/.")
  ) {
    return reply.status(404).send({ error: "NOT_FOUND", message: "Topilmadi" });
  }
});

app.addHook("onSend", async (req, reply, payload) => {
  if (isUploadsRequest(req)) {
    reply.header("X-Content-Type-Options", "nosniff");
    // Sandbox'siz faqat haqiqiy application/pdf javobi; qolgan hammasi (SVG, HTML, 404, 304...) sandbox bilan
    const contentType = String(reply.getHeader("content-type") ?? "").trim().toLowerCase();
    if (!contentType.startsWith("application/pdf")) {
      reply.header("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
    }
  }
  return payload;
});
/**
 * `/uploads/` — yuklangan ochiq fayllar (audit: storage-1, storage-2).
 *
 * Fayl nomlari tasodifiy va HECH QACHON o'zgarmaydi (yangi fayl = yangi nom), shuning uchun
 * brauzer va CDN ularni bir yil keshlashi mumkin: logolar har sahifada qayta so'ralmaydi.
 *
 * S3 sozlangan bo'lsa ikki holat bor:
 *   - `S3_PUBLIC_BASE_URL` berilgan — bazadagi havola to'g'ridan-to'g'ri CDN'ga ishora qiladi
 *     va bu marshrutga umuman kelinmaydi (eng tez yo'l);
 *   - berilmagan (bucket yopiq) — fayl shu marshrut orqali xotiradan o'qib uzatiladi.
 *     Sekinroq, lekin ochiq bucket ochmasdan ham ishlaydi.
 * PDF rezyumelar bu yerdan BERILMAYDI — yuqoridagi `onRequest` qoidasi ularni to'sadi (D-058).
 */
if (storageKind() === "s3") {
  app.get("/uploads/:name", async (req, reply) => {
    const { name } = req.params as { name: string };
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes("..")) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Topilmadi" });
    }
    const file = await getFile(name);
    if (!file) return reply.status(404).send({ error: "NOT_FOUND", message: "Topilmadi" });
    reply.header("Content-Type", contentTypeOf(name)).header("Cache-Control", "public, max-age=31536000, immutable");
    if (file.size > 0) reply.header("Content-Length", String(file.size));
    return reply.send(file.stream);
  });
} else {
  await app.register(fastifyStatic, {
    root: UPLOAD_DIR,
    prefix: "/uploads/",
    maxAge: "365d",
    immutable: true,
  });
}
// ws kutubxonasining sukut chegarasi 100 MB — chat xabari 4000 belgidan oshmaydi (audit ISSUE-040)
await app.register(websocket, { options: { maxPayload: 64 * 1024 } });

app.setErrorHandler((error, _req, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ error: error.code, message: error.message });
  }
  // Zod validatsiya xatosi -> 400 (tushunarli xabar, 500 emas)
  if (error instanceof ZodError) {
    const issue = error.errors[0];
    const field = issue?.path.join(".");
    const message = field ? `${field}: ${issue.message}` : issue?.message ?? "Ma'lumotlar noto'g'ri";
    return reply.status(400).send({ error: "VALIDATION_ERROR", message });
  }
  // Fastify ichki validatsiya xatosi
  if ((error as { validation?: unknown }).validation) {
    return reply.status(400).send({ error: "VALIDATION_ERROR", message: error.message });
  }
  // Prisma ma'lum xatolari
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return reply.status(409).send({ error: "CONFLICT", message: "Bu yozuv allaqachon mavjud" });
    }
    if (error.code === "P2025") {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Topilmadi" });
    }
    // Noto'g'ri formatdagi ObjectId (masalan /api/conversations/abc) — bunday resurs yo'q (audit ISSUE-031)
    if (error.code === "P2023") {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Topilmadi" });
    }
    // Baza bilan aloqa yo'q yoki ulanish navbati to'lgan — bu 500 emas, VAQTINCHALIK holat:
    // klient (va SSR) uni qayta urinib ko'radigan xato sifatida ko'rsin (audit R3, api-errors-9)
    if (error.code === "P2024" || error.code === "P1001" || error.code === "P1002" || error.code === "P1017") {
      return reply.status(503).send({ error: "SERVICE_UNAVAILABLE", message: "Xizmat vaqtincha mavjud emas. Birozdan so'ng qayta urinib ko'ring." });
    }
    // Yozuv to'qnashuvi (tranzaksiya) — qayta urinsa o'tadi
    if (error.code === "P2034") {
      return reply.status(409).send({ error: "WRITE_CONFLICT", message: "Ma'lumot ayni damda band. Qayta urinib ko'ring." });
    }
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    app.log.error(error);
    return reply.status(503).send({ error: "SERVICE_UNAVAILABLE", message: "Xizmat vaqtincha mavjud emas. Birozdan so'ng qayta urinib ko'ring." });
  }
  // Fastify va plugin xatolari: ichki `FST_*` kodi va inglizcha matn tashqariga chiqmasin,
  // klient tayanadigan barqaror kod qaytadi (audit R3, api-errors-9)
  const fastifyCode = (error as { code?: string }).code;
  if (typeof fastifyCode === "string" && fastifyCode.startsWith("FST_")) {
    if (fastifyCode === "FST_INVALID_MULTIPART_CONTENT_TYPE") {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "Fayl multipart/form-data sifatida yuborilishi kerak" });
    }
    if (fastifyCode === "FST_ERR_CTP_BODY_TOO_LARGE" || fastifyCode === "FST_REQ_FILE_TOO_LARGE") {
      return reply.status(413).send({ error: "PAYLOAD_TOO_LARGE", message: "Yuborilgan ma'lumot juda katta" });
    }
    if (fastifyCode === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
      return reply.status(415).send({ error: "UNSUPPORTED_MEDIA_TYPE", message: "So'rov turi qo'llab-quvvatlanmaydi" });
    }
    const fastifyStatus = (error as { statusCode?: number }).statusCode;
    if (typeof fastifyStatus === "number" && fastifyStatus >= 400 && fastifyStatus < 500) {
      // Kod status bilan mos bo'lsin: multipart chegaralari (FST_PARTS_LIMIT, FST_FIELDS_LIMIT,
      // FST_FILES_LIMIT) 413 qaytaradi — ularni "BAD_REQUEST" deb atash klientni chalg'itardi
      if (fastifyStatus === 413) {
        return reply.status(413).send({ error: "PAYLOAD_TOO_LARGE", message: "Yuborilgan ma'lumot juda katta" });
      }
      if (fastifyStatus === 415) {
        return reply.status(415).send({ error: "UNSUPPORTED_MEDIA_TYPE", message: "So'rov turi qo'llab-quvvatlanmaydi" });
      }
      return reply.status(fastifyStatus).send({ error: "BAD_REQUEST", message: "So'rov noto'g'ri" });
    }
  }
  // Boshqa plugin xatolari (masalan rate-limit 429, CORS 403) — kodi va matni allaqachon bizniki
  const statusCode = (error as { statusCode?: number }).statusCode;
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
    return reply.status(statusCode).send({ error: error.code ?? "ERROR", message: error.message });
  }
  app.log.error(error);
  return reply.status(500).send({ error: "INTERNAL_ERROR", message: "Kutilmagan xatolik" });
});

// Mavjud bo'lmagan manzil uchun ham loyihaning standart shakli ({error, message}) qaytadi —
// ilgari Fastify'ning o'z inglizcha JSON'i ketardi (audit R3, api-errors-9)
app.setNotFoundHandler((_req, reply) => {
  return reply.status(404).send({ error: "NOT_FOUND", message: "Topilmadi" });
});

// Railway healthcheck shu manzilni so'raydi. Baza bilan aloqani ham
// tekshiramiz — aks holda "sog'lom" deb belgilangan, lekin hech narsa
// qaytara olmaydigan konteyner deploy bo'lib qolardi.
app.get("/health", async (_req, reply) => {
  // Redis holati ham ko'rsatiladi, lekin "sog'lom" bahosiga TA'SIR QILMAYDI: u ixtiyoriy
  // tezlatgich, uzilganda sayt xotiradagi zaxira yo'l bilan ishlayveradi (Rule K).
  const redis = redisState();
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    return { ok: true, db: "up", redis };
  } catch {
    return reply.status(503).send({ ok: false, db: "down", redis });
  }
});

// API root — brauzerdan to'g'ridan-to'g'ri kirilsa saytga yo'naltiramiz (404 emas)
app.get("/", async (_req, reply) => reply.redirect(env.WEB_ORIGIN));

await app.register(authRoutes);
await app.register(vacancyRoutes);
await app.register(companyRoutes);
await app.register(applicationRoutes);
await app.register(reviewRoutes);
await app.register(seoRoutes);
await app.register(ogRoutes);
await app.register(articleRoutes);
await app.register(statsRoutes);
await app.register(profileRoutes);
await app.register(catalogRoutes);
await app.register(resumeRoutes);
await app.register(chatRoutes);
await app.register(candidateRoutes);
await app.register(telegramRoutes);
await app.register(supportRoutes);
// PDF rezyume fayli — faqat egasiga, ariza kelgan kompaniya egasiga va adminga (audit R3, D-058)
await app.register(fileRoutes);
await app.register(notificationRoutes);
await app.register(favoriteRoutes);
await app.register(alertRoutes);
// Monetizatsiya o'chiq (platforma bepul): tariflar, checkout va webhook'lar faqat BILLING_ENABLED=true bo'lsa
if (features.billing) await app.register(billingRoutes);
await app.register(adminRoutes);
await app.register(adminModerationRoutes);
await app.register(adminSupportRoutes);
await app.register(articleAdminRoutes);
await app.register(teamRoutes);

/**
 * Fon ishlari: katalog/tariflar/admin hisobi, Telegram bot, qidiruv indeksi va
 * obuna jadvali.
 *
 * Bular `listen` dan KEYIN ishga tushadi. Ilgari ular listen'dan oldin
 * `await` qilinardi va baza sekin javob bersa Railway healthcheck'i port
 * ochilishini kutib timeout bo'lardi. Endi server darrov javob beradi,
 * tayyorgarlik esa fonda tugaydi.
 */
async function bootstrap() {
  try {
    await ensureCatalog();
    if (features.billing) await ensurePlans();
    await ensureAdminUser(app.log);
    await backfillArticles(app.log);
  } catch (e) {
    app.log.error({ err: e }, "Boshlang'ich ma'lumotlarni tayyorlashda xatolik");
  }

  // S3 sozlangan bo'lsa fayllar platformadan mustaqil — Volume ham, UPLOAD_DIR ham kerak emas
  if (isProd && storageKind() === "local" && !env.UPLOAD_DIR) {
    app.log.warn(
      "Fayllar konteynerning vaqtinchalik diskiga yoziladi va deployda yo'qoladi — Volume ulab UPLOAD_DIR bering yoki S3 sozlang (DEPLOY.md)"
    );
  }

  void startTelegramBot(app.log);
  void warmSearchIndex();
  startAlertScheduler(app.log);
  // Admin 24 soat ichida ko'rmagan moderatsiya navbati avtomatik tasdiqlanadi
  startAutoApproveScheduler(app.log);
  startHeartbeat();
  // Ko'rishlar buferini davriy ravishda bazaga yozadi (audit: views-1)
  startCounterFlush(app.log);
}

// Xavfsizlik to'ri: tutilmagan promise xatosi jarayonni yiqitmasin (Node 15+ sukut bo'yicha yiqitadi).
// Asosiy tuzatish xatolar joyida ushlanadi (WS handler, notify) — bu faqat qolgan holatlar uchun log.
process.on("unhandledRejection", (reason) => {
  app.log.error({ err: reason }, "Tutilmagan promise xatosi (unhandledRejection)");
});

// Konteyner to'xtatilganda (Railway deploy, SIGTERM) ochiq so'rovlarni
// tugatib, bazani yopib chiqamiz — aks holda foydalanuvchi uzilgan javob oladi.
let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`${signal} — server to'xtatilmoqda`);
    // Osilib qolgan ulanishlar deployni to'xtatib qo'ymasin — 10 soniyadan keyin majburan chiqamiz
    setTimeout(() => process.exit(1), 10_000).unref();
    stopAlertScheduler();
    stopAutoApproveScheduler();
    stopTelegramBot();
    stopHeartbeat();
    stopCounterFlush();
    void (async () => {
      try {
        await app.close();
        // Buferdagi ko'rishlar yo'qolmasin — to'xtashdan oldin oxirgi marta yoziladi
        await flushCounters().catch((err) => app.log.error({ err }, "Ko'rishlar buferini yozib bo'lmadi"));
        // "Onlayn" belgilari 90 soniya osilib qolmasin — boshqa nusxa darhol to'g'ri ko'rsin
        await releasePresence().catch(() => undefined);
        await closeRedis();
        await prisma.$disconnect();
      } finally {
        process.exit(0);
      }
    })();
  });
}

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`API ${env.PORT} portida ishlamoqda`);
  // Amaldagi proxy ishonchi (audit R3, D-053): Railway'da 1 hop kutiladi. Deploydan keyin
  // so'rov logidagi remoteAddress X-Real-IP bilan bir xilligini tekshiring.
  app.log.info(`TRUST_PROXY = ${JSON.stringify(env.TRUST_PROXY)} (mijoz IP'si shu qoida bo'yicha aniqlanadi)`);
  void bootstrap();
} catch (err) {
  // Ilgari bu yerda faqat `.then()` bor edi: port band bo'lsa yoki listen
  // yiqilsa jarayon "muvaffaqiyatli" tugab, deploy jim qolardi.
  app.log.error(err, "Serverni ishga tushirib bo'lmadi");
  process.exit(1);
}
