// ============================================================
// Deploydan oldingi tekshiruv (uchdan-uchgacha).
//
// Haqiqiy MongoDB ustida `dist/server.js` ni ko'taradi va asosiy oqimlarni
// HTTP orqali tekshiradi: ro'yxatdan o'tish, seans cookie'si, vakansiya,
// ariza, rezyume, chat, sharh, admin paneli, CORS, sitemap, OG rasm, cheklanmagan faol vakansiyalar,
// vakansiya joylashuvi qoidalari (kategoriya / ish joylashuvi / hudud).
//
// Round 3 xavfsizlik regressiyasi (auth_contract.md): PDF rezyume faqat vakolatli endpointdan (D-058),
// ish beruvchi murojaatlari server tomonida sahifalanadi (D-061), nomzodlar bazasida telefon gate'i
// (D-071), Telegram orqali kirish yo'llari olib tashlangan (D-041), SSR kaliti alohida rate-limit
// bucket'i (D-074), TRUST_PROXY sukuti soxta X-Forwarded-For'ni qabul qilmaydi (D-053), login lockout
// `email|ip` bo'yicha (D-052) va admin mutatsiyalarining manfiy authz matritsasi (admin-staff-15).
// Telegram botiga bog'liq oqimlar (parol tiklash, telefon almashtirish, zaxira raqam, qo'lda tiklash)
// alohida `scripts/auth-telegram-check.mjs` da (D-062).
//
// Round 3, 2-to'lqin shartnomalari: admin moderatsiya qulfi (D-070), oxirgi admin himoyasi va
// bloklangan ega ma'lumoti (D-077), kompaniya tasdiq belgisi (D-073), sharh moderatsiyasi va
// maxfiyligi (D-075), bildirishnoma/xabar/suhbat cursor sahifalashi va WebSocket telefon gate'i
// (D-078), bildirishnoma tarjima kaliti payload.i18n (D-059), billing bayrog'i (D-065) va
// qidiruvdagi o'zbekcha apostrof variantlari (D-080).
//
// Ishlatish:
//   npm run build
//   E2E_DATABASE_URL="mongodb+srv://.../ishbor_test" npm run test:e2e
//
// DIQQAT: skript bazaga YOZADI. Shu sababli u faqat nomida "test" bo'lgan
// bazaga ruxsat beradi va har ishga tushganda uni TOZALAYDI. Asosiy
// `DATABASE_URL` ataylab ishlatilmaydi — alohida `E2E_DATABASE_URL` kerak.
// ============================================================
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const uri = process.env.E2E_DATABASE_URL ?? "";
if (!uri) {
  console.error(
    [
      "E2E_DATABASE_URL berilmagan. Masalan:",
      '  E2E_DATABASE_URL="mongodb+srv://<foydalanuvchi>:<parol>@cluster/ishbor_test" npm run test:e2e',
    ].join("\n")
  );
  process.exit(1);
}
const dbName = (uri.split("?")[0].split("/").pop() ?? "").toLowerCase();
if (!dbName.includes("test")) {
  console.error(
    [
      `Xavfsizlik: baza nomida "test" bo'lishi shart (hozir: "${dbName}").`,
      "Skript bazani tozalaydi, shuning uchun ishchi bazaga qaratib bo'lmaydi.",
    ].join("\n")
  );
  process.exit(1);
}

// Yo'llar shu fayldan hisoblanadi — skript qaysi papkadan chaqirilishidan qat'i nazar ishlaydi.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PRISMA_CLI = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const SERVER = fileURLToPath(new URL("../dist/server.js", import.meta.url));

if (!existsSync(SERVER)) {
  console.error(`${SERVER} topilmadi. Avval: npm run build`);
  process.exit(1);
}

// Eskirgan build bilan tekshiruv yolg'on natija beradi: src'dagi eng yangi fayl dist/server.js'dan
// keyin o'zgargan bo'lsa ishga tushmaymiz (audit PHASE 6, U37)
function newestFile(dir) {
  let newest = { time: 0, file: "" };
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const candidate = entry.isDirectory() ? newestFile(full) : { time: statSync(full).mtimeMs, file: full };
    if (candidate.time > newest.time) newest = candidate;
  }
  return newest;
}
const newestSrc = newestFile(fileURLToPath(new URL("../src", import.meta.url)));
if (newestSrc.time > statSync(SERVER).mtimeMs) {
  console.error(`dist/server.js eskirgan: ${newestSrc.file} build'dan keyin o'zgargan — avval npm run build`);
  process.exit(1);
}

const push = spawnSync(
  process.execPath,
  [PRISMA_CLI, "db", "push", "--skip-generate", "--force-reset"],
  { cwd: ROOT, env: { ...process.env, DATABASE_URL: uri }, encoding: "utf8" }
);
console.log("db push:", push.status === 0 ? "OK" : "XATO " + push.status);
if (push.status !== 0) {
  console.error(String(push.stdout ?? "") + String(push.stderr ?? ""));
  process.exit(1);
}

const PORT = 4711;
// TRUST_PROXY sukutini tekshirish uchun qisqa umrli ikkinchi server (audit R3, D-053)
const PORT_TRUST = 4712;
// Oldindan moderatsiya SUKUT sozlamasi (tasdiqlanmagan kompaniya e'loni navbatga) uchun uchinchi server
const PORT_MOD = 4713;
const env = {
  ...process.env,
  DATABASE_URL: uri,
  NODE_ENV: "production",
  PORT: String(PORT),
  WEB_ORIGIN: "https://sayt.example",
  // production'da kamida 32 belgi va bir-biridan farqli bo'lishi shart (env.ts, audit ISSUE-009)
  JWT_ACCESS_SECRET: "e2e-access-secret-0123456789abcdef-A1",
  JWT_REFRESH_SECRET: "e2e-refresh-secret-0123456789abcdef-B2",
  // Monetizatsiya o'chiq (platforma bepul) — tarif/to'lov yo'llari ro'yxatdan o'tmaydi
  BILLING_ENABLED: "false",
  // Asosiy tekshiruvlar e'lon/sharh darhol chiqadi deb yozilgan (post-moderatsiya). Oldindan moderatsiya
  // va 24 soatlik avto-tasdiq pastda alohida, sukut sozlamali uchinchi serverda tekshiriladi.
  VACANCY_PREMODERATION: "off",
  REVIEW_PREMODERATION: "false",
  ADMIN_EMAIL: "Admin@Ish.Top",
  ADMIN_PASSWORD: "admin-parol-123",
  TELEGRAM_BOT_TOKEN: "",
  SMTP_HOST: "",
  MEILI_HOST: "",
  UPLOAD_DIR: "",
  // Aloqa sahifasi: faqat shu ikkitasi sozlangan — qolgan kanallar null bo'lishi kerak
  SUPPORT_EMAIL: "yordam@sayt.example",
  SUPPORT_HOURS: "Du–Ju, 09:00–18:00",
  SUPPORT_PHONE: "raqam-emas",
  // Hermetik muhit (audit PHASE 6, U35): server `dotenv/config` bilan apps/api/.env ni o'qiydi — mavjud
  // bo'lmagan fayl beriladi, tekshiruvlar tayanadigan sozlamalar esa aniq yoziladi (mahalliy .env yoki
  // shell'dagi CORS regex, proxy, limit va kalitlar natijani o'zgartirmasin)
  DOTENV_CONFIG_PATH: join(tmpdir(), `ishbor-e2e-${process.pid}-mavjud-emas.env`),
  // Login/ro'yxatdan o'tish so'rovlari X-Forwarded-For bilan turli IP'dan yuboriladi
  TRUST_PROXY: "true",
  CORS_EXTRA_ORIGINS: "",
  CORS_PREVIEW_ORIGIN_REGEX: "",
  // Tekshiruvlar bitta IP'dan yuzlab so'rov yuboradi — umumiy limit tasodifiy 429 bermasin
  RATE_LIMIT_MAX: "3000",
  // SSR so'rovlari uchun alohida (kengroq) rate-limit bucket kaliti (audit R3, D-074) — kamida 32 belgi
  SSR_API_KEY: "e2e-ssr-kaliti-0123456789abcdefghij",
  GOOGLE_CLIENT_ID: "",
  VAPID_PUBLIC_KEY: "",
  VAPID_PRIVATE_KEY: "",
  TELEGRAM_ADMIN_CHAT_ID: "",
  // Aloqa sahifasi tekshiruvi bu kanallar null bo'lishini kutadi — shell'dan kelgan qiymat ham o'tmasin (audit PHASE 6, U35)
  SUPPORT_TELEGRAM: "",
  SUPPORT_ADDRESS: "",
  SUPPORT_RESPONSE_HOURS: "",
  PARTNERSHIP_EMAIL: "",
  // Ko'rishlar buferi tez bo'shasin — test kutib o'tirmasin (prod sukuti 30 s)
  VIEW_FLUSH_MS: "1000",
  // Foydalanuvchi holati keshi O'CHIQ. Sabab: bu skript bazani TO'G'RIDAN-TO'G'RI o'zgartiradi
  // (masalan telefonni tasdiqlangan qilib qo'yadi), ya'ni ilovaning keshni bekor qilish yo'lini
  // chetlab o'tadi. Prodda bunday o'zgarishlar ilova orqali bo'ladi va kesh darhol yangilanadi.
  AUTH_CACHE_MS: "0",
  // Sukut bo'yicha Redis'siz (xotiradagi yo'l) — CI'da qo'shimcha xizmat talab qilinmasin.
  // Redis yo'lini ham tekshirish uchun: E2E_REDIS_URL="redis://127.0.0.1:6379/1" npm run test:e2e
  REDIS_URL: process.env.E2E_REDIS_URL ?? "",
  REDIS_PREFIX: "ishbor-e2e:",
  // Sukut bo'yicha fayllar lokal diskda. S3-mos xotira yo'lini ham tekshirish uchun:
  //   E2E_S3_ENDPOINT="http://127.0.0.1:4599" npm run test:e2e
  // (yopiq bucket holati — ochiq manzil berilmaydi, fayllar API orqali beriladi)
  S3_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? "",
  S3_BUCKET: process.env.E2E_S3_ENDPOINT ? "ishbor-e2e" : "",
  S3_ACCESS_KEY_ID: process.env.E2E_S3_ENDPOINT ? "e2e-key" : "",
  S3_SECRET_ACCESS_KEY: process.env.E2E_S3_ENDPOINT ? "e2e-secret" : "",
  S3_PUBLIC_BASE_URL: "",
};

const server = spawn(process.execPath, [SERVER], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));

const BASE = `http://127.0.0.1:${PORT}`;
let up = false;
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`${BASE}/health`);
    if (r.ok) { up = true; break; }
  } catch {}
  await sleep(500);
}
if (!up) {
  console.error("Server ko'tarilmadi:\n" + log);
  server.kill();
  process.exit(1);
}

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log("  OK  " + name);
  } catch (e) {
    failed++;
    console.error("  XATO " + name + ": " + e.message);
  }
}
const j = async (path, init) => {
  const res = await fetch(BASE + path, init);
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body, res };
};
const post = (path, data, token) =>
  j(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data ?? {}),
  });

/**
 * Ko'rish signali (audit: views-1). Ko'ruvchi IP + User-Agent bo'yicha ajratiladi, shuning uchun
 * har xil "ko'ruvchi" har xil User-Agent bilan keladi; `null` — umuman User-Agent'siz so'rov.
 */
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";
const OTHER_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
const view = (path, ua, token) =>
  j(path, {
    method: "POST",
    headers: { ...(ua ? { "user-agent": ua } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
/** Bufer bazaga yozilishini kutish: e2e muhitida `VIEW_FLUSH_MS=1000`. */
const flushWait = () => sleep(1600);

/** Eslatma (tekshiruv emas): testdan tashqarida qolgan narsa jimgina o'tib ketmasin. */
const note = (text) => console.log("  ESLATMA " + text);

/**
 * Telefon gate'ining ikkala to'g'ri javobi (audit R3, D-051/D-072, Rule K):
 * bot mavjud bo'lsa 403 PHONE_NOT_VERIFIED, mavjud bo'lmasa 503 TELEGRAM_UNAVAILABLE.
 * Bu skriptda TELEGRAM_BOT_TOKEN bo'sh — amalda 503 keladi; 403 tarmog'i auth-telegram-check.mjs da.
 */
const phoneGateRefusal = (res) =>
  (res.status === 403 && res.body?.error === "PHONE_NOT_VERIFIED") ||
  (res.status === 503 && res.body?.error === "TELEGRAM_UNAVAILABLE");

await check("GET /health", async () => {
  const { status, body } = await j("/health");
  if (status !== 200 || body.db !== "up") throw new Error(JSON.stringify(body));
});

// Startup bootstrap fonda ishlaydi — kataloglar TO'LIQ to'lishini kutamiz.
// Shart pastdagi tekshiruvlar bilan bir xil bo'lishi kerak: ilgari "kamida 1 ta
// hudud" kutilardi, keyin esa ">= 14" tekshirilardi — yuklangan mashinada test
// bootstrap'ning o'rtasiga tushib, tasodifan yiqilardi.
for (let i = 0; i < 60; i++) {
  const regions = await j("/api/regions");
  if ((regions.body?.items?.length ?? 0) >= 14) break;
  await sleep(500);
}

await check("GET /api/regions (ensureCatalog)", async () => {
  const { body } = await j("/api/regions");
  if (!body.items || body.items.length < 14) throw new Error("hudud soni: " + body.items?.length);
  if (!/^[0-9a-f]{24}$/.test(body.items[0].id)) throw new Error("ID ObjectId emas: " + body.items[0].id);
});

await check("tarif/to'lov API'si o'chiq (BILLING_ENABLED=false): /api/plans va webhook 404", async () => {
  const plans = await j("/api/plans");
  if (plans.status !== 404) throw new Error("/api/plans: " + plans.status);
  const webhook = await post("/api/payments/payme/callback", {});
  if (webhook.status !== 404) throw new Error("webhook: " + webhook.status);
});

let employerToken, seekerToken, adminToken;
await check("POST /api/auth/register (ish beruvchi + kompaniya)", async () => {
  const { status, body } = await post("/api/auth/register", {
    email: "HR@Test.Uz", password: "parol12345", role: "employer", companyName: "NextBrain O'zbekiston",
  });
  if (status !== 200 || !body.accessToken) throw new Error(status + " " + JSON.stringify(body));
  employerToken = body.accessToken;
});

await check("email registr sezgir emas (HR@Test.Uz -> hr@test.uz)", async () => {
  const { status, body } = await post("/api/auth/login", { email: "hr@test.uz", password: "parol12345" });
  if (status !== 200 || !body.accessToken) throw new Error(status + " " + JSON.stringify(body));
});

await check("refresh cookie SameSite=None; Secure (prod)", async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "hr@test.uz", password: "parol12345" }),
  });
  const cookie = res.headers.get("set-cookie") ?? "";
  if (!/SameSite=None/i.test(cookie) || !/Secure/i.test(cookie) || !/HttpOnly/i.test(cookie)) {
    throw new Error("cookie: " + cookie);
  }
});

await check("dublikat email -> 409", async () => {
  const { status } = await post("/api/auth/register", { email: "hr@test.uz", password: "parol12345", role: "employer" });
  if (status !== 409) throw new Error("status " + status);
});

await check("kompaniya slug (o'zbekcha nomdan)", async () => {
  const { body } = await j("/api/employer/company", { headers: { authorization: `Bearer ${employerToken}` } });
  const slug = body.company?.slug;
  if (!slug || !/^nextbrain-ozbekiston-[0-9a-f]{8}$/.test(slug)) throw new Error("slug: " + slug);
});

// Telefon gate'i (audit R3, D-051/D-072, Rule K): bu skriptda TELEGRAM_BOT_TOKEN bo'sh, ya'ni
// `isTelegramAvailable()` false — shuning uchun to'g'ri javob 503 TELEGRAM_UNAVAILABLE ("tasdiqlang"
// deb bajarib bo'lmaydigan ko'rsatma berilmaydi). Bot MAVJUD bo'lgandagi 403 PHONE_NOT_VERIFIED
// tarmog'i `scripts/auth-telegram-check.mjs` da (TELEGRAM_TEST_MODE=1) tekshiriladi.
await check("POST /api/vacancies telefoni tasdiqlanmagan ish beruvchiga yopiq (Telegram yo'q -> 503 TELEGRAM_UNAVAILABLE)", async () => {
  const { status, body } = await post("/api/vacancies", {
    title: "Frontend dasturchi", description: "Uzun tavsif matni", employmentType: "full_time",
  }, employerToken);
  if (status === 403 && body.error === "PHONE_NOT_VERIFIED") return; // bot sozlangan muhitda ham to'g'ri
  if (status !== 503 || body.error !== "TELEGRAM_UNAVAILABLE") throw new Error(status + " " + JSON.stringify(body));
});

// Telefonni tasdiqlab qo'yamiz (Telegram botsiz test qilish uchun to'g'ridan bazadan)
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: uri } } });
await prisma.user.updateMany({ where: {}, data: { isPhoneVerified: true } });

let vacancyId, vacancySlug;
await check("POST /api/vacancies (ObjectId validatsiyasi bilan)", async () => {
  const regions = (await j("/api/regions")).body.items;
  const cats = (await j("/api/categories")).body.items;
  const { status, body } = await post("/api/vacancies", {
    title: "Frontend dasturchi (React)", description: "Uzun tavsif matni bu yerda",
    employmentType: "full_time", regionId: regions[0].id, categoryId: cats[0].id, workplaceType: "office",
    salaryMin: 15000000, salaryMax: 25000000,
  }, employerToken);
  if (status !== 201) throw new Error(status + " " + JSON.stringify(body));
  vacancyId = body.id; vacancySlug = body.slug;
  if (!/^frontend-dasturchi-react-[0-9a-f]{8}$/.test(vacancySlug)) throw new Error("slug: " + vacancySlug);
});

await check("noto'g'ri ObjectId -> 400", async () => {
  const { status, body } = await post("/api/vacancies", {
    title: "Test", description: "Uzun tavsif matni", employmentType: "full_time",
    regionId: "5f9b1a2c-0000-4000-8000-000000000000",
  }, employerToken);
  if (status !== 400 || body.error !== "VALIDATION_ERROR") throw new Error(status + " " + JSON.stringify(body));
});

await check("GET /api/vacancies (ro'yxat + qidiruv + saralash)", async () => {
  const list = (await j("/api/vacancies")).body;
  if (list.total !== 1 || list.engine !== "mongodb") throw new Error(JSON.stringify(list).slice(0, 200));
  const search = (await j("/api/vacancies?text=DASTURCHI%20react")).body;
  if (search.total !== 1) throw new Error("qidiruv topmadi: " + search.total);
  const sorted = (await j("/api/vacancies?sort=salary_asc")).body;
  if (sorted.items.length !== 1) throw new Error("saralash: " + sorted.items.length);
});

await check("vakansiyalar: ko'p qiymatli filtrlar, kompaniya, facets, yangi saralash", async () => {
  const regions = (await j("/api/regions")).body.items;
  const detail = (await j(`/api/vacancies/${vacancySlug}`)).body;
  const own = detail.region.slug;
  const other = regions.find((r) => r.slug !== own).slug;
  const total = async (qs) => (await j(`/api/vacancies?${qs}`)).body.total;

  if ((await total(`area=${other},${own}`)) !== 1) throw new Error("hudud (csv)");
  if ((await total(`area=${other}`)) !== 0) throw new Error("boshqa hudud");
  if ((await total("experience=six_plus,none")) !== 1) throw new Error("tajriba (csv)");
  if ((await total("experience=six_plus")) !== 0) throw new Error("tajriba six_plus");
  if ((await total("employment=part_time,full_time")) !== 1) throw new Error("bandlik (csv)");
  if ((await total("employment=yoq")) !== 1) throw new Error("noma'lum bandlik e'tiborsiz qolishi kerak");
  if ((await total(`company=${detail.company.slug}`)) !== 1) throw new Error("kompaniya");
  if ((await total("company=yoq-kompaniya")) !== 0) throw new Error("begona kompaniya");
  if ((await total("premium=1")) !== 0) throw new Error("premium");
  for (const sort of ["popular", "date", "relevance", "salary_desc"]) {
    const res = await j(`/api/vacancies?sort=${sort}&pageSize=10`);
    if (res.status !== 200 || res.body.items.length !== 1) throw new Error("saralash " + sort);
  }

  const facets = (await j(`/api/vacancies/facets?area=${other}`)).body;
  if (facets.total !== 0) throw new Error("facets total: " + facets.total);
  // Hudud o'lchovi o'z filtrini chetlab hisoblanadi — tanlanmagan hudud soni ham ko'rinadi
  if (facets.regions.find((r) => r.slug === own)?.count !== 1) throw new Error("facets hudud: " + JSON.stringify(facets.regions));
  if (facets.employment.find((e) => e.value === "full_time").count !== 0) throw new Error("facets bandlik hudud bilan torayishi kerak");
  const all = (await j("/api/vacancies/facets")).body;
  if (all.total !== 1 || all.companies[0]?.slug !== detail.company.slug || all.experience.find((e) => e.value === "none").count !== 1) {
    throw new Error("facets: " + JSON.stringify(all).slice(0, 300));
  }
});

await check("GET /api/vacancies/:slug (ko'rishlar +1)", async () => {
  const { status, body } = await j(`/api/vacancies/${vacancySlug}`);
  if (status !== 200 || body.slug !== vacancySlug) throw new Error(status + " " + JSON.stringify(body).slice(0, 200));
  // Detail sahifasi uchun: rasmlar (bo'sh ro'yxat), kompaniya hududi va faol vakansiyalar soni
  if (!Array.isArray(body.images) || !Array.isArray(body.company.images)) throw new Error("images maydoni yo'q");
  if (body.company._count?.vacancies !== 1) throw new Error("kompaniya _count: " + JSON.stringify(body.company._count));
});

await check("GET /api/vacancies/:slug/similar (o'zi chiqmaydi, soha bo'yicha, 404)", async () => {
  const alone = await j(`/api/vacancies/${vacancySlug}/similar`);
  if (alone.status !== 200 || alone.body.items.length !== 0) throw new Error("yagona vakansiya: " + JSON.stringify(alone.body).slice(0, 200));

  const detail = (await j(`/api/vacancies/${vacancySlug}`)).body;
  const second = await post("/api/vacancies", {
    title: "Backend dasturchi", description: "Uzun tavsif matni bu yerda",
    employmentType: "full_time", categoryId: detail.categoryId, regionId: detail.regionId, workplaceType: "hybrid",
  }, employerToken);
  if (second.status !== 201) throw new Error("ikkinchi vakansiya: " + second.status);
  const list = (await j(`/api/vacancies/${vacancySlug}/similar?limit=4`)).body.items;
  if (list.length !== 1 || list[0].slug !== second.body.slug || !list[0].company?.name) {
    throw new Error("o'xshash: " + JSON.stringify(list).slice(0, 200));
  }
  if ((await j("/api/vacancies/yoq-vakansiya/similar")).status !== 404) throw new Error("404 kutilgan");
  // Keyingi tekshiruvlar bitta vakansiyaga tayanadi — vaqtinchalik e'lonni o'chiramiz
  await j(`/api/vacancies/${second.body.id}`, { method: "DELETE", headers: { authorization: `Bearer ${employerToken}` } });
});

await check("nomzod ro'yxatdan o'tadi + ariza yuboradi", async () => {
  const reg = await post("/api/auth/register", {
    email: "seeker@test.uz", password: "parol12345", role: "job_seeker", firstName: "Aziz", lastName: "Aliyev",
  });
  seekerToken = reg.body.accessToken;
  await prisma.user.updateMany({ where: {}, data: { isPhoneVerified: true } });

  const r1 = await post(`/api/vacancies/${vacancyId}/apply`, { source: "site" }, seekerToken);
  if (r1.status !== 400) throw new Error("rezyumesiz ariza o'tib ketdi: " + r1.status + " " + JSON.stringify(r1.body));

  const resume = await j("/api/resume", {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${seekerToken}` },
    body: JSON.stringify({
      title: "Frontend dasturchi", skills: ["React", "TypeScript"],
      experience: [{ companyName: "X", position: "Dev", startDate: "2023-01", endDate: "2024-06" }],
      education: [{ institution: "TATU", startYear: 2018, endYear: 2022 }],
    }),
  });
  if (resume.status !== 200 || resume.body.resume?.skills?.length !== 2) {
    throw new Error("rezyume: " + resume.status + " " + JSON.stringify(resume.body).slice(0, 200));
  }

  const r2 = await post(`/api/vacancies/${vacancyId}/apply`, { source: "site" }, seekerToken);
  if (r2.status !== 201) throw new Error("ariza: " + r2.status + " " + JSON.stringify(r2.body));
  const r3 = await post(`/api/vacancies/${vacancyId}/apply`, { source: "site" }, seekerToken);
  if (r3.status !== 200) throw new Error("takroriy ariza: " + r3.status);
});

await check("ish beruvchi arizani ko'radi va holatini o'zgartiradi (yengil ro'yxat + tafsilot, audit R3 D-061)", async () => {
  const list = await j("/api/employer/applications", { headers: { authorization: `Bearer ${employerToken}` } });
  if (list.body.items?.length !== 1) throw new Error("ariza soni: " + list.body.items?.length);
  const appId = list.body.items[0].id;
  const upd = await j(`/api/applications/${appId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${employerToken}` },
    body: JSON.stringify({ status: "invited", reason: "Suhbatga taklif qilamiz" }),
  });
  if (upd.status !== 200) throw new Error("holat: " + upd.status + " " + JSON.stringify(upd.body));

  // Ro'yxat YENGIL (audit R3, D-061): to'liq rezyume, ariza xati va holat tarixi bu yerda emas
  const after = await j("/api/employer/applications", { headers: { authorization: `Bearer ${employerToken}` } });
  const item = after.body.items[0];
  for (const key of ["resume", "coverLetter", "statusHistory", "jobSeeker"]) {
    if (key in item) throw new Error(`yengil ro'yxatda "${key}" bo'lmasligi kerak`);
  }
  if (!item.vacancy || !("workplaceType" in item.vacancy) || !("employmentType" in item.vacancy)) {
    throw new Error("vakansiya kartasi: " + JSON.stringify(item.vacancy));
  }
  // PDF fayl manzili emas, faqat bayroq (audit R3, D-058)
  if (typeof item.hasResumeFile !== "boolean") throw new Error("hasResumeFile bayrog'i yo'q: " + JSON.stringify(item));
  if (JSON.stringify(item).includes("/uploads/")) throw new Error("ro'yxatda fayl manzili bor");
  if (item.status !== "invited") throw new Error("holat: " + item.status);
  // Server tomonidagi sahifalash va sonlar
  if (after.body.total !== 1 || after.body.page !== 1) throw new Error("sahifalash: " + JSON.stringify({ t: after.body.total, p: after.body.page }));
  if (!(after.body.pageSize > 0 && after.body.pageSize <= 50)) throw new Error("pageSize: " + after.body.pageSize);
  if (after.body.counts?.all !== 1 || after.body.counts?.invited !== 1) throw new Error("sonlar: " + JSON.stringify(after.body.counts));

  // To'liq ma'lumot faqat tafsilot endpointida
  const detail = await j(`/api/employer/applications/${appId}`, { headers: { authorization: `Bearer ${employerToken}` } });
  if (detail.status !== 200) throw new Error("tafsilot: " + detail.status + " " + JSON.stringify(detail.body).slice(0, 200));
  if (!("coverLetter" in detail.body)) throw new Error("tafsilotda ariza xati yo'q");
  if (!Array.isArray(detail.body.statusHistory) || !detail.body.statusHistory.some((h) => h.newStatus === "invited" && h.oldStatus === "sent")) {
    throw new Error("holat tarixi: " + JSON.stringify(detail.body.statusHistory));
  }
  if ("changedBy" in (detail.body.statusHistory[0] ?? {})) throw new Error("tarixda kim o'zgartirgani yuborilmasligi kerak");
  if (typeof detail.body.hasResumeFile !== "boolean") throw new Error("tafsilotda hasResumeFile yo'q");
  if (!detail.body.candidate?.email) throw new Error("ariza yuborgan nomzod aloqa ma'lumoti yo'q");

  const toSent = await j(`/api/applications/${appId}/status`, {
    method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${employerToken}` }, body: JSON.stringify({ status: "sent" }),
  });
  if (toSent.status !== 400) throw new Error("'sent' holatiga qaytarish: " + toSent.status);
  const asSeeker = await j("/api/employer/applications", { headers: { authorization: `Bearer ${seekerToken}` } });
  if (asSeeker.status !== 403) throw new Error("nomzod ish beruvchi arizalarini ochdi: " + asSeeker.status);
  const detailAsSeeker = await j(`/api/employer/applications/${appId}`, { headers: { authorization: `Bearer ${seekerToken}` } });
  if (detailAsSeeker.status !== 403) throw new Error("nomzod tafsilotni ochdi: " + detailAsSeeker.status);
});

await check("begona vakansiya arizalari yopiq (403)", async () => {
  const other = await post("/api/auth/register", { email: "hr2@test.uz", password: "parol12345", role: "employer", companyName: "Boshqa" });
  const { status } = await j(`/api/vacancies/${vacancyId}/applications`, {
    headers: { authorization: `Bearer ${other.body.accessToken}` },
  });
  if (status !== 403) throw new Error("status " + status);
  // "Murojaatlar": begona ish beruvchi faqat o'z (bo'sh) ro'yxatini ko'radi va holatni o'zgartira olmaydi
  const foreignList = (await j("/api/employer/applications", { headers: { authorization: `Bearer ${other.body.accessToken}` } })).body;
  if (foreignList.items?.length !== 0) throw new Error("begona ish beruvchi arizalarni ko'rdi: " + foreignList.items?.length);
  const ownerItems = (await j("/api/employer/applications", { headers: { authorization: `Bearer ${employerToken}` } })).body.items;
  const foreignPatch = await j(`/api/applications/${ownerItems[0].id}/status`, {
    method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${other.body.accessToken}` }, body: JSON.stringify({ status: "rejected" }),
  });
  if (foreignPatch.status !== 403) throw new Error("begona ish beruvchi holatni o'zgartirdi: " + foreignPatch.status);
});

await check("chat: suhbat ochiladi va xabar keladi", async () => {
  const conv = await j("/api/conversations", { headers: { authorization: `Bearer ${seekerToken}` } });
  if (conv.body.items?.length !== 1) throw new Error("suhbat soni: " + conv.body.items?.length);
  const msgs = await j(`/api/conversations/${conv.body.items[0].id}/messages`, {
    headers: { authorization: `Bearer ${seekerToken}` },
  });
  if (msgs.body.items?.length !== 1) throw new Error("xabar soni: " + msgs.body.items?.length);
});

await check("chat: ro'yxat konteksti (kompaniya, vakansiya), begona tarix 403, mehmon 401", async () => {
  const conv = await j("/api/conversations", { headers: { authorization: `Bearer ${seekerToken}` } });
  const item = conv.body.items?.[0];
  if (item?.otherRole !== "employer") throw new Error("otherRole: " + item?.otherRole);
  if (!item.company?.slug || "ownerUserId" in item.company || "stir" in item.company) {
    throw new Error("kompaniya: " + JSON.stringify(item.company));
  }
  if (!item.vacancy?.slug) throw new Error("vakansiya konteksti yo'q: " + JSON.stringify(item).slice(0, 300));
  if (typeof item.lastMessageMine !== "boolean") throw new Error("lastMessageMine yo'q");
  const other = await post("/api/auth/login", { email: "hr2@test.uz", password: "parol12345" });
  const foreign = await j(`/api/conversations/${item.id}/messages`, { headers: { authorization: `Bearer ${other.body.accessToken}` } });
  if (foreign.status !== 403) throw new Error("begona tarix: " + foreign.status);
  const guest = await j("/api/conversations");
  if (guest.status !== 401) throw new Error("mehmon: " + guest.status);
});

await check("chat (WebSocket): yuboruvchiga clientId qaytadi, suhbatdoshga — qaytmaydi", async () => {
  const { default: WebSocket } = await import("ws");
  const conv = (await j("/api/conversations", { headers: { authorization: `Bearer ${seekerToken}` } })).body.items[0];
  const open = (token) =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/chat?token=${encodeURIComponent(token)}`);
      ws.once("open", () => resolve(ws));
      ws.once("error", reject);
    });
  const nextMessage = (ws) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("xabar kelmadi")), 5000);
      ws.on("message", function onMessage(raw) {
        const data = JSON.parse(String(raw));
        if (data.type !== "message") return;
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve(data);
      });
    });
  const [seekerWs, employerWs] = await Promise.all([open(seekerToken), open(employerToken)]);
  try {
    const mine = nextMessage(seekerWs);
    const theirs = nextMessage(employerWs);
    seekerWs.send(JSON.stringify({ type: "message", conversationId: conv.id, body: "  WS salom  ", clientId: "e2e-client-1" }));
    const [a, b] = await Promise.all([mine, theirs]);
    if (a.clientId !== "e2e-client-1" || a.message.body !== "WS salom") throw new Error("yuboruvchi: " + JSON.stringify(a));
    if ("clientId" in b) throw new Error("suhbatdoshga clientId ketdi");
  } finally {
    seekerWs.close();
    employerWs.close();
  }
});

