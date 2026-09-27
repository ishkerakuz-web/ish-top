import { z } from "zod";
import { boolish } from "./validation.js";

/**
 * Hujjatlardagi namunaviy JWT sirlari va umumiy "placeholder" belgilari (audit PHASE 6, U7).
 * .env.example misollari uzun va har xil — uzunlik/tenglik tekshiruvidan o'tib ketardi.
 * Joriy va eski .env.example qiymatlari; README/DEPLOY'da aniq misol sir yo'q (faqat yaratish buyrug'i).
 */
const PLACEHOLDER_SECRET_MARKERS = [
  "kamida-32-belgili-tasodifiy-satr-shu-yerga-yozing",
  "boshqa-kamida-32-belgili-tasodifiy-satr-yozing",
  "kamida-8-belgi-tasodifiy-satr",
  "boshqa-tasodifiy-satr",
  "tasodifiy-satr",
  "shu-yerga-yozing",
  "kamida-32-belgili",
  "your-secret",
  "replace-me",
];

function isPlaceholderSecret(value: string): boolean {
  // Katta-kichik harf, pastki chiziq yoki bo'shliq bilan yozilgan misol ham tanilsin
  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return PLACEHOLDER_SECRET_MARKERS.some((marker) => normalized.includes(marker));
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // MongoDB ulanish satri (Atlas: mongodb+srv://...). Tranzaksiyalar uchun
  // replica set kerak — Atlas'da bu sukut bo'yicha bor.
  //
  // Prefiks ataylab tekshiriladi: loyiha ilgari PostgreSQL'da edi, eski
  // `postgresql://...` satri qolib ketsa Prisma'ning tushunarsiz ichki xatosi
  // o'rniga shu yerda aniq xabar chiqadi.
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((v) => /^mongodb(\+srv)?:\/\//.test(v), {
      message: "MongoDB ulanish satri bo'lishi kerak (mongodb:// yoki mongodb+srv://)",
    }),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  // Railway PORT ni o'zi beradi — qo'lda o'rnatmang.
  PORT: z.coerce.number().default(3000),
  // Frontend manzili: CORS uchun ham, xat/Telegram havolalari uchun ham.
  // Vercel'dagi asosiy domen (masalan https://ishbor.vercel.app).
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  // CORS uchun qo'shimcha manzillar (vergul bilan). Vercel preview deploylari
  // yoki o'z domeningiz uchun. Masalan: "https://ishbor.uz,https://www.ishbor.uz"
  CORS_EXTRA_ORIGINS: z.string().optional().default(""),
  // Yuklangan fayllar papkasi. Railway'da fayl tizimi vaqtinchalik, shuning
  // uchun Volume ulab shu yerga uning yo'lini bering (masalan /data/uploads).
  UPLOAD_DIR: z.string().optional().default(""),
  // Bitta IP uchun daqiqadagi so'rov chegarasi. SSR (Vercel) so'rovlari bir
  // nechta umumiy IP dan keladi, shuning uchun chegara keng olingan.
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).default(600),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional().default(""),
  // Telegram oqimlari uchun test harness (audit R3, D-062). FAQAT `NODE_ENV=test` bilan ruxsat etiladi:
  // bot mavjud deb hisoblanadi, username `ishbor_test_bot`, long-polling ishga tushmaydi va update'lar
  // `handleTelegramUpdate()` orqali jarayon ichida beriladi. Production'da qiymat berilsa — env xatosi.
  TELEGRAM_TEST_MODE: boolish().optional().default(false),
  // Google orqali kirish uchun (Google Cloud Console'dan OAuth Client ID).
  // Bo'sh bo'lsa — Google login o'chiq, sayt oddiy ishlayveradi.
  GOOGLE_CLIENT_ID: z.string().optional().default(""),

  // --- Email (SMTP). Bo'sh bo'lsa xatlar konsolga yoziladi, xato bermaydi. ---
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().optional().default(587),
  // Diqqat: `z.coerce.boolean()` emas — u "false" satrini true qilardi.
  SMTP_SECURE: boolish().optional().default(false),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().optional().default("ISH BOR! <no-reply@localhost>"),

  // --- Web Push (VAPID). Kalitlar bo'sh bo'lsa push o'chiq. ---
  // Kalit juftini yaratish: `npm run push:keys`
  VAPID_PUBLIC_KEY: z.string().optional().default(""),
  VAPID_PRIVATE_KEY: z.string().optional().default(""),
  VAPID_SUBJECT: z.string().optional().default("mailto:admin@localhost"),

  // --- Meilisearch. MEILI_HOST bo'sh bo'lsa MongoDB qidiruviga tushadi. ---
  MEILI_HOST: z.string().optional().default(""),
  MEILI_API_KEY: z.string().optional().default(""),
  MEILI_INDEX: z.string().optional().default("vacancies"),

  // --- To'lov provayderlari (Payme / Click). Bo'sh bo'lsa "qo'lda tasdiqlash" rejimi. ---
  PAYME_MERCHANT_ID: z.string().optional().default(""),
  PAYME_KEY: z.string().optional().default(""),
  CLICK_MERCHANT_ID: z.string().optional().default(""),
  CLICK_SERVICE_ID: z.string().optional().default(""),
  CLICK_SECRET_KEY: z.string().optional().default(""),

  // --- "Biz bilan bog'laning" sahifasidagi aloqa kanallari ---
  // Bo'sh yoki noto'g'ri qiymat — kanal sahifada ko'rsatilmaydi (to'qima kontakt yo'q).
  SUPPORT_EMAIL: z.string().optional().default(""),
  // Support Telegram akkaunti (@siz ham bo'ladi). Bo'sh bo'lsa — ishlab turgan bot ko'rsatiladi.
  SUPPORT_TELEGRAM: z.string().optional().default(""),
  SUPPORT_PHONE: z.string().optional().default(""),
  SUPPORT_ADDRESS: z.string().optional().default(""),
  // Ish vaqti matni, masalan "Du–Ju, 09:00–18:00"
  SUPPORT_HOURS: z.string().optional().default(""),
  // Haqiqiy javob muddati (soat). Berilmasa "N soat ichida javob" va'dasi chiqmaydi.
  SUPPORT_RESPONSE_HOURS: z.string().optional().default(""),
  PARTNERSHIP_EMAIL: z.string().optional().default(""),

  // --- Birinchi admin hisobi (seed paytida yaratiladi) ---
  ADMIN_EMAIL: z.string().optional().default(""),
  ADMIN_PASSWORD: z.string().optional().default(""),

  // Ish qidiruv obunalari (saved search alerts) tekshirilish oralig'i, daqiqada
  ALERTS_INTERVAL_MINUTES: z.coerce.number().optional().default(15),

  // Moderatsiya navbatidagi vakansiya va sharhlar admin shu muddat (soat) ichida qaror qilmasa
  // avtomatik tasdiqlanadi. 0 — avto-tasdiq o'chiq (navbat faqat admin qo'lida).
  MODERATION_AUTO_APPROVE_HOURS: z.coerce.number().min(0).max(24 * 30).optional().default(24),
  // Yangi vakansiyalarni oldindan moderatsiya: "unverified" — faqat tasdiqlanmagan kompaniyalarniki
  // (sukut), "all" — hammasi, "off" — darhol e'lon qilinadi (post-moderatsiya).
  VACANCY_PREMODERATION: z.enum(["unverified", "all", "off"]).optional().default("unverified"),
  // Yangi kompaniya sharhlari avval moderatsiyaga tushadimi (sukut: ha)
  REVIEW_PREMODERATION: boolish().optional().default(true),

  // --- Tarmoq va xavfsizlik ---
  // Reverse-proxy'ga ishonch: hop soni ("1" — SUKUT), "true", "false" yoki IP/CIDR ro'yxati.
  // Audit R3, D-053 (headers-infra-1, auth-core-9): sukut `true` edi — Fastify X-Forwarded-For ning ENG CHAP
  // (mijoz yozgan) qiymatini olardi va IP bo'yicha har qanday rate-limit soxta sarlavha bilan chetlab
  // o'tilardi. Railway/nginx kabi bitta edge proxy uchun to'g'ri qiymat "1"; ikki proxy bo'lsa (Cloudflare
  // + Railway) "2" qo'ying va deploydan keyin `request.ip` ni X-Real-IP bilan solishtiring.
  TRUST_PROXY: z
    .string()
    .optional()
    .default("1")
    .transform((v): boolean | number | string => {
      const s = v.trim().toLowerCase();
      if (s === "" || s === "true") return true;
      if (s === "false") return false;
      if (/^\d+$/.test(s)) return Number(s);
      return v.trim();
    }),
  // Vercel preview domenlari uchun ANIQ regex (Origin sarlavhasi bilan to'liq moslik — sxema ham kiradi),
  // masalan: https://ishbor-[a-z0-9-]+-myteam\.vercel\.app (sxemasiz naqsh hech qachon mos kelmaydi; audit PHASE 6, U32)
  // Bo'sh — preview'larga ruxsat yo'q. Keng naqsh (*.vercel.app) begona saytga cookie bilan ruxsat beradi.
  CORS_PREVIEW_ORIGIN_REGEX: z.string().optional().default(""),
  // Monetizatsiya (tariflar, checkout, to'lov webhook'lari). Platforma hozircha bepul — sukut bo'yicha o'chiq.
  BILLING_ENABLED: boolish().optional().default(false),
  // SSR (web server) so'rovlari uchun alohida rate-limit bucket kaliti (audit R3, D-074).
  // Faqat server muhitida saqlanadi, brauzerga hech qachon yubormang. Bo'sh — imkoniyat o'chiq.
  SSR_API_KEY: z.string().optional().default(""),

  // --- Redis (ixtiyoriy). Bo'sh bo'lsa hammasi jarayon xotirasida ishlaydi. ---
  // Berilsa ko'rishlar buferi, takror filtri, kvotalar, rate-limit, kesh yangilanishi
  // va WebSocket fan-out nusxalar orasida UMUMIY bo'ladi — ya'ni API'ni bir nechta
  // nusxada ishlatish mumkin (DEPLOY.md "Gorizontal kengaytirish").
  REDIS_URL: z
    .string()
    .optional()
    .default("")
    .refine((v) => !v || /^rediss?:\/\//.test(v), { message: "redis:// yoki rediss:// bilan boshlanishi kerak" }),
  // Bitta Redis'ni bir nechta muhit (prod/staging) baham ko'rsa kalitlar aralashmasin
  REDIS_PREFIX: z.string().optional().default("ishbor:"),
  // Ko'rishlar buferini bazaga yozish oralig'i. Kichik qiymat — aniqroq raqam,
  // ko'proq yozuv; katta qiymat — kamroq yozuv, sahifada kechikkan son.
  VIEW_FLUSH_MS: z.coerce.number().int().min(1_000).max(600_000).default(30_000),
  // Bitta ko'ruvchi bitta e'lonni shu muddat ichida qayta ochsa ko'rish QAYTA sanalmaydi.
  VIEW_DEDUPE_SEC: z.coerce.number().int().min(60).max(7 * 24 * 3600).default(24 * 3600),

  // Foydalanuvchi holati (rol, blok, seans versiyasi, telefon tasdig'i) keshi — har bir
  // autentifikatsiyalangan so'rovdagi baza o'qishini olib tashlaydi (audit: perf-auth-1).
  // Bloklash, rol o'zgarishi va telefon tasdig'i keshni DARHOL bekor qiladi, shuning uchun
  // bu muddat faqat ilovani chetlab o'tib (bazada qo'lda) qilingan o'zgarish uchun ahamiyatli.
  // `0` — kesh o'chiq (har so'rov bazadan o'qiydi).
  AUTH_CACHE_MS: z.coerce.number().int().min(0).max(300_000).default(10_000),

  // --- S3-mos fayl xotirasi (IXTIYORIY): Cloudflare R2, AWS S3, B2, MinIO ---
  // Sozlanmasa fayllar lokal diskka (`UPLOAD_DIR`) yoziladi — dev uchun shunday qulay.
  // Sozlansa fayllar platformaga bog'liq bo'lmay qoladi: Railway'da Volume kerak emas,
  // bir nechta nusxa bir xil fayllarni ko'radi, Vercel kabi "yozib bo'lmaydigan" muhit ham ishlaydi.
  S3_BUCKET: z.string().optional().default(""),
  S3_ACCESS_KEY_ID: z.string().optional().default(""),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
  // AWS S3 uchun bo'sh qoldiring; R2 uchun https://<account_id>.r2.cloudflarestorage.com
  S3_ENDPOINT: z.string().optional().default(""),
  // R2 da "auto"
  S3_REGION: z.string().optional().default("auto"),
  // Kalit prefiksi (papka). Bitta bucket'ni bir nechta muhit baham ko'rsa farqlang.
  S3_PREFIX: z.string().optional().default("uploads/"),
  // OCHIQ fayllar (logo, muqova) shu manzildan beriladi: bucket'ning ochiq havolasi yoki CDN.
  // Masalan R2: https://pub-xxxxx.r2.dev . Berilmasa ochiq fayllar ham API orqali o'tadi.
  S3_PUBLIC_BASE_URL: z.string().optional().default(""),
}).superRefine((cfg, ctx) => {
  // S3 yarim sozlangan bo'lsa fayllar jimgina lokal diskka yozilib ketmasin — bu prodda
  // "logolar deploydan keyin yo'qoldi" bo'lib chiqadi. Yo hammasi, yo hech qaysisi.
  const s3Parts = [cfg.S3_BUCKET, cfg.S3_ACCESS_KEY_ID, cfg.S3_SECRET_ACCESS_KEY];
  if (s3Parts.some(Boolean) && !s3Parts.every(Boolean)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["S3_BUCKET"],
      message: "S3 uchun S3_BUCKET, S3_ACCESS_KEY_ID va S3_SECRET_ACCESS_KEY birgalikda berilishi kerak",
    });
  }
  if (cfg.S3_PREFIX && !cfg.S3_PREFIX.endsWith("/")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["S3_PREFIX"], message: "slash bilan tugashi kerak (masalan \"uploads/\")" });
  }
  if (cfg.CORS_PREVIEW_ORIGIN_REGEX) {
    try {
      new RegExp(cfg.CORS_PREVIEW_ORIGIN_REGEX);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["CORS_PREVIEW_ORIGIN_REGEX"], message: "yaroqli regex bo'lishi kerak" });
    }
  }
  // Test rejimi faqat testlarda (audit R3, D-062): noto'g'ri sozlangan production'da Telegram
  // tasdig'ini butunlay chetlab o'tishga yo'l qo'ymaydi.
  if (cfg.TELEGRAM_TEST_MODE && cfg.NODE_ENV !== "test") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["TELEGRAM_TEST_MODE"],
      message: "faqat NODE_ENV=test bilan ishlatiladi",
    });
  }
  // Qisqa kalit taxmin qilinsa SSR bucket'i orqali limitlar chetlab o'tiladi (audit R3, D-074)
  if (cfg.SSR_API_KEY && cfg.SSR_API_KEY.trim().length < 32) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["SSR_API_KEY"], message: "kamida 32 belgi bo'lishi kerak" });
  }
  if (cfg.NODE_ENV !== "production") return;
  // Qisqa HS256 siri oflayn brute-force bilan topilsa, istalgan rol bilan token yasash mumkin (audit ISSUE-009)
  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
    if (cfg[key].length < 32) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "production'da kamida 32 belgili tasodifiy satr bo'lishi shart" });
    }
  }
  if (cfg.JWT_ACCESS_SECRET === cfg.JWT_REFRESH_SECRET) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["JWT_REFRESH_SECRET"], message: "JWT_ACCESS_SECRET bilan bir xil bo'lmasligi kerak" });
  }
  // Hujjatdagi misol (placeholder) sir uzunlik tekshiruvidan o'tsa ham rad etiladi (audit PHASE 6, U7)
  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
    if (isPlaceholderSecret(cfg[key])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `hujjatdagi namunaviy (placeholder) qiymat — production'da haqiqiy tasodifiy satr yozing: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Deployda eng ko'p uchraydigan xato — .env to'ldirilmagan. Stack trace
  // o'rniga qaysi o'zgaruvchi yetishmayotganini aniq aytamiz.
  const lines = parsed.error.errors.map((e) => `  - ${e.path.join(".")}: ${e.message}`);
  console.error(`Sozlamalar (env) noto'g'ri:\n${lines.join("\n")}`);
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === "production";

/**
 * CORS uchun ruxsat etilgan manzillar.
 * Dev'da mahalliy portlar ham qo'shiladi (`vite preview` va `npm start`).
 */
export const allowedOrigins: string[] = [
  env.WEB_ORIGIN,
  ...env.CORS_EXTRA_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  ...(isProd ? [] : ["http://localhost:5173", "http://localhost:4173", "http://localhost:3001"]),
].filter((v, i, all) => v && all.indexOf(v) === i);

/**
 * Startup ogohlantirishlari (audit R3, D-072 va headers-infra-13).
 *
 * Telegram production'da MAJBURIY servis: telefon tasdig'i (ariza, vakansiya, chat, nomzodlar
 * bazasi) va parolni tiklash unga bog'liq. Token bo'lmasa server yiqilmaydi (Rule K), lekin
 * operator buni darhol ko'rishi kerak. Ikkinchi ogohlantirish — NODE_ENV berilmay qolgan
 * (sukut "development") holat: bunda JWT siri uzunligi, cookie `Secure`, HSTS va CORS
 * qoidalari production darajasida bo'lmaydi.
 */
function warnStartupConfig(): void {
  if (isProd) {
    if (!env.TELEGRAM_BOT_TOKEN) {
      console.warn(
        "OGOHLANTIRISH: TELEGRAM_BOT_TOKEN berilmagan — telefon tasdig'i va parolni tiklash ishlamaydi (D-072)"
      );
    }
    return;
  }
  // Testlar ataylab https WEB_ORIGIN bilan ishlaydi — ogohlantirish faqat "development" uchun
  if (env.NODE_ENV !== "development") return;
  const publicOrigin = /^https:\/\//i.test(env.WEB_ORIGIN) && !/localhost|127\.0\.0\.1/i.test(env.WEB_ORIGIN);
  if (publicOrigin || process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL) {
    console.warn(
      `OGOHLANTIRISH: NODE_ENV="${env.NODE_ENV}", lekin muhit production'ga o'xshaydi (WEB_ORIGIN=${env.WEB_ORIGIN}). ` +
        "JWT siri, cookie Secure/SameSite, HSTS va CORS qoidalari production darajasida EMAS — NODE_ENV=production qo'ying."
    );
  }
}
warnStartupConfig();

/** Xizmat sozlanganmi — modullar shu bayroqlar bo'yicha o'zini o'chiradi. */
export const features = {
  email: Boolean(env.SMTP_HOST),
  push: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
  telegram: Boolean(env.TELEGRAM_BOT_TOKEN) || env.TELEGRAM_TEST_MODE,
  meilisearch: Boolean(env.MEILI_HOST),
  redis: Boolean(env.REDIS_URL),
  s3: Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY),
  payme: Boolean(env.PAYME_MERCHANT_ID),
  click: Boolean(env.CLICK_MERCHANT_ID && env.CLICK_SERVICE_ID),
  billing: env.BILLING_ENABLED,
};