await check("bildirishnomalar yozilgan", async () => {
  await sleep(700);
  const n = await j("/api/notifications", { headers: { authorization: `Bearer ${seekerToken}` } });
  if (!n.body.items?.length) throw new Error("bildirishnoma yo'q");
});

await check("sharh: ariza yuborgan nomzod qoldira oladi (bir marta)", async () => {
  const company = (await j("/api/employer/company", { headers: { authorization: `Bearer ${employerToken}` } })).body.company;
  const r1 = await post(`/api/companies/${company.slug}/reviews`, { rating: 5, comment: "Zo'r" }, seekerToken);
  if (r1.status !== 201) throw new Error("sharh: " + r1.status + " " + JSON.stringify(r1.body));
  const r2 = await post(`/api/companies/${company.slug}/reviews`, { rating: 4 }, seekerToken);
  if (r2.status !== 200) throw new Error("takroriy sharh: " + r2.status);
});

await check("sevimlilar (upsert, dublikatsiz)", async () => {
  for (let i = 0; i < 2; i++) {
    const r = await post(`/api/favorites/${vacancyId}`, {}, seekerToken);
    if (r.status !== 201) throw new Error("status " + r.status);
  }
  const ids = await j("/api/favorites/ids", { headers: { authorization: `Bearer ${seekerToken}` } });
  if (ids.body.ids?.length !== 1) throw new Error("soni: " + ids.body.ids?.length);
});

await check("kompaniyalar katalogi: hisoblangan ko'rsatkichlar, filtr, cursor", async () => {
  const first = await j("/api/companies?limit=1");
  if (first.status !== 200 || !Array.isArray(first.body.items) || typeof first.body.total !== "number") {
    throw new Error("javob shakli: " + JSON.stringify(first.body).slice(0, 200));
  }
  const c = first.body.items[0];
  for (const key of ["id", "slug", "name", "rating", "reviewCount", "activeVacancyCount"]) {
    if (!(key in c)) throw new Error("maydon yo'q: " + key);
  }
  // Barcha sahifalarni cursor bilan aylanib chiqish — takror va tushib qolish yo'q
  const seen = new Set();
  let cursor = null;
  do {
    const page = await j(`/api/companies?limit=1&sort=newest${cursor ? `&cursor=${cursor}` : ""}`);
    if (page.status !== 200) throw new Error("sahifa: " + page.status);
    for (const item of page.body.items) {
      if (seen.has(item.id)) throw new Error("takror: " + item.slug);
      seen.add(item.id);
    }
    cursor = page.body.nextCursor;
  } while (cursor);
  if (seen.size !== first.body.total) throw new Error(`jami ${first.body.total}, aylanildi ${seen.size}`);
  const hiring = await j("/api/companies?hiring=1");
  if (hiring.body.items.some((x) => x.activeVacancyCount === 0)) throw new Error("hiring filtri");
  const bad = await j("/api/companies?cursor=buzilgan");
  if (bad.status !== 400) throw new Error("buzilgan cursor: " + bad.status);
  const guestSaved = await j("/api/companies?saved=1");
  if (guestSaved.status !== 401) throw new Error("saved=1 mehmon: " + guestSaved.status);
});

await check("kompaniyani saqlash (upsert, saved=1 filtri, o'chirish)", async () => {
  const company = (await j("/api/employer/company", { headers: { authorization: `Bearer ${employerToken}` } })).body.company;
  for (let i = 0; i < 2; i++) {
    const r = await post(`/api/favorites/companies/${company.id}`, {}, seekerToken);
    if (r.status !== 201) throw new Error("saqlash: " + r.status);
  }
  const auth = { headers: { authorization: `Bearer ${seekerToken}` } };
  const ids = await j("/api/favorites/companies/ids", auth);
  if (ids.body.ids?.length !== 1) throw new Error("ids: " + JSON.stringify(ids.body));
  const list = await j("/api/companies?saved=1", auth);
  if (list.body.total !== 1 || list.body.items[0].id !== company.id) throw new Error("saved ro'yxat: " + JSON.stringify(list.body).slice(0, 200));
  const del = await j(`/api/favorites/companies/${company.id}`, { method: "DELETE", ...auth });
  if (del.status !== 200) throw new Error("o'chirish: " + del.status);
  const after = await j("/api/companies?saved=1", auth);
  if (after.body.total !== 0) throw new Error("o'chirilgandan keyin: " + after.body.total);
});

await check("o'xshash kompaniyalar (o'zi chiqmaydi, 404) va sitemap /companies/:slug", async () => {
  const company = (await j("/api/employer/company", { headers: { authorization: `Bearer ${employerToken}` } })).body.company;
  const detail = await j(`/api/companies/${company.slug}`);
  if (detail.status !== 200 || !Array.isArray(detail.body.images)) throw new Error("detail: " + detail.status);
  const similar = await j(`/api/companies/${company.slug}/similar?limit=5`);
  if (similar.status !== 200 || !Array.isArray(similar.body.items) || similar.body.items.some((c) => c.slug === company.slug)) {
    throw new Error("similar: " + similar.status + " " + JSON.stringify(similar.body).slice(0, 200));
  }
  if ((await j("/api/companies/yoq-kompaniya/similar")).status !== 404) throw new Error("404 kutilgan");
  const sm = (await j("/sitemap-employer.xml")).body;
  if (!sm.includes(`https://sayt.example/companies/${company.slug}`) || sm.includes("/employer/")) throw new Error(sm.slice(0, 300));
});

await check("saqlangan qidiruv (Json)", async () => {
  const r = await post("/api/saved-searches", {
    name: "IT Toshkent", queryParams: { text: "dasturchi", area: "tashkent" }, frequency: "daily",
  }, seekerToken);
  if (r.status !== 201 || r.body.params?.text !== "dasturchi") throw new Error(r.status + " " + JSON.stringify(r.body));
});

await check("admin hisobi yaratilgan va panel ishlaydi", async () => {
  const login = await post("/api/auth/login", { email: "admin@ish.top", password: "admin-parol-123" });
  if (login.status !== 200) throw new Error("admin login: " + login.status + " " + JSON.stringify(login.body));
  adminToken = login.body.accessToken;
  const ov = await j("/api/admin/overview", { headers: { authorization: `Bearer ${adminToken}` } });
  if (ov.status !== 200 || ov.body.users?.total < 3) throw new Error(ov.status + " " + JSON.stringify(ov.body).slice(0, 200));
  if (ov.body.search?.engine !== "mongodb") throw new Error("engine: " + ov.body.search?.engine);
  const users = await j("/api/admin/users?text=aziz", { headers: { authorization: `Bearer ${adminToken}` } });
  if (users.body.items?.length !== 1) throw new Error("admin qidiruv: " + users.body.items?.length);
});

await check("nomzodlar bazasi bepul: tarif cheklovi (402) yo'q", async () => {
  const { status, body } = await j("/api/candidates", { headers: { authorization: `Bearer ${employerToken}` } });
  if (status !== 200 || !Array.isArray(body.items)) throw new Error(status + " " + JSON.stringify(body).slice(0, 200));
});

await check("maosh statistikasi", async () => {
  const { status, body } = await j("/api/stats/salary");
  if (status !== 200 || body.summary?.count !== 1) throw new Error(status + " " + JSON.stringify(body).slice(0, 200));
});

await check("maosh statistikasi: kasb, matn, tajriba kesimi, bozor bazasi", async () => {
  // Yagona maoshli vakansiya: "Frontend dasturchi (React)", 15–25 mln, tajribasiz
  const role = (await j("/api/stats/salary?role=frontend-developer")).body;
  if (role.summary?.count !== 1 || role.summary.median !== 20000000) throw new Error("role: " + JSON.stringify(role.summary));
  if (role.vacancyCount < 1 || role.market?.count !== 1) throw new Error("vacancyCount/market: " + role.vacancyCount + " " + JSON.stringify(role.market));
  if (role.byExperience?.length !== 4 || role.byExperience[0].level !== "none" || role.byExperience[0].count !== 1) {
    throw new Error("byExperience: " + JSON.stringify(role.byExperience));
  }
  const hr = (await j("/api/stats/salary?role=hr")).body;
  if (hr.summary.count !== 0 || hr.vacancyCount !== 0 || hr.market.count !== 1) throw new Error("hr: " + JSON.stringify(hr.summary));
  const text = (await j("/api/stats/salary?q=react")).body;
  if (text.summary.count !== 1) throw new Error("q=react: " + text.summary.count);
  // Tajriba filtri kartalarni toraytiradi, lekin tajriba grafigi o'z filtrini chetlab hisoblanadi
  const senior = (await j("/api/stats/salary?experience=six_plus")).body;
  if (senior.summary.count !== 0 || senior.byExperience[0].count !== 1) throw new Error("experience: " + JSON.stringify(senior.byExperience));
  const bad = await j("/api/stats/salary?role=astronavt");
  if (bad.status !== 400) throw new Error("noto'g'ri kasb: " + bad.status);
});

await check("robots.txt va sitemap sayt domeniga ishora qiladi", async () => {
  const robots = (await j("/robots.txt")).body;
  if (!robots.includes("Sitemap: https://sayt.example/sitemap.xml")) throw new Error(robots.slice(0, 200));
  const sm = (await j("/sitemap-vacancy.xml")).body;
  if (!sm.includes(`https://sayt.example/vacancies/${vacancySlug}`)) throw new Error(sm.slice(0, 300));
});

await check("OG rasm chiziladi", async () => {
  const res = await fetch(`${BASE}/api/og/vacancy/${vacancySlug}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (res.status !== 200 || buf.subarray(1, 4).toString() !== "PNG") throw new Error(res.status + " " + buf.length);
});

await check("CORS: begona manzil rad etiladi, WEB_ORIGIN o'tadi", async () => {
  const bad = await fetch(`${BASE}/api/stats`, { headers: { origin: "https://yomon.example" } });
  if (bad.headers.get("access-control-allow-origin")) throw new Error("begona manzilga ruxsat berildi");
  const good = await fetch(`${BASE}/api/stats`, { headers: { origin: "https://sayt.example" } });
  if (good.headers.get("access-control-allow-origin") !== "https://sayt.example") throw new Error("WEB_ORIGIN rad etildi");
  // Istalgan *.vercel.app ruxsat olmaydi (audit ISSUE-004): preview faqat aniq CORS_PREVIEW_ORIGIN_REGEX bilan
  const preview = await fetch(`${BASE}/api/stats`, { headers: { origin: "https://ishbor-git-x.vercel.app" } });
  if (preview.headers.get("access-control-allow-origin") || preview.status !== 403) {
    throw new Error("begona vercel preview ruxsat oldi: " + preview.status);
  }
});

await check("faol vakansiyalar soni cheklanmagan: 4- va 10-faol vakansiya 201, 402 yo'q, tarif ma'lumoti qaytmaydi", async () => {
  const regions = (await j("/api/regions")).body.items;
  const cats = (await j("/api/categories")).body.items;
  const auth = { authorization: `Bearer ${employerToken}` };
  const created = [];
  for (let i = 0; i < 9; i++) {
    const r = await post("/api/vacancies", {
      title: `Vakansiya ${i}`, description: "Uzun tavsif matni", employmentType: "full_time",
      categoryId: cats[0].id, regionId: regions[0].id, workplaceType: "office",
    }, employerToken);
    if (r.status !== 201 || r.body.status !== "active") throw new Error(`#${i}: ` + r.status + " " + JSON.stringify(r.body));
    created.push(r.body.id);
  }
  const list = (await j("/api/employer/vacancies", { headers: auth })).body;
  const active = list.items.filter((v) => v.status === "active").length;
  if (active < 10) throw new Error("faol vakansiyalar: " + active);
  if ("subscription" in list) throw new Error("javobda tarif ma'lumoti qoldi");
  // Yopilganni qayta faollashtirish ham cheklanmaydi
  const patch = (id, status) => j(`/api/vacancies/${id}/status`, {
    method: "PATCH", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ status }),
  });
  const closed = await patch(created[0], "archived");
  const reopened = await patch(created[0], "active");
  if (closed.status !== 200 || reopened.status !== 200 || reopened.body.status !== "active") {
    throw new Error("qayta faollashtirish: " + closed.status + " " + reopened.status);
  }
});

await check("vakansiya holati: moderatsiyani chetlab o'tib bo'lmaydi (rad etilgan/moderatsiya -> faol 409), yopish/faollashtirish ishlaydi", async () => {
  const auth = { authorization: `Bearer ${employerToken}` };
  const patch = (id, status) => j(`/api/vacancies/${id}/status`, {
    method: "PATCH", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ status }),
  });
  const list = (await j("/api/employer/vacancies", { headers: auth })).body.items;
  const target = list.find((v) => v.status === "active");
  if (!target) throw new Error("faol vakansiya yo'q");
  // Limit to'la (3/3) bo'lsa ham bir xil holat — o'zgarishsiz 200
  const same = await patch(target.id, "active");
  if (same.status !== 200 || same.body.status !== "active") throw new Error("bir xil holat: " + same.status + " " + JSON.stringify(same.body));
  for (const blocked of ["rejected", "moderation"]) {
    await prisma.vacancy.update({ where: { id: target.id }, data: { status: blocked } });
    const r = await patch(target.id, "active");
    if (r.status !== 409) throw new Error(`${blocked} -> active: ` + r.status);
    const after = await prisma.vacancy.findUnique({ where: { id: target.id }, select: { status: true } });
    if (after.status !== blocked) throw new Error(`${blocked} o'zgarib ketdi: ` + after.status);
  }
  await prisma.vacancy.update({ where: { id: target.id }, data: { status: "draft" } });
  const fromDraft = await patch(target.id, "active");
  if (fromDraft.status !== 200 || fromDraft.body.status !== "active") throw new Error("draft -> active: " + fromDraft.status);
  const closed = await patch(target.id, "archived");
  const reopened = await patch(target.id, "active");
  if (closed.status !== 200 || reopened.status !== 200 || reopened.body.status !== "active") throw new Error("yopish/faollashtirish: " + closed.status + " " + reopened.status);
  const closedAgain = await patch(target.id, "archived");
  if (closedAgain.status !== 200) throw new Error("egasi yopa olmadi: " + closedAgain.status);
  const foreign = await j(`/api/vacancies/${target.id}/status`, {
    method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${seekerToken}` }, body: JSON.stringify({ status: "active" }),
  });
  if (foreign.status !== 403) throw new Error("nomzod holatni o'zgartirdi: " + foreign.status);
  await patch(target.id, "active");
});

await check("yangi vakansiya formasi: qoralama (ochiq emas), ish grafigi, maoshni yashirish, maoshni tozalash, holatni o'zi qo'ya olmaydi", async () => {
  const auth = { authorization: `Bearer ${employerToken}` };
  const regions = (await j("/api/regions")).body.items;
  const cats = (await j("/api/categories")).body.items;
  const draft = await post("/api/vacancies", {
    title: "Qoralama vakansiya", description: "Qoralama uchun tavsif matni", employmentType: "part_time", status: "draft",
    categoryId: cats[0].id, regionId: regions[0].id, workplaceType: "hybrid",
    scheduleType: "gibkiy", salaryMin: 5000000, salaryMax: 7000000, isSalaryHidden: true,
  }, employerToken);
  if (draft.status !== 201 || draft.body.status !== "draft" || draft.body.publishedAt !== null) throw new Error("draft: " + draft.status + " " + JSON.stringify(draft.body));
  if (draft.body.scheduleType !== "gibkiy" || draft.body.isSalaryHidden !== true) throw new Error("maydonlar: " + JSON.stringify(draft.body));
  const open = await j(`/api/vacancies/${draft.body.slug}`);
  if (open.status !== 404) throw new Error("qoralama ochiq sahifada: " + open.status);
  const put = (data) => j(`/api/vacancies/${draft.body.id}`, { method: "PUT", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(data) });
  const edited = await put({ scheduleType: "five_two", isSalaryHidden: false, salaryMin: null, salaryMax: null });
  if (edited.status !== 200 || edited.body.scheduleType !== "five_two" || edited.body.isSalaryHidden !== false || edited.body.salaryMin !== null || edited.body.status !== "draft") {
    throw new Error("tahrirlash: " + edited.status + " " + JSON.stringify(edited.body));
  }
  const cleared = await put({ scheduleType: null });
  if (cleared.status !== 200 || cleared.body.scheduleType !== null) throw new Error("grafikni tozalash: " + JSON.stringify(cleared.body));
  const forcedStatus = await put({ status: "active" });
  if (forcedStatus.status !== 200 || forcedStatus.body.status !== "draft") throw new Error("PUT holatni o'zgartirdi: " + forcedStatus.body.status);
  for (const status of ["moderation", "rejected", "archived"]) {
    const bad = await post("/api/vacancies", { title: "Holat", description: "Uzun tavsif matni", employmentType: "full_time", status }, employerToken);
    if (bad.status !== 400) throw new Error(`status=${status}: ` + bad.status);
  }
  const decimal = await post("/api/vacancies", { title: "Maosh", description: "Uzun tavsif matni", employmentType: "full_time", status: "draft", salaryMin: 1.5 }, employerToken);
  if (decimal.status !== 400) throw new Error("o'nlik maosh: " + decimal.status);
  const del = await j(`/api/vacancies/${draft.body.id}`, { method: "DELETE", headers: auth });
  if (del.status !== 200) throw new Error("o'chirish: " + del.status);
});

await check("vakansiya joylashuvi: kategoriya majburiy, hudud masofaviydan boshqa hollarda majburiy (yaratish/tahrirlash), begona ish beruvchi 403, ochiq sahifa va masofaviy filtri", async () => {
  const auth = { authorization: `Bearer ${employerToken}` };
  const regions = (await j("/api/regions")).body.items;
  const cats = (await j("/api/categories")).body.items;
  const base = { title: "Joylashuv testi", description: "Joylashuv qoidalari uchun tavsif", employmentType: "full_time" };
  const create = (extra) => post("/api/vacancies", { ...base, ...extra }, employerToken);
  const put = (id, data, token = employerToken) => j(`/api/vacancies/${id}`, {
    method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(data),
  });
  const expect400 = (r, field, label) => {
    if (r.status !== 400 || !String(r.body?.message ?? "").startsWith(field)) throw new Error(`${label}: ` + r.status + " " + JSON.stringify(r.body));
  };

  // Yaratish
  expect400(await create({ regionId: regions[0].id, workplaceType: "office" }), "categoryId", "kategoriyasiz");
  expect400(await create({ categoryId: cats[0].id, workplaceType: "office" }), "regionId", "ofis, hududsiz");
  expect400(await create({ categoryId: cats[0].id, workplaceType: "hybrid", regionId: null }), "regionId", "gibrid, hududsiz");
  expect400(await create({ categoryId: cats[0].id, regionId: regions[0].id }), "workplaceType", "ish joylashuvisiz");
  expect400(await create({ categoryId: cats[0].id, regionId: regions[0].id, workplaceType: "space" }), "workplaceType", "noto'g'ri joylashuv");
  expect400(await create({ categoryId: "0".repeat(24), regionId: regions[0].id, workplaceType: "office" }), "categoryId", "mavjud bo'lmagan kategoriya");
  expect400(await create({ categoryId: cats[0].id, regionId: "0".repeat(24), workplaceType: "office" }), "regionId", "mavjud bo'lmagan hudud");

  const office = await create({ categoryId: cats[0].id, regionId: regions[0].id, workplaceType: "office" });
  const hybrid = await create({ categoryId: cats[0].id, regionId: regions[0].id, workplaceType: "hybrid" });
  const remote = await create({ categoryId: cats[0].id, workplaceType: "remote" });
  const remoteWithRegion = await create({ categoryId: cats[0].id, regionId: regions[0].id, workplaceType: "remote" });
  for (const [label, r, wp] of [["ofis", office, "office"], ["gibrid", hybrid, "hybrid"], ["masofaviy", remote, "remote"], ["masofaviy+hudud", remoteWithRegion, "remote"]]) {
    if (r.status !== 201 || r.body.workplaceType !== wp) throw new Error(`${label}: ` + r.status + " " + JSON.stringify(r.body));
  }
  if (remote.body.regionId !== null) throw new Error("masofaviy e'londa hudud: " + remote.body.regionId);

  // Tahrirlash — yakuniy holat bo'yicha bir xil qoida
  expect400(await put(office.body.id, { regionId: null }), "regionId", "ofisdan hududni olib tashlash");
  expect400(await put(remote.body.id, { workplaceType: "hybrid" }), "regionId", "masofaviy -> gibrid, hududsiz");
  expect400(await put(office.body.id, { categoryId: null }), "categoryId", "kategoriyani olib tashlash");
  const toRemote = await put(office.body.id, { workplaceType: "remote", regionId: null });
  if (toRemote.status !== 200 || toRemote.body.workplaceType !== "remote" || toRemote.body.regionId !== null) throw new Error("ofis -> masofaviy: " + JSON.stringify(toRemote.body));
  const toHybrid = await put(remote.body.id, { workplaceType: "hybrid", regionId: regions[1].id });
  if (toHybrid.status !== 200 || toHybrid.body.regionId !== regions[1].id) throw new Error("masofaviy -> gibrid: " + JSON.stringify(toHybrid.body));
  const titleOnly = await put(remoteWithRegion.body.id, { title: "Joylashuv testi (yangi nom)" });
  if (titleOnly.status !== 200) throw new Error("qisman tahrirlash: " + titleOnly.status);

  // Xavfsizlik: begona ish beruvchi boshqa kompaniya vakansiyasini o'zgartira olmaydi
  const other = await post("/api/auth/register", { email: "hr3@test.uz", password: "parol12345", role: "employer", companyName: "Uchinchi kompaniya" });
  const otherAuth = { authorization: `Bearer ${other.body.accessToken}` };
  const foreignPut = await put(office.body.id, { title: "Buzilgan" }, other.body.accessToken);
  const foreignPatch = await j(`/api/vacancies/${office.body.id}/status`, {
    method: "PATCH", headers: { "content-type": "application/json", ...otherAuth }, body: JSON.stringify({ status: "archived" }),
  });
  const foreignDelete = await j(`/api/vacancies/${office.body.id}`, { method: "DELETE", headers: otherAuth });
  if (foreignPut.status !== 403 || foreignPatch.status !== 403 || foreignDelete.status !== 403) {
    throw new Error(`begona ish beruvchi: PUT ${foreignPut.status}, PATCH ${foreignPatch.status}, DELETE ${foreignDelete.status}`);
  }

  // Ochiq sahifa va filtrlar: hududsiz masofaviy e'lon xatosiz ishlaydi
  const open = await j(`/api/vacancies/${toRemote.body.slug}`);
  if (open.status !== 200 || open.body.region !== null || open.body.workplaceType !== "remote") {
    throw new Error("ochiq sahifa: " + open.status + " " + JSON.stringify({ region: open.body.region, workplaceType: open.body.workplaceType }));
  }
  const remoteList = (await j("/api/vacancies?employment=remote&pageSize=50")).body;
  if (!remoteList.items.some((v) => v.id === toRemote.body.id)) throw new Error("employment=remote filtri masofaviy joylashuvni topmadi");
  const facets = (await j("/api/vacancies/facets")).body;
  const remoteFacet = facets.employment.find((e) => e.value === "remote")?.count ?? 0;
  if (remoteFacet < 2) throw new Error("masofaviy facet: " + remoteFacet);
  const byArea = await j(`/api/vacancies?area=${regions[0].slug}&employment=remote`);
  if (byArea.status !== 200) throw new Error("hudud + masofaviy filtri: " + byArea.status);

  for (const r of [office, hybrid, remote, remoteWithRegion]) await j(`/api/vacancies/${r.body.id}`, { method: "DELETE", headers: auth });
});

await check("rezyume bo'sh bo'limlar bilan saqlanadi (ta'lim/ko'nikmasiz)", async () => {
  // MongoDB bo'sh `createMany` ni rad etadi — ilgari bu 500 berib, rezyumeni
  // yarim yozib qo'yardi. Profil sahifasi har bo'limni alohida saqlaydi, shuning
  // uchun bo'sh bo'limli hujjat odatiy holat.
  const put = (data) =>
    j("/api/resume", {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${seekerToken}` },
      body: JSON.stringify(data),
    });
  const partial = await put({
    title: "Frontend dasturchi", summary: "Qisqa tavsif", skills: [], education: [],
    experience: [{ companyName: "X", position: "Dev", startDate: "2023-01", endDate: null, isCurrent: true }],
  });
  if (partial.status !== 200) throw new Error("qisman: " + partial.status + " " + JSON.stringify(partial.body).slice(0, 200));
  const back = await j("/api/resume", { headers: { authorization: `Bearer ${seekerToken}` } });
  const r = back.body.resume;
  if (r?.summary !== "Qisqa tavsif" || r.experience.length !== 1 || r.education.length !== 0 || r.skills.length !== 0) {
    throw new Error("saqlangan holat noto'g'ri: " + JSON.stringify(r).slice(0, 200));
  }
  const empty = await put({ title: "Frontend dasturchi", skills: [], experience: [], education: [] });
  if (empty.status !== 200) throw new Error("hammasi bo'sh: " + empty.status);
});

await check("nomzodning o'z arizalari (GET /api/applications) — kompaniya bilan", async () => {
  const { status, body } = await j("/api/applications", { headers: { authorization: `Bearer ${seekerToken}` } });
  if (status !== 200 || !Array.isArray(body) || body.length < 1) throw new Error(status + " " + JSON.stringify(body).slice(0, 200));
  const first = body[0];
  if (!first.status || !first.vacancy?.slug || !first.vacancy?.company?.name) {
    throw new Error("maydonlar yetishmaydi: " + JSON.stringify(first).slice(0, 200));
  }
  if (!first.vacancy.employmentType || !first.vacancy.experienceRequired || !("isVerified" in first.vacancy.company)) {
    throw new Error("vakansiya metamaydonlari yo'q: " + JSON.stringify(first.vacancy).slice(0, 200));
  }
  // Kompaniyaning ichki maydonlari nomzodga chiqmaydi
  if ("ownerUserId" in first.vacancy.company || "stir" in first.vacancy.company) {
    throw new Error("kompaniya ichki maydonlari ochiq: " + JSON.stringify(first.vacancy.company).slice(0, 200));
  }
  if (first.resume?.title !== "Frontend dasturchi") throw new Error("rezyume: " + JSON.stringify(first.resume));
  // Ish beruvchi holatni "invited" ga o'zgartirgan — tarixda haqiqiy yozuv bor
  const last = first.statusHistory?.[first.statusHistory.length - 1];
  if (first.status !== "invited" || last?.newStatus !== "invited" || !last.createdAt) {
    throw new Error("holat tarixi: " + JSON.stringify(first.statusHistory));
  }
});

await check("arizalar faqat egasiga ko'rinadi (boshqa nomzod — bo'sh, ish beruvchi — 403)", async () => {
  const other = await post("/api/auth/register", {
    email: "seeker2@test.uz", password: "parol12345", role: "job_seeker", firstName: "Boshqa", lastName: "Nomzod",
  });
  const mine = await j("/api/applications", { headers: { authorization: `Bearer ${other.body.accessToken}` } });
  if (mine.status !== 200 || !Array.isArray(mine.body) || mine.body.length !== 0) {
    throw new Error("begona arizalar ko'rindi: " + mine.status + " " + JSON.stringify(mine.body).slice(0, 200));
  }
  const employer = await j("/api/applications", { headers: { authorization: `Bearer ${employerToken}` } });
  if (employer.status !== 403) throw new Error("ish beruvchi: " + employer.status);
  const guest = await j("/api/applications");
  if (guest.status !== 401) throw new Error("mehmon: " + guest.status);
});

await check("saqlangan vakansiyalar: javob shakli va faqat egasiga (ichki maydonlarsiz)", async () => {
  const mine = await j("/api/favorites", { headers: { authorization: `Bearer ${seekerToken}` } });
  const item = mine.body.items?.[0];
  if (mine.status !== 200 || mine.body.items?.length !== 1 || item.id !== vacancyId) {
    throw new Error("ro'yxat: " + mine.status + " " + JSON.stringify(mine.body).slice(0, 200));
  }
  if (!item.favoritedAt || typeof item.isClosed !== "boolean" || !item.company?.name || !("logoUrl" in item.company)) {
    throw new Error("maydonlar: " + JSON.stringify(item).slice(0, 300));
  }
  if ("ownerUserId" in item.company || "stir" in item.company || "description" in item) {
    throw new Error("ichki maydonlar chiqdi: " + Object.keys(item.company).join(","));
  }
  const other = await post("/api/auth/login", { email: "seeker2@test.uz", password: "parol12345" });
  const theirs = await j("/api/favorites", { headers: { authorization: `Bearer ${other.body.accessToken}` } });
  if (theirs.status !== 200 || theirs.body.items?.length !== 0) throw new Error("begona saqlanganlar: " + JSON.stringify(theirs.body).slice(0, 200));
  const employer = await j("/api/favorites", { headers: { authorization: `Bearer ${employerToken}` } });
  if (employer.status !== 403) throw new Error("ish beruvchi: " + employer.status);
  const guest = await j("/api/favorites");
  if (guest.status !== 401) throw new Error("mehmon: " + guest.status);
});

await check("bildirishnomalar: faqat egasiga (begona o'qish/o'chirish — 403), tashqi havola yo'q, hammasini o'qish, o'chirish", async () => {
  const auth = { headers: { authorization: `Bearer ${seekerToken}` } };
  const list = await j("/api/notifications?limit=100", auth);
  const first = list.body.items?.[0];
  if (list.status !== 200 || !first || typeof list.body.unreadCount !== "number") {
    throw new Error("ro'yxat: " + list.status + " " + JSON.stringify(list.body).slice(0, 200));
  }
  const other = await post("/api/auth/login", { email: "seeker2@test.uz", password: "parol12345" });
  const otherAuth = { headers: { authorization: `Bearer ${other.body.accessToken}` } };
  const theirs = await j("/api/notifications?limit=100", otherAuth);
  if ((theirs.body.items ?? []).some((n) => n.id === first.id)) throw new Error("begona bildirishnoma ko'rindi");
  const readForeign = await post(`/api/notifications/${first.id}/read`, {}, other.body.accessToken);
  if (readForeign.status !== 403) throw new Error("begona o'qish: " + readForeign.status);
  const delForeign = await j(`/api/notifications/${first.id}`, { method: "DELETE", ...otherAuth });
  if (delForeign.status !== 403) throw new Error("begona o'chirish: " + delForeign.status);

  // payload.url "//host" — tashqi sayt, ro'yxatda havola bo'lmasligi kerak
  const owner = await prisma.notification.findUnique({ where: { id: first.id }, select: { userId: true } });
  const evil = await prisma.notification.create({
    data: { userId: owner.userId, type: "system", title: "Tashqi havola", body: "test", payload: { url: "//evil.example/x" } },
  });
  const withEvil = await j("/api/notifications?limit=100", auth);
  const evilItem = withEvil.body.items.find((n) => n.id === evil.id);
  if (!evilItem || evilItem.url !== null) throw new Error("tashqi havola o'tib ketdi: " + JSON.stringify(evilItem));

  const all = await post("/api/notifications/read-all", {}, seekerToken);
  const count = await j("/api/notifications/unread-count", auth);
  if (all.status !== 200 || count.body.count !== 0) throw new Error("hammasini o'qish: " + JSON.stringify(count.body));
  const del = await j(`/api/notifications/${evil.id}`, { method: "DELETE", ...auth });
  const after = await j("/api/notifications?limit=100", auth);
  if (del.status !== 200 || after.body.items.some((n) => n.id === evil.id)) throw new Error("o'chirish: " + del.status);
  const guest = await j("/api/notifications");
  if (guest.status !== 401) throw new Error("mehmon: " + guest.status);
});

// ------------------------------------------------------------
// Maqolalar: ochiq API, kontent jamoasi, rollar va ish oqimi
// ------------------------------------------------------------
const authH = (token) => ({ authorization: `Bearer ${token}` });
const authGet = (token) => ({ headers: authH(token) });
const send = (method, path, data, token) =>
  j(path, {
    method,
    headers: { "content-type": "application/json", ...(token ? authH(token) : {}) },
    body: JSON.stringify(data ?? {}),
  });
const LONG_CONTENT =
  "## Kirish\n\n" +
  "Bu maqola matni ko'rib chiqish va chop etish uchun yetarli uzunlikda yozilgan test matni. ".repeat(6) +
  "\n\n- Birinchi band\n- Ikkinchi band\n\n> [!TIP]\n> Amaliy maslahat.";

let staffEditorToken, staffAuthorToken, staffEditorId, staffAuthorId, articleId, articleSlug;

async function acceptInvite(email, role, fullName) {
  const invite = await post("/api/admin/team/invites", { email, role }, adminToken);
  if (invite.status !== 201 || !invite.body.link?.includes("/admin/invite?token=")) throw new Error("taklif: " + invite.status + " " + JSON.stringify(invite.body));
  const token = new URL(invite.body.link).searchParams.get("token");
  const accepted = await post(`/api/staff-invites/${token}/accept`, { fullName, password: "parol12345" });
  if (accepted.status !== 200 || !accepted.body.accessToken) throw new Error("qabul: " + accepted.status + " " + JSON.stringify(accepted.body));
  const me = await j("/api/auth/me", authGet(accepted.body.accessToken));
  return { token, accessToken: accepted.body.accessToken, me: me.body };
}

await check("maqolalar: admin API nomzod/ish beruvchiga 403, mehmonga 401; ochiq ro'yxatdan o'tishda kontent roli yo'q", async () => {
  for (const path of ["/api/admin/articles", "/api/admin/team", "/api/admin/articles/authors"]) {
    const guest = await j(path);
    if (guest.status !== 401) throw new Error(`mehmon ${path}: ${guest.status}`);
    for (const [who, token] of [["nomzod", seekerToken], ["ish beruvchi", employerToken]]) {
      const r = await j(path, authGet(token));
      if (r.status !== 403) throw new Error(`${who} ${path}: ${r.status}`);
    }
  }
  const create = await post("/api/admin/articles", { title: "Buzg'unchi", content: LONG_CONTENT, intent: "publish" }, employerToken);
  if (create.status !== 403) throw new Error("ish beruvchi yaratdi: " + create.status);
  const reg = await post("/api/auth/register", { email: "hacker@test.uz", password: "parol12345", role: "content_editor" });
  if (reg.status !== 400) throw new Error("register content_editor: " + reg.status);
});

await check("jamoa: taklif faqat admin, token bazada hash, qabul (bir marta), rol va ism /me da", async () => {
  const editor = await acceptInvite("Muharrir@Test.uz", "content_editor", "Dilnoza Rahimova");
  staffEditorToken = editor.accessToken;
  staffEditorId = editor.me.id;
  if (editor.me.role !== "content_editor" || editor.me.firstName !== "Dilnoza Rahimova") throw new Error("/me: " + JSON.stringify(editor.me));
  const stored = await prisma.staffInvite.findFirst({ where: { email: "muharrir@test.uz" } });
  if (!stored?.acceptedAt || stored.tokenHash === editor.token || stored.tokenHash.length !== 64) throw new Error("token hash emas");
  const reuse = await post(`/api/staff-invites/${editor.token}/accept`, { fullName: "Boshqa", password: "parol12345" });
  if (reuse.status !== 410) throw new Error("qayta ishlatish: " + reuse.status);
  const bad = await j("/api/staff-invites/yaroqsiz-token-aaaaaaaaaaaaaaaaaaaaaaa");
  if (bad.status !== 404) throw new Error("yaroqsiz token: " + bad.status);

  const author = await acceptInvite("muallif@test.uz", "content_author", "Jasur Qodirov");
  staffAuthorToken = author.accessToken;
  staffAuthorId = author.me.id;

  const dup = await post("/api/admin/team/invites", { email: "hr@test.uz", role: "content_author" }, adminToken);
  if (dup.status !== 409) throw new Error("mavjud email: " + dup.status);
  const byEditor = await post("/api/admin/team/invites", { email: "yangi@test.uz", role: "content_author" }, staffEditorToken);
  if (byEditor.status !== 403) throw new Error("muharrir taklif qildi: " + byEditor.status);
  const team = await j("/api/admin/team", authGet(adminToken));
  if (team.status !== 200 || team.body.members.length !== 3) throw new Error("jamoa: " + JSON.stringify(team.body).slice(0, 200));
  const adminMe = (await j("/api/auth/me", authGet(adminToken))).body;
  const selfBlock = await send("PATCH", `/api/admin/team/${adminMe.id}`, { isBlocked: true }, adminToken);
  if (selfBlock.status !== 400) throw new Error("o'zini bloklash: " + selfBlock.status);
});

await check("maqola oqimi: muallif qoralama → ko'rib chiqish (chop eta olmaydi) → muharrir qaytaradi/chop etadi; ochiq API faqat chop etilgan", async () => {
  const publishByAuthor = await post("/api/admin/articles", { title: "Rezyume bo'yicha test maqola", content: LONG_CONTENT, intent: "publish" }, staffAuthorToken);
  if (publishByAuthor.status !== 403) throw new Error("muallif chop etdi: " + publishByAuthor.status);
  const short = await post("/api/admin/articles", { title: "Qisqa matn", content: "Juda qisqa", intent: "review" }, staffAuthorToken);
  if (short.status !== 400 || short.body.error !== "CONTENT_TOO_SHORT") throw new Error("qisqa matn: " + short.status + " " + short.body.error);

  const created = await post(
    "/api/admin/articles",
    { title: "Rezyume bo'yicha test maqola", excerpt: "Qisqa tavsif", content: LONG_CONTENT, category: "resume", tags: ["Rezyume", "rezyume", " Ish  topish "], authorId: staffEditorId },
    staffAuthorToken
  );
  if (created.status !== 201 || created.body.status !== "draft" || created.body.author?.id !== staffAuthorId) throw new Error("yaratish: " + JSON.stringify(created.body).slice(0, 300));
  if (created.body.slug !== "rezyume-boyicha-test-maqola") throw new Error("slug: " + created.body.slug);
  if (JSON.stringify(created.body.tags) !== JSON.stringify(["Rezyume", "Ish topish"])) throw new Error("teglar: " + JSON.stringify(created.body.tags));
  if (!(created.body.readingMinutes >= 1) || created.body.permissions.publish || !created.body.permissions.submit) throw new Error("hosila/ruxsat: " + JSON.stringify(created.body.permissions));
  articleId = created.body.id;
  articleSlug = created.body.slug;

  if ((await j(`/api/articles/${articleSlug}`)).status !== 404) throw new Error("qoralama ochiq");
  const submitted = await post(`/api/admin/articles/${articleId}/submit`, {}, staffAuthorToken);
  if (submitted.body.status !== "in_review") throw new Error("submit: " + JSON.stringify(submitted.body).slice(0, 200));
  if ((await j(`/api/articles/${articleSlug}`)).status !== 404) throw new Error("ko'rib chiqilayotgan ochiq");
  const editLocked = await send("PUT", `/api/admin/articles/${articleId}`, { title: "O'zgartirildi", content: LONG_CONTENT }, staffAuthorToken);
  if (editLocked.status !== 403) throw new Error("muallif ko'rib chiqilayotganni tahrirladi: " + editLocked.status);
  const authorPublish = await post(`/api/admin/articles/${articleId}/publish`, {}, staffAuthorToken);
  if (authorPublish.status !== 403) throw new Error("muallif publish: " + authorPublish.status);

  const returned = await post(`/api/admin/articles/${articleId}/return`, { note: "Misollar qo'shing" }, staffEditorToken);
  if (returned.body.status !== "draft" || returned.body.reviewNote !== "Misollar qo'shing") throw new Error("qaytarish: " + JSON.stringify(returned.body).slice(0, 200));
  await post(`/api/admin/articles/${articleId}/submit`, {}, staffAuthorToken);
  const published = await post(`/api/admin/articles/${articleId}/publish`, {}, staffEditorToken);
  if (published.body.status !== "published" || !published.body.publishedAt || published.body.reviewNote !== null) throw new Error("chop etish: " + JSON.stringify(published.body).slice(0, 200));

  const detail = await j(`/api/articles/${articleSlug}`);
  if (detail.status !== 200 || detail.body.article.author?.name !== "Jasur Qodirov") throw new Error("ochiq detail: " + JSON.stringify(detail.body).slice(0, 200));
  if (JSON.stringify(detail.body).includes("muallif@test.uz") || "status" in detail.body.article) throw new Error("ichki maydon ochiq javobda");
  const authorEditPublished = await send("PUT", `/api/admin/articles/${articleId}`, { title: "O'zgartirildi", content: LONG_CONTENT }, staffAuthorToken);
  if (authorEditPublished.status !== 403) throw new Error("muallif chop etilganni tahrirladi: " + authorEditPublished.status);
  const own = await j("/api/admin/articles", authGet(staffAuthorToken));
  if (own.body.total !== 1 || own.body.items.some((a) => a.author?.id !== staffAuthorId)) throw new Error("muallif ro'yxati: " + own.body.total);
});

await check("ochiq ro'yxat: featured + sahifalash (takrorsiz), saralash, qidiruv (sarlavha/teg/kategoriya), kategoriya sonlari, bo'sh maydonlar null", async () => {
  const make = (title, extra) => post("/api/admin/articles", { title, content: LONG_CONTENT, intent: "publish", ...extra }, staffEditorToken);
  const interview = await make("Intervyu savollari va javoblari", { category: "interview", tags: ["Suhbat"] });
  const salary = await make("Maosh bo'yicha kelishuv sirlari", { category: "salary", tags: ["Muzokara"] });
  const plain = await make("Kategoriyasiz eslatma", {});
  const resume2 = await make("Rezyume uchun kalit so'zlar", { category: "resume", tags: ["Rezyume"] });
  for (const r of [interview, salary, plain, resume2]) if (r.status !== 201) throw new Error("yaratish: " + r.status + " " + JSON.stringify(r.body).slice(0, 200));
  if (plain.body.category !== null || plain.body.excerpt !== null || plain.body.coverImageUrl !== null || plain.body.tags.length !== 0) throw new Error("bo'sh maydonlar null emas");

  const first = (await j("/api/articles?featured=1&pageSize=2")).body;
  if (first.total !== 5 || !first.featured || first.items.length !== 2 || first.pageCount !== 2 || first.publishedTotal !== 5) {
    throw new Error("1-sahifa: " + JSON.stringify({ total: first.total, items: first.items.length, pageCount: first.pageCount }));
  }
  const second = (await j("/api/articles?featured=1&pageSize=2&page=2")).body;
  const seen = new Set([first.featured.id, ...first.items.map((a) => a.id), ...second.items.map((a) => a.id)]);
  if (second.items.length !== 2 || seen.size !== 5) throw new Error("sahifalash takror/yo'qolgan: " + seen.size);
  if (first.featured.slug !== resume2.body.slug) throw new Error("featured eng yangi emas: " + first.featured.slug);
  const oldest = (await j("/api/articles?sort=oldest")).body;
  if (oldest.items[0].slug !== articleSlug) throw new Error("eng eski: " + oldest.items[0].slug);

  if ((await j("/api/articles?q=muzokara")).body.total !== 1) throw new Error("teg bo'yicha qidiruv");
  const byCategoryWord = (await j(`/api/articles?q=${encodeURIComponent("собеседование")}`)).body;
  if (byCategoryWord.total !== 1 || byCategoryWord.items[0].category !== "interview") throw new Error("kategoriya nomi bo'yicha qidiruv: " + byCategoryWord.total);
  const byTitle = (await j(`/api/articles?q=${encodeURIComponent("kalit so'zlar")}`)).body;
  if (byTitle.total !== 1) throw new Error("sarlavha bo'yicha qidiruv: " + byTitle.total);
  if ((await j("/api/articles?category=salary")).body.total !== 1) throw new Error("kategoriya filtri");
  const resumeCount = first.categories.find((c) => c.key === "resume")?.count;
  if (resumeCount !== 2 || first.categories.some((c) => c.count === 0)) throw new Error("kategoriya sonlari: " + JSON.stringify(first.categories));
  if ((await j("/api/articles?category=hacker")).status !== 400) throw new Error("noto'g'ri kategoriya");

  const related = (await j(`/api/articles/${resume2.body.slug}`)).body.related;
  if (related.length !== 1 || related[0].slug !== articleSlug) throw new Error("mavzuga oid: " + JSON.stringify(related.map((r) => r.slug)));
  const noRelated = (await j(`/api/articles/${plain.body.slug}`)).body.related;
  if (noRelated.length !== 0) throw new Error("kategoriyasiz/tegsiz maqolaga mavzuga oid chiqdi");

  // Maqolani o'qish hisoblagichni oshirmaydi; ko'rish alohida signal bilan keladi (audit: views-1).
  // Uch xil "ko'ruvchi" — uch xil User-Agent, aks holda takror filtri ikkinchisidan boshlab to'xtatadi.
  await j(`/api/articles/${salary.body.slug}`);
  await flushWait();
  if ((await j(`/api/admin/articles/${salary.body.id}`, authGet(staffEditorToken))).body.stats.views !== 0) throw new Error("maqolani o'qish hisoblagichni oshirdi");
  for (const ua of [BROWSER_UA, OTHER_UA, `${BROWSER_UA} Edition/3`]) {
    if ((await view(`/api/articles/${salary.body.slug}/view`, ua)).body.counted !== true) throw new Error("maqola ko'rishi sanalmadi");
  }
  if ((await view(`/api/articles/${salary.body.slug}/view`, BROWSER_UA)).body.counted !== false) throw new Error("maqolada takroriy ko'rish sanaldi");
  await flushWait();
  const popular = (await j("/api/articles?sort=popular")).body;
  if (popular.items[0].slug !== salary.body.slug) throw new Error("mashhur: " + popular.items[0].slug);
  const salaryAdmin = (await j(`/api/admin/articles/${salary.body.id}`, authGet(staffEditorToken))).body;
  if (salaryAdmin.stats.views !== 3 || salaryAdmin.updatedAt !== salary.body.updatedAt) throw new Error("ko'rishlar updatedAt'ni o'zgartirmasin: " + JSON.stringify(salaryAdmin.stats));
});

await check("slug: o'zgarsa eski havola yo'naltiriladi, band (eski ham) — 409, noto'g'ri — 400, avto slug takrorlanmaydi; sitemap faqat chop etilgan", async () => {
  const current = (await j(`/api/admin/articles/${articleId}`, authGet(staffEditorToken))).body;
  const updated = await send(
    "PUT",
    `/api/admin/articles/${articleId}`,
    { title: current.title, slug: "rezyume-test-2026", content: current.content, excerpt: current.excerpt, category: current.category, tags: current.tags },
    staffEditorToken
  );
  if (updated.status !== 200 || updated.body.slug !== "rezyume-test-2026" || !updated.body.previousSlugs.includes(articleSlug)) throw new Error("slug yangilash: " + JSON.stringify(updated.body).slice(0, 200));
  const old = await j(`/api/articles/${articleSlug}`);
  if (old.status !== 200 || old.body.redirectTo !== "rezyume-test-2026") throw new Error("eski slug: " + JSON.stringify(old.body).slice(0, 120));
  if ((await post("/api/admin/articles", { title: "Boshqa maqola", slug: articleSlug, content: LONG_CONTENT }, staffEditorToken)).status !== 409) throw new Error("eski slug band emas");
  if ((await post("/api/admin/articles", { title: "Boshqa maqola", slug: "Katta Harf!", content: LONG_CONTENT }, staffEditorToken)).status !== 400) throw new Error("noto'g'ri slug");
  const auto = await post("/api/admin/articles", { title: "Intervyu savollari va javoblari", content: LONG_CONTENT }, staffEditorToken);
  if (auto.status !== 201 || auto.body.slug !== "intervyu-savollari-va-javoblari-2" || auto.body.status !== "draft") throw new Error("avto slug: " + auto.body.slug);
  articleSlug = "rezyume-test-2026";
  const sitemap = (await j("/sitemap-articles.xml")).body;
  if (!sitemap.includes("https://sayt.example/articles/rezyume-test-2026") || sitemap.includes(auto.body.slug)) throw new Error("sitemap: " + sitemap.slice(0, 300));
  const index = (await j("/sitemap.xml")).body;
  if (!index.includes("sitemap-articles.xml")) throw new Error("sitemap indeksi");
});

await check("holatlar: foydali ovoz, chop etishdan olish/arxiv → ochiq 404, tiklash; o'chirish faqat admin; qidiruv muallif bo'yicha", async () => {
  const vote = (helpful, ua) =>
    j(`/api/articles/${articleSlug}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": ua },
      body: JSON.stringify({ helpful }),
    });
  const firstVote = await vote(true, BROWSER_UA);
  if (firstVote.status !== 200 || firstVote.body.counted !== true) throw new Error("ovoz: " + JSON.stringify(firstVote.body));
  // Bitta ovoz beruvchidan faqat BIR marta (audit: views-2) — ilgari bir odam istagancha ovoz bera olardi
  for (let i = 0; i < 3; i++) {
    const repeat = await vote(true, BROWSER_UA);
    if (repeat.status !== 200 || repeat.body.counted !== false) throw new Error("takroriy ovoz sanaldi: " + JSON.stringify(repeat.body));
  }
  await flushWait();
  if ((await j(`/api/admin/articles/${articleId}`, authGet(staffEditorToken))).body.stats.helpfulYes !== 1) throw new Error("ovoz saqlanmadi");
  const byAuthor = (await j(`/api/admin/articles?q=${encodeURIComponent("Dilnoza")}`, authGet(adminToken))).body;
  if (byAuthor.total !== 5) throw new Error("muallif bo'yicha qidiruv: " + byAuthor.total);
  const byTitle = (await j(`/api/admin/articles?q=${encodeURIComponent("rezyume bo'yicha")}&status=published`, authGet(adminToken))).body;
  if (byTitle.total !== 1 || byTitle.counts.published < 1) throw new Error("sarlavha + holat: " + JSON.stringify(byTitle).slice(0, 200));

  const unpublished = await post(`/api/admin/articles/${articleId}/unpublish`, {}, staffEditorToken);
  if (unpublished.body.status !== "draft" || (await j(`/api/articles/${articleSlug}`)).status !== 404) throw new Error("chop etishdan olish");
  if ((await vote(false, OTHER_UA)).status !== 404) throw new Error("qoralamaga ovoz");
  const archived = await post(`/api/admin/articles/${articleId}/archive`, {}, staffEditorToken);
  if (archived.body.status !== "archived" || (await j(`/api/articles/${articleSlug}`)).status !== 404) throw new Error("arxiv");
  const restored = await post(`/api/admin/articles/${articleId}/restore`, {}, staffEditorToken);
  if (restored.body.status !== "draft") throw new Error("tiklash");

  for (const [who, token] of [["muharrir", staffEditorToken], ["muallif", staffAuthorToken]]) {
    const r = await j(`/api/admin/articles/${articleId}`, { method: "DELETE", headers: authH(token) });
    if (r.status !== 403) throw new Error(`${who} o'chirdi: ${r.status}`);
  }
  const deleted = await j(`/api/admin/articles/${articleId}`, { method: "DELETE", headers: authH(adminToken) });
  if (deleted.status !== 200 || (await j(`/api/admin/articles/${articleId}`, authGet(adminToken))).status !== 404) throw new Error("admin o'chirish: " + deleted.status);
});

await check("[PHASE6-V4] muallif o'z qoralamasiga chop etilgan maqola muqovasini qo'yib, keyin olib tashlasa — umumiy muqova fayli o'chmaydi", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "umumiy-muqova.png");
  const uploaded = await fetch(`${BASE}/api/admin/articles/cover`, { method: "POST", headers: authH(staffEditorToken), body: form });
  const cover = (await uploaded.json().catch(() => null))?.url;
  if (uploaded.status !== 201 || !cover) throw new Error("muqova yuklash: " + uploaded.status);
  const fileStatus = async () => {
    const res = await fetch(`${BASE}${cover}`);
    await res.arrayBuffer().catch(() => undefined);
    return res.status;
  };
  try {
    const published = await post("/api/admin/articles", { title: "Umumiy muqovali chop etilgan maqola", content: LONG_CONTENT, coverImageUrl: cover, intent: "publish" }, staffEditorToken);
    if (published.status !== 201 || published.body.status !== "published" || published.body.coverImageUrl !== cover) {
      throw new Error("chop etilgan maqola: " + published.status + " " + JSON.stringify(published.body).slice(0, 200));
    }
    if ((await fileStatus()) !== 200) throw new Error("muqova fayli ochilmadi");

    const draft = await post("/api/admin/articles", { title: "Muallif qoralamasi umumiy muqova bilan", content: LONG_CONTENT }, staffAuthorToken);
    if (draft.status !== 201 || draft.body.status !== "draft") throw new Error("qoralama: " + draft.status + " " + JSON.stringify(draft.body).slice(0, 200));
    const edit = (coverImageUrl) => send("PUT", `/api/admin/articles/${draft.body.id}`, { title: draft.body.title, content: LONG_CONTENT, coverImageUrl }, staffAuthorToken);
    const withCover = await edit(cover);
    if (withCover.status !== 200 || withCover.body.coverImageUrl !== cover) throw new Error("muqovani qo'yish: " + withCover.status + " " + JSON.stringify(withCover.body).slice(0, 200));
    const cleared = await edit(null);
    if (cleared.status !== 200 || cleared.body.coverImageUrl !== null) throw new Error("muqovani olib tashlash: " + cleared.status + " " + JSON.stringify(cleared.body).slice(0, 200));

    // Fayl fonda o'chiriladi — biroz kutib tekshiramiz
    await sleep(400);
    const status = await fileStatus();
    if (status !== 200) throw new Error("chop etilgan maqola muqovasi o'chib ketdi: " + status);
  } finally {
    const { unlinkSync } = await import("node:fs");
    try { unlinkSync(new URL(`../uploads/${cover.split("/").pop()}`, import.meta.url)); } catch {}
  }
});

await check("jamoa: faolsizlantirish va rol o'zgarishi DARHOL kuchga kiradi (eski token bekor, qayta kirishda yangi rol); muqova yuklash turi tekshiriladi", async () => {
  const blocked = await send("PATCH", `/api/admin/team/${staffAuthorId}`, { isBlocked: true }, adminToken);
  if (blocked.status !== 200 || !blocked.body.isBlocked) throw new Error("bloklash: " + blocked.status);
  if ((await j("/api/admin/articles", authGet(staffAuthorToken))).status !== 403) throw new Error("bloklangan muallif kirdi");
  if ((await post("/api/auth/login", { email: "muallif@test.uz", password: "parol12345" })).status !== 403) throw new Error("bloklangan login");
  await send("PATCH", `/api/admin/team/${staffAuthorId}`, { isBlocked: false }, adminToken);
  // Faolsizlantirish tokenVersion'ni oshiradi: blok yechilgach ham eski access token qaytmaydi — 401 (audit PHASE 6, V5).
  // Login alohida X-Forwarded-For bilan: IP bo'yicha qattiq login limiti boshqa tekshiruvlarga ta'sir qilmasin.
  let loginSeq = 0;
  const staffLogin = async () => {
    const res = await j("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.66.0.${++loginSeq}` },
      body: JSON.stringify({ email: "muallif@test.uz", password: "parol12345" }),
    });
    if (res.status !== 200 || !res.body.accessToken) throw new Error("muallif qayta kira olmadi: " + res.status);
    return res.body.accessToken;
  };
  if ((await j("/api/admin/articles/authors", authGet(staffAuthorToken))).status !== 401) throw new Error("faolsizlantirilgan seansning eski tokeni qayta ishladi");
  let authorToken = await staffLogin();
  if ((await j("/api/admin/articles/authors", authGet(authorToken))).status !== 403) throw new Error("muallif mualliflar ro'yxatini ko'rdi");
  const promoted = await send("PATCH", `/api/admin/team/${staffAuthorId}`, { role: "content_editor", fullName: "Jasur Qodirov", position: "Muharrir" }, adminToken);
  if (promoted.body.role !== "content_editor" || promoted.body.position !== "Muharrir") throw new Error("rol: " + JSON.stringify(promoted.body));
  // Rol o'zgarishi ham eski tokenni bekor qiladi; qayta kirilgach yangi rol darhol ishlaydi (audit PHASE 6, V5)
  if ((await j("/api/admin/articles/authors", authGet(authorToken))).status !== 401) throw new Error("rol o'zgargach eski token ishladi");
  authorToken = await staffLogin();
  if ((await j("/api/admin/articles/authors", authGet(authorToken))).status !== 200) throw new Error("yangi rol darhol ishlamadi");

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const upload = async (token, blob, name) => {
    const form = new FormData();
    form.append("file", blob, name);
    const res = await fetch(`${BASE}/api/admin/articles/cover`, { method: "POST", headers: token ? authH(token) : {}, body: form });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const ok = await upload(staffEditorToken, new Blob([png], { type: "image/png" }), "muqova.png");
  if (ok.status !== 201 || !/^\/uploads\/article-cover-[\w-]+\.png$/.test(ok.body.url)) throw new Error("yuklash: " + JSON.stringify(ok));
  const svg = await upload(staffEditorToken, new Blob(["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"], { type: "image/svg+xml" }), "x.svg");
  if (svg.status !== 400) throw new Error("svg qabul qilindi: " + svg.status);
  if ((await upload(null, new Blob([png], { type: "image/png" }), "a.png")).status !== 401) throw new Error("mehmon yukladi");
  if ((await upload(seekerToken, new Blob([png], { type: "image/png" }), "a.png")).status !== 403) throw new Error("nomzod yukladi");
  const { unlinkSync } = await import("node:fs");
  try { unlinkSync(new URL(`../uploads/${ok.body.url.split("/").pop()}`, import.meta.url)); } catch {}
});

await check("yordam/aloqa: faqat sozlangan kanallar, server validatsiyasi, xabar murojaatlar qutisiga yoziladi, honeypot", async () => {
  const c = await j("/api/support/contacts");
  if (c.status !== 200) throw new Error("contacts: " + c.status);
  const b = c.body;
  // Telefon noto'g'ri formatda berilgan — ko'rsatilmaydi; bot tokeni yo'q — Telegram yo'q
  if (b.channels?.email !== "yordam@sayt.example" || b.channels.phone !== null || b.channels.telegram !== null || b.channels.address !== null) {
    throw new Error("kanallar: " + JSON.stringify(b.channels));
  }
  if (b.hours !== "Du–Ju, 09:00–18:00" || b.responseHours !== null) throw new Error("ish vaqti/muddat: " + JSON.stringify(b));
  // Forma har doim ishlaydi: xabar bazadagi murojaatlar qutisiga tushadi (Telegram — qo'shimcha kanal)
  if (b.form?.enabled !== true || !b.form.subjects?.includes("partnership")) throw new Error("forma: " + JSON.stringify(b.form));
  if (b.partnership?.email !== null || b.partnership?.viaForm !== true) throw new Error("hamkorlik (forma orqali): " + JSON.stringify(b.partnership));

  const badEmail = await post("/api/support", { name: "Ali", email: "ali@", subject: "general", message: "Salom, yordam kerak" });
  if (badEmail.status !== 400) throw new Error("noto'g'ri email: " + badEmail.status);
  const blank = await post("/api/support", { name: "Ali", email: "ali@test.uz", message: "   a  " });
  if (blank.status !== 400) throw new Error("bo'sh xabar: " + blank.status);
  const badSubject = await post("/api/support", { email: "ali@test.uz", subject: "spam", message: "Salom, yordam kerak" });
  if (badSubject.status !== 400) throw new Error("noto'g'ri mavzu: " + badSubject.status);
  // Telegram sozlanmagan — xabar baribir yo'qolmaydi, murojaatlar qutisiga yoziladi
  const stored = await post("/api/support", { name: "Ali", email: "", subject: "technical", message: "Sayt <b>ochilmayapti</b>" });
  if (stored.status !== 200 || stored.body.ok !== true) throw new Error("saqlash: " + stored.status + " " + JSON.stringify(stored.body));
  const ticket = await prisma.supportTicket.findFirst({ where: { kind: "contact", subject: "technical" }, orderBy: { createdAt: "desc" } });
  if (!ticket || ticket.status !== "open" || !ticket.message.includes("ochilmayapti")) throw new Error("murojaat bazada yo'q: " + JSON.stringify(ticket));
  const bot = await post("/api/support", { name: "Bot", email: "bot@test.uz", message: "Reklama xabari", website: "https://spam.example" });
  if (bot.status !== 200 || bot.body.ok !== true) throw new Error("honeypot: " + bot.status);
  if (await prisma.supportTicket.findFirst({ where: { email: "bot@test.uz" } })) throw new Error("honeypot xabari bazaga yozildi");
});

// ===================== AUDIT: xavfsizlik va miqyos regressiyasi =====================
// Har tekshiruv docs/audit/ISSUES.md dagi ID ga bog'langan. Login/ro'yxatdan o'tish so'rovlari
// alohida X-Forwarded-For bilan yuboriladi — IP bo'yicha qattiq limit (10/min) boshqa tekshiruvlarga ta'sir qilmasin.
let ipSeq = 0;
const nextIp = () => `10.77.${Math.floor(++ipSeq / 250)}.${(ipSeq % 250) + 1}`;
const postFresh = (path, data) =>
  j(path, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": nextIp() }, body: JSON.stringify(data ?? {}) });
const put = (path, data, token) => j(path, { method: "PUT", headers: { "content-type": "application/json", ...authH(token) }, body: JSON.stringify(data ?? {}) });
const patch = (path, data, token) => j(path, { method: "PATCH", headers: { "content-type": "application/json", ...authH(token) }, body: JSON.stringify(data ?? {}) });
const del = (path, token) => j(path, { method: "DELETE", headers: authH(token) });
const loginAs = async (email, password = "parol12345") => (await postFresh("/api/auth/login", { email, password })).body.accessToken;

// WebSocket yordamchilari. Ulanishda ishlatilgan access tokenlar yig'iladi — oxirida ular server
// logida uchramasligi tekshiriladi (audit PHASE 6, U34)
const wsTokens = new Set();
const wsOpen = async (token) => {
  const { default: WebSocket } = await import("ws");
  wsTokens.add(token);
  return new Promise((resolve, reject) => {
    const s = new WebSocket(`ws://127.0.0.1:${PORT}/ws/chat?token=${encodeURIComponent(token)}`);
    s.once("open", () => resolve(s));
    s.once("error", reject);
  });
};
const wsNextMessage = (ws, predicate, timeoutMs = 5000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("xabar kelmadi"));
    }, timeoutMs);
    function onMessage(raw) {
      let data;
      try { data = JSON.parse(String(raw)); } catch { return; }
      if (data?.type !== "message" || !predicate(data)) return;
      clearTimeout(timer);
      ws.off("message", onMessage);
      resolve(data);
    }
    ws.on("message", onMessage);
  });

const hr2Token = await loginAs("hr2@test.uz");
const seeker2Token = await loginAs("seeker2@test.uz");
await prisma.user.updateMany({ where: {}, data: { isPhoneVerified: true } });
const cats = (await j("/api/categories")).body.items;
const regions = (await j("/api/regions")).body.items;
const newVacancy = (extra = {}) => post("/api/vacancies", {
  title: "Audit vakansiya", description: "Audit uchun tavsif matni", employmentType: "full_time",
  categoryId: cats[0].id, regionId: regions[0].id, workplaceType: "office", ...extra,
}, employerToken);

await check("[ISSUE-001] [PHASE6-U34] ariza ro'yxati nomzod parol hashini va ichki maydonlarni qaytarmaydi (aniq kalitlar ro'yxati)", async () => {
  // applications.routes.ts dagi select bilan aynan bir xil (audit PHASE 6, U34): select'ga yangi maydon
  // qo'shilsa bu ro'yxat ongli ravishda yangilanadi — "qora ro'yxat" yangi sizib chiqishni ushlamasdi
  const SEEKER_KEYS = ["email", "id", "jobSeekerProfile", "phone"];
  // `resumeUrl` ro'yxatdan olib tashlandi (audit R3, D-058): fayl manzili o'rniga `hasResumeFile`
  const PROFILE_KEYS = ["avatarUrl", "firstName", "headline", "isOpenToWork", "lastName", "region"];
  const res = await j(`/api/vacancies/${vacancyId}/applications`, { headers: authH(employerToken) });
  if (res.status !== 200 || !Array.isArray(res.body) || res.body.length === 0) throw new Error(res.status + " " + JSON.stringify(res.body).slice(0, 200));
  if (JSON.stringify(res.body).includes("/uploads/")) throw new Error("ish beruvchi javobida fayl manzili bor (D-058)");
  for (const item of res.body) {
    if (typeof item.hasResumeFile !== "boolean") throw new Error("hasResumeFile bayrog'i yo'q (D-058)");
    if ("resumeUrl" in (item.jobSeeker?.jobSeekerProfile ?? {})) throw new Error("profil.resumeUrl oqib chiqdi (D-058)");
    for (const key of ["passwordHash", "telegramChatId", "isBlocked", "role", "tokenVersion"]) {
      if (key in (item.jobSeeker ?? {})) throw new Error("jobSeeker." + key + " oqib chiqdi");
    }
    for (const key of ["birthDate", "gender", "additionalPhone"]) {
      if (key in (item.jobSeeker?.jobSeekerProfile ?? {})) throw new Error("profil." + key + " oqib chiqdi");
    }
    const seekerKeys = Object.keys(item.jobSeeker ?? {}).sort();
    if (JSON.stringify(seekerKeys) !== JSON.stringify(SEEKER_KEYS)) throw new Error("jobSeeker kalitlari: " + seekerKeys.join(","));
    if (!item.jobSeeker.jobSeekerProfile) throw new Error("jobSeekerProfile yo'q — kalitlarni tekshirib bo'lmadi");
    const profileKeys = Object.keys(item.jobSeeker.jobSeekerProfile).sort();
    if (JSON.stringify(profileKeys) !== JSON.stringify(PROFILE_KEYS)) throw new Error("jobSeekerProfile kalitlari: " + profileKeys.join(","));
  }
});

await check("[ISSUE-002] SVG logo rad etiladi; PNG nomli HTML rad etiladi; /uploads/ rasmlari sandbox CSP + nosniff bilan beriladi", async () => {
  const upload = async (blob, name) => {
    const form = new FormData();
    form.append("file", blob, name);
    const res = await fetch(`${BASE}/api/employer/company/logo`, { method: "POST", headers: authH(employerToken), body: form });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const svg = await upload(new Blob(["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"], { type: "image/svg+xml" }), "logo.svg");
  if (svg.status !== 400) throw new Error("svg qabul qilindi: " + svg.status);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAMAASsJTYQAAAAASUVORK5CYII=", "base64");
  const ok = await upload(new Blob([png], { type: "image/png" }), "logo.png");
  if (ok.status !== 200 || !/^\/uploads\/company-logo-[0-9a-f]{32}\.png$/.test(ok.body?.logoUrl ?? "")) throw new Error("png: " + ok.status + " " + JSON.stringify(ok.body));
  const served = await fetch(`${BASE}${ok.body.logoUrl}`);
  const csp = served.headers.get("content-security-policy") ?? "";
  if (served.status !== 200 || !/sandbox/.test(csp) || served.headers.get("x-content-type-options") !== "nosniff") {
    throw new Error("uploads sarlavhalari: " + served.status + " csp=" + csp);
  }
  const fake = await upload(new Blob(["<html><script>alert(1)</script></html>"], { type: "image/png" }), "x.png");
  if (fake.status !== 400) throw new Error("PNG nomli HTML qabul qilindi: " + fake.status);
  await del("/api/employer/company/logo", employerToken);
  await sleep(200);
  if ((await fetch(`${BASE}${ok.body.logoUrl}`)).status !== 404) throw new Error("o'chirilgan logo fayli hali ochiq");
});

await check("[ISSUE-003/040] [PHASE6-U8] WebSocket: noto'g'ri conversationId, obyekt tana va katta frame serverni yiqitmaydi, logda xato qolmaydi, yangi ulanishda xabar yetadi", async () => {
  const { default: WebSocket } = await import("ws");
  // Faqat shu tekshiruv davomidagi log bo'lagi ko'riladi (audit PHASE 6, U8)
  const logStart = log.length;
  const ws = await wsOpen(employerToken);
  ws.send(JSON.stringify({ type: "message", conversationId: "not-an-object-id", body: "salom" }));
  ws.send(JSON.stringify({ type: "read", conversationId: "zzz" }));
  ws.send(JSON.stringify({ type: "message", conversationId: "0123456789abcdef01234567", body: { a: 1 } }));
  ws.send("{buzilgan json");
  const closed = new Promise((resolve) => ws.once("close", (code) => resolve(code)));
  ws.send("x".repeat(200 * 1024));
  const code = await Promise.race([closed, sleep(4000).then(() => "timeout")]);
  if (code !== 1009) throw new Error("katta frame yopilmadi: " + code);
  await sleep(300);
  const health = await j("/health");
  if (health.status !== 200) throw new Error("server yiqildi: " + health.status);
  const bad = await new Promise((resolve) => {
    const s = new WebSocket(`ws://127.0.0.1:${PORT}/ws/chat?token=yaroqsiz`);
    s.once("close", (c) => resolve(c));
    s.once("error", () => undefined);
  });
  if (bad !== 4401) throw new Error("yaroqsiz token yopilish kodi: " + bad);

  // Ilgari tekshiruv faqat /health'ga qarardi (audit PHASE 6, U8): buzilgan xabarlar jim e'tiborsiz
  // qolishi — tutilmagan promise yoki handler xatosi sifatida logga tushmasligi kerak
  await sleep(300);
  const since = log.slice(logStart);
  for (const marker of ["Tutilmagan promise xatosi", "WS xabarini qayta ishlab bo'lmadi"]) {
    if (since.includes(marker)) throw new Error("server logida: " + marker);
  }

  // Server ishlashda davom etadi: yangi ulanishda mavjud suhbatga yuborilgan oddiy xabar yetib boradi
  const conv = (await j("/api/conversations", { headers: authH(seekerToken) })).body.items?.[0];
  if (!conv?.id) throw new Error("mavjud suhbat topilmadi");
  const [seekerWs, employerWs] = await Promise.all([wsOpen(seekerToken), wsOpen(employerToken)]);
  try {
    // Ikkala ulanish serverda ro'yxatga olinishi uchun
    await sleep(300);
    const text = `U8 tekshiruv xabari ${Date.now()}`;
    const delivered = wsNextMessage(seekerWs, (d) => d.message?.conversationId === conv.id && d.message?.body === text);
    employerWs.send(JSON.stringify({ type: "message", conversationId: conv.id, body: text }));
    await delivered;
  } finally {
    seekerWs.close();
    employerWs.close();
  }
});

await check("[ISSUE-004] CORS: begona *.vercel.app sayti credentials bilan ruxsat olmaydi (preflight)", async () => {
  for (const origin of ["https://evil-abc.vercel.app", "https://ishbor-evil.vercel.app"]) {
    const res = await fetch(`${BASE}/api/auth/refresh`, { method: "OPTIONS", headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type" } });
    if (res.headers.get("access-control-allow-origin")) throw new Error("ruxsat berildi: " + origin);
  }
});

await check("[ISSUE-009] JWT: algoritm qat'iy (HS512 rad), refresh turidagi token access sifatida o'tmaydi", async () => {
  const jwt = (await import("jsonwebtoken")).default;
  const me = await j("/api/auth/me", { headers: authH(employerToken) });
  const userId = me.body.id ?? me.body.user?.id;
  if (!userId) throw new Error("/me javobida id yo'q: " + JSON.stringify(me.body).slice(0, 200));
  const forged = jwt.sign({ sub: userId, role: "admin" }, env.JWT_ACCESS_SECRET, { algorithm: "HS512", expiresIn: "5m" });
  if ((await j("/api/auth/me", { headers: authH(forged) })).status !== 401) throw new Error("HS512 token qabul qilindi");
  const refreshAsAccess = jwt.sign({ sub: userId, role: "employer", typ: "refresh" }, env.JWT_ACCESS_SECRET, { algorithm: "HS256", expiresIn: "5m" });
  if ((await j("/api/auth/me", { headers: authH(refreshAsAccess) })).status !== 401) throw new Error("typ=refresh access sifatida o'tdi");
});

await check("[ISSUE-006] ariza: boshqa nomzodning rezyumesini biriktirib bo'lmaydi", async () => {
  const mine = (await j("/api/applications", { headers: authH(seekerToken) })).body;
  const foreignResumeId = mine[0]?.resume?.id;
  if (!foreignResumeId) throw new Error("rezyume id topilmadi");
  const vac = await newVacancy({ title: "IDOR rezyume" });
  const r = await post(`/api/vacancies/${vac.body.id}/apply`, { resumeId: foreignResumeId }, seeker2Token);
  if (r.status !== 400 && r.status !== 404) throw new Error("begona rezyume qabul qilindi: " + r.status);
  const apps = await prisma.application.count({ where: { vacancyId: vac.body.id } });
  if (apps !== 0) throw new Error("ariza yaratildi");
});

await check("[ISSUE-007/008] nomzodlar bazasi bepul (200); aloqa ma'lumoti faqat shu kompaniyaga ariza yuborganlarda", async () => {
  await put("/api/resume", { title: "Tester", skills: ["QA"], experience: [], education: [] }, seeker2Token);
  const own = await j("/api/candidates", { headers: authH(employerToken) });
  if (own.status !== 200 || !Array.isArray(own.body.items)) throw new Error("status " + own.status + " " + JSON.stringify(own.body));
  const applicant = own.body.items.find((c) => c.firstName === "Aziz");
  const stranger = own.body.items.find((c) => c.firstName === "Boshqa");
  if (!applicant?.email) throw new Error("ariza yuborgan nomzod emaili yo'q");
  if (!stranger) throw new Error("ish qidirayotgan ikkinchi nomzod ro'yxatda yo'q");
  if (stranger.email || stranger.phone) throw new Error("ariza yubormagan nomzod aloqa ma'lumoti chiqdi");
  const foreign = await j("/api/candidates", { headers: authH(hr2Token) });
  if (foreign.status !== 200 || foreign.body.items.some((c) => c.email || c.phone)) throw new Error("begona ish beruvchi aloqa ma'lumotini ko'rdi");
  if ((await j("/api/candidates?region=zzz", { headers: authH(employerToken) })).status !== 400) throw new Error("noto'g'ri region 400 emas");
});

await check("[ISSUE-031] noto'g'ri ObjectId 500 emas (400/404)", async () => {
  const cases = [
    ["GET", `/api/vacancies/zzz/applications`, employerToken],
    ["PATCH", `/api/vacancies/zzz/status`, employerToken, { status: "archived" }],
    ["PUT", `/api/vacancies/zzz`, employerToken, { title: "abcd" }],
    ["DELETE", `/api/vacancies/zzz`, employerToken],
    ["PATCH", `/api/applications/zzz/status`, employerToken, { status: "viewed" }],
    ["POST", `/api/vacancies/zzz/apply`, seekerToken],
    ["POST", `/api/favorites/zzz`, seekerToken],
    ["DELETE", `/api/favorites/zzz`, seekerToken],
    ["POST", `/api/notifications/zzz/read`, seekerToken],
    ["DELETE", `/api/notifications/zzz`, seekerToken],
    ["DELETE", `/api/reviews/zzz`, seekerToken],
    ["PATCH", `/api/saved-searches/zzz`, seekerToken, { name: "x" }],
    ["GET", `/api/conversations/zzz/messages`, seekerToken],
    ["GET", `/api/conversations/zzz/rating`, seekerToken],
    ["GET", `/api/users/zzz/summary`, seekerToken],
    ["PATCH", `/api/admin/users/zzz/block`, adminToken, { isBlocked: true }],
    ["PATCH", `/api/admin/vacancies/zzz/moderate`, adminToken, { status: "active" }],
  ];
  for (const [method, path, token, body] of cases) {
    const res = method === "GET" ? await j(path, { headers: authH(token) }) : await j(path, { method, headers: { "content-type": "application/json", ...authH(token) }, body: JSON.stringify(body ?? {}) });
    if (res.status >= 500) throw new Error(`${method} ${path} -> ${res.status}`);
  }
});

await check("[ISSUE-032/033] ochiq API: kompaniya ichki maydonlari va yashirilgan maosh chiqmaydi (ish beruvchining o'zida qoladi)", async () => {
  const INTERNAL = ["ownerUserId", "stir", "legalName", "subscriptionPlanId", "subscriptionExpiresAt", "industryId"];
  const hidden = await newVacancy({ title: "Yashirin maosh", salaryMin: 7000000, salaryMax: 9000000, isSalaryHidden: true });
  const list = (await j("/api/vacancies?pageSize=50")).body.items;
  const detail = (await j(`/api/vacancies/${hidden.body.slug}`)).body;
  const company = (await j(`/api/companies/${detail.company.slug}`)).body;
  for (const [name, obj] of [["list", list[0].company], ["detail", detail.company], ["companies/:slug", company]]) {
    for (const key of INTERNAL) if (key in obj) throw new Error(`${name}: ${key}`);
  }
  if ("description" in list[0] || "conditions" in list[0]) throw new Error("ro'yxat kartasida to'liq matn");
  const inList = list.find((v) => v.id === hidden.body.id);
  if (!inList || inList.salaryMin !== null || inList.salaryMax !== null || detail.salaryMin !== null) throw new Error("yashirin maosh ochiq: " + JSON.stringify({ l: inList?.salaryMin, d: detail.salaryMin }));
  const inCompany = company.vacancies.find((v) => v.id === hidden.body.id);
  if (!inCompany || inCompany.salaryMin !== null) throw new Error("kompaniya sahifasida yashirin maosh: " + inCompany?.salaryMin);
  if (typeof company.reviewSummary?.count !== "number" || typeof company._count?.vacancies !== "number") throw new Error("reviewSummary/_count yo'q");
  const own = (await j("/api/employer/vacancies", { headers: authH(employerToken) })).body.items.find((v) => v.id === hidden.body.id);
  if (own?.salaryMin !== 7000000) throw new Error("ish beruvchi o'z maoshini ko'rmadi");
});

await check("[ISSUE-033] maosh bo'yicha saralash: maoshi yozilmagan va yashirin e'lonlar tushib qolmaydi, yashirin raqam filtr orqali topilmaydi", async () => {
  const unset = await newVacancy({ title: "Maoshi yozilmagan eski e'lon" });
  await prisma.$runCommandRaw({ update: "vacancies", updates: [{ q: { _id: { $oid: unset.body.id } }, u: { $unset: { salary_min: "", salary_max: "" } } }] });
  const { total, items } = (await j("/api/vacancies?sort=salary_asc&pageSize=50")).body;
  if (items.length !== Math.min(total, 50)) throw new Error(`sahifada ${items.length}, jami ${total}`);
  if (!items.some((v) => v.id === unset.body.id)) throw new Error("maydoni yozilmagan e'lon tushib qoldi");
  const hiddenItems = items.filter((v) => v.isSalaryHidden);
  if (!hiddenItems.length || hiddenItems.some((v) => v.salaryMin !== null || v.salaryMax !== null)) throw new Error("yashirin maosh: " + JSON.stringify(hiddenItems.map((v) => v.salaryMin)));
  const filtered = (await j("/api/vacancies?salary=1000000&pageSize=50")).body.items;
  if (filtered.some((v) => v.isSalaryHidden)) throw new Error("yashirin maosh filtrga tushdi");
});

await check("[ISSUE-034/038] OG rasm va sevimlilar faqat faol vakansiya uchun", async () => {
  const draft = await newVacancy({ title: "Qoralama OG", status: "draft" });
  const og = await fetch(`${BASE}/api/og/vacancy/${draft.body.slug}`);
  if (og.status !== 404) throw new Error("qoralama OG: " + og.status);
  const fav = await post(`/api/favorites/${draft.body.id}`, {}, seekerToken);
  if (fav.status !== 404) throw new Error("qoralamani saqlash: " + fav.status);
  const active = await fetch(`${BASE}/api/og/vacancy/${vacancySlug}`);
  if (/immutable/.test(active.headers.get("cache-control") ?? "")) throw new Error("OG immutable keshlanadi");
});

await check("[ISSUE-037] ish beruvchi ikkinchi kompaniya yarata olmaydi (409); javascript: sayt manzili rad etiladi", async () => {
  const r = await post("/api/companies", { name: "Ikkinchi kompaniya" }, employerToken);
  if (r.status !== 409) throw new Error("status " + r.status);
  const current = (await j("/api/employer/company", { headers: authH(employerToken) })).body.company;
  const bad = await put("/api/employer/company", { name: current.name, website: "javascript:alert(1)" }, employerToken);
  if (bad.status !== 400) throw new Error("javascript: sayt: " + bad.status);
});

await check("[ISSUE-035] admin roli olingan foydalanuvchi eski token bilan admin API'ga kira olmaydi", async () => {
  const argon2 = (await import("argon2")).default;
  const email = "demoted-admin@test.uz";
  await prisma.user.create({ data: { email, passwordHash: await argon2.hash("parol12345"), role: "admin", isEmailVerified: true } });
  const token = await loginAs(email);
  if ((await j("/api/admin/overview", { headers: authH(token) })).status !== 200) throw new Error("admin kira olmadi");
  await prisma.user.update({ where: { email }, data: { role: "employer" } });
  const after = await j("/api/admin/overview", { headers: authH(token) });
  if (after.status !== 403) throw new Error("rol olingandan keyin: " + after.status);
});

await check("[ISSUE-036/014/060] ariza holati: bir xil holat takror yuborilsa tarix va bildirishnoma ko'paymaydi; bildirishnoma havolasi saqlanadi", async () => {
  const app = (await j("/api/employer/applications", { headers: authH(employerToken) })).body.items[0];
  const before = await prisma.applicationStatusHistory.count({ where: { applicationId: app.id } });
  const notifBefore = await prisma.notification.count({ where: { userId: app.jobSeekerId } });
  const again = await patch(`/api/applications/${app.id}/status`, { status: app.status }, employerToken);
  if (again.status !== 200) throw new Error("takror: " + again.status);
  await sleep(300);
  if ((await prisma.applicationStatusHistory.count({ where: { applicationId: app.id } })) !== before) throw new Error("tarix ko'paydi");
  if ((await prisma.notification.count({ where: { userId: app.jobSeekerId } })) !== notifBefore) throw new Error("bildirishnoma ko'paydi");
  const list = (await j("/api/notifications?limit=100", { headers: authH(seekerToken) })).body.items;
  const changed = list.find((n) => n.type === "application_status_changed");
  if (!changed?.url || !/^\/messages\?c=[0-9a-f]{24}$/.test(changed.url)) throw new Error("holat bildirishnomasi havolasi: " + JSON.stringify(changed));
});

await check("[ISSUE-044] validatsiya: juda uzun maydonlar 400; buzilgan sahifa raqami 500 emas", async () => {
  const long = await newVacancy({ title: "A".repeat(5000) });
  if (long.status !== 400) throw new Error("uzun sarlavha: " + long.status);
  const reg = await postFresh("/api/auth/register", { email: "long@test.uz", password: "p".repeat(5000), role: "job_seeker" });
  if (reg.status !== 400) throw new Error("uzun parol: " + reg.status);
  const name = await postFresh("/api/auth/register", { email: "long2@test.uz", password: "parol12345", role: "job_seeker", firstName: "F".repeat(500) });
  if (name.status !== 400) throw new Error("uzun ism: " + name.status);
  const inf = await j("/api/vacancies?page=Infinity&salary=abc");
  if (inf.status !== 200 || inf.body.page !== 1) throw new Error("page=Infinity: " + inf.status + " " + inf.body?.page);
  const skills = await put("/api/resume", { title: "Ko'p", skills: Array.from({ length: 51 }, (_, i) => "s" + i), experience: [], education: [] }, seeker2Token);
  if (skills.status !== 400) throw new Error("51 ko'nikma: " + skills.status);
});

await check("[ISSUE-086] ariza: parallel ikki so'rov bitta ariza yaratadi va ikkalasi muvaffaqiyatli", async () => {
  const vac = await newVacancy({ title: "Parallel ariza" });
  const [a, b] = await Promise.all([post(`/api/vacancies/${vac.body.id}/apply`, {}, seeker2Token), post(`/api/vacancies/${vac.body.id}/apply`, {}, seeker2Token)]);
  if (![200, 201].includes(a.status) || ![200, 201].includes(b.status)) throw new Error(`${a.status} ${b.status}`);
  if ((await prisma.application.count({ where: { vacancyId: vac.body.id } })) !== 1) throw new Error("dublikat");
});

await check("[ISSUE-039] suhbat: ish beruvchi faqat ariza bergan yoki ish qidirayotgan nomzodga yoza oladi; summary suhbatsiz 403", async () => {
  const me = (await j("/api/auth/me", { headers: authH(seeker2Token) })).body;
  const seeker2Id = me.id ?? me.user?.id;
  if ((await j(`/api/users/${seeker2Id}/summary`, { headers: authH(hr2Token) })).status !== 403) throw new Error("summary suhbatsiz ochildi");
  await patch("/api/profile", { isOpenToWork: false }, seeker2Token);
  const closed = await post("/api/conversations/start", { candidateUserId: seeker2Id }, hr2Token);
  if (closed.status !== 403) throw new Error("ish qidirmayotgan nomzod: " + closed.status);
  await patch("/api/profile", { isOpenToWork: true }, seeker2Token);
  const open = await post("/api/conversations/start", { candidateUserId: seeker2Id }, hr2Token);
  if (open.status !== 200) throw new Error("ochiq nomzod: " + open.status);
});

await check("[profile-1] hisob ma'lumotini har qanday rol O'QIY oladi, lekin nomzod profilini faqat nomzod YOZADI", async () => {
  // Admin va ish beruvchining o'z hisob sahifasi ham shu yo'ldan o'qiydi (ilgari 403 edi va
  // sahifa "Ma'lumotlarni yuklab bo'lmadi" holatida qolardi)
  for (const [who, token] of [["admin", adminToken], ["ish beruvchi", employerToken]]) {
    const res = await j("/api/profile", { headers: authH(token) });
    if (res.status !== 200) throw new Error(`${who} hisobini o'qiy olmadi: ${res.status}`);
    if (!res.body.email || !res.body.role) throw new Error(`${who}: javobda email/rol yo'q`);
    // Nomzodga xos maydonlar bo'sh, lekin mavjud — sahifa ularni xatosiz chizadi
    if (res.body.headline !== null || res.body.regionId !== null) throw new Error(`${who}: nomzod maydonlari to'ldirilgan`);
  }
  // YOZISH avvalgidek faqat nomzodda: admin hisobiga nomzod profili yaratilmaydi
  for (const [who, token] of [["admin", adminToken], ["ish beruvchi", employerToken]]) {
    const res = await patch("/api/profile", { headline: "Buzildi" }, token);
    if (res.status !== 403) throw new Error(`${who} nomzod profilini yozdi: ${res.status}`);
  }
  if ((await j("/api/profile")).status !== 401) throw new Error("mehmon hisob ma'lumotini oldi");
});

await check("[IDOR] begona ish beruvchi/nomzod boshqaning resurslarini o'zgartira olmaydi", async () => {
  if ((await put(`/api/vacancies/${vacancyId}`, { title: "Buzildi" }, hr2Token)).status !== 403) throw new Error("PUT vacancy");
  if ((await del(`/api/vacancies/${vacancyId}`, hr2Token)).status !== 403) throw new Error("DELETE vacancy");
  if ((await patch(`/api/vacancies/${vacancyId}/status`, { status: "archived" }, hr2Token)).status !== 403) throw new Error("PATCH vacancy status");
  const search = (await j("/api/saved-searches", { headers: authH(seekerToken) })).body.items[0];
  if ((await patch(`/api/saved-searches/${search.id}`, { name: "x" }, seeker2Token)).status !== 403) throw new Error("PATCH saved search");
  if ((await del(`/api/saved-searches/${search.id}`, seeker2Token)).status !== 403) throw new Error("DELETE saved search");
  const conv = (await j("/api/conversations", { headers: authH(seekerToken) })).body.items[0];
  if ((await j(`/api/conversations/${conv.id}/messages`, { headers: authH(seeker2Token) })).status !== 403) throw new Error("messages");
  if ((await j(`/api/conversations/${conv.id}/rating`, { headers: authH(seeker2Token) })).status !== 403) throw new Error("rating");
  if ((await post(`/api/conversations/${conv.id}/rating`, { score: 1 }, seeker2Token)).status !== 403) throw new Error("rating POST");
  const review = await prisma.companyReview.findFirst({ select: { id: true } });
  if (review && (await del(`/api/reviews/${review.id}`, seeker2Token)).status !== 403) throw new Error("begona sharhni o'chirdi");
  const application = (await j("/api/employer/applications", { headers: authH(employerToken) })).body.items[0];
  if ((await patch(`/api/applications/${application.id}/status`, { status: "rejected" }, hr2Token)).status !== 403) throw new Error("begona ariza holati");
  if ((await j("/api/admin/overview", { headers: authH(employerToken) })).status !== 403) throw new Error("ish beruvchi admin API");
});

await check("[ISSUE-027] admin rad etgan sharh muallif tahrirlaganda qayta tasdiqlanmaydi (pending)", async () => {
  const company = (await j("/api/employer/company", { headers: authH(employerToken) })).body.company;
  const review = await prisma.companyReview.findFirst({ where: { companyId: company.id } });
  const rejected = await send("PATCH", `/api/admin/reviews/${review.id}`, { status: "rejected" }, adminToken);
  if (rejected.status !== 200) throw new Error("admin rad etolmadi: " + rejected.status);
  const edited = await post(`/api/companies/${company.slug}/reviews`, { rating: 5, comment: "Qayta" }, seekerToken);
  if (edited.status !== 200 || edited.body.status !== "pending") throw new Error("tahrir: " + edited.status + " " + edited.body?.status);
  const publicReviews = (await j(`/api/companies/${company.slug}`)).body.reviews;
  if (publicReviews.some((r) => r.id === review.id)) throw new Error("moderatsiyadagi sharh ochiq sahifada");
});

await check("[ISSUE-025/024/059] vakansiya: arizasi bor e'lon o'chirilmaydi (409); rad etilgan e'lon tahrirlansa moderatsiyaga tushadi; to'liq bo'lmagan eski e'lon qayta faollashmaydi", async () => {
  const withApps = await del(`/api/vacancies/${vacancyId}`, employerToken);
  if (withApps.status !== 409 || withApps.body.error !== "VACANCY_HAS_APPLICATIONS") throw new Error("arizali o'chirish: " + withApps.status);
  if (!(await prisma.vacancy.findUnique({ where: { id: vacancyId } }))) throw new Error("vakansiya o'chib ketdi");

  const rejected = await newVacancy({ title: "Rad etilgan e'lon" });
  await prisma.vacancy.update({ where: { id: rejected.body.id }, data: { status: "rejected", rejectionReason: "Test" } });
  const edited = await put(`/api/vacancies/${rejected.body.id}`, { title: "Tuzatilgan e'lon" }, employerToken);
  if (edited.status !== 200 || edited.body.status !== "moderation") throw new Error("tahrirdan keyin: " + edited.status + " " + edited.body?.status);

  const legacy = await newVacancy({ title: "Eski e'lon" });
  await prisma.$runCommandRaw({ update: "vacancies", updates: [{ q: { _id: { $oid: legacy.body.id } }, u: { $set: { status: "archived" }, $unset: { workplace_type: "" } } }] });
  const reopen = await patch(`/api/vacancies/${legacy.body.id}/status`, { status: "active" }, employerToken);
  if (reopen.status !== 400 || !String(reopen.body?.message ?? "").startsWith("workplaceType")) throw new Error("joylashuvsiz qayta faollashtirish: " + reopen.status + " " + JSON.stringify(reopen.body));
  const fixed = await put(`/api/vacancies/${legacy.body.id}`, { workplaceType: "office" }, employerToken);
  const reopened = await patch(`/api/vacancies/${legacy.body.id}/status`, { status: "active" }, employerToken);
  if (fixed.status !== 200 || reopened.status !== 200 || reopened.body.status !== "active") throw new Error("to'ldirilgandan keyin: " + fixed.status + " " + reopened.status);
});

await check("[ISSUE-056/050] sitemap bo'sh kompaniya profilini kiritmaydi; katalog 'masofaviy' filtri ish joylashuvini ko'radi", async () => {
  const empty = await prisma.company.findFirst({ where: { name: "Uchinchi kompaniya" }, select: { slug: true } });
  if (!empty) throw new Error("bo'sh kompaniya topilmadi");
  const sm = (await j("/sitemap-employer.xml")).body;
  if (sm.includes(`/companies/${empty.slug}`)) throw new Error("bo'sh profil sitemap'da");
  const remote = await newVacancy({ title: "Masofaviy to'liq stavka", workplaceType: "remote", regionId: null, employmentType: "full_time" });
  if (remote.status !== 201) throw new Error("masofaviy e'lon: " + remote.status);
  const company = (await j("/api/employer/company", { headers: authH(employerToken) })).body.company;
  const catalog = (await j("/api/companies?work=remote&limit=50")).body.items;
  if (!catalog.some((c) => c.id === company.id)) throw new Error("masofaviy filtri kompaniyani topmadi");
});

await check("[ISSUE-029/043] PDF rezyume: turi baytlardan tekshiriladi, nomi tasodifiy, o'chirilganda fayl ham o'chadi", async () => {
  const upload = async (blob, name) => {
    const form = new FormData();
    form.append("file", blob, name);
    const res = await fetch(`${BASE}/api/profile/resume`, { method: "POST", headers: authH(seekerToken), body: form });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const fake = await upload(new Blob(["<html>salom</html>"], { type: "application/pdf" }), "cv.pdf");
  if (fake.status !== 400) throw new Error("PDF nomli HTML: " + fake.status);
  const pdf = await upload(new Blob(["%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"], { type: "application/pdf" }), "cv.pdf");
  if (pdf.status !== 200 || !/^\/uploads\/resume-[0-9a-f]{32}\.pdf$/.test(pdf.body?.resumeUrl ?? "")) throw new Error("pdf: " + pdf.status + " " + JSON.stringify(pdf.body));
  // Fayl endi statik yo'ldan BERILMAYDI (audit R3, D-058) — egasi uni vakolatli endpointdan oladi
  if ((await fetch(`${BASE}${pdf.body.resumeUrl}`)).status !== 404) throw new Error("statik /uploads/*.pdf hali ochiq (D-058)");
  const mine = await fetch(`${BASE}/api/resume-files/me`, { headers: authH(seekerToken) });
  await mine.arrayBuffer().catch(() => undefined);
  if (mine.status !== 200) throw new Error("egasi o'z faylini ocha olmadi: " + mine.status);
  const notMultipart = await post("/api/profile/resume", { a: 1 }, seekerToken);
  if (notMultipart.status !== 400) throw new Error("multipart emas: " + notMultipart.status);
  await del("/api/profile/resume", seekerToken);
  await sleep(200);
  if ((await fetch(`${BASE}${pdf.body.resumeUrl}`)).status !== 404) throw new Error("o'chirilgan fayl hali ochiq");
  const gone = await fetch(`${BASE}/api/resume-files/me`, { headers: authH(seekerToken) });
  await gone.arrayBuffer().catch(() => undefined);
  if (gone.status !== 404) throw new Error("o'chirilgandan keyin /api/resume-files/me: " + gone.status);
});

await check("[ISSUE-054] ommaviy xabar: darhol 202, fonda yuboriladi, tashqi havola saqlanmaydi", async () => {
  const title = "Audit ommaviy xabar";
  const res = await send("POST", "/api/admin/broadcast", { title, body: "Sinov xabari", role: "job_seeker", url: "//evil.example/x" }, adminToken);
  if (res.status !== 202 || typeof res.body.sent !== "number") throw new Error("javob: " + res.status + " " + JSON.stringify(res.body));
  let item;
  for (let i = 0; i < 20 && !item; i++) {
    await sleep(250);
    item = (await j("/api/notifications?limit=100", { headers: authH(seekerToken) })).body.items.find((n) => n.title === title);
  }
  if (!item) throw new Error("bildirishnoma kelmadi");
  if (item.url !== "/") throw new Error("havola: " + item.url);
});

await check("[PHASE6-U13] ommaviy xabar: boshqaruv belgili havola ('/' + TAB + '/evil.example') saqlanmaydi", async () => {
  const title = "Audit tab belgili havola";
  // Brauzer URL'dagi tab'ni tashlab yuboradi va "//evil.example" — tashqi sayt hosil bo'ladi
  const url = "/" + String.fromCharCode(9) + "/evil.example";
  let res;
  // Oldingi ommaviy xabar hali yuborilayotgan bo'lsa 409 — tugashini kutamiz
  for (let i = 0; i < 40; i++) {
    res = await send("POST", "/api/admin/broadcast", { title, body: "Tab belgili havola sinovi", role: "job_seeker", url }, adminToken);
    if (res.status !== 409) break;
    await sleep(250);
  }
  if (res.status !== 202) throw new Error("javob: " + res.status + " " + JSON.stringify(res.body));
  let item;
  for (let i = 0; i < 20 && !item; i++) {
    await sleep(250);
    item = (await j("/api/notifications?limit=100", { headers: authH(seekerToken) })).body.items?.find((n) => n.title === title);
  }
  if (!item) throw new Error("bildirishnoma kelmadi");
  const stored = await prisma.notification.findUnique({ where: { id: item.id }, select: { payload: true } });
  const storedUrl = stored?.payload?.url ?? null;
  if (storedUrl !== null && storedUrl !== "/") throw new Error("bazadagi payload.url: " + JSON.stringify(storedUrl));
  if (item.url !== null && item.url !== "/") throw new Error("API havolasi: " + JSON.stringify(item.url));
});

await check("[ISSUE-041/035] logout refresh tokenni bekor qiladi; bloklash refresh tokenni bekor qiladi va ochiq WebSocket'ni yopadi", async () => {
  const reg = await postFresh("/api/auth/register", { email: "seans@test.uz", password: "parol12345", role: "job_seeker", firstName: "Seans" });
  if (reg.status !== 200) throw new Error("ro'yxatdan o'tish: " + reg.status);
  const loginCookie = async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
      body: JSON.stringify({ email: "seans@test.uz", password: "parol12345" }),
    });
    const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
    return { cookie, token: (await res.json()).accessToken };
  };
  const refresh = async (cookie) => (await (await fetch(`${BASE}/api/auth/refresh`, { method: "POST", headers: { cookie } })).json()).accessToken;

  const first = await loginCookie();
  if (!first.cookie.startsWith("refreshToken=") || !(await refresh(first.cookie))) throw new Error("refresh ishlamadi");
  await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { cookie: first.cookie } });
  if ((await refresh(first.cookie)) !== null) throw new Error("logout'dan keyin eski refresh token ishladi");

  const second = await loginCookie();
  const me = (await j("/api/auth/me", { headers: authH(second.token) })).body;
  const userId = me.id ?? me.user?.id;
  // Shu token ham oxirida server logida qidiriladi (audit PHASE 6, U34)
  wsTokens.add(second.token);
  const { default: WebSocket } = await import("ws");
  const ws = await new Promise((resolve, reject) => {
    const s = new WebSocket(`ws://127.0.0.1:${PORT}/ws/chat?token=${encodeURIComponent(second.token)}`);
    s.once("open", () => resolve(s));
    s.once("error", reject);
  });
  const closed = new Promise((resolve) => ws.once("close", (code) => resolve(code)));
  await sleep(300);
  const blocked = await send("PATCH", `/api/admin/users/${userId}/block`, { isBlocked: true }, adminToken);
  if (blocked.status !== 200) throw new Error("bloklash: " + blocked.status);
  const code = await Promise.race([closed, sleep(3000).then(() => "timeout")]);
  if (code !== 4403) throw new Error("WebSocket yopilmadi: " + code);
  if ((await refresh(second.cookie)) !== null) throw new Error("bloklangandan keyin refresh ishladi");
  await send("PATCH", `/api/admin/users/${userId}/block`, { isBlocked: false }, adminToken);
});

// ===================== AUDIT PHASE 6: ikkinchi darajali tuzatishlar regressiyasi =====================
// Har tekshiruv nomi PHASE 6 topshiriq ID'si bilan boshlanadi. Yangi foydalanuvchilar postFresh (alohida IP) bilan.

await check("[PHASE6-U11] logout eskirgan refresh cookie bilan yangi seansni bekor qilmaydi", async () => {
  const email = "eski-cookie@test.uz";
  const reg = await postFresh("/api/auth/register", { email, password: "parol12345", role: "job_seeker", firstName: "Cookie" });
  if (reg.status !== 200) throw new Error("ro'yxatdan o'tish: " + reg.status);
  const loginCookie = async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
      body: JSON.stringify({ email, password: "parol12345" }),
    });
    const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
    await res.arrayBuffer().catch(() => undefined);
    if (res.status !== 200 || !cookie.startsWith("refreshToken=")) throw new Error("login: " + res.status);
    return cookie;
  };
  const refresh = async (cookie) => (await (await fetch(`${BASE}/api/auth/refresh`, { method: "POST", headers: { cookie } })).json()).accessToken;
  const logout = async (cookie) => {
    const res = await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { cookie } });
    await res.arrayBuffer().catch(() => undefined);
    return res.status;
  };

  const cookieA = await loginCookie();
  if ((await logout(cookieA)) !== 200) throw new Error("A cookie bilan logout");
  if ((await refresh(cookieA)) !== null) throw new Error("logout'dan keyin A cookie ishladi");
  const cookieB = await loginCookie();
  if (!(await refresh(cookieB))) throw new Error("yangi B seans ishlamadi");
  // Boshqa oynada qolgan eskirgan A cookie bilan logout joriy B seansga tegmasligi kerak
  if ((await logout(cookieA)) !== 200) throw new Error("eskirgan cookie bilan logout");
  if (!(await refresh(cookieB))) throw new Error("eskirgan A cookie bilan logout yangi B seansni bekor qildi");
});

let phase6AppId = null;

await check("[PHASE6-V5] bazada bloklangan hisobning amaldagi access tokeni 403 USER_BLOCKED (/me va ariza holati), blokdan chiqqach ishlaydi; admin bloki tokenVersion'ni oshirib eski tokenni bekor qiladi (401)", async () => {
  const email = "blok-hr@test.uz";
  const reg = await postFresh("/api/auth/register", { email, password: "parol12345", role: "employer", companyName: "Blok tekshiruvi MChJ" });
  if (reg.status !== 200) throw new Error("ro'yxatdan o'tish: " + reg.status);
  await prisma.user.update({ where: { email }, data: { isPhoneVerified: true } });
  const token = reg.body.accessToken;
  const me = await j("/api/auth/me", { headers: authH(token) });
  const userId = me.body?.id;
  if (me.status !== 200 || !userId) throw new Error("/me: " + me.status);
  const vac = await post("/api/vacancies", {
    title: "Blok tekshiruvi vakansiyasi", description: "Blok tekshiruvi uchun tavsif matni", employmentType: "full_time",
    categoryId: cats[0].id, regionId: regions[0].id, workplaceType: "office",
  }, token);
  if (vac.status !== 201) throw new Error("vakansiya: " + vac.status + " " + JSON.stringify(vac.body));
  const applied = await post(`/api/vacancies/${vac.body.id}/apply`, {}, seeker2Token);
  if (applied.status !== 201) throw new Error("ariza: " + applied.status + " " + JSON.stringify(applied.body));
  const appId = applied.body.id;
  phase6AppId = appId;
  const statusOf = async () => (await prisma.application.findUnique({ where: { id: appId }, select: { status: true } }))?.status;
  const changeStatus = (status) => patch(`/api/applications/${appId}/status`, { status }, token);

  // 1) Faqat bazada bloklash: tokenVersion o'zgarmaydi, token imzosi hali yaroqli
  await prisma.user.update({ where: { id: userId }, data: { isBlocked: true } });
  try {
    const meBlocked = await j("/api/auth/me", { headers: authH(token) });
    if (meBlocked.status !== 403 || meBlocked.body?.error !== "USER_BLOCKED") throw new Error("/me: " + meBlocked.status + " " + JSON.stringify(meBlocked.body));
    const write = await changeStatus("viewed");
    if (write.status !== 403 || write.body?.error !== "USER_BLOCKED") throw new Error("ariza holati: " + write.status + " " + JSON.stringify(write.body));
    if ((await statusOf()) !== "sent") throw new Error("bloklangan hisob ariza holatini o'zgartirdi");
  } finally {
    await prisma.user.update({ where: { id: userId }, data: { isBlocked: false } });
  }
  if ((await j("/api/auth/me", { headers: authH(token) })).status !== 200) throw new Error("blokdan chiqqach /me ishlamadi");
  const allowed = await changeStatus("viewed");
  if (allowed.status !== 200 || (await statusOf()) !== "viewed") throw new Error("blokdan chiqqach ariza holati: " + allowed.status);

  // 2) Admin API bloki tokenVersion'ni oshiradi. Blok davomida token rad etiladi (401 yoki 403 USER_BLOCKED —
  //    blok tekshiruvi versiyadan oldin turishi mumkin); blok yechilgach ham eski token qaytmaydi — 401
  const blocked = await send("PATCH", `/api/admin/users/${userId}/block`, { isBlocked: true }, adminToken);
  if (blocked.status !== 200) throw new Error("admin bloki: " + blocked.status);
  const during = await j("/api/auth/me", { headers: authH(token) });
  if (!(during.status === 401 || (during.status === 403 && during.body?.error === "USER_BLOCKED"))) {
    throw new Error("admin bloki davomida eski token: " + during.status + " " + JSON.stringify(during.body));
  }
  const unblocked = await send("PATCH", `/api/admin/users/${userId}/block`, { isBlocked: false }, adminToken);
  if (unblocked.status !== 200) throw new Error("admin blokdan chiqarish: " + unblocked.status);
  const revoked = await j("/api/auth/me", { headers: authH(token) });
  if (revoked.status !== 401) throw new Error("admin blokidan keyin eski access token: " + revoked.status);
  const revokedWrite = await changeStatus("invited");
  if (revokedWrite.status !== 401 || (await statusOf()) !== "viewed") throw new Error("bekor qilingan token bilan yozish: " + revokedWrite.status);
  const fresh = await loginAs(email);
  if (!fresh || (await j("/api/auth/me", { headers: authH(fresh) })).status !== 200) throw new Error("qayta kirish ishlamadi");
});

await check("[PHASE6-V5] roli bazada olingan admin (token'da hali admin) begona kompaniya arizasi holatini o'zgartira olmaydi (403)", async () => {
  if (!phase6AppId) throw new Error("oldingi tekshiruvda ariza yaratilmadi");
  const argon2 = (await import("argon2")).default;
  const email = "demoted-admin2@test.uz";
  await prisma.user.create({ data: { email, passwordHash: await argon2.hash("parol12345"), role: "admin", isEmailVerified: true, isPhoneVerified: true } });
  const token = await loginAs(email);
  if (!token) throw new Error("admin login");
  const statusOf = async () => (await prisma.application.findUnique({ where: { id: phase6AppId }, select: { status: true } }))?.status;
  const before = await statusOf();
  await prisma.user.update({ where: { email }, data: { role: "employer" } });
  const bypass = await patch(`/api/applications/${phase6AppId}/status`, { status: "rejected" }, token);
  if (bypass.status !== 403) throw new Error("roli olingan admin: " + bypass.status + " " + JSON.stringify(bypass.body));
  const after = await statusOf();
  if (after !== before) throw new Error(`ariza holati o'zgardi: ${before} -> ${after}`);
});

await check("[PHASE6-V1] suhbatlar ro'yxati va suhbatdosh profili emailni oshkor qilmaydi (ismsiz nomzod, kompaniyasiz ish beruvchi)", async () => {
  const seekerEmail = "ismsiz-nomzod@test.uz";
  const employerEmail = "kompaniyasiz-hr@test.uz";
  const seekerReg = await postFresh("/api/auth/register", { email: seekerEmail, password: "parol12345", role: "job_seeker" });
  const employerReg = await postFresh("/api/auth/register", { email: employerEmail, password: "parol12345", role: "employer" });
  if (seekerReg.status !== 200 || employerReg.status !== 200) throw new Error("ro'yxatdan o'tish: " + seekerReg.status + " " + employerReg.status);
  const seekerTok = seekerReg.body.accessToken;
  const employerTok = employerReg.body.accessToken;
  await prisma.user.updateMany({ where: { email: { in: [seekerEmail, employerEmail] } }, data: { isPhoneVerified: true } });
  // Topiladigan nomzod: ism va sarlavha yo'q, rezyume chop etilgan, ish qidirmoqda
  const resume = await put("/api/resume", { title: "Omborchi", skills: ["Hisob-kitob"], experience: [], education: [] }, seekerTok);
  if (resume.status !== 200) throw new Error("rezyume: " + resume.status);
  const profile = await patch("/api/profile", { isOpenToWork: true }, seekerTok);
  if (profile.status !== 200 || profile.body.firstName || profile.body.lastName || profile.body.headline) throw new Error("profil: " + profile.status + " " + JSON.stringify(profile.body));
  const seekerId = (await j("/api/auth/me", { headers: authH(seekerTok) })).body.id;
  const employerId = (await j("/api/auth/me", { headers: authH(employerTok) })).body.id;

  const started = await post("/api/conversations/start", { candidateUserId: seekerId }, employerTok);
  if (started.status !== 200 || !started.body?.id) throw new Error("suhbat ochish: " + started.status + " " + JSON.stringify(started.body));

  const employerList = await j("/api/conversations", { headers: authH(employerTok) });
  const employerItem = employerList.body.items?.find((c) => c.id === started.body.id);
  if (employerList.status !== 200 || employerItem?.otherUserId !== seekerId) throw new Error("ish beruvchi ro'yxatida suhbat yo'q: " + employerList.status);
  if (JSON.stringify(employerList.body).includes(seekerEmail)) throw new Error("ish beruvchi suhbatlar ro'yxatida nomzod emaili");

  const summary = await j(`/api/users/${seekerId}/summary`, { headers: authH(employerTok) });
  if (summary.status !== 200) throw new Error("summary: " + summary.status);
  if (JSON.stringify(summary.body).includes(seekerEmail)) throw new Error("summary javobida nomzod emaili");

  const seekerList = await j("/api/conversations", { headers: authH(seekerTok) });
  const seekerItem = seekerList.body.items?.find((c) => c.id === started.body.id);
  if (seekerList.status !== 200 || seekerItem?.otherUserId !== employerId) throw new Error("nomzod ro'yxatida suhbat yo'q: " + seekerList.status);
  if (JSON.stringify(seekerList.body).includes(employerEmail)) throw new Error("nomzod suhbatlar ro'yxatida ish beruvchi emaili");
});

await check("[PHASE6-V3] /uploads/<rasm>;.pdf so'rovi rasmni CSP sandbox'siz bermaydi", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAMAASsJTYQAAAAASUVORK5CYII=", "base64");
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "logo.png");
  const res = await fetch(`${BASE}/api/employer/company/logo`, { method: "POST", headers: authH(employerToken), body: form });
  const logoUrl = (await res.json().catch(() => null))?.logoUrl;
  if (res.status !== 200 || !/^\/uploads\/company-logo-[0-9a-f]{32}\.png$/.test(logoUrl ?? "")) throw new Error("logo: " + res.status + " " + logoUrl);
  try {
    // Router ';' dan keyingi qismni so'rov satri deb biladi va rasmni beradi; URL esa ".pdf" bilan tugaydi
    for (const suffix of [";.pdf", ";.PDF"]) {
      const served = await fetch(`${BASE}${logoUrl}${suffix}`);
      await served.arrayBuffer().catch(() => undefined);
      const csp = served.headers.get("content-security-policy") ?? "";
      if (served.status === 200 && !/sandbox/.test(csp)) throw new Error(`${suffix}: 200, CSP sandbox yo'q (${csp || "sarlavha yo'q"})`);
    }
  } finally {
    await del("/api/employer/company/logo", employerToken);
  }
});

await check("[PHASE6-U31] [ISSUE-087] telefoni tasdiqlanmagan ish beruvchi yopilgan vakansiyani qayta faollashtira olmaydi (gate: 503/403)", async () => {
  const vac = await newVacancy({ title: "Telefon tekshiruvi e'loni" });
  if (vac.status !== 201) throw new Error("vakansiya: " + vac.status);
  const closed = await patch(`/api/vacancies/${vac.body.id}/status`, { status: "archived" }, employerToken);
  if (closed.status !== 200) throw new Error("yopish: " + closed.status);
  await prisma.user.update({ where: { email: "hr@test.uz" }, data: { isPhoneVerified: false } });
  try {
    // Bot sozlanmagan (Rule K, D-051) -> 503 TELEGRAM_UNAVAILABLE; bot bo'lsa 403 PHONE_NOT_VERIFIED
    const reopen = await patch(`/api/vacancies/${vac.body.id}/status`, { status: "active" }, employerToken);
    if (!phoneGateRefusal(reopen)) throw new Error("qayta faollashtirish: " + reopen.status + " " + JSON.stringify(reopen.body));
    const after = await prisma.vacancy.findUnique({ where: { id: vac.body.id }, select: { status: true } });
    if (after?.status !== "archived") throw new Error("holat o'zgarib ketdi: " + after?.status);
  } finally {
    await prisma.user.update({ where: { email: "hr@test.uz" }, data: { isPhoneVerified: true } });
  }
});

await check("[views-1] sahifani OCHISH hisoblagichni oshirmaydi; ko'rish alohida so'rov bilan, bufer orqali va updatedAt o'zgarmasdan yoziladi", async () => {
  const vac = await newVacancy({ title: "Ko'rishlar hisoblagichi" });
  if (vac.status !== 201) throw new Error("vakansiya: " + vac.status);
  const read = () => prisma.vacancy.findUnique({ where: { id: vac.body.id }, select: { viewsCount: true, updatedAt: true } });
  const before = await read();

  // 1. Ma'lumotni o'qish endi TOZA o'qish: uch marta ochilsa ham hisoblagich qimirlamaydi
  for (let i = 0; i < 3; i++) {
    if ((await j(`/api/vacancies/${vac.body.slug}`)).status !== 200) throw new Error("sahifa ochilmadi");
  }
  await flushWait();
  if ((await read()).viewsCount !== before.viewsCount) throw new Error("sahifani o'qish hisoblagichni oshirdi");

  // 2. Brauzerdan kelgan ko'rish sanaladi (bufer bo'shagach bazada)
  const first = await view(`/api/vacancies/${vac.body.slug}/view`, BROWSER_UA);
  if (first.status !== 202 || first.body.counted !== true) throw new Error("ko'rish qabul qilinmadi: " + JSON.stringify(first.body));
  await flushWait();
  const after = await read();
  if (after.viewsCount !== before.viewsCount + 1) throw new Error(`ko'rishlar: ${before.viewsCount} -> ${after.viewsCount}`);
  if (after.updatedAt.getTime() !== before.updatedAt.getTime()) throw new Error("updatedAt o'zgardi (sitemap lastmod buziladi)");

  // 3. O'SHA ko'ruvchi qayta yuborsa sanalmaydi (sutkalik takror filtri)
  const again = await view(`/api/vacancies/${vac.body.slug}/view`, BROWSER_UA);
  if (again.body.counted !== false) throw new Error("takroriy ko'rish sanaldi");
  // 4. Bot sanalmaydi, User-Agent'siz so'rov ham
  if ((await view(`/api/vacancies/${vac.body.slug}/view`, "Mozilla/5.0 (compatible; Googlebot/2.1)")).body.counted !== false) throw new Error("bot sanaldi");
  if ((await view(`/api/vacancies/${vac.body.slug}/view`, null)).body.counted !== false) throw new Error("User-Agent'siz so'rov sanaldi");
  // 5. Boshqa ko'ruvchi (boshqa brauzer) — sanaladi
  if ((await view(`/api/vacancies/${vac.body.slug}/view`, OTHER_UA)).body.counted !== true) throw new Error("boshqa ko'ruvchi sanalmadi");
  await flushWait();
  if ((await read()).viewsCount !== before.viewsCount + 2) throw new Error("ikkinchi ko'ruvchi yozilmadi");

  // 6. Mavjud bo'lmagan slug 404 emas, shunchaki bekor ketadi (bu yo'l bazaga murojaat qilmaydi)
  if ((await view(`/api/vacancies/yoq-bunday-vakansiya-9999/view`, BROWSER_UA)).status !== 202) throw new Error("noma'lum slug 202 bermadi");
});

await check("[PHASE6-U31] robots.txt seo.routes.ts qoidalariga mos: shaxsiy yo'llar uch tilda yopiq, ochiq bo'limlar ochiq, sitemap sayt domenida", async () => {
  const res = await fetch(`${BASE}/robots.txt`);
  const text = await res.text();
  if (res.status !== 200 || !/^text\/plain/.test(res.headers.get("content-type") ?? "")) throw new Error("javob: " + res.status + " " + res.headers.get("content-type"));
  const rawLines = text.split("\n").map((l) => l.trim());
  if (rawLines[0] !== "User-agent: *") throw new Error("birinchi qator: " + rawLines[0]);
  const lines = new Set(rawLines);
  const PRIVATE = [
    "/admin", "/profile", "/messages", "/applications", "/login", "/signup", "/favorites", "/notifications", "/alerts",
    "/employer/vacancies", "/employer/applications", "/employer/candidates",
  ];
  const expected = [
    "Disallow: /api",
    ...PRIVATE.flatMap((p) => [`Disallow: ${p}`, `Disallow: /ru${p}`, `Disallow: /en${p}`]),
    "Sitemap: https://sayt.example/sitemap.xml",
  ];
  const missing = expected.filter((l) => !lines.has(l));
  if (missing.length) throw new Error("yetishmayotgan qatorlar: " + missing.join(" | "));
  // Disallow prefiks bo'yicha ishlaydi — ochiq (sitemap'dagi) sahifalarni yopib qo'yadigan qoida bo'lmasin
  const PUBLIC = ["/", "/vacancies", "/companies", "/articles", "/salaries", "/employer", "/support", "/contact"];
  const publicPaths = PUBLIC.flatMap((p) => [p, p === "/" ? "/ru" : `/ru${p}`, p === "/" ? "/en" : `/en${p}`]);
  const disallows = rawLines.filter((l) => l.startsWith("Disallow:")).map((l) => l.slice("Disallow:".length).trim()).filter(Boolean);
  const blockedPublic = publicPaths.filter((p) => disallows.some((d) => p.startsWith(d)));
  if (blockedPublic.length) throw new Error("ochiq sahifalar yopilgan: " + blockedPublic.join(", "));
});

await check("[PHASE6-U33] nomzodlar bazasi: bloklangan va rezyumesi qoralama nomzod chiqmaydi", async () => {
  const make = async (email, firstName) => {
    const reg = await postFresh("/api/auth/register", { email, password: "parol12345", role: "job_seeker", firstName, lastName: "Tekshiruvov" });
    if (reg.status !== 200) throw new Error("ro'yxatdan o'tish: " + reg.status);
    const saved = await put("/api/resume", { title: "Sotuvchi", skills: ["Savdo"], experience: [], education: [] }, reg.body.accessToken);
    if (saved.status !== 200) throw new Error("rezyume: " + saved.status);
    return (await j("/api/auth/me", { headers: authH(reg.body.accessToken) })).body.id;
  };
  const listed = async (text, userId) => {
    const res = await j(`/api/candidates?text=${encodeURIComponent(text)}`, { headers: authH(employerToken) });
    // API xatosi "topilmadi" deb hisoblanmaydi
    if (res.status !== 200 || !Array.isArray(res.body.items)) throw new Error("candidates: " + res.status + " " + JSON.stringify(res.body).slice(0, 200));
    return res.body.items.some((c) => c.userId === userId);
  };

  const blockedId = await make("blokli-nomzod@test.uz", "Zumradxonblok");
  if (!(await listed("Zumradxonblok", blockedId))) throw new Error("ochiq nomzod ro'yxatda topilmadi");
  await prisma.user.update({ where: { id: blockedId }, data: { isBlocked: true } });
  try {
    if (await listed("Zumradxonblok", blockedId)) throw new Error("bloklangan nomzod ro'yxatda");
  } finally {
    await prisma.user.update({ where: { id: blockedId }, data: { isBlocked: false } });
  }

  const draftId = await make("qoralama-nomzod@test.uz", "Qoralamaxonbek");
  if (!(await listed("Qoralamaxonbek", draftId))) throw new Error("chop etilgan rezyumeli nomzod topilmadi");
  const profile = await prisma.jobSeekerProfile.findUnique({ where: { userId: draftId }, select: { id: true } });
  await prisma.resume.updateMany({ where: { jobSeekerId: profile.id }, data: { status: "draft" } });
  if (await listed("Qoralamaxonbek", draftId)) throw new Error("rezyumesi qoralama nomzod ro'yxatda");
});

await check("[PHASE6-U33] yashirin maosh saqlanganlar va o'xshash vakansiyalar javobida ham null", async () => {
  const base = await newVacancy({ title: "O'xshashlik asosi" });
  const hidden = await newVacancy({ title: "Yashirin maoshli o'xshash e'lon", salaryMin: 11000000, salaryMax: 13000000, isSalaryHidden: true });
  if (base.status !== 201 || hidden.status !== 201) throw new Error("vakansiyalar: " + base.status + " " + hidden.status);
  const fav = await post(`/api/favorites/${hidden.body.id}`, {}, seekerToken);
  if (fav.status !== 201) throw new Error("saqlash: " + fav.status);
  try {
    const favorites = await j("/api/favorites", { headers: authH(seekerToken) });
    const inFavorites = favorites.body.items?.find((v) => v.id === hidden.body.id);
    if (favorites.status !== 200 || !inFavorites) throw new Error("saqlanganlarda yo'q: " + favorites.status);
    if (inFavorites.salaryMin !== null || inFavorites.salaryMax !== null) throw new Error("saqlanganlarda maosh: " + inFavorites.salaryMin + " " + inFavorites.salaryMax);
    const similar = await j(`/api/vacancies/${base.body.slug}/similar?limit=10`);
    const inSimilar = similar.body.items?.find((v) => v.id === hidden.body.id);
    if (similar.status !== 200 || !inSimilar) throw new Error("o'xshashlarda yo'q: " + similar.status);
    if (inSimilar.salaryMin !== null || inSimilar.salaryMax !== null) throw new Error("o'xshashlarda maosh: " + inSimilar.salaryMin + " " + inSimilar.salaryMax);
  } finally {
    await del(`/api/favorites/${hidden.body.id}`, seekerToken);
  }
});

await check("[PHASE6-U17] vakansiya sahifasi: company.reviewSummary (son) bor, company.reviews massivi yo'q", async () => {
  const res = await j(`/api/vacancies/${vacancySlug}`);
  if (res.status !== 200 || !res.body.company) throw new Error("sahifa: " + res.status);
  const company = res.body.company;
  if (typeof company.reviewSummary?.count !== "number") throw new Error("reviewSummary: " + JSON.stringify(company.reviewSummary));
  if (Array.isArray(company.reviews)) throw new Error("company.reviews massivi hali qaytmoqda: " + company.reviews.length);
});

await check("[PHASE6-U18] eski masofaviy e'lon (employment_type=remote, workplace_type yo'q, arxiv) sarlavhasi tahrirlanadi (200)", async () => {
  const legacy = await newVacancy({ title: "Eski masofaviy e'lon", employmentType: "remote", workplaceType: "remote", regionId: null });
  if (legacy.status !== 201) throw new Error("vakansiya: " + legacy.status + " " + JSON.stringify(legacy.body));
  await prisma.$runCommandRaw({ update: "vacancies", updates: [{ q: { _id: { $oid: legacy.body.id } }, u: { $set: { status: "archived" }, $unset: { workplace_type: "" } } }] });
  const raw = await prisma.vacancy.findUnique({ where: { id: legacy.body.id }, select: { workplaceType: true, status: true, employmentType: true } });
  if (raw?.workplaceType !== null || raw.status !== "archived" || raw.employmentType !== "remote") throw new Error("tayyorlash: " + JSON.stringify(raw));
  const title = "Eski masofaviy e'lon (yangi nom)";
  const edited = await put(`/api/vacancies/${legacy.body.id}`, { title }, employerToken);
  if (edited.status !== 200 || edited.body.title !== title) throw new Error("tahrirlash: " + edited.status + " " + JSON.stringify(edited.body));
});

await check("[PHASE6-U5] [D-071] nomzodlar bazasi: avval telefon gate'i, keyin kompaniya (400 COMPANY_REQUIRED)", async () => {
  const email = "nomzod-qidiruvchi@test.uz";
  const reg = await postFresh("/api/auth/register", { email, password: "parol12345", role: "employer" });
  if (reg.status !== 200) throw new Error("ro'yxatdan o'tish: " + reg.status);
  // D-071: telefoni tasdiqlanmagan ish beruvchi nomzodlar bazasini umuman ko'ra olmaydi
  const gated = await j("/api/candidates", { headers: authH(reg.body.accessToken) });
  if (!phoneGateRefusal(gated)) throw new Error("telefon gate'i: " + gated.status + " " + JSON.stringify(gated.body));
  await prisma.user.update({ where: { email }, data: { isPhoneVerified: true } });
  const res = await j("/api/candidates", { headers: authH(reg.body.accessToken) });
  if (res.status !== 400 || res.body?.error !== "COMPANY_REQUIRED") throw new Error(res.status + " " + JSON.stringify(res.body));
});

await check("[PHASE6-U29] API orqali yaratilgan faol vakansiya filtrsiz facets jami soniga darhol qo'shiladi", async () => {
  const total = async () => {
    const res = await j("/api/vacancies/facets");
    if (res.status !== 200 || typeof res.body.total !== "number") throw new Error("facets: " + res.status);
    return res.body.total;
  };
  // Kesh bo'lsa, u oldindan to'ldiriladi
  await total();
  const before = await total();
  const created = await newVacancy({ title: "Facets yangilanishi" });
  if (created.status !== 201 || created.body.status !== "active") throw new Error("vakansiya: " + created.status);
  const after = await total();
  if (after !== before + 1) throw new Error(`facets total: ${before} -> ${after}`);
});

// ===================== AUDIT R3: xavfsizlik regressiyasi =====================
// Round 3 shartnomasi (auth_contract.md, D-041..D-074) bo'yicha yangi tekshiruvlar.

await check("[ISSUE-011] [D-052] login lockout: bitta manba qurbonni bloklay olmaydi, email bo'yicha umumiy shift saqlanadi", async () => {
  // D-052 (auth-core-3, headers-infra-4): kalit endi `email|ip`. Ilgari FAQAT email edi —
  // istalgan odam 10 ta noto'g'ri parol yuborib qurbonni 15 daqiqaga kirishdan mahrum qilardi.
  const victim = "seeker2@test.uz";
  for (let i = 0; i < 12; i++) {
    const res = await postFresh("/api/auth/login", { email: victim, password: "notogri-parol" });
    if (res.status !== 401) throw new Error(`#${i} noto'g'ri parol: ${res.status} ${JSON.stringify(res.body)}`);
  }
  // Har urinish boshqa IP'dan bo'lgani uchun qurbon O'ZI hali ham kira oladi
  const ok = await postFresh("/api/auth/login", { email: victim, password: "parol12345" });
  if (ok.status !== 200 || !ok.body?.accessToken) throw new Error("qurbon kira olmadi: " + ok.status + " " + JSON.stringify(ok.body));
  // Boshqa email umuman ta'sirlanmaydi
  const neighbour = await postFresh("/api/auth/login", { email: "seeker@test.uz", password: "parol12345" });
  if (neighbour.status !== 200) throw new Error("boshqa email bloklandi: " + neighbour.status);

  // Taqsimlangan (ko'p IP'li) brute-force uchun email bo'yicha shift (50/15 daqiqa) joyida qoladi
  const sacrifice = "lockout-shift@test.uz";
  for (let batch = 0; batch < 10; batch++) {
    await Promise.all(
      Array.from({ length: 5 }, () => postFresh("/api/auth/login", { email: sacrifice, password: "notogri-parol" }))
    );
  }
  const blocked = await postFresh("/api/auth/login", { email: sacrifice, password: "notogri-parol" });
  if (blocked.status !== 429 || blocked.body?.error !== "TOO_MANY_ATTEMPTS") {
    throw new Error("email shifti ishlamadi: " + blocked.status + " " + JSON.stringify(blocked.body));
  }
  const untouched = await postFresh("/api/auth/login", { email: "seeker@test.uz", password: "parol12345" });
  if (untouched.status !== 200) throw new Error("shiftdan keyin boshqa email: " + untouched.status);
});
note("[D-052] `email|ip` bo'yicha 10 ta urinish chegarasini bitta IP'dan ajratib tekshirib bo'lmaydi: /api/auth/login marshrutida IP bo'yicha 10/daqiqa limiti bor va 11-so'rov login-guard'gacha yetmaydi (429 RATE_LIMITED). Oyna tugashini kutish e2e uchun juda sekin.");

await check("[D-041] Telegram orqali kirish yo'llari olib tashlangan (404)", async () => {
  // Rule A: Telegram endi faqat telefon tasdig'i va parol tiklash uchun
  const start = await postFresh("/api/auth/telegram/start", {});
  if (start.status !== 404) throw new Error("/api/auth/telegram/start: " + start.status + " " + JSON.stringify(start.body));
  const poll = await postFresh("/api/auth/telegram/poll", { token: "a".repeat(32) });
  if (poll.status !== 404) throw new Error("/api/auth/telegram/poll: " + poll.status + " " + JSON.stringify(poll.body));
});

await check("[D-058] PDF rezyume: statik /uploads/*.pdf yopiq (nuqta-vergul va kodlangan variantlar ham), fayl faqat vakolatli endpointdan", async () => {
  const form = new FormData();
  form.append("file", new Blob(["%PDF-1.4" + String.fromCharCode(10) + "1 0 obj<<>>endobj trailer<<>> %%EOF"], { type: "application/pdf" }), "cv.pdf");
  const up = await fetch(`${BASE}/api/profile/resume`, { method: "POST", headers: authH(seekerToken), body: form });
  const upBody = await up.json().catch(() => null);
  if (up.status !== 200 || typeof upBody?.resumeUrl !== "string") throw new Error("yuklash: " + up.status + " " + JSON.stringify(upBody));
  const filePath = upBody.resumeUrl; // /uploads/resume-<hex>.pdf

  try {
    // 1) Statik yo'l — hech qanday ko'rinishda bermaydi (audit R3, D-058, files-xss-1/authz-idor-8)
    const variants = [
      filePath,
      filePath + ";.png",
      filePath + ";x",
      filePath.replace(".pdf", ".PDF"),
      filePath + "?download=1",
      "/%75ploads/" + filePath.split("/").pop(),
    ];
    for (const path of variants) {
      const res = await fetch(`${BASE}${path}`);
      await res.arrayBuffer().catch(() => undefined);
      if (res.status !== 404) throw new Error(`statik yo'l ochiq: ${path} -> ${res.status}`);
    }

    // 2) Egasi — vakolatli endpoint orqali oladi, sarlavhalar shaxsiy ma'lumotga mos
    const mine = await fetch(`${BASE}/api/resume-files/me`, { headers: authH(seekerToken) });
    const bytes = await mine.arrayBuffer().catch(() => new ArrayBuffer(0));
    if (mine.status !== 200) throw new Error("egasi: " + mine.status);
    if (bytes.byteLength === 0) throw new Error("fayl bo'sh keldi");
    if (!String(mine.headers.get("content-type") ?? "").startsWith("application/pdf")) throw new Error("content-type: " + mine.headers.get("content-type"));
    const cache = String(mine.headers.get("cache-control") ?? "");
    if (!/private/.test(cache) || !/no-store/.test(cache)) throw new Error("cache-control: " + cache);
    if (!/noindex/.test(String(mine.headers.get("x-robots-tag") ?? ""))) throw new Error("x-robots-tag: " + mine.headers.get("x-robots-tag"));

    const guestMine = await fetch(`${BASE}/api/resume-files/me`);
    await guestMine.arrayBuffer().catch(() => undefined);
    if (guestMine.status !== 401) throw new Error("mehmon /me: " + guestMine.status);
    const employerMine = await fetch(`${BASE}/api/resume-files/me`, { headers: authH(employerToken) });
    await employerMine.arrayBuffer().catch(() => undefined);
    if (employerMine.status !== 403) throw new Error("ish beruvchi /me: " + employerMine.status);

    // 3) Ariza bo'yicha: faqat vakansiya egasi, arizachi va admin
    const vac = await newVacancy({ title: "Rezyume huquqi e'loni", applyWithoutResume: true });
    if (vac.status !== 201) throw new Error("vakansiya: " + vac.status);
    const applied = await post(`/api/vacancies/${vac.body.id}/apply`, { coverLetter: "Rezyume huquqi uchun ariza" }, seekerToken);
    if (applied.status !== 201 && applied.status !== 200) throw new Error("ariza: " + applied.status + " " + JSON.stringify(applied.body));
    const appPath = `/api/resume-files/application/${applied.body.id}`;
    const fetchAs = async (token) => {
      const res = await fetch(`${BASE}${appPath}`, { headers: token ? authH(token) : {} });
      await res.arrayBuffer().catch(() => undefined);
      return res.status;
    };
    const owner = await fetchAs(employerToken);
    if (owner !== 200) throw new Error("vakansiya egasi: " + owner);
    const applicant = await fetchAs(seekerToken);
    if (applicant !== 200) throw new Error("arizachi: " + applicant);
    const admin = await fetchAs(adminToken);
    if (admin !== 200) throw new Error("admin: " + admin);
    const foreignEmployer = await fetchAs(hr2Token);
    if (foreignEmployer !== 403 && foreignEmployer !== 404) throw new Error("begona ish beruvchi: " + foreignEmployer);
    const foreignSeeker = await fetchAs(seeker2Token);
    if (foreignSeeker !== 403 && foreignSeeker !== 404) throw new Error("begona nomzod: " + foreignSeeker);
    const guest = await fetchAs(null);
    if (guest !== 401) throw new Error("mehmon: " + guest);
    const missing = await fetch(`${BASE}/api/resume-files/application/${"0".repeat(24)}`, { headers: authH(employerToken) });
    await missing.arrayBuffer().catch(() => undefined);
    if (missing.status !== 404) throw new Error("mavjud bo'lmagan ariza: " + missing.status);
    const badId = await fetch(`${BASE}/api/resume-files/application/salom`, { headers: authH(employerToken) });
    await badId.arrayBuffer().catch(() => undefined);
    if (badId.status !== 400) throw new Error("noto'g'ri ID: " + badId.status);

    // 4) Ish beruvchi javoblarida fayl manzili umuman yo'q (D-058)
    const detail = await j(`/api/employer/applications/${applied.body.id}`, { headers: authH(employerToken) });
    if (detail.status !== 200) throw new Error("tafsilot: " + detail.status);
    if (JSON.stringify(detail.body).includes("/uploads/")) throw new Error("tafsilotda fayl manzili bor");
    if (detail.body.hasResumeFile !== true) throw new Error("hasResumeFile: " + JSON.stringify(detail.body.hasResumeFile));
  } finally {
    await del("/api/profile/resume", seekerToken);
  }
});

await check("[D-061] ish beruvchi murojaatlari: sahifalash chegaralari, sonlar, yengil ro'yxat va tafsilot egaligi", async () => {
  const vacA = await newVacancy({ title: "Sahifalash A", applyWithoutResume: true });
  const vacB = await newVacancy({ title: "Sahifalash B", applyWithoutResume: true });
  if (vacA.status !== 201 || vacB.status !== 201) throw new Error("vakansiyalar: " + vacA.status + "/" + vacB.status);
  for (const [token, vac] of [[seekerToken, vacA], [seekerToken, vacB], [seeker2Token, vacA], [seeker2Token, vacB]]) {
    const res = await post(`/api/vacancies/${vac.body.id}/apply`, { coverLetter: "Sahifalash uchun ariza matni" }, token);
    if (res.status !== 201 && res.status !== 200) throw new Error("ariza: " + res.status + " " + JSON.stringify(res.body));
  }

  const list = (query) => j(`/api/employer/applications${query}`, { headers: authH(employerToken) });

  // Standart javob shakli va chegaralari
  const base = await list("");
  if (base.status !== 200) throw new Error("ro'yxat: " + base.status);
  for (const key of ["items", "total", "page", "pageSize", "counts", "vacancies"]) {
    if (!(key in base.body)) throw new Error(`javobda "${key}" yo'q`);
  }
  if (base.body.pageSize !== 20 || base.body.page !== 1) throw new Error("standart sahifa: " + JSON.stringify({ p: base.body.page, s: base.body.pageSize }));
  if (base.body.total < 4) throw new Error("jami arizalar: " + base.body.total);
  if (base.body.counts.all !== base.body.total) throw new Error("counts.all != total: " + JSON.stringify(base.body.counts));
  if (base.body.items.length > base.body.pageSize) throw new Error("sahifadan ko'p qator: " + base.body.items.length);

  // pageSize/page chegaradan oshsa — 400 (2000 talik "hammasini ber" so'rovi endi yo'q)
  for (const q of ["?pageSize=51", "?pageSize=1000", "?pageSize=0", "?page=0", "?page=201", "?pageSize=abc"]) {
    const res = await list(q);
    if (res.status !== 400) throw new Error(`${q}: ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`);
  }
  const maxSize = await list("?pageSize=50");
  if (maxSize.status !== 200 || maxSize.body.pageSize !== 50) throw new Error("pageSize=50: " + maxSize.status + " " + maxSize.body?.pageSize);

  // Haqiqiy sahifalash: har sahifada boshqa ariza, jami o'zgarmaydi
  const p1 = await list("?pageSize=1&page=1");
  const p2 = await list("?pageSize=1&page=2");
  if (p1.body.items.length !== 1 || p2.body.items.length !== 1) throw new Error("sahifa hajmi: " + p1.body.items.length + "/" + p2.body.items.length);
  if (p1.body.items[0].id === p2.body.items[0].id) throw new Error("ikki sahifada bir xil ariza");
  if (p1.body.total !== p2.body.total) throw new Error("jami o'zgardi: " + p1.body.total + " -> " + p2.body.total);
  // Oxirgi sahifadan nariga so'ralsa — server oxirgi sahifani qaytaradi (bo'sh ro'yxat emas)
  const far = await list("?pageSize=1&page=200");
  if (far.status !== 200 || far.body.items.length !== 1 || far.body.page !== Math.min(200, far.body.total)) {
    throw new Error("chegaradan tashqari sahifa: " + far.status + " " + JSON.stringify({ p: far.body?.page, n: far.body?.items?.length }));
  }

  // Holat filtri va sonlar
  const sent = await list("?status=sent");
  if (sent.body.total !== sent.body.counts.sent) throw new Error("status filtri: " + JSON.stringify({ t: sent.body.total, c: sent.body.counts }));
  if (sent.body.items.some((item) => item.status !== "sent")) throw new Error("filtrda boshqa holat bor");
  // Vakansiya filtri va begona vakansiya ID'si
  const byVacancy = await list(`?vacancyId=${vacB.body.id}`);
  if (byVacancy.body.items.some((item) => item.vacancy?.id !== vacB.body.id)) throw new Error("vakansiya filtri ishlamadi");
  if (byVacancy.body.counts.all !== 2) throw new Error("vakansiya sonlari: " + JSON.stringify(byVacancy.body.counts));
  const foreignVacancy = await list(`?vacancyId=${"0".repeat(24)}`);
  if (foreignVacancy.status !== 200 || foreignVacancy.body.items.length !== 0) {
    throw new Error("begona vakansiya ID'si: " + foreignVacancy.status + " " + foreignVacancy.body?.items?.length);
  }

  // Ro'yxat YENGIL: rezyume ichki ma'lumoti, ariza xati, tarix va aloqa faqat tafsilotda
  const serialized = JSON.stringify(base.body.items);
  for (const leak of ["/uploads/", "resumeUrl", "coverLetter", "statusHistory", "passwordHash", "@test.uz"]) {
    if (serialized.includes(leak)) throw new Error(`yengil ro'yxatda "${leak}" bor`);
  }
  for (const item of base.body.items) {
    if (typeof item.hasResumeFile !== "boolean" || typeof item.hasResume !== "boolean") throw new Error("bayroqlar yo'q: " + JSON.stringify(item));
    if (!item.candidate || "email" in item.candidate || "phone" in item.candidate) throw new Error("nomzod aloqasi ro'yxatda: " + JSON.stringify(item.candidate));
  }

  // Tafsilot: faqat egasi (yoki admin)
  const appId = base.body.items[0].id;
  const detail = await j(`/api/employer/applications/${appId}`, { headers: authH(employerToken) });
  if (detail.status !== 200 || !("coverLetter" in detail.body) || !Array.isArray(detail.body.statusHistory)) {
    throw new Error("tafsilot: " + detail.status + " " + JSON.stringify(detail.body).slice(0, 160));
  }
  if (!detail.body.candidate?.email) throw new Error("tafsilotda aloqa yo'q");
  const byForeign = await j(`/api/employer/applications/${appId}`, { headers: authH(hr2Token) });
  if (byForeign.status !== 403) throw new Error("begona ish beruvchi tafsiloti: " + byForeign.status);
  const bySeeker = await j(`/api/employer/applications/${appId}`, { headers: authH(seekerToken) });
  if (bySeeker.status !== 403) throw new Error("nomzod tafsiloti: " + bySeeker.status);
  const byGuest = await j(`/api/employer/applications/${appId}`);
  if (byGuest.status !== 401) throw new Error("mehmon tafsiloti: " + byGuest.status);
  const missing = await j(`/api/employer/applications/${"0".repeat(24)}`, { headers: authH(employerToken) });
  if (missing.status !== 404) throw new Error("mavjud bo'lmagan ariza: " + missing.status);
  const badId = await j("/api/employer/applications/salom", { headers: authH(employerToken) });
  if (badId.status !== 400) throw new Error("noto'g'ri ID: " + badId.status);
});

await check("[D-071] nomzodlar bazasi: telefoni tasdiqlangan ish beruvchi ko'radi, admin telefon gate'idan ozod", async () => {
  const verified = await j("/api/candidates", { headers: authH(employerToken) });
  if (verified.status !== 200 || !Array.isArray(verified.body?.items)) throw new Error("tasdiqlangan ish beruvchi: " + verified.status + " " + JSON.stringify(verified.body).slice(0, 160));
  await prisma.user.updateMany({ where: { role: "admin" }, data: { isPhoneVerified: false } });
  try {
    const admin = await j("/api/candidates", { headers: authH(adminToken) });
    if (admin.status !== 200) throw new Error("admin (telefon tasdiqlanmagan): " + admin.status + " " + JSON.stringify(admin.body).slice(0, 160));
  } finally {
    await prisma.user.updateMany({ where: { role: "admin" }, data: { isPhoneVerified: true } });
  }
});

await check("[D-074] SSR kaliti: to'g'ri x-ssr-key alohida (kengroq) bucket'ga tushadi, noto'g'ri kalit — oddiy IP bucket'iga", async () => {
  const limitOf = async (headers) => {
    const res = await fetch(`${BASE}/api/stats`, { headers });
    await res.arrayBuffer().catch(() => undefined);
    const raw = res.headers.get("x-ratelimit-limit");
    if (raw === null) throw new Error("x-ratelimit-limit sarlavhasi yo'q");
    return Number(raw);
  };
  const plain = await limitOf({});
  const wrong = await limitOf({ "x-ssr-key": "notogri-kalit-0123456789abcdefghij" });
  const right = await limitOf({ "x-ssr-key": env.SSR_API_KEY });
  if (plain !== Number(env.RATE_LIMIT_MAX)) throw new Error("oddiy so'rov limiti: " + plain);
  if (wrong !== plain) throw new Error("noto'g'ri kalit limitni oshirdi: " + wrong);
  if (!(right > plain)) throw new Error(`SSR kaliti bilan limit oshmadi: ${plain} -> ${right}`);
});

// ===================== AUDIT R3 (2-to'lqin): shartnomalar regressiyasi =====================
// Har tekshiruv wave 2 shartnomasiga bog'langan: D-070 (admin moderatsiya qulfi), D-077 (oxirgi
// admin, rol o'zgarishi, bloklangan ega), D-073 (tasdiq belgisi), D-075 (sharhlar), D-078 (cursor
// sahifalash va WS telefon gate'i), D-059 (payload.i18n), D-065 (billing o'chiq), D-080 (apostrof
// variantlari), gap4-3 (ochiq tafsilotda ichki maydon yo'q), db-perf-8 (ish beruvchi vakansiyalari).

/** Bir martalik hisob: o'z IP'si bilan ro'yxatdan o'tadi va telefoni tasdiqlangan holatga keltiriladi. */
const freshAccount = async (email, data) => {
  const reg = await postFresh("/api/auth/register", { email, password: "parol12345", ...data });
  if (reg.status !== 200 || !reg.body.accessToken) {
    throw new Error(`${email} ro'yxatdan o'tmadi: ${reg.status} ${JSON.stringify(reg.body).slice(0, 160)}`);
  }
  await prisma.user.update({ where: { email }, data: { isPhoneVerified: true } });
  const me = await j("/api/auth/me", authGet(reg.body.accessToken));
  const id = me.body?.id ?? me.body?.user?.id;
  if (!id) throw new Error(`${email} ID topilmadi: ` + JSON.stringify(me.body).slice(0, 160));
  return { token: reg.body.accessToken, id, email };
};

/** Foydalanuvchi ID'si (tokendan emas — serverdan). */
const userIdOf = async (token) => {
  const me = await j("/api/auth/me", authGet(token));
  const id = me.body?.id ?? me.body?.user?.id;
  if (!id) throw new Error("foydalanuvchi ID'si topilmadi: " + JSON.stringify(me.body).slice(0, 160));
  return id;
};

/** Bildirishnoma fonda yoziladi (`void notify`) — kalit bo'yicha kutamiz (audit R3, D-059). */
const waitForI18nNotification = async (token, key, tries = 15, match = () => true) => {
  for (let i = 0; i < tries; i++) {
    const res = await j("/api/notifications?limit=50", authGet(token));
    if (res.status !== 200) throw new Error("bildirishnomalar: " + res.status + " " + JSON.stringify(res.body).slice(0, 160));
    const hit = (res.body.items ?? []).find((n) => n?.payload?.i18n?.key === key && match(n));
    if (hit) return hit;
    await sleep(400);
  }
  return null;
};

await check("[D-070] admin arxivi/rad etishi vakansiyani qulflaydi (409 VACANCY_LOCKED), admin faollashtirsa qulf ochiladi", async () => {
  const created = await newVacancy({ title: "Moderatsiya qulfi sinovi" });
  if (created.status !== 201) throw new Error("vakansiya: " + created.status + " " + JSON.stringify(created.body).slice(0, 160));
  const id = created.body.id;

  const archived = await send("PATCH", `/api/admin/vacancies/${id}/moderate`, { status: "archived" }, adminToken);
  if (archived.status !== 200) throw new Error("admin arxivlashi: " + archived.status + " " + JSON.stringify(archived.body).slice(0, 160));
  let row = await prisma.vacancy.findUnique({ where: { id }, select: { status: true, adminArchivedAt: true } });
  if (row.status !== "archived") throw new Error("holat: " + row.status);
  if (!row.adminArchivedAt) throw new Error("adminArchivedAt yozilmadi — admin arxivi ish beruvchinikidan farqlanmaydi (D-070)");

  const owner = await patch(`/api/vacancies/${id}/status`, { status: "active" }, employerToken);
  if (owner.status !== 409 || owner.body?.error !== "VACANCY_LOCKED") {
    throw new Error("ish beruvchi admin qulfini chetlab o'tdi: " + owner.status + " " + JSON.stringify(owner.body).slice(0, 160));
  }
  row = await prisma.vacancy.findUnique({ where: { id }, select: { status: true } });
  if (row.status !== "archived") throw new Error("qulflangan e'lon holati o'zgardi: " + row.status);

  const opened = await send("PATCH", `/api/admin/vacancies/${id}/moderate`, { status: "active" }, adminToken);
  if (opened.status !== 200) throw new Error("admin faollashtirishi: " + opened.status + " " + JSON.stringify(opened.body).slice(0, 160));
  row = await prisma.vacancy.findUnique({ where: { id }, select: { status: true, adminArchivedAt: true } });
  if (row.status !== "active" || row.adminArchivedAt) throw new Error("qulf tozalanmadi: " + JSON.stringify(row));
  const closedByOwner = await patch(`/api/vacancies/${id}/status`, { status: "archived" }, employerToken);
  if (closedByOwner.status !== 200) throw new Error("qulf ochilgach egasi yopolmadi: " + closedByOwner.status);

  // Rad etish ham qulflaydi (moderatsiyani chetlab o'tish yopiq)
  const rejected = await send("PATCH", `/api/admin/vacancies/${id}/moderate`, { status: "rejected", reason: "Sinov sababi" }, adminToken);
  if (rejected.status !== 200) throw new Error("rad etish: " + rejected.status + " " + JSON.stringify(rejected.body).slice(0, 160));
  row = await prisma.vacancy.findUnique({ where: { id }, select: { status: true, adminArchivedAt: true } });
  if (row.status !== "rejected" || !row.adminArchivedAt) throw new Error("rad etilgan e'lon qulflanmadi: " + JSON.stringify(row));
  const afterReject = await patch(`/api/vacancies/${id}/status`, { status: "active" }, employerToken);
  if (afterReject.status !== 409) throw new Error("rad etilgandan keyin faollashtirildi: " + afterReject.status);
});

await check("[D-070] [admin-staff-6] admin moderatsiyasi qoralamani chop etmaydi va joylashuv qoidalarini tekshiradi", async () => {
  const draft = await newVacancy({ title: "Admin qoralama sinovi" });
  if (draft.status !== 201) throw new Error("vakansiya: " + draft.status);
  await prisma.vacancy.update({ where: { id: draft.body.id }, data: { status: "draft" } });
  const published = await send("PATCH", `/api/admin/vacancies/${draft.body.id}/moderate`, { status: "active" }, adminToken);
  const draftRow = await prisma.vacancy.findUnique({ where: { id: draft.body.id }, select: { status: true } });
  if (draftRow.status === "active") throw new Error("admin qoralamani chop etdi (D-070): " + published.status);
  if (published.status < 400 || published.status >= 500) {
    throw new Error("qoralama uchun 4xx kutilgan: " + published.status + " " + JSON.stringify(published.body).slice(0, 160));
  }

  // Eski (ish joylashuvi to'ldirilmagan) e'lonni admin ham qoidasiz chop eta olmaydi
  const legacy = await newVacancy({ title: "Admin joylashuv sinovi" });
  if (legacy.status !== 201) throw new Error("ikkinchi vakansiya: " + legacy.status);
  await prisma.$runCommandRaw({
    update: "vacancies",
    updates: [{ q: { _id: { $oid: legacy.body.id } }, u: { $set: { status: "archived" }, $unset: { workplace_type: "" } } }],
  });
  const forced = await send("PATCH", `/api/admin/vacancies/${legacy.body.id}/moderate`, { status: "active" }, adminToken);
  const legacyRow = await prisma.vacancy.findUnique({ where: { id: legacy.body.id }, select: { status: true } });
  if (legacyRow.status === "active") throw new Error("admin joylashuv qoidasisiz chop etdi (D-070): " + forced.status);
  if (forced.status < 400 || forced.status >= 500) {
    throw new Error("joylashuvsiz e'lon uchun 4xx kutilgan: " + forced.status + " " + JSON.stringify(forced.body).slice(0, 160));
  }
});

await check("[D-059] bildirishnoma payload.i18n: application.new, application.statusChanged, vacancy.rejected", async () => {
  const target = await newVacancy({ title: "Bildirishnoma sinovi (i18n)" });
  if (target.status !== 201) throw new Error("vakansiya: " + target.status + " " + JSON.stringify(target.body).slice(0, 160));
  const applied = await post(`/api/vacancies/${target.body.id}/apply`, { source: "site" }, seekerToken);
  if (applied.status !== 201) throw new Error("ariza: " + applied.status + " " + JSON.stringify(applied.body).slice(0, 160));
  const application = await prisma.application.findFirst({ where: { vacancyId: target.body.id }, select: { id: true } });
  if (!application) throw new Error("ariza bazada topilmadi");

  const newApp = await waitForI18nNotification(employerToken, "application.new");
  if (!newApp) throw new Error("ish beruvchida payload.i18n.key=application.new yo'q (D-059) — ro'yxat `payload` ni qaytarmayotgan bo'lishi ham mumkin");
  if (newApp.payload.i18n.params?.vacancyTitle !== "Bildirishnoma sinovi (i18n)") {
    throw new Error("application.new params: " + JSON.stringify(newApp.payload.i18n.params));
  }
  // Bazadagi o'zbekcha matn saqlanadi (eski klient, Telegram va push shundan o'qiydi)
  if (!newApp.title || !newApp.body) throw new Error("saqlangan title/body yo'qolgan: " + JSON.stringify(newApp).slice(0, 160));

  const statusChanged = await patch(`/api/applications/${application.id}/status`, { status: "invited" }, employerToken);
  if (statusChanged.status !== 200) throw new Error("holat o'zgarishi: " + statusChanged.status + " " + JSON.stringify(statusChanged.body).slice(0, 160));
  // Shu tekshiruvning o'z bildirishnomasi kerak: bir xil kalitli eski yozuv (boshqa ariza) topilib qolmasin
  const seekerNote = await waitForI18nNotification(
    seekerToken,
    "application.statusChanged",
    15,
    (n) => n?.payload?.i18n?.params?.status === "invited"
  );
  if (!seekerNote) throw new Error("nomzodda payload.i18n.key=application.statusChanged yo'q (D-059)");
  const params = seekerNote.payload.i18n.params ?? {};
  if (params.status !== "invited") throw new Error("statusChanged params.status: " + JSON.stringify(params));
  if (!params.vacancyTitle) throw new Error("statusChanged params.vacancyTitle yo'q: " + JSON.stringify(params));

  // Yuqoridagi D-070 tekshiruvi vakansiyani rad etgan — ish beruvchida vacancy.rejected bo'lishi kerak
  const rejectedNote = await waitForI18nNotification(employerToken, "vacancy.rejected");
  if (!rejectedNote) throw new Error("ish beruvchida payload.i18n.key=vacancy.rejected yo'q (D-059)");
  const rejectParams = rejectedNote.payload.i18n.params ?? {};
  if (!rejectParams.vacancyTitle) throw new Error("vacancy.rejected params: " + JSON.stringify(rejectParams));
  if (typeof rejectParams.reason !== "string") {
    throw new Error("vacancy.rejected params.reason satr bo'lishi kerak (sababsiz holatda bo'sh satr): " + JSON.stringify(rejectParams));
  }

  // D-059 bilan `payload` endi javobga chiqadi — bu YANGI oshkor bo'lish yuzasi (ilgari faqat `url` chiqardi).
  // Kelajakda biror `notify()` payload'ga shaxsiy ma'lumot qo'shsa, u jimgina klientga ketmasin (audit R3, D-059 / ISSUE-001).
  const EMAIL_IN_PAYLOAD = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const TOKEN_IN_PAYLOAD = /eyJ[A-Za-z0-9_-]{10,}/;
  for (const [who, token] of [["ish beruvchi", employerToken], ["nomzod", seekerToken]]) {
    const all = await j("/api/notifications?limit=50", authGet(token));
    if (all.status !== 200) throw new Error(who + " bildirishnomalari: " + all.status);
    for (const item of all.body.items ?? []) {
      if (!item?.payload) continue;
      const text = JSON.stringify(item.payload);
      if (EMAIL_IN_PAYLOAD.test(text)) throw new Error(who + ": bildirishnoma payload'ida email bor (D-059): " + text.slice(0, 160));
      if (TOKEN_IN_PAYLOAD.test(text)) throw new Error(who + ": bildirishnoma payload'ida token ko'rinishidagi qiymat bor (D-059)");
    }
  }
});

await check("[db-perf-8] [employer-flows-4] ish beruvchi vakansiyalari: server sahifalashi, holat filtri, sonlar va bitta e'lon endpointi", async () => {
  const list = await j("/api/employer/vacancies?page=1&pageSize=2", authGet(employerToken));
  if (list.status !== 200 || !Array.isArray(list.body.items)) throw new Error("ro'yxat: " + list.status + " " + JSON.stringify(list.body).slice(0, 160));
  if (list.body.items.length > 2) throw new Error("pageSize hisobga olinmadi: " + list.body.items.length);
  if (typeof list.body.total !== "number" || list.body.page !== 1) {
    throw new Error("sahifalash maydonlari yo'q: " + JSON.stringify({ total: list.body.total, page: list.body.page }));
  }
  // Sonlar: `counts.total` + `counts.byStatus` (eski `counts.all` shakli ham qabul qilinadi)
  const counts = list.body.counts;
  const countsTotal = typeof counts?.total === "number" ? counts.total : counts?.all;
  if (typeof countsTotal !== "number") throw new Error("holatlar bo'yicha sonlar yo'q: " + JSON.stringify(counts));
  const byStatus = counts.byStatus ?? counts;
  if (typeof byStatus.active !== "number") throw new Error("holat kesimidagi sonlar yo'q: " + JSON.stringify(counts));
  if (list.body.total < 3) throw new Error("sinov ma'lumoti yetarli emas: " + list.body.total);

  const second = await j("/api/employer/vacancies?page=2&pageSize=2", authGet(employerToken));
  if (second.status !== 200) throw new Error("ikkinchi sahifa: " + second.status);
  const firstIds = new Set(list.body.items.map((v) => v.id));
  if ((second.body.items ?? []).some((v) => firstIds.has(v.id))) throw new Error("sahifalar kesishdi");

  const huge = await j("/api/employer/vacancies?pageSize=999", authGet(employerToken));
  if (huge.status >= 500) throw new Error("pageSize=999: " + huge.status);
  if (huge.status === 200 && ((huge.body.pageSize ?? 0) > 50 || (huge.body.items ?? []).length > 50)) {
    throw new Error("pageSize 50 chegarasidan oshdi: " + huge.body.pageSize);
  }
  const filtered = await j("/api/employer/vacancies?status=active&pageSize=50", authGet(employerToken));
  if (filtered.status !== 200 || (filtered.body.items ?? []).some((v) => v.status !== "active")) {
    throw new Error("holat filtri ishlamadi: " + filtered.status);
  }

  // Yengil karta: tahrirlash formasi uchun kerak bo'lgan og'ir matn ro'yxatda yuborilmaydi
  const card = list.body.items[0];
  for (const key of ["requirements", "conditions"]) {
    if (key in card) throw new Error(`ro'yxatda og'ir maydon "${key}" qoldi (db-perf-8)`);
  }
  if ("description" in card) note("[db-perf-8] ish beruvchi ro'yxatida `description` hali yuborilmoqda — kartaga kerak bo'lmasa olib tashlansa yaxshi.");

  const detail = await j(`/api/employer/vacancies/${vacancyId}`, authGet(employerToken));
  if (detail.status !== 200) throw new Error("bitta e'lon endpointi: " + detail.status + " " + JSON.stringify(detail.body).slice(0, 160));
  if (typeof detail.body.description !== "string") throw new Error("tafsilotda to'liq maydonlar yo'q: " + JSON.stringify(detail.body).slice(0, 160));
  const foreign = await j(`/api/employer/vacancies/${vacancyId}`, authGet(hr2Token));
  if (foreign.status !== 403 && foreign.status !== 404) throw new Error("begona ish beruvchi tafsilotni ochdi: " + foreign.status);
  const guest = await j(`/api/employer/vacancies/${vacancyId}`);
  if (guest.status !== 401) throw new Error("mehmon tafsilotni ochdi: " + guest.status);
  const badId = await j("/api/employer/vacancies/salom", authGet(employerToken));
  if (badId.status !== 400 && badId.status !== 404) throw new Error("noto'g'ri ID: " + badId.status);
});

await check("[gap4-3] ochiq vakansiya tafsiloti ichki maydonni (rejectionReason) qaytarmaydi", async () => {
  const secret = "Ichki moderatsiya izohi (ochiq bo'lmasligi kerak)";
  await prisma.vacancy.update({ where: { id: vacancyId }, data: { rejectionReason: secret } });
  try {
    const detail = await j(`/api/vacancies/${vacancySlug}`);
    if (detail.status !== 200) throw new Error("tafsilot: " + detail.status);
    if ("rejectionReason" in detail.body) throw new Error("rejectionReason maydoni ochiq javobda (gap4-3)");
    if (JSON.stringify(detail.body).includes(secret)) throw new Error("ichki izoh matni ochiq javobda (gap4-3)");
  } finally {
    await prisma.vacancy.update({ where: { id: vacancyId }, data: { rejectionReason: null } });
  }
});

await check("[D-073] tasdiqlangan kompaniya nomi/sayti o'zgarsa belgi tushadi, egasiga xabar ketadi; boshqa tahrir belgini saqlaydi", async () => {
  const emp = await freshAccount("tasdiq-sinov-hr@test.uz", { role: "employer", companyName: "Tasdiq Sinov Kompaniyasi" });
  const company = (await j("/api/employer/company", authGet(emp.token))).body.company;
  if (!company?.id) throw new Error("kompaniya yaratilmadi");

  const verify = await patch(`/api/admin/companies/${company.id}/verify`, { isVerified: true }, adminToken);
  if (verify.status !== 200 || verify.body.isVerified !== true) throw new Error("tasdiqlash: " + verify.status + " " + JSON.stringify(verify.body).slice(0, 160));

  const renamed = await put("/api/employer/company", { name: "Tasdiq Sinov Kompaniyasi (yangi nom)" }, emp.token);
  if (renamed.status !== 200) throw new Error("nomni o'zgartirish: " + renamed.status + " " + JSON.stringify(renamed.body).slice(0, 160));
  const afterRename = (await j("/api/employer/company", authGet(emp.token))).body.company;
  if (afterRename.isVerified !== false) throw new Error("nom o'zgargach tasdiq belgisi qoldi (D-073)");
  const removedNote = await waitForI18nNotification(emp.token, "company.verificationRemoved");
  if (!removedNote) throw new Error("company.verificationRemoved bildirishnomasi kelmadi (D-073/D-059)");
  if (!removedNote.payload.i18n.params?.companyName) throw new Error("company.verificationRemoved params: " + JSON.stringify(removedNote.payload.i18n.params));

  const reVerify = await patch(`/api/admin/companies/${company.id}/verify`, { isVerified: true }, adminToken);
  if (reVerify.status !== 200) throw new Error("qayta tasdiqlash: " + reVerify.status);
  const siteChanged = await put("/api/employer/company", { name: afterRename.name, website: "https://yangi-sayt.example" }, emp.token);
  if (siteChanged.status !== 200) throw new Error("sayt o'zgarishi: " + siteChanged.status + " " + JSON.stringify(siteChanged.body).slice(0, 160));
  const afterSite = (await j("/api/employer/company", authGet(emp.token))).body.company;
  if (afterSite.isVerified !== false) throw new Error("sayt o'zgargach tasdiq belgisi qoldi (D-073)");

  // Identity'ga daxlsiz tahrir (tavsif) tasdiqni bekor qilmaydi — qoida ortiqcha qattiq bo'lmasin
  const reVerify2 = await patch(`/api/admin/companies/${company.id}/verify`, { isVerified: true }, adminToken);
  if (reVerify2.status !== 200) throw new Error("uchinchi tasdiqlash: " + reVerify2.status);
  const descOnly = await put(
    "/api/employer/company",
    { name: afterSite.name, website: afterSite.website ?? undefined, description: "Kompaniya haqida yangilangan tavsif matni." },
    emp.token
  );
  if (descOnly.status !== 200) throw new Error("tavsif tahriri: " + descOnly.status + " " + JSON.stringify(descOnly.body).slice(0, 160));
  const afterDesc = (await j("/api/employer/company", authGet(emp.token))).body.company;
  if (afterDesc.isVerified !== true) throw new Error("faqat tavsif o'zgarganda ham tasdiq bekor qilindi (D-073 ortiqcha qo'llanildi)");
});

await check("[D-075] sharh: ochiq sahifada userId yo'q va mine bayrog'i, rad etilganni muallif o'chira olmaydi, qayta yuborish pending", async () => {
  const company = (await j("/api/employer/company", authGet(employerToken))).body.company;
  const seekerId = await userIdOf(seekerToken);
  const review = await prisma.companyReview.findFirst({ where: { companyId: company.id, userId: seekerId }, select: { id: true } });
  if (!review) throw new Error("nomzodning sinov sharhi topilmadi");

  const approve = await send("PATCH", `/api/admin/reviews/${review.id}`, { status: "approved" }, adminToken);
  if (approve.status !== 200) throw new Error("tasdiqlash: " + approve.status);

  const guest = await j(`/api/companies/${company.slug}`);
  const guestReview = (guest.body.reviews ?? []).find((r) => r.id === review.id);
  if (!guestReview) throw new Error("tasdiqlangan sharh ochiq sahifada ko'rinmadi");
  if ("userId" in guestReview) throw new Error("ochiq sharhda muallif userId'si qoldi (D-075/employer-flows-8)");
  if (guestReview.mine === true) throw new Error("mehmonga mine=true berildi");

  const asAuthor = await j(`/api/companies/${company.slug}`, authGet(seekerToken));
  const mineReview = (asAuthor.body.reviews ?? []).find((r) => r.id === review.id);
  if (!mineReview) throw new Error("muallif javobida sharh yo'q");
  if (mineReview.mine !== true) throw new Error("muallif uchun mine=true emas: " + JSON.stringify(mineReview).slice(0, 160));
  if ("userId" in mineReview) throw new Error("token bilan ham userId qaytdi (D-075)");
  const asOther = await j(`/api/companies/${company.slug}`, authGet(seeker2Token));
  const otherReview = (asOther.body.reviews ?? []).find((r) => r.id === review.id);
  if (otherReview?.mine === true) throw new Error("begona foydalanuvchiga mine=true berildi");

  const rejected = await send("PATCH", `/api/admin/reviews/${review.id}`, { status: "rejected" }, adminToken);
  if (rejected.status !== 200) throw new Error("rad etish: " + rejected.status);
  const byAuthor = await del(`/api/reviews/${review.id}`, seekerToken);
  if (byAuthor.status !== 403) throw new Error("muallif rad etilgan sharhni o'chirdi — moderatsiya chetlab o'tildi (D-075): " + byAuthor.status);
  // Aynan moderatsiya sababli rad etilsin: egalik tekshiruvi ham 403 beradi, u boshqa xato
  if (byAuthor.body?.error !== "REVIEW_UNDER_MODERATION") throw new Error("kutilgan REVIEW_UNDER_MODERATION: " + JSON.stringify(byAuthor.body).slice(0, 160));
  if (!(await prisma.companyReview.findUnique({ where: { id: review.id } }))) throw new Error("rad etilgan sharh o'chib ketdi");

  const reposted = await post(`/api/companies/${company.slug}/reviews`, { rating: 5, comment: "Qayta yuborildi" }, seekerToken);
  if (reposted.status !== 200 || reposted.body.status !== "pending") {
    throw new Error("qayta yuborilgan sharh moderatsiyaga tushmadi: " + reposted.status + " " + reposted.body?.status);
  }
  const pendingDelete = await del(`/api/reviews/${review.id}`, seekerToken);
  if (pendingDelete.status !== 403) throw new Error("muallif kutilayotgan sharhni o'chirdi (D-075): " + pendingDelete.status);
  if (pendingDelete.body?.error !== "REVIEW_UNDER_MODERATION") throw new Error("kutilgan REVIEW_UNDER_MODERATION: " + JSON.stringify(pendingDelete.body).slice(0, 160));

  const backToApproved = await send("PATCH", `/api/admin/reviews/${review.id}`, { status: "approved" }, adminToken);
  if (backToApproved.status !== 200) throw new Error("qayta tasdiqlash: " + backToApproved.status);
  const authorDelete = await del(`/api/reviews/${review.id}`, seekerToken);
  if (authorDelete.status !== 200) throw new Error("muallif tasdiqlangan sharhini o'chira olmadi: " + authorDelete.status);
});

await check("[gap4-1] [D-077] bloklangan ish beruvchi kompaniyasi ochiq sahifada 404 va katalogda yo'q", async () => {
  const emp = await freshAccount("blok-sinov-hr@test.uz", { role: "employer", companyName: "Blok Sinov Kompaniyasi" });
  const created = await post(
    "/api/vacancies",
    { title: "Blok sinovi vakansiyasi", description: "Uzun tavsif matni", employmentType: "full_time", categoryId: cats[0].id, regionId: regions[0].id, workplaceType: "office" },
    emp.token
  );
  if (created.status !== 201) throw new Error("vakansiya: " + created.status + " " + JSON.stringify(created.body).slice(0, 160));
  const company = (await j("/api/employer/company", authGet(emp.token))).body.company;
  if (!company?.slug) throw new Error("kompaniya yaratilmadi");
  const before = await j(`/api/companies/${company.slug}`);
  if (before.status !== 200) throw new Error("bloklashdan oldin ochiq sahifa: " + before.status);

  const blocked = await patch(`/api/admin/users/${emp.id}/block`, { isBlocked: true }, adminToken);
  if (blocked.status !== 200) throw new Error("bloklash: " + blocked.status + " " + JSON.stringify(blocked.body).slice(0, 160));

  const after = await j(`/api/companies/${company.slug}`);
  if (after.status !== 404) throw new Error("bloklangan ega kompaniyasi ochiq qoldi (gap4-1): " + after.status);
  const catalog = await j(`/api/companies?text=${encodeURIComponent("Blok Sinov Kompaniyasi")}&limit=50`);
  if (catalog.status !== 200) throw new Error("katalog: " + catalog.status);
  if ((catalog.body.items ?? []).some((c) => c.slug === company.slug)) throw new Error("bloklangan ega kompaniyasi katalogda qoldi (gap1-8)");
  const mainCompany = (await j("/api/employer/company", authGet(employerToken))).body.company;
  const similar = await j(`/api/companies/${mainCompany.slug}/similar?limit=10`);
  if ((similar.body.items ?? []).some((c) => c.slug === company.slug)) throw new Error("o'xshash kompaniyalar ro'yxatida qoldi");
});

await check("[D-077] [employer-flows-5] rol ish beruvchidan o'zgarsa faol vakansiyalar admin arxiviga tushadi", async () => {
  const emp = await freshAccount("rol-sinov-hr@test.uz", { role: "employer", companyName: "Rol Sinov Kompaniyasi" });
  const created = await post(
    "/api/vacancies",
    { title: "Rol sinovi vakansiyasi", description: "Uzun tavsif matni", employmentType: "full_time", categoryId: cats[0].id, regionId: regions[0].id, workplaceType: "office" },
    emp.token
  );
  if (created.status !== 201 || created.body.status !== "active") throw new Error("vakansiya: " + created.status + " " + JSON.stringify(created.body).slice(0, 160));

  const changed = await patch(`/api/admin/users/${emp.id}/role`, { role: "job_seeker" }, adminToken);
  if (changed.status !== 200) throw new Error("rol o'zgarishi: " + changed.status + " " + JSON.stringify(changed.body).slice(0, 160));

  const row = await prisma.vacancy.findUnique({ where: { id: created.body.id }, select: { status: true, adminArchivedAt: true } });
  if (row.status !== "archived") throw new Error("rol o'zgargach vakansiya faol qoldi (employer-flows-5): " + row.status);
  if (!row.adminArchivedAt) throw new Error("adminArchivedAt yozilmadi — eski ish beruvchi qayta faollashtira oladi (D-077)");
  const publicList = await j(`/api/vacancies?text=${encodeURIComponent("Rol sinovi vakansiyasi")}`);
  if ((publicList.body.items ?? []).some((v) => v.id === created.body.id)) throw new Error("arxivlangan e'lon ochiq ro'yxatda qoldi");
});

await check("[D-078] bildirishnomalar cursor: nextCursor va before bilan takrorsiz sahifalash", async () => {
  const userId = await userIdOf(seeker2Token);
  await prisma.notification.deleteMany({ where: { userId } });
  for (let i = 0; i < 5; i++) {
    await prisma.notification.create({
      data: { userId, type: "system", title: `Cursor sinovi ${i}`, body: "Sinov matni", createdAt: new Date(Date.now() - i * 60000) },
    });
  }

  const seen = [];
  let cursor = null;
  for (let page = 0; page < 6; page++) {
    const res = await j(`/api/notifications?limit=2${cursor ? `&before=${cursor}` : ""}`, authGet(seeker2Token));
    if (res.status !== 200 || !Array.isArray(res.body.items)) throw new Error("sahifa: " + res.status + " " + JSON.stringify(res.body).slice(0, 160));
    if (typeof res.body.unreadCount !== "number") throw new Error("unreadCount yo'qoldi (eski shakl saqlanishi kerak)");
    if (!("nextCursor" in res.body)) throw new Error("nextCursor maydoni yo'q (D-078)");
    for (const item of res.body.items) {
      if (seen.includes(item.id)) throw new Error("takror element: " + item.id);
      seen.push(item.id);
    }
    cursor = res.body.nextCursor;
    if (!cursor) break;
  }
  if (cursor) throw new Error("oxirgi sahifadan keyin ham nextCursor qaytdi");
  if (seen.length !== 5) throw new Error("jami aylanilgan: " + seen.length);

  const plain = await j("/api/notifications", authGet(seeker2Token));
  if (plain.status !== 200 || !Array.isArray(plain.body.items) || typeof plain.body.unreadCount !== "number") {
    throw new Error("parametrsiz javob shakli o'zgardi: " + JSON.stringify(plain.body).slice(0, 160));
  }
  const badCursor = await j("/api/notifications?limit=2&before=salom", authGet(seeker2Token));
  if (badCursor.status >= 500) throw new Error("buzilgan cursor 500 berdi: " + badCursor.status);
  const bigLimit = await j("/api/notifications?limit=5000", authGet(seeker2Token));
  if (bigLimit.status >= 500) throw new Error("limit=5000 500 berdi: " + bigLimit.status);
});

await check("[D-078] [scale-10k-9] xabarlar tarixi cursor: before/hasMore, o'sish tartibi, eski shakl saqlanadi", async () => {
  const convs = await j("/api/conversations", authGet(seekerToken));
  const conv = (convs.body.items ?? []).find((c) => c.lastMessage) ?? convs.body.items?.[0];
  if (!conv) throw new Error("nomzodda suhbat yo'q");
  const meId = await userIdOf(seekerToken);
  for (let i = 0; i < 6; i++) {
    await prisma.message.create({
      data: { conversationId: conv.id, senderId: meId, body: `Cursor xabari ${i}`, isRead: true, createdAt: new Date(Date.now() - (10 - i) * 60000) },
    });
  }

  const first = await j(`/api/conversations/${conv.id}/messages?limit=3`, authGet(seekerToken));
  if (first.status !== 200 || (first.body.items ?? []).length !== 3) {
    throw new Error("birinchi sahifa: " + first.status + " " + (first.body.items ?? []).length);
  }
  const times = first.body.items.map((m) => new Date(m.createdAt).getTime());
  if (times.some((t, i) => i > 0 && t < times[i - 1])) throw new Error("xabarlar o'sish tartibida emas");
  if (first.body.hasMore !== true) throw new Error("hasMore=true kutilgan (D-078): " + JSON.stringify(first.body.hasMore));

  const older = await j(`/api/conversations/${conv.id}/messages?limit=3&before=${first.body.items[0].id}`, authGet(seekerToken));
  if (older.status !== 200 || !Array.isArray(older.body.items)) throw new Error("eskiroq sahifa: " + older.status);
  if (older.body.items.length === 0) throw new Error("eskiroq xabarlar kelmadi (before ishlamadi)");
  const firstIds = new Set(first.body.items.map((m) => m.id));
  if (older.body.items.some((m) => firstIds.has(m.id))) throw new Error("sahifalar kesishdi");
  const olderTimes = older.body.items.map((m) => new Date(m.createdAt).getTime());
  if (olderTimes.some((t, i) => i > 0 && t < olderTimes[i - 1])) throw new Error("eskiroq sahifa tartibi buzilgan");
  if (Math.max(...olderTimes) > Math.min(...times)) throw new Error("eskiroq sahifada yangiroq xabar bor");

  const plain = await j(`/api/conversations/${conv.id}/messages`, authGet(seekerToken));
  if (plain.status !== 200 || !Array.isArray(plain.body.items) || plain.body.me !== meId) {
    throw new Error("parametrsiz javob shakli o'zgardi: " + JSON.stringify(plain.body).slice(0, 160));
  }
});

await check("[D-078] [scale-10k-6] suhbatlar ro'yxati cursor: nextCursor bilan takrorsiz sahifalash", async () => {
  const hr2Company = (await j("/api/employer/company", authGet(hr2Token))).body.company;
  if (!hr2Company?.slug) throw new Error("ikkinchi kompaniya topilmadi");
  const started = await post("/api/conversations/start", { companySlug: hr2Company.slug }, seekerToken);
  if (started.status !== 200) throw new Error("ikkinchi suhbat: " + started.status + " " + JSON.stringify(started.body).slice(0, 160));

  const all = await j("/api/conversations", authGet(seekerToken));
  if (all.status !== 200 || (all.body.items ?? []).length < 2) throw new Error("suhbat soni: " + (all.body.items ?? []).length);
  if (!("nextCursor" in all.body)) throw new Error("nextCursor maydoni yo'q (D-078)");

  const seen = [];
  let cursor = null;
  for (let page = 0; page < 8; page++) {
    const res = await j(`/api/conversations?limit=1${cursor ? `&before=${encodeURIComponent(cursor)}` : ""}`, authGet(seekerToken));
    if (res.status !== 200 || !Array.isArray(res.body.items)) throw new Error("sahifa: " + res.status + " " + JSON.stringify(res.body).slice(0, 160));
    for (const item of res.body.items) {
      if (seen.includes(item.id)) throw new Error("takror suhbat: " + item.id);
      seen.push(item.id);
    }
    cursor = res.body.nextCursor;
    if (!cursor) break;
  }
  if (cursor) throw new Error("oxirgi sahifadan keyin ham nextCursor qaytdi");
  if (seen.length !== all.body.items.length) throw new Error(`jami ${all.body.items.length}, aylanildi ${seen.length}`);
});

await check("[realtime-2] [gap2-6] WebSocket xabari telefon tasdig'ini talab qiladi (xato frame, xabar saqlanmaydi)", async () => {
  const convs = await j("/api/conversations", authGet(seeker2Token));
  const conv = convs.body.items?.[0];
  if (!conv) throw new Error("seeker2 suhbati yo'q");
  const userId = await userIdOf(seeker2Token);
  const before = await prisma.message.count({ where: { conversationId: conv.id } });
  await prisma.user.update({ where: { id: userId }, data: { isPhoneVerified: false } });
  let ws;
  try {
    ws = await wsOpen(seeker2Token);
    const frames = [];
    ws.on("message", (raw) => {
      try { frames.push(JSON.parse(String(raw))); } catch {}
    });
    ws.send(JSON.stringify({ type: "message", conversationId: conv.id, body: "Telefoni tasdiqlanmagan xabar", clientId: "w2-phone-gate" }));
    await sleep(1500);
    const after = await prisma.message.count({ where: { conversationId: conv.id } });
    if (after !== before) throw new Error("telefoni tasdiqlanmagan foydalanuvchi WS orqali xabar saqladi (realtime-2)");
    if (frames.some((f) => f?.type === "message")) throw new Error("xabar frame'i qaytdi");
    const refusal = frames.find((f) => f && (f.code === "PHONE_NOT_VERIFIED" || f.error === "PHONE_NOT_VERIFIED"));
    if (!refusal) throw new Error("PHONE_NOT_VERIFIED xato frame'i kelmadi (api-errors-6): " + JSON.stringify(frames).slice(0, 200));
  } finally {
    if (ws) ws.close();
    await prisma.user.update({ where: { id: userId }, data: { isPhoneVerified: true } });
  }
});

await check("[D-065] billing o'chiq: admin to'lov tasdiqlash 404 va overview'da billingEnabled=false", async () => {
  const confirm = await post(`/api/admin/payments/sinov-tranzaksiya-${Date.now()}/confirm`, {}, adminToken);
  if (confirm.status !== 404) throw new Error("to'lov tasdiqlash: " + confirm.status + " " + JSON.stringify(confirm.body).slice(0, 160));
  const overview = await j("/api/admin/overview", authGet(adminToken));
  if (overview.status !== 200) throw new Error("overview: " + overview.status);
  if (overview.body.billingEnabled !== false) {
    throw new Error("overview.billingEnabled yo'q yoki false emas (D-065): " + JSON.stringify(overview.body.billingEnabled));
  }
});
note("[D-065] Mavjud bo'lmagan tranzaksiya ham 404 beradi — bayroq bo'yicha 404 aynan shu tekshiruvda ajratilmaydi; ajratuvchi belgi — overview.billingEnabled=false.");

// Apostrof variantlari kod bo'yicha yasaladi (manbaga escape yozilmaydi): U+0027 U+02BB U+02BC U+2018 U+2019 U+0060 U+00B4.
// Ro'yxat `src/common/search-text.ts` dagi APOSTROPHE_CODES bilan bir xil bo'lishi shart (audit R3, D-080):
// u yerdan bitta belgi tushib qolsa, shu ro'yxatdagi variant bilan qidiruv ishlamay qoladi.
const APOSTROPHES = [0x27, 0x02bb, 0x02bc, 0x2018, 0x2019, 0x60, 0xb4].map((code) => String.fromCharCode(code));
await check("[D-080] [gap1-1] qidiruv o'zbekcha apostrof variantlarini bir xil ko'radi (vakansiya, kompaniya, nomzod, admin)", async () => {
  const jobWord = (apo) => "to" + apo + "qimachi";
  const nameWord = (apo) => "To" + apo + "qimachiyeva";

  // 1) Vakansiya: sarlavhada ASCII apostrof, qidiruvda — har bir variant
  const ascii = await newVacancy({ title: "Tajribali " + jobWord(APOSTROPHES[0]) });
  if (ascii.status !== 201) throw new Error("vakansiya: " + ascii.status + " " + JSON.stringify(ascii.body).slice(0, 160));
  for (const apo of APOSTROPHES) {
    const res = await j(`/api/vacancies?text=${encodeURIComponent(jobWord(apo))}`);
    if (res.status !== 200) throw new Error("qidiruv: " + res.status);
    if (!(res.body.items ?? []).some((v) => v.id === ascii.body.id)) {
      throw new Error(`apostrof varianti (kod ${apo.charCodeAt(0)}) bilan vakansiya topilmadi (D-080)`);
    }
  }
  // 2) Teskari yo'nalish: bazada tipografik apostrof, so'rovda ASCII
  const typographic = await newVacancy({ title: "Tajribali " + jobWord(APOSTROPHES[1]) + " (ikkinchi)" });
  if (typographic.status !== 201) throw new Error("ikkinchi vakansiya: " + typographic.status);
  const asciiQuery = await j(`/api/vacancies?text=${encodeURIComponent(jobWord(APOSTROPHES[0]))}`);
  if (!(asciiQuery.body.items ?? []).some((v) => v.id === typographic.body.id)) {
    throw new Error("tipografik apostrofli e'lon ASCII so'rov bilan topilmadi (D-080)");
  }

  // 3) Kompaniyalar katalogi
  const emp = await freshAccount("apostrof-sinov-hr@test.uz", { role: "employer", companyName: "Sinov " + jobWord(APOSTROPHES[0]) + " MChJ" });
  const company = (await j("/api/employer/company", authGet(emp.token))).body.company;
  for (const apo of [APOSTROPHES[1], APOSTROPHES[4]]) {
    const res = await j(`/api/companies?text=${encodeURIComponent(jobWord(apo))}&limit=50`);
    if (res.status !== 200) throw new Error("kompaniya qidiruvi: " + res.status);
    if (!(res.body.items ?? []).some((c) => c.id === company.id)) {
      throw new Error(`kompaniya apostrof varianti (kod ${apo.charCodeAt(0)}) bilan topilmadi (D-080)`);
    }
  }

  // 4) Nomzodlar bazasi va admin qidiruvi: familiyada tipografik apostrof, so'rovda ASCII
  const candidate = await freshAccount("apostrof-nomzod@test.uz", {
    role: "job_seeker",
    firstName: "Dilnoza",
    lastName: nameWord(APOSTROPHES[1]),
  });
  const resume = await put("/api/resume", { title: "Sotuvchi", skills: ["Savdo"], experience: [], education: [] }, candidate.token);
  if (resume.status !== 200) throw new Error("nomzod rezyumesi: " + resume.status);
  const candidates = await j(`/api/candidates?text=${encodeURIComponent(nameWord(APOSTROPHES[0]))}`, authGet(employerToken));
  if (candidates.status !== 200 || !Array.isArray(candidates.body.items)) throw new Error("nomzodlar: " + candidates.status);
  if (!candidates.body.items.some((c) => c.userId === candidate.id)) {
    throw new Error("nomzod ASCII apostrofli so'rov bilan topilmadi (D-080)");
  }
  // Admin qidiruvi ham D-080 qarorida ko'rsatilgan yuza: admin.routes.ts `textVariants()` orqali
  // `apostropheVariants` ni ishlatadi, shuning uchun bu yerda ESLATMA emas, qat'iy shart.
  const adminSearch = await j(`/api/admin/users?text=${encodeURIComponent(nameWord(APOSTROPHES[0]))}`, authGet(adminToken));
  if (adminSearch.status !== 200) throw new Error("admin qidiruvi: " + adminSearch.status);
  if (!(adminSearch.body.items ?? []).some((u) => u.id === candidate.id)) {
    throw new Error("admin foydalanuvchilar qidiruvi apostrof variantini ko'rmadi (D-080)");
  }
  // Filtr umuman qo'llanmasa ro'yxat HAMMANI qaytaradi va yuqoridagi shart bo'sh o'tib ketardi:
  // natija haqiqatan ham toraytirilganini tekshiramiz.
  const adminAll = await j("/api/admin/users", authGet(adminToken));
  if (adminAll.status !== 200) throw new Error("admin ro'yxati: " + adminAll.status);
  if ((adminSearch.body.total ?? 0) >= (adminAll.body.total ?? 0)) {
    throw new Error(
      `admin qidiruvi natijani toraytirmadi (matn filtri qo'llanmagan): ${adminSearch.body.total} / ${adminAll.body.total}`
    );
  }
});

await check("[D-077] [auth-core-10] oxirgi faol admin o'z rolini/blokini yo'qota olmaydi; oxirgi bo'lmagan admin esa tushiriladi", async () => {
  const activeAdmins = await prisma.user.count({ where: { role: "admin", isBlocked: false } });
  if (activeAdmins !== 1) throw new Error("kutilgan bitta faol admin, hozir: " + activeAdmins);
  const adminRow = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });

  // Yagona admin o'zini tushira/bloklay olmaydi (mavjud 400 qoidasi yoki yangi 409 LAST_ADMIN)
  const selfRole = await patch(`/api/admin/users/${adminRow.id}/role`, { role: "employer" }, adminToken);
  if (selfRole.status !== 400 && selfRole.status !== 409) throw new Error("oxirgi admin o'z rolini tushirdi: " + selfRole.status);
  const selfBlock = await patch(`/api/admin/users/${adminRow.id}/block`, { isBlocked: true }, adminToken);
  if (selfBlock.status !== 400 && selfBlock.status !== 409) throw new Error("oxirgi admin o'zini bloklay oldi: " + selfBlock.status);
  const still = await prisma.user.findUnique({ where: { id: adminRow.id }, select: { role: true, isBlocked: true } });
  if (still.role !== "admin" || still.isBlocked) throw new Error("admin hisobi o'zgardi: " + JSON.stringify(still));

  // Qo'riqchi ORTIQCHA bloklamasligi kerak: ikkinchi admin bo'lsa birinchisini tushirish mumkin
  const second = await freshAccount("ikkinchi-admin@test.uz", { role: "job_seeker", firstName: "Ikkinchi", lastName: "Admin" });
  try {
    const promoted = await patch(`/api/admin/users/${second.id}/role`, { role: "admin" }, adminToken);
    if (promoted.status !== 200) throw new Error("ikkinchi adminni tayinlash: " + promoted.status + " " + JSON.stringify(promoted.body).slice(0, 160));
    const secondToken = await loginAs("ikkinchi-admin@test.uz");
    if (!secondToken) throw new Error("ikkinchi admin kira olmadi");
    const demoteFirst = await patch(`/api/admin/users/${adminRow.id}/role`, { role: "employer" }, secondToken);
    if (demoteFirst.status !== 200) {
      throw new Error("oxirgi bo'lmagan adminni tushirib bo'lmadi (qo'riqchi ortiqcha): " + demoteFirst.status + " " + JSON.stringify(demoteFirst.body).slice(0, 160));
    }
    const demoted = await prisma.user.findUnique({ where: { id: adminRow.id }, select: { role: true } });
    if (demoted.role !== "employer") throw new Error("rol o'zgarmadi: " + demoted.role);
  } finally {
    // Holatni tiklaymiz: birinchi admin qaytadi, ikkinchisi oddiy foydalanuvchi bo'ladi
    await prisma.user.update({ where: { id: adminRow.id }, data: { role: "admin", isBlocked: false } });
    await prisma.user.updateMany({ where: { email: "ikkinchi-admin@test.uz" }, data: { role: "job_seeker" } });
    adminToken = await loginAs("admin@ish.top", "admin-parol-123");
  }
  if (!adminToken) throw new Error("admin qayta kira olmadi");
  const restored = await j("/api/admin/overview", authGet(adminToken));
  if (restored.status !== 200) throw new Error("tiklangan admin paneli: " + restored.status);
});
note("[D-077] 409 LAST_ADMIN kodi aynan tekshirilmaydi: yagona admin o'ziga qaratilgan so'rovda mavjud 400 qoidasi ham to'g'ri javob — 'oxirgi admin kirishni yo'qotmaydi' invarianti tekshiriladi.");

// Ikkinchi, qisqa umrli server SUKUT sozlamalari bilan: asosiy server TRUST_PROXY=true bilan ishlaydi
// (tekshiruvlar turli IP'dan kelsin uchun), bu yerda esa sukut qiymat (hop soni "1", D-053) va
// ADMIN_EMAIL bootstrap xatti-harakati (D-069) sinaladi.
const bootstrapEmail = "bootstrap-sinov@test.uz";
await postFresh("/api/auth/register", { email: bootstrapEmail, password: "parol12345", role: "job_seeker" });
const trustEnv = {
  ...env,
  PORT: String(PORT_TRUST),
  RATE_LIMIT_MAX: "100",
  // Bu server — alohida SOZLAMA sinovi, birinchisining ikkinchi nusxasi emas. Redis bilan
  // ishlaganda rate-limit hisobi prefiks bo'yicha umumiy bo'ladi: bitta prefiksda birinchi
  // serverning yuzlab so'rovi shu serverning 100 lik chegarasini darhol tugatib, /health ham
  // 429 berardi. Alohida prefiks — alohida deploy degani (DEPLOY.md).
  REDIS_PREFIX: "ishbor-e2e-2:",
  // D-069: shu email bilan hisob ALLAQACHON bor — u admin roliga ko'tarilmasligi kerak
  ADMIN_EMAIL: bootstrapEmail,
  ADMIN_PASSWORD: "bootstrap-parol-123",
};
delete trustEnv.TRUST_PROXY;
const secondServer = spawn(process.execPath, [SERVER], { cwd: ROOT, env: trustEnv, stdio: ["ignore", "pipe", "pipe"] });
let secondLog = "";
secondServer.stdout.on("data", (d) => (secondLog += d));
secondServer.stderr.on("data", (d) => (secondLog += d));
const TRUST_BASE = `http://127.0.0.1:${PORT_TRUST}`;
let secondReady = false;

await check("[R3] sukut sozlamali ikkinchi server ko'tariladi", async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${TRUST_BASE}/health`);
      if (r.ok) { secondReady = true; break; }
    } catch {}
    await sleep(500);
  }
  if (!secondReady) throw new Error("ko'tarilmadi:" + String.fromCharCode(10) + secondLog.slice(-800));
});

await check("[D-053] TRUST_PROXY sukuti: mijoz yozgan X-Forwarded-For per-IP limit kalitini o'zgartira olmaydi", async () => {
  if (!secondReady) throw new Error("ikkinchi server ishlamadi");
  // Eng chapdagi qiymatni MIJOZ yozadi, o'ngdagisini haqiqiy proxy (Railway/nginx) qo'shadi.
  // Sukut "1" bilan server faqat oxirgi (proxy qo'shgan) qiymatga ishonadi.
  const remaining = async (forwarded) => {
    const res = await fetch(`${TRUST_BASE}/api/stats`, { headers: { "x-forwarded-for": forwarded } });
    await res.arrayBuffer().catch(() => undefined);
    const raw = res.headers.get("x-ratelimit-remaining");
    if (raw === null) throw new Error("x-ratelimit-remaining sarlavhasi yo'q");
    return Number(raw);
  };
  const first = await remaining("9.9.9.9, 7.7.7.7");
  const second = await remaining("1.1.1.1, 7.7.7.7");
  if (second !== first - 1) throw new Error(`soxta X-Forwarded-For bucket'ni almashtirdi: ${first} -> ${second}`);
  const other = await remaining("1.1.1.1, 6.6.6.6");
  if (!(other > second)) throw new Error(`proxy qo'shgan haqiqiy IP bo'yicha ajratilmadi: ${second} -> ${other}`);
});

await check("[D-069] ADMIN_EMAIL bootstrap mavjud hisobni admin qilmaydi", async () => {
  if (!secondReady) throw new Error("ikkinchi server ishlamadi");
  // Bootstrap fonda ishlaydi — rol o'zgarishi uchun vaqt beramiz, keyin o'zgarmaganini tasdiqlaymiz
  await sleep(2500);
  const row = await prisma.user.findUnique({ where: { email: bootstrapEmail }, select: { role: true } });
  if (!row) throw new Error("sinov hisobi topilmadi");
  if (row.role !== "job_seeker") {
    throw new Error(
      "mavjud hisob admin roliga ko'tarildi: " +
        row.role +
        " — D-069 hali bajarilmagan: common/ensure-admin.ts mavjud hisobni admin qilmasligi kerak"
    );
  }
});

secondServer.kill("SIGTERM");

await check("[admin-staff-15] admin mutatsiyalari: mehmon 401, nomzod va ish beruvchi 403", async () => {
  const fake = "0".repeat(24);
  // BILLING_ENABLED=false bo'lsa to'lov yo'llari umuman ro'yxatdan o'tmasligi mumkin (404 ham to'g'ri)
  const routes = [
    ["PATCH", `/api/admin/users/${fake}/block`, { isBlocked: true }, false],
    ["PATCH", `/api/admin/users/${fake}/role`, { role: "employer" }, false],
    ["PATCH", `/api/admin/vacancies/${fake}/moderate`, { action: "approve" }, false],
    ["PATCH", `/api/admin/companies/${fake}/verify`, { isVerified: true }, false],
    ["PATCH", `/api/admin/reviews/${fake}`, { status: "approved" }, false],
    ["DELETE", `/api/admin/reviews/${fake}`, null, false],
    ["POST", "/api/admin/search/reindex", {}, false],
    ["POST", "/api/admin/alerts/run", {}, false],
    ["POST", "/api/admin/broadcast", { title: "Sinov", body: "Sinov xabari", role: "all" }, false],
    ["POST", `/api/admin/payments/${fake}/confirm`, {}, true],
    ["POST", `/api/admin/recovery-requests/${fake}/approve`, { note: "sinov" }, false],
    ["POST", `/api/admin/recovery-requests/${fake}/reject`, { note: "sinov" }, false],
    // Moderatsiya ish joyi
    ["POST", "/api/admin/vacancies/bulk", { ids: [fake], status: "active" }, false],
    ["POST", "/api/admin/reviews/bulk", { ids: [fake], action: "approved" }, false],
    ["PATCH", `/api/admin/support/${fake}`, { status: "resolved" }, false],
    ["POST", `/api/admin/support/${fake}/reply`, { message: "Salom" }, false],
    ["POST", "/api/admin/moderation/auto-approve/run", {}, false],
  ];
  const call = (method, path, body, token) =>
    j(path, {
      method,
      headers: { ...(body === null ? {} : { "content-type": "application/json" }), ...(token ? authH(token) : {}) },
      body: body === null ? undefined : JSON.stringify(body),
    });
  for (const [method, path, body, allowMissing] of routes) {
    const guest = await call(method, path, body, null);
    if (guest.status === 404 && allowMissing) continue;
    if (guest.status !== 401) throw new Error(`mehmon ${method} ${path}: ${guest.status}`);
    for (const [who, token] of [["nomzod", seekerToken], ["ish beruvchi", employerToken]]) {
      const res = await call(method, path, body, token);
      if (res.status !== 403) throw new Error(`${who} ${method} ${path}: ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`);
    }
  }
  // O'qish yo'llari ham
  for (const path of [
    "/api/admin/overview",
    "/api/admin/users",
    "/api/admin/recovery-requests",
    "/api/admin/counters",
    "/api/admin/support",
    "/api/admin/moderation-log",
    "/api/admin/broadcasts",
    `/api/admin/vacancies/${fake}`,
    `/api/admin/users/${fake}`,
  ]) {
    const guest = await j(path);
    if (guest.status !== 401) throw new Error(`mehmon GET ${path}: ${guest.status}`);
    const seeker = await j(path, { headers: authH(seekerToken) });
    if (seeker.status !== 403) throw new Error(`nomzod GET ${path}: ${seeker.status}`);
  }
});

await check("[D-055] Google: yaroqsiz credential seans bermaydi va 500 qaytarmaydi", async () => {
  const res = await postFresh("/api/auth/google", { credential: "soxta.google.tokeni", role: "job_seeker" });
  if (res.status === 200 || res.body?.accessToken) throw new Error("soxta token bilan seans berildi: " + JSON.stringify(res.body).slice(0, 120));
  if (res.status >= 500 && res.status !== 503) throw new Error("kutilmagan xato: " + res.status + " " + JSON.stringify(res.body));
});
note("[D-055] Google avtomatik birlashtirishni rad etish (409 GOOGLE_ACCOUNT_EXISTS) tekshirilmaydi: Google imzolagan haqiqiy ID token kerak, GOOGLE_CLIENT_ID esa bu yerda bo'sh. Qaror `auth.service.ts` `googleLogin` da `mergeable` sharti bilan amalga oshirilgan.");
note("[D-045] Parolni tiklash, telefonni almashtirish, zaxira telefon va qo'lda tiklash oqimlari Telegram botisiz ishlamaydi — ular `scripts/auth-telegram-check.mjs` da (TELEGRAM_TEST_MODE=1) tekshiriladi.");


// ===================== Moderatsiya: murojaatlar, jurnal, ommaviy amallar, moderator roli =====================
await check("[moderatsiya] vakansiya shikoyati vakansiyaga bog'lanadi, admin navbatida va ro'yxatda ko'rinadi", async () => {
  const created = await newVacancy({ title: "Shikoyat sinovi" });
  if (created.status !== 201 || created.body.status !== "active") throw new Error("e'lon: " + created.status + " " + JSON.stringify(created.body).slice(0, 160));
  const bad = await post(`/api/vacancies/${created.body.slug}/report`, { reason: "spam" });
  if (bad.status !== 400) throw new Error("noto'g'ri sabab: " + bad.status);
  const rep = await post(`/api/vacancies/${created.body.slug}/report`, { reason: "fraud", comment: "Oldindan pul so'rashyapti" }, seekerToken);
  if (rep.status !== 200) throw new Error("shikoyat: " + rep.status + " " + JSON.stringify(rep.body));
  // Bir foydalanuvchining takroriy shikoyati navbatni to'ldirmaydi
  await post(`/api/vacancies/${created.body.slug}/report`, { reason: "fraud" }, seekerToken);
  const count = await prisma.supportTicket.count({ where: { vacancyId: created.body.id, kind: "vacancy_report" } });
  if (count !== 1) throw new Error("takroriy shikoyat yozildi: " + count);

  const inbox = await j("/api/admin/support?kind=vacancy_report&status=open", authGet(adminToken));
  const item = inbox.body.items?.find((x) => x.vacancy?.id === created.body.id);
  if (inbox.status !== 200 || !item || item.subject !== "fraud" || !item.account) throw new Error("admin qutisi: " + JSON.stringify(inbox.body).slice(0, 240));
  const list = await j(`/api/admin/vacancies?text=${encodeURIComponent("Shikoyat sinovi")}`, authGet(adminToken));
  const row = list.body.items?.find((x) => x.id === created.body.id);
  if (!row || row.openReports !== 1) throw new Error("ro'yxatda shikoyat soni: " + JSON.stringify(row));

  const detail = await j(`/api/admin/vacancies/${created.body.id}`, authGet(adminToken));
  if (detail.status !== 200 || detail.body.reports?.length !== 1 || !detail.body.description) throw new Error("tafsilot: " + JSON.stringify(detail.body).slice(0, 200));

  // Holat o'zgarishi va izoh jurnalga tushadi
  const upd = await patch(`/api/admin/support/${item.id}`, { status: "resolved", adminNote: "E'lon tekshirildi" }, adminToken);
  if (upd.status !== 200 || upd.body.status !== "resolved") throw new Error("holat: " + upd.status);
  const reply = await post(`/api/admin/support/${item.id}/reply`, { message: "Rahmat" }, adminToken);
  if (reply.status !== 503 || reply.body.error !== "EMAIL_DISABLED") throw new Error("SMTP'siz javob: " + reply.status + " " + JSON.stringify(reply.body));
  const logRes = await j(`/api/admin/moderation-log?entityType=ticket&entityId=${item.id}`, authGet(adminToken));
  if (!logRes.body.items?.some((e) => e.action === "ticket_status" && e.actorId)) throw new Error("jurnal: " + JSON.stringify(logRes.body).slice(0, 200));
});

await check("[moderatsiya] ommaviy arxivlash: har biri tekshiriladi, jurnalga kim qilgani bilan yoziladi", async () => {
  const a = await newVacancy({ title: "Ommaviy A" });
  const b = await newVacancy({ title: "Ommaviy B" });
  const fake = "0".repeat(24);
  const res = await post("/api/admin/vacancies/bulk", { ids: [a.body.id, b.body.id, fake], status: "archived" }, adminToken);
  if (res.status !== 200 || res.body.done !== 2 || res.body.failed?.length !== 1) throw new Error(JSON.stringify(res.body));
  const rows = await prisma.vacancy.findMany({ where: { id: { in: [a.body.id, b.body.id] } }, select: { status: true, adminArchivedAt: true } });
  if (!rows.every((r) => r.status === "archived" && r.adminArchivedAt)) throw new Error("arxivlanmadi: " + JSON.stringify(rows));
  const logRes = await j(`/api/admin/moderation-log?entityType=vacancy&entityId=${a.body.id}`, authGet(adminToken));
  const ev = logRes.body.items?.[0];
  if (!ev || ev.action !== "archived" || !ev.actorName || ev.meta?.title !== "Ommaviy A") throw new Error("jurnal: " + JSON.stringify(ev));
  const tooMany = await post("/api/admin/vacancies/bulk", { ids: Array.from({ length: 101 }, () => fake), status: "archived" }, adminToken);
  if (tooMany.status !== 400) throw new Error("101 ta id: " + tooMany.status);
});

await check("[moderatsiya] kompaniya tasdiq so'rovi: STIR tekshiruvi, admin navbati, sababli rad etish", async () => {
  const bad = await post("/api/employer/company/verification", { legalName: "NextBrain MChJ", stir: "12345" }, employerToken);
  if (bad.status !== 400) throw new Error("qisqa STIR: " + bad.status);
  const ok = await post("/api/employer/company/verification", { legalName: "NextBrain MChJ", stir: "305123456" }, employerToken);
  if (ok.status !== 200 || !ok.body.company?.verificationRequestedAt) throw new Error("so'rov: " + ok.status + " " + JSON.stringify(ok.body));
  const queue = await j("/api/admin/companies?requested=1", authGet(adminToken));
  const row = queue.body.items?.find((c) => c.stir === "305123456");
  if (!row || row.legalName !== "NextBrain MChJ") throw new Error("navbat: " + JSON.stringify(queue.body).slice(0, 200));
  const counters = await j("/api/admin/counters", authGet(adminToken));
  if (counters.status !== 200 || counters.body.companies < 1 || counters.body.support < 0) throw new Error("hisoblagichlar: " + JSON.stringify(counters.body));
  const rej = await patch(`/api/admin/companies/${row.id}/verify`, { isVerified: false, note: "STIR mos kelmadi" }, adminToken);
  if (rej.status !== 200) throw new Error("rad etish: " + rej.status);
  const after = await prisma.company.findUnique({ where: { id: row.id }, select: { isVerified: true, verificationRequestedAt: true, verificationNote: true } });
  if (after.isVerified || after.verificationRequestedAt || after.verificationNote !== "STIR mos kelmadi") throw new Error("holat: " + JSON.stringify(after));
  const ev = await prisma.moderationEvent.findFirst({ where: { entityType: "company", entityId: row.id }, orderBy: { createdAt: "desc" } });
  if (ev?.action !== "verification_rejected" || ev.reason !== "STIR mos kelmadi") throw new Error("jurnal: " + JSON.stringify(ev));
});

await check("[moderatsiya] moderator roli: moderatsiya bo'limlari ochiq, foydalanuvchilar/umumiy/ommaviy xabar yopiq", async () => {
  const argon2 = (await import("argon2")).default;
  await prisma.user.create({
    data: { email: "moderator@test.uz", passwordHash: await argon2.hash("parol12345"), role: "moderator", isEmailVerified: true, isPhoneVerified: true },
  });
  const modToken = await loginAs("moderator@test.uz");
  if (!modToken) throw new Error("moderator kira olmadi");
  for (const path of ["/api/admin/vacancies", "/api/admin/reviews", "/api/admin/companies", "/api/admin/support", "/api/admin/moderation-log", "/api/admin/counters"]) {
    const res = await j(path, authGet(modToken));
    if (res.status !== 200) throw new Error(`moderator GET ${path}: ${res.status}`);
  }
  for (const path of ["/api/admin/overview", "/api/admin/users", "/api/admin/recovery-requests", "/api/admin/broadcasts", "/api/admin/team", "/api/admin/articles"]) {
    const res = await j(path, authGet(modToken));
    if (res.status !== 403) throw new Error(`moderator GET ${path}: ${res.status}`);
  }
  const bc = await post("/api/admin/broadcast", { title: "Sinov", body: "Sinov xabari", role: "all" }, modToken);
  if (bc.status !== 403) throw new Error("moderator ommaviy xabar: " + bc.status);
  // Moderatorning qarori jurnalda uning nomi bilan
  const v = await newVacancy({ title: "Moderator arxivlaydi" });
  const mod = await patch(`/api/admin/vacancies/${v.body.id}/moderate`, { status: "archived" }, modToken);
  if (mod.status !== 200) throw new Error("moderator qarori: " + mod.status);
  // Jurnal yozuvi javobni kutdirmasdan yoziladi (`recordModeration` — fire-and-forget),
  // shuning uchun darhol o'qish poygaga tushadi: yozuv paydo bo'lguncha qisqa kutamiz.
  let ev = null;
  for (let i = 0; i < 20 && !ev; i++) {
    ev = await prisma.moderationEvent.findFirst({ where: { entityId: v.body.id }, orderBy: { createdAt: "desc" } });
    if (!ev) await sleep(100);
  }
  const modRow = await prisma.user.findUnique({ where: { email: "moderator@test.uz" }, select: { id: true } });
  if (ev?.actorId !== modRow.id) throw new Error("jurnalda moderator yo'q: " + JSON.stringify(ev));
});

await check("[moderatsiya] foydalanuvchi kartochkasi: kompaniya, e'lonlar, murojaatlar bir joyda", async () => {
  const hr = await prisma.user.findUnique({ where: { email: "hr@test.uz" }, select: { id: true } });
  const res = await j(`/api/admin/users/${hr.id}`, authGet(adminToken));
  if (res.status !== 200 || res.body.role !== "employer" || res.body.companies?.length < 1 || res.body.vacancies?.total < 1) {
    throw new Error(JSON.stringify(res.body).slice(0, 240));
  }
  if ("passwordHash" in res.body || JSON.stringify(res.body).includes("password")) throw new Error("maxfiy maydon");
  const seeker = await prisma.user.findUnique({ where: { email: "seeker@test.uz" }, select: { id: true } });
  const s = await j(`/api/admin/users/${seeker.id}`, authGet(adminToken));
  if (s.status !== 200 || s.body.applications?.total < 1 || s.body.tickets?.length < 1) throw new Error("nomzod: " + JSON.stringify(s.body).slice(0, 240));
});

// Oldindan moderatsiya va 24 soatlik avto-tasdiq — SUKUT sozlamali uchinchi server (bir xil baza)
const modEnv = { ...env, PORT: String(PORT_MOD), REDIS_PREFIX: "ishbor-e2e-3:" };
delete modEnv.VACANCY_PREMODERATION;
delete modEnv.REVIEW_PREMODERATION;
const modServer = spawn(process.execPath, [SERVER], { cwd: ROOT, env: modEnv, stdio: ["ignore", "pipe", "pipe"] });
let modLog = "";
modServer.stdout.on("data", (d) => (modLog += d));
modServer.stderr.on("data", (d) => (modLog += d));
const MOD_BASE = `http://127.0.0.1:${PORT_MOD}`;
const j3 = async (path, init) => {
  const res = await fetch(MOD_BASE + path, init);
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
};
const post3 = (path, data, token, ip) =>
  j3(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? authH(token) : {}), ...(ip ? { "x-forwarded-for": ip } : {}) },
    body: JSON.stringify(data ?? {}),
  });
let modReady = false;
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`${MOD_BASE}/health`);
    if (r.ok) { modReady = true; break; }
  } catch {}
  await sleep(500);
}

await check("[moderatsiya] sukut: tasdiqlanmagan kompaniya e'loni navbatga tushadi, admin tasdig'i bilan chiqadi", async () => {
  if (!modReady) throw new Error("uchinchi server ko'tarilmadi:\n" + modLog.slice(-800));
  const reg = await post3("/api/auth/register", { email: "premod@test.uz", password: "parol12345", role: "employer", companyName: "Premod MChJ" }, null, nextIp());
  if (reg.status !== 200) throw new Error("ro'yxat: " + reg.status + " " + JSON.stringify(reg.body));
  await prisma.user.update({ where: { email: "premod@test.uz" }, data: { isPhoneVerified: true } });
  const token = reg.body.accessToken;
  const base = { description: "Oldindan moderatsiya tavsifi", employmentType: "full_time", categoryId: cats[0].id, regionId: regions[0].id, workplaceType: "office" };
  const v = await post3("/api/vacancies", { ...base, title: "Premod birinchi" }, token);
  if (v.status !== 201 || v.body.status !== "moderation" || v.body.publishedAt) throw new Error("navbatga tushmadi: " + JSON.stringify(v.body).slice(0, 200));
  if ((await j3(`/api/vacancies/${v.body.slug}`)).status !== 404) throw new Error("navbatdagi e'lon ochiq sahifada");
  // Qoralama birinchi marta chiqarilganda ham navbatga
  const draft = await post3("/api/vacancies", { ...base, title: "Premod qoralama", status: "draft" }, token);
  const pub = await j3(`/api/vacancies/${draft.body.id}/status`, { method: "PATCH", headers: { "content-type": "application/json", ...authH(token) }, body: JSON.stringify({ status: "active" }) });
  if (pub.status !== 200 || pub.body.status !== "moderation") throw new Error("qoralama navbatni chetlab o'tdi: " + JSON.stringify(pub.body).slice(0, 160));

  const approve = await j3(`/api/admin/vacancies/${v.body.id}/moderate`, { method: "PATCH", headers: { "content-type": "application/json", ...authH(adminToken) }, body: JSON.stringify({ status: "active" }) });
  if (approve.status !== 200 || approve.body.status !== "active") throw new Error("tasdiq: " + approve.status + " " + JSON.stringify(approve.body));
  // Bildirishnoma fonda yoziladi — qisqa kutish
  let note = null;
  for (let i = 0; i < 20 && !note; i++) {
    note = await prisma.notification.findFirst({ where: { title: "Vakansiya e'lon qilindi", user: { email: "premod@test.uz" } } });
    if (!note) await sleep(150);
  }
  if (!note) throw new Error("ish beruvchiga tasdiq xabari bormadi");

  // Tasdiqlangan kompaniya — darhol e'lon qilinadi
  await prisma.company.updateMany({ where: { name: "Premod MChJ" }, data: { isVerified: true } });
  const fast = await post3("/api/vacancies", { ...base, title: "Premod tasdiqlangan" }, token);
  if (fast.body.status !== "active") throw new Error("tasdiqlangan kompaniya navbatga tushdi: " + fast.body.status);
  await prisma.company.updateMany({ where: { name: "Premod MChJ" }, data: { isVerified: false } });
});

await check("[moderatsiya] 24 soatlik avto-tasdiq: muddati o'tgani faollashadi, yangisi va to'ldirilmagani navbatda qoladi", async () => {
  if (!modReady) throw new Error("uchinchi server ishlamadi");
  const H = 3600_000;
  const owner = await prisma.user.findUnique({ where: { email: "premod@test.uz" }, select: { id: true } });
  const company = await prisma.company.findFirst({ where: { ownerUserId: owner.id } });
  const mk = (title, extra) => prisma.vacancy.create({
    data: {
      companyId: company.id, title, slug: `avto-${title.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}`, description: "Avto tasdiq",
      employmentType: "full_time", categoryId: cats[0].id, regionId: regions[0].id, workplaceType: "office", status: "moderation", ...extra,
    },
  });
  const due = await mk("Avto eski", { moderationSubmittedAt: new Date(Date.now() - 25 * H) });
  const fresh = await mk("Avto yangi", { moderationSubmittedAt: new Date(Date.now() - 1 * H) });
  const incomplete = await mk("Avto to'liqmas", { moderationSubmittedAt: new Date(Date.now() - 30 * H), categoryId: null });

  const run = await j3("/api/admin/moderation/auto-approve/run", { method: "POST", headers: { "content-type": "application/json", ...authH(adminToken) }, body: "{}" });
  if (run.status !== 200 || !run.body.enabled || run.body.vacancies < 1) throw new Error("sweep: " + JSON.stringify(run.body));
  const rows = await prisma.vacancy.findMany({ where: { id: { in: [due.id, fresh.id, incomplete.id] } }, select: { id: true, status: true, autoApprovedAt: true, publishedAt: true, moderationNudgedAt: true } });
  const by = new Map(rows.map((r) => [r.id, r]));
  if (by.get(due.id).status !== "active" || !by.get(due.id).autoApprovedAt || !by.get(due.id).publishedAt) throw new Error("eski: " + JSON.stringify(by.get(due.id)));
  if (by.get(fresh.id).status !== "moderation") throw new Error("yangi faollashdi");
  if (by.get(incomplete.id).status !== "moderation" || !by.get(incomplete.id).moderationNudgedAt) throw new Error("to'liqmas: " + JSON.stringify(by.get(incomplete.id)));
  const ev = await prisma.moderationEvent.findFirst({ where: { entityId: due.id, action: "auto_approved" } });
  if (!ev || ev.actorId) throw new Error("jurnal (tizim): " + JSON.stringify(ev));
  await sleep(500);
  const nudge = await prisma.notification.count({ where: { userId: owner.id, title: "Vakansiyani to'ldiring" } });
  // Ikkinchi yurish — xabar takrorlanmaydi
  await j3("/api/admin/moderation/auto-approve/run", { method: "POST", headers: { "content-type": "application/json", ...authH(adminToken) }, body: "{}" });
  await sleep(500);
  const nudge2 = await prisma.notification.count({ where: { userId: owner.id, title: "Vakansiyani to'ldiring" } });
  if (nudge !== 1 || nudge2 !== 1) throw new Error(`"to'ldiring" xabari: ${nudge} -> ${nudge2}`);

  // "Tekshirildi": admin avto-tasdiqlangan e'lonni ko'rib chiqadi — belgi olinadi
  const reviewed = await j3(`/api/admin/vacancies/${due.id}/moderate`, { method: "PATCH", headers: { "content-type": "application/json", ...authH(adminToken) }, body: JSON.stringify({ status: "active" }) });
  if (reviewed.status !== 200 || reviewed.body.autoApprovedAt !== null) throw new Error("tekshirildi: " + JSON.stringify(reviewed.body));
});

await check("[moderatsiya] sukut: yangi sharh navbatga tushadi, 24 soatdan keyin avtomatik chop etiladi", async () => {
  if (!modReady) throw new Error("uchinchi server ishlamadi");
  const v = await prisma.vacancy.findFirst({ where: { title: "Premod birinchi", status: "active" } });
  const company = await prisma.company.findUnique({ where: { id: v.companyId }, select: { slug: true } });
  const reg = await post3("/api/auth/register", { email: "premod-seeker@test.uz", password: "parol12345", role: "job_seeker", firstName: "Sharh", lastName: "Yozuvchi" }, null, nextIp());
  await prisma.user.update({ where: { email: "premod-seeker@test.uz" }, data: { isPhoneVerified: true } });
  const token = reg.body.accessToken;
  // Sharh uchun shu kompaniyaga ariza bo'lishi shart — ariza oqimi boshqa tekshiruvlarda sinalgan
  const seekerRow = await prisma.user.findUnique({ where: { email: "premod-seeker@test.uz" }, select: { id: true } });
  await prisma.application.create({ data: { vacancyId: v.id, jobSeekerId: seekerRow.id } });
  const review = await post3(`/api/companies/${company.slug}/reviews`, { rating: 4, comment: "Yaxshi jamoa" }, token);
  if (review.status !== 201 || review.body.status !== "pending") throw new Error("sharh: " + JSON.stringify(review.body));
  await prisma.companyReview.update({ where: { id: review.body.id }, data: { submittedAt: new Date(Date.now() - 25 * 3600_000) } });
  const run = await j3("/api/admin/moderation/auto-approve/run", { method: "POST", headers: { "content-type": "application/json", ...authH(adminToken) }, body: "{}" });
  if (run.body.reviews < 1) throw new Error("sweep: " + JSON.stringify(run.body));
  const after = await prisma.companyReview.findUnique({ where: { id: review.body.id }, select: { status: true, autoApprovedAt: true } });
  if (after.status !== "approved" || !after.autoApprovedAt) throw new Error("sharh: " + JSON.stringify(after));
});

modServer.kill("SIGTERM");

await check("[ISSUE-030] [PHASE6-U34] loglarda WebSocket access tokeni yo'q (token= ko'rinishida ham, tokenning o'zi ham)", async () => {
  if (/token=eyJ/.test(log)) throw new Error("token logda");
  // Redaksiya `token=` naqshini kesadi; tokenning o'zi boshqa ko'rinishda (xato obyekti, to'liq URL) ham chiqmasligi kerak (audit PHASE 6, U34)
  for (const token of new Set([seekerToken, employerToken, ...wsTokens])) {
    if (token && log.includes(token)) throw new Error("WebSocket'da ishlatilgan access token server logida");
  }
});

await prisma.$disconnect();
server.kill("SIGTERM");
await sleep(1500);

if (failed > 0) console.error("\nServer loglari (oxirgi 30 qator):\n" + log.split("\n").slice(-30).join("\n"));
console.log(failed === 0 ? "\nHAMMASI O'TDI" : `\n${failed} TA XATO`);
process.exit(failed === 0 ? 0 : 1);
