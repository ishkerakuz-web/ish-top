// ============================================================
// AUTH + TELEGRAM regressiya tekshiruvi (audit R3, D-062).
//
// Nima qiladi:
//  - alohida TEST bazasini tozalab ko'taradi (`prisma db push --force-reset`);
//  - `dist/server.js` ni NODE_ENV=test + TELEGRAM_TEST_MODE=1 bilan ishga tushiradi;
//  - SHU JARAYONNING o'zida `dist/modules/telegram/telegram.service.js` ni import qilib,
//    `setTelegramTransportForTests()` bilan botning chiquvchi xabarlarini ushlab qoladi va
//    `handleTelegramUpdate()` ga sun'iy update'lar beradi (private chat, from.id, /start payload, contact).
//
// Ya'ni faqat TRANSPORT soxta: challenge, identity, yagonalik, seans va audit mantig'i
// haqiqiy kod va haqiqiy baza ustida tekshiriladi (D-062).
//
// Qamrov (owner test matritsasi): kirish, chiqish, bloklangan hisob, rol o'zgarishi,
// muddati o'tgan token, bekor qilingan token, Telegram tasdig'i, yaroqsiz/eskirgan/qayta
// ishlatilgan payload, oddiy /start havolasi, parolni tiklash (uchdan-uchgacha), bir martalik
// reset token, eskirgan reset token, yangi token eskisini bekor qilishi, telefonni almashtirish,
// zaxira telefon (qo'shish/olib tashlash/yagonalik), dublikat Telegram identity va telefon,
// noma'lum raqam uchun "decoy" javob, qo'lda tiklash (admin tasdig'i bilan), admin javoblarida
// maxfiy maydon yo'qligi, har qadam uchun SecurityEvent, serverda log gigienasi, Telegram
// mavjud bo'lmaganda 503 va olib tashlangan Telegram-login yo'llari (404).
//
// Bundan tashqari bazaga tegmaydigan SOF tekshiruvlar (telefon normalizatsiyasi va niqoblash,
// payload/reset token formati), botning chat bo'yicha yumshoq limiti, callback tugmalari endi
// seans bermasligi, nomzodlar bazasidagi telefon gate'i (D-071) va tasdiqlangan raqamsiz
// telefon oqimlarining 409 javobi ham shu yerda.
//
// Ishlatish:
//   npm run build
//   AUTH_TEST_DATABASE_URL="mongodb://127.0.0.1:27018/ishbor_authtest?replicaSet=rs0" npm run test:auth
//
// DIQQAT: skript bazaga YOZADI va uni TOZALAYDI — shu sababli faqat nomida "test"
// bo'lgan bazaga ruxsat beriladi. Asosiy `DATABASE_URL` ataylab ishlatilmaydi.
// ============================================================
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const uri =
  process.env.AUTH_TEST_DATABASE_URL ?? "mongodb://127.0.0.1:27018/ishbor_authtest?replicaSet=rs0";

// Bu skript FAQAT `AUTH_TEST_DATABASE_URL` ni o'qiydi (e2e bazasini tasodifan tozalab
// yubormaslik uchun `E2E_DATABASE_URL` ataylab qabul qilinmaydi). Berilmagan bo'lsa qaysi
// baza ishlatilayotgani aniq yoziladi — operator boshqa bazani nazarda tutgan bo'lsa ko'rsin.
if (!process.env.AUTH_TEST_DATABASE_URL) {
  console.log(`  ESLATMA AUTH_TEST_DATABASE_URL berilmadi — sukut baza: ${uri}`);
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

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PRISMA_CLI = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const SERVER = fileURLToPath(new URL("../dist/server.js", import.meta.url));
const BOT_MODULE = fileURLToPath(new URL("../dist/modules/telegram/telegram.service.js", import.meta.url));
// Sof (bazasiz) yordamchilar: telefon normalizatsiyasi/niqoblash va challenge tokenlari (audit R3, D-043, D-042)
const PHONE_MODULE = fileURLToPath(new URL("../dist/common/phone.js", import.meta.url));
const CHALLENGE_MODULE = fileURLToPath(new URL("../dist/modules/auth/challenges.js", import.meta.url));
const requireFromApi = createRequire(join(ROOT, "package.json"));

if (!existsSync(SERVER)) {
  console.error(`${SERVER} topilmadi. Avval: npm run build`);
  process.exit(1);
}

// Eskirgan build yolg'on natija beradi (e2e-check.mjs bilan bir xil qoida)
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

// ------------------------------------------------------------
// Sozlamalar va serverlar
// ------------------------------------------------------------
const PORT = 4714;
// Telegram MAVJUD EMAS holati uchun ikkinchi (qisqa umrli) server — test rejimisiz va tokensiz
const PORT_OFFLINE = 4715;
const WEB_ORIGIN = "https://sayt.example";
const ACCESS_SECRET = "auth-test-access-secret-0123456789-A1";
const REFRESH_SECRET = "auth-test-refresh-secret-0123456789-B2";
const ADMIN_EMAIL = "admin@auth.test";
const ADMIN_PASSWORD = "admin-auth-parol-123";
const SSR_KEY = "auth-test-ssr-kaliti-0123456789-abcdef";

/** Hermetik muhit: mahalliy `.env` natijani o'zgartirmasin (e2e-check.mjs bilan bir xil usul). */
const NO_DOTENV = join(tmpdir(), `ishbor-auth-${process.pid}-mavjud-emas.env`);

const baseEnv = {
  ...process.env,
  DATABASE_URL: uri,
  WEB_ORIGIN,
  JWT_ACCESS_SECRET: ACCESS_SECRET,
  JWT_REFRESH_SECRET: REFRESH_SECRET,
  BILLING_ENABLED: "false",
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_ADMIN_CHAT_ID: "",
  // Tashqi muhitdan meros qolgan qiymat "Telegram mavjud emas" tarmog'ini buzmasin:
  // test rejimi FAQAT asosiy serverga aniq beriladi (pastda)
  TELEGRAM_TEST_MODE: "",
  SMTP_HOST: "",
  SMTP_USER: "",
  SMTP_PASS: "",
  MEILI_HOST: "",
  MEILI_API_KEY: "",
  UPLOAD_DIR: "",
  GOOGLE_CLIENT_ID: "",
  VAPID_PUBLIC_KEY: "",
  VAPID_PRIVATE_KEY: "",
  SUPPORT_EMAIL: "",
  SUPPORT_TELEGRAM: "",
  SUPPORT_PHONE: "",
  SUPPORT_ADDRESS: "",
  SUPPORT_HOURS: "",
  SUPPORT_RESPONSE_HOURS: "",
  PARTNERSHIP_EMAIL: "",
  CORS_EXTRA_ORIGINS: "",
  CORS_PREVIEW_ORIGIN_REGEX: "",
  SSR_API_KEY: SSR_KEY,
  // Har so'rov boshqa X-Forwarded-For bilan yuboriladi — IP bo'yicha kvotalar matritsani to'xtatmasin
  TRUST_PROXY: "true",
  RATE_LIMIT_MAX: "3000",
  /**
   * Redis: sukut bo'yicha O'CHIQ. Yoqilsa (`AUTH_TEST_REDIS_URL`) prefiks HAR YUGURISHDA
   * boshqacha — aks holda kvotalar ("bitta raqamga soatiga 5 ta so'rov") yugurishlar orasida
   * qolib ketadi va ikkinchi marta ishga tushirganda testlar 429 oladi; dev serverning
   * kalitlari bilan ham aralashib ketardi.
   */
  REDIS_URL: process.env.AUTH_TEST_REDIS_URL ?? "",
  REDIS_PREFIX: `ishbor-auth-${process.pid}:`,
  /**
   * Foydalanuvchi holati keshi. Bu skript bot oqimlarini O'Z JARAYONIDA bajaradi
   * (`handleTelegramUpdate`), ya'ni telefon tasdig'i serverdan TASHQARIDA yoziladi va
   * server keshi bundan bexabar qoladi. Prodda bunday emas: bot server ichida ishlaydi,
   * bir nechta nusxa esa Redis pub/sub orqali kelishadi. Shuning uchun kesh sukut bo'yicha
   * o'chiq; Redis berilgan bo'lsa (signal jarayonlar orasida yetadi) yoqiladi.
   */
  AUTH_CACHE_MS: process.env.AUTH_TEST_CACHE_MS ?? (process.env.AUTH_TEST_REDIS_URL ? "10000" : "0"),
  DOTENV_CONFIG_PATH: NO_DOTENV,
};

const server = spawn(process.execPath, [SERVER], {
  cwd: ROOT,
  env: { ...baseEnv, NODE_ENV: "test", TELEGRAM_TEST_MODE: "1", PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));

let offlineServer = null;
let offlineLog = "";

function killServers() {
  try { server.kill("SIGTERM"); } catch {}
  try { offlineServer?.kill("SIGTERM"); } catch {}
}
process.on("exit", killServers);

const BASE = `http://127.0.0.1:${PORT}`;
const OFFLINE_BASE = `http://127.0.0.1:${PORT_OFFLINE}`;

async function waitForHealth(base, timeoutTicks = 80) {
  for (let i = 0; i < timeoutTicks; i++) {
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) return true;
    } catch {}
    await sleep(500);
  }
  return false;
}

if (!(await waitForHealth(BASE))) {
  console.error("Server ko'tarilmadi:\n" + log);
  killServers();
  process.exit(1);
}

// ------------------------------------------------------------
// Bot moduli SHU jarayonda: env avval, keyin import (D-062)
// ------------------------------------------------------------
process.env.DATABASE_URL = uri;
process.env.NODE_ENV = "test";
process.env.TELEGRAM_TEST_MODE = "1";
process.env.JWT_ACCESS_SECRET = ACCESS_SECRET;
process.env.JWT_REFRESH_SECRET = REFRESH_SECRET;
process.env.WEB_ORIGIN = WEB_ORIGIN;
process.env.TELEGRAM_BOT_TOKEN = "";
process.env.BILLING_ENABLED = "false";
// Bot moduli server bilan BIR XIL Redis/prefiks va kesh sozlamasini ko'rsin: shunda shu
// jarayondagi yozuv serverning holat keshini ham bekor qiladi (Redis yoqilgan holatda)
process.env.REDIS_URL = baseEnv.REDIS_URL;
process.env.REDIS_PREFIX = baseEnv.REDIS_PREFIX;
process.env.AUTH_CACHE_MS = baseEnv.AUTH_CACHE_MS;
process.env.DOTENV_CONFIG_PATH = NO_DOTENV;

let botModule = null;
let botLoadError = null;
try {
  botModule = await import(pathToFileURL(BOT_MODULE).href);
} catch (e) {
  botLoadError = e;
}

/** Botdan chiqqan xabarlar (transport chaqiruvlari) — argumentlar JSON ko'rinishida saqlanadi. */
const sent = [];
let transportReady = false;
if (botModule && typeof botModule.setTelegramTransportForTests === "function") {
  botModule.setTelegramTransportForTests((...args) => {
    sent.push(args);
    const id = sent.length;
    // Turli chaqiruv shakllari uchun "muvaffaqiyat" javobi
    return { ok: true, message_id: id, result: { message_id: id } };
  });
  transportReady = true;
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: uri } } });

/** Sxemada yangi model bo'lmasa — aniq xabar (jim o'tib ketmasin). */
function model(name) {
  const m = prisma[name];
  if (!m || typeof m.findFirst !== "function") {
    throw new Error(`Prisma modeli yo'q: ${name} (sxema yangilanmagan yoki prisma generate qilinmagan)`);
  }
  return m;
}

// ------------------------------------------------------------
// Tekshiruv yordamchilari
// ------------------------------------------------------------
let failed = 0;
let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log("  OK  " + name);
  } catch (e) {
    failed++;
    console.error("  XATO " + name + ": " + (e?.message ?? e));
  }
}
function note(text) {
  console.log("  ESLATMA " + text);
}

/** Loglarda va javoblarda uchramasligi kerak bo'lgan qiymatlar (parol, token, kod, payload). */
const secrets = new Set();
const keepSecret = (value, why) => {
  if (typeof value === "string" && value.length >= 8) secrets.add(value);
  return value;
};

let ipSeq = 0;
const nextIp = () => `10.42.${Math.floor(++ipSeq / 250) % 250}.${(ipSeq % 250) + 1}`;

function setCookiesOf(res) {
  if (typeof res.headers.getSetCookie === "function") return res.headers.getSetCookie();
  const raw = res.headers.get("set-cookie");
  return raw ? [raw] : [];
}
const refreshCookieOf = (cookies) => {
  for (const c of cookies ?? []) {
    const m = /(?:^|;\s*)refreshToken=([^;]*)/.exec(c);
    if (m && m[1]) return `refreshToken=${m[1]}`;
  }
  return null;
};

async function req(method, path, options = {}) {
  const { token, body, cookie, base = BASE, headers = {} } = options;
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
      "x-forwarded-for": options.ip ?? nextIp(),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = text;
  try { parsed = JSON.parse(text); } catch {}
  return { status: res.status, body: parsed, text, cookies: setCookiesOf(res) };
}
const get = (path, opts) => req("GET", path, opts);
const post = (path, body, opts = {}) => req("POST", path, { ...opts, body: body ?? {} });
const del = (path, body, opts = {}) => req("DELETE", path, { ...opts, body: body ?? {} });

// `undefined` da JSON.stringify ham `undefined` qaytaradi — xato xabari o'rniga TypeError
// chiqib, haqiqiy sabab ko'rinmay qolardi (audit R3 reviewer).
const short = (v) => (v === undefined ? "undefined" : String(JSON.stringify(v)).slice(0, 300));

/** Hisob yaratish (parol secrets ro'yxatiga tushadi). */
async function createAccount(email, role, extra = {}) {
  const password = keepSecret(`parol-${email.split("@")[0]}-123`);
  const res = await post("/api/auth/register", { email, password, role, ...extra });
  if (res.status !== 200 || !res.body?.accessToken) {
    throw new Error(`register ${email}: ${res.status} ${short(res.body)}`);
  }
  const row = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!row) throw new Error(`register ${email}: baza qatori topilmadi`);
  keepSecret(res.body.accessToken);
  return {
    email,
    password,
    id: row.id,
    token: res.body.accessToken,
    refresh: refreshCookieOf(res.cookies),
    phone: null,
    telegramId: null,
  };
}

async function login(account, password = account.password) {
  const res = await post("/api/auth/login", { email: account.email, password });
  if (res.status !== 200 || !res.body?.accessToken) {
    throw new Error(`login ${account.email}: ${res.status} ${short(res.body)}`);
  }
  account.token = keepSecret(res.body.accessToken);
  account.refresh = refreshCookieOf(res.cookies) ?? account.refresh;
  return account.token;
}

// ------------------------------------------------------------
// Telegram update'lari (private chat; chat.id === from.id)
// ------------------------------------------------------------
let updateSeq = 1000;
const nextId = () => ++updateSeq;

function tgUpdate(fromId, messageExtra, chatExtra = {}) {
  const id = nextId();
  return {
    update_id: id,
    message: {
      message_id: id,
      date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: "Sinov", language_code: "uz" },
      chat: { id: fromId, type: "private", first_name: "Sinov", ...chatExtra },
      ...messageExtra,
    },
  };
}
const startUpdate = (fromId, payload) => tgUpdate(fromId, { text: payload ? `/start ${payload}` : "/start" });
const contactUpdate = (fromId, phoneNumber, contactUserId = fromId) =>
  tgUpdate(fromId, { contact: { phone_number: phoneNumber, first_name: "Sinov", user_id: contactUserId } });

/** Bir update'ni ishlatadi va SHU update natijasida chiqqan xabarlarni qaytaradi. */
async function drive(update) {
  if (!botModule || typeof botModule.handleTelegramUpdate !== "function") {
    throw new Error("telegram.service.js `handleTelegramUpdate` eksport qilmaydi (D-062)");
  }
  const from = sent.length;
  await botModule.handleTelegramUpdate(update);
  return sent.slice(from);
}
const dumpOf = (messages) => messages.map((m) => JSON.stringify(m)).join("\n");
const textsOf = (messages) =>
  messages.flatMap((m) => [...JSON.stringify(m).matchAll(/"text":"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]));

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RESET_LINK_RE = new RegExp(escapeRegExp(WEB_ORIGIN) + "/login\\?reset=([A-Za-z0-9_-]{16,})");

/** Deep-link (`https://t.me/<bot>?start=<payload>`) ichidan payload. */
function payloadOf(link) {
  if (typeof link !== "string") throw new Error("link satr emas: " + short(link));
  let value = null;
  try { value = new URL(link).searchParams.get("start"); } catch {}
  if (!value) value = /[?&]start=([A-Za-z0-9_-]+)/.exec(link)?.[1] ?? null;
  if (!value) throw new Error("deep-link ichida start payload yo'q: " + link);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(value)) throw new Error("payload formati noto'g'ri: " + value);
  return keepSecret(value);
}

/** Botdan kelgan xabarlardan reset tokenini oladi. */
function resetTokenOf(messages) {
  const m = RESET_LINK_RE.exec(dumpOf(messages));
  if (!m) throw new Error("bot reset havolasini yubormadi: " + dumpOf(messages).slice(0, 400));
  return keepSecret(m[1]);
}

async function securityEvents(userId) {
  return model("securityEvent").findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}
const hasEvent = (events, type) => events.some((e) => e.type === type);

/**
 * Hodisalar "yoz va unut" tarzida yoziladi (common/security-events.ts) — HTTP javobidan keyin
 * bir necha o'n millisekund kechikishi mumkin. Shuning uchun qisqa kutish bilan o'qiymiz;
 * baribir kelmasa — aniq xato (jim o'tkazib yuborilmaydi).
 */
async function waitForEvents(userId, types, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const events = await securityEvents(userId);
    const missing = types.filter((type) => !hasEvent(events, type));
    if (missing.length === 0) return events;
    if (Date.now() >= deadline) throw new Error("hodisa yozilmadi: " + missing.join(", "));
    await sleep(200);
  }
}

/** Tur bo'yicha (foydalanuvchisiz ham) kamida bitta hodisa. */
async function waitForEventTypes(types, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const all = await model("securityEvent").findMany({});
    const present = new Set(all.map((e) => e.type));
    const missing = types.filter((type) => !present.has(type));
    if (missing.length === 0) return all;
    if (Date.now() >= deadline) throw new Error("yozilmagan hodisa turlari: " + missing.join(", "));
    await sleep(200);
  }
}

// ------------------------------------------------------------
// Telefon raqamlari (yagona, +998...)
// ------------------------------------------------------------
const PHONE = {
  link: "+998901110011",
  dup: "+998901110022",
  pcOld: "+998901110033",
  pcNew: "+998901110044",
  bkPrimary: "+998901110055",
  bkBackup: "+998901110066",
  bk2Primary: "+998901110144",
  bk2Backup: "+998901110155",
  unlink: "+998901110077",
  r1: "+998901110088",
  r2: "+998901110099",
  r3: "+998901110100",
  mr: "+998901110111",
  mrNew: "+998901110122",
  dup2: "+998901110133",
  unknown: "+998901119999",
};

// Telegram identity'lari (from.id)
const TG = {
  link: 5000001,
  dup: 5000002,
  pc: 5000011,
  bkPrimary: 5000021,
  bkBackup: 5000022,
  bk2Primary: 5000023,
  bk2Backup: 5000024,
  unlink: 5000031,
  r1: 5000041,
  r2: 5000042,
  r3: 5000043,
  mr: 5000051,
  mrNew: 5000052,
  dup2: 5000061,
  stranger: 5000099,
};

// ------------------------------------------------------------
// 0. Test harness'ning o'zi
// ------------------------------------------------------------
await check("[D-062] telegram.service test eksportlari mavjud (handleTelegramUpdate, setTelegramTransportForTests)", async () => {
  if (botLoadError) throw new Error("modulni import qilib bo'lmadi: " + (botLoadError?.message ?? botLoadError));
  if (typeof botModule.handleTelegramUpdate !== "function") throw new Error("handleTelegramUpdate eksport qilinmagan");
  if (typeof botModule.setTelegramTransportForTests !== "function") throw new Error("setTelegramTransportForTests eksport qilinmagan");
  if (!transportReady) throw new Error("transport o'rnatilmadi");
});

// ------------------------------------------------------------
// 0a. Sof yordamchilar (bazasiz): telefon va token formatlari
// ------------------------------------------------------------
await check("[D-043] normalizePhone/maskPhone: 9 xonali raqamga 998 qo'shiladi, 10-15 raqam chegarasi, niqobda faqat kod va oxirgi 2 raqam", async () => {
  const { normalizePhone, maskPhone, isValidPhone } = await import(pathToFileURL(PHONE_MODULE).href);
  const cases = [
    ["901234567", "+998901234567"],
    ["+998 90 123-45-67", "+998901234567"],
    ["998901234567", "+998901234567"],
    ["1234567890", "+1234567890"],
    ["12", null],
    ["123456789012345678", null],
    [null, null],
  ];
  for (const [input, expected] of cases) {
    const got = normalizePhone(input);
    if (got !== expected) throw new Error(`${short(input)} -> ${short(got)} (kutilgan ${short(expected)})`);
  }
  if (isValidPhone("12") !== false || isValidPhone("901234567") !== true) throw new Error("isValidPhone");
  const masked = maskPhone("+998901234567");
  if (!masked || !masked.startsWith("+998")) throw new Error("niqobda mamlakat kodi yo'q: " + short(masked));
  if (!masked.endsWith("67")) throw new Error("niqobda oxirgi 2 raqam yo'q: " + short(masked));
  if (masked.includes("9012345")) throw new Error("niqob raqamni ochib qo'ydi: " + masked);
  if (maskPhone(null) !== null) throw new Error("maskPhone(null)");
});

await check("[D-042] deep-link payload va reset tokeni: base64url, PAYLOAD_RE ga mos, bazada faqat sha256", async () => {
  const { randomToken, sha256hex, PAYLOAD_RE } = await import(pathToFileURL(CHALLENGE_MODULE).href);
  const payload = randomToken();
  if (payload.length !== 32) throw new Error("payload uzunligi: " + payload.length);
  if (!PAYLOAD_RE.test(payload)) throw new Error("payload PAYLOAD_RE ga mos emas: " + payload);
  const reset = randomToken(32);
  if (!PAYLOAD_RE.test(reset)) throw new Error("reset tokeni PAYLOAD_RE ga mos emas");
  if (randomToken() === randomToken()) throw new Error("tokenlar takrorlanmoqda");
  const hash = sha256hex(payload);
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("sha256 hex emas: " + hash);
  if (hash.includes(payload)) throw new Error("hash ichida ochiq token bor");
  if (sha256hex(payload) !== hash) throw new Error("sha256 barqaror emas");
  for (const bad of ["qisqa", "a".repeat(65), "yaroqsiz payload!!", ""]) {
    if (PAYLOAD_RE.test(bad)) throw new Error("yaroqsiz payload qabul qilindi: " + short(bad));
  }
});

// ------------------------------------------------------------
// 1. Hisoblar
// ------------------------------------------------------------
let uLink, uDup, uDup2, uPc, uBk, uBk2, uUnlink, uR1, uR2, uR3, uMr, uGate, uBlock, uRole, adminToken, adminId;

await check("[R3] hisoblar yaratiladi va oddiy kirish ishlaydi (email + parol)", async () => {
  uLink = await createAccount("link@test.uz", "job_seeker", { firstName: "Link", lastName: "Sinov" });
  uDup = await createAccount("dup@test.uz", "job_seeker", { firstName: "Dup", lastName: "Sinov" });
  uDup2 = await createAccount("dup2@test.uz", "job_seeker", { firstName: "Dup2", lastName: "Sinov" });
  uPc = await createAccount("pc@test.uz", "job_seeker", { firstName: "Pc", lastName: "Sinov" });
  uBk = await createAccount("bk@test.uz", "job_seeker", { firstName: "Bk", lastName: "Sinov" });
  uBk2 = await createAccount("bk2@test.uz", "job_seeker", { firstName: "Bk2", lastName: "Sinov" });
  uUnlink = await createAccount("unlink@test.uz", "job_seeker", { firstName: "Un", lastName: "Sinov" });
  uR1 = await createAccount("r1@test.uz", "job_seeker", { firstName: "R1", lastName: "Sinov" });
  uR2 = await createAccount("r2@test.uz", "job_seeker", { firstName: "R2", lastName: "Sinov" });
  uR3 = await createAccount("r3@test.uz", "job_seeker", { firstName: "R3", lastName: "Sinov" });
  uMr = await createAccount("mr@test.uz", "job_seeker", { firstName: "Mr", lastName: "Sinov" });
  uBlock = await createAccount("block@test.uz", "job_seeker", { firstName: "Bl", lastName: "Sinov" });
  uRole = await createAccount("role@test.uz", "job_seeker", { firstName: "Ro", lastName: "Sinov" });
  uGate = await createAccount("gate@test.uz", "employer", { companyName: "Gate MChJ" });

  const me = await get("/api/auth/me", { token: uLink.token });
  if (me.status !== 200 || me.body?.email !== "link@test.uz") throw new Error("/me: " + me.status + " " + short(me.body));
  // Noto'g'ri parol — 401 (hisob bor-yo'qligi oshkor bo'lmaydi)
  const bad = await post("/api/auth/login", { email: uLink.email, password: "butunlay-boshqa-parol" });
  if (bad.status !== 401) throw new Error("noto'g'ri parol: " + bad.status);
});

await check("[R3] admin hisobi (ADMIN_EMAIL) bootstrap bilan yaratilgan va kira oladi", async () => {
  let res = null;
  for (let i = 0; i < 40; i++) {
    res = await post("/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    if (res.status === 200) break;
    await sleep(500);
  }
  if (res?.status !== 200 || !res.body?.accessToken) throw new Error("admin login: " + res?.status + " " + short(res?.body));
  adminToken = keepSecret(res.body.accessToken);
  keepSecret(ADMIN_PASSWORD);
  const row = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL.toLowerCase() } });
  if (!row || row.role !== "admin") throw new Error("admin roli yo'q: " + short(row?.role));
  adminId = row.id;
});

// ------------------------------------------------------------
// 2. Seans: chiqish, muddati o'tgan token, bekor qilingan token, blok, rol
// ------------------------------------------------------------
await check("[R3] chiqish (logout) barcha seanslarni bekor qiladi: eski access token 401, refresh cookie null", async () => {
  const tmp = await createAccount("logout@test.uz", "job_seeker", { firstName: "Lo", lastName: "Sinov" });
  const before = await get("/api/auth/me", { token: tmp.token });
  if (before.status !== 200) throw new Error("kirishdan keyin /me: " + before.status);
  const out = await post("/api/auth/logout", {}, { cookie: tmp.refresh });
  if (out.status !== 200) throw new Error("logout: " + out.status + " " + short(out.body));
  const after = await get("/api/auth/me", { token: tmp.token });
  if (after.status !== 401) throw new Error("logoutdan keyin eski access token: " + after.status);
  const refreshed = await post("/api/auth/refresh", {}, { cookie: tmp.refresh });
  if (refreshed.status !== 200 || refreshed.body?.accessToken !== null) {
    throw new Error("logoutdan keyin refresh: " + refreshed.status + " " + short(refreshed.body));
  }
});

await check("[R3] muddati o'tgan access token 401 (test siri bilan imzolangan)", async () => {
  const jwt = requireFromApi("jsonwebtoken");
  const expired = jwt.sign(
    { sub: uLink.id, role: "job_seeker", v: 0, typ: "access" },
    ACCESS_SECRET,
    { algorithm: "HS256", expiresIn: "-10m" }
  );
  const res = await get("/api/auth/me", { token: expired });
  if (res.status !== 401) throw new Error("muddati o'tgan token: " + res.status + " " + short(res.body));
  // Imzo boshqa sir bilan bo'lsa ham 401
  const wrongSecret = jwt.sign({ sub: uLink.id, role: "admin", v: 0, typ: "access" }, "boshqa-sir-0123456789abcdef", {
    algorithm: "HS256",
    expiresIn: "15m",
  });
  const res2 = await get("/api/auth/me", { token: wrongSecret });
  if (res2.status !== 401) throw new Error("begona sir bilan imzolangan token: " + res2.status);
});

await check("[R3] bloklangan hisob: access token 403 USER_BLOCKED, blokdan chiqqach yana ishlaydi (SecurityEvent bilan)", async () => {
  const blocked = await req("PATCH", `/api/admin/users/${uBlock.id}/block`, { token: adminToken, body: { isBlocked: true } });
  if (blocked.status !== 200) throw new Error("bloklash: " + blocked.status + " " + short(blocked.body));
  const me = await get("/api/auth/me", { token: uBlock.token });
  if (me.status !== 403 || me.body?.error !== "USER_BLOCKED") throw new Error("bloklangan /me: " + me.status + " " + short(me.body));
  const unblocked = await req("PATCH", `/api/admin/users/${uBlock.id}/block`, { token: adminToken, body: { isBlocked: false } });
  if (unblocked.status !== 200) throw new Error("blokdan chiqarish: " + unblocked.status);
  await login(uBlock);
  const after = await get("/api/auth/me", { token: uBlock.token });
  if (after.status !== 200) throw new Error("blokdan keyin kirish: " + after.status);
  await waitForEvents(uBlock.id, ["user_blocked", "user_unblocked"]);
});

await check("[R3] rol o'zgarishi eski tokenni bekor qiladi (401) va role_changed hodisasi yoziladi", async () => {
  const changed = await req("PATCH", `/api/admin/users/${uRole.id}/role`, { token: adminToken, body: { role: "employer" } });
  if (changed.status !== 200) throw new Error("rol: " + changed.status + " " + short(changed.body));
  const me = await get("/api/auth/me", { token: uRole.token });
  if (me.status !== 401) throw new Error("rol o'zgargach eski token: " + me.status + " " + short(me.body));
  await waitForEvents(uRole.id, ["role_changed", "sessions_invalidated"]);
});

// ------------------------------------------------------------
// 3. Telegram: holat, oddiy /start, bog'lash va telefonni tasdiqlash
// ------------------------------------------------------------
await check("[D-051] GET /api/telegram/status: test rejimida available=true, bot username ma'lum", async () => {
  const res = await get("/api/telegram/status", { token: uLink.token });
  if (res.status !== 200) throw new Error("status: " + res.status + " " + short(res.body));
  const b = res.body;
  for (const key of ["linked", "phoneVerified", "phone", "backupPhone", "available", "botUsername"]) {
    if (!(key in b)) throw new Error(`javobda "${key}" yo'q: ` + short(b));
  }
  if (b.linked !== false || b.phoneVerified !== false) throw new Error("boshlang'ich holat: " + short(b));
  if (b.available !== true) throw new Error("TELEGRAM_TEST_MODE'da available=false: " + short(b));
  if (!b.botUsername) throw new Error("botUsername bo'sh");
});

await check("[D-046] payloadsiz /start saytga kirish havolasini yuboradi (Rule C)", async () => {
  const messages = await drive(startUpdate(TG.stranger, ""));
  if (messages.length === 0) throw new Error("bot javob bermadi");
  const dump = dumpOf(messages);
  if (!dump.includes(`${WEB_ORIGIN}/login`)) throw new Error("javobda sayt havolasi yo'q: " + dump.slice(0, 300));
});

let genericInvalidReply = null;
await check("[D-046] yaroqsiz va noma'lum payload uchun bitta umumiy javob (hisob mavjudligi oshkor bo'lmaydi)", async () => {
  const broken = await drive(startUpdate(TG.stranger, "yaroqsiz-payload!!!"));
  const unknown = await drive(startUpdate(TG.stranger, "A".repeat(32)));
  if (broken.length === 0 || unknown.length === 0) throw new Error("bot javob bermadi");
  const a = textsOf(broken).join("|");
  const b = textsOf(unknown).join("|");
  if (a !== b) throw new Error(`javoblar farq qiladi:\n  ${a}\n  ${b}`);
  genericInvalidReply = a;
  const state = await prisma.user.findUnique({ where: { id: uLink.id } });
  if (state.telegramChatId || state.isPhoneVerified) throw new Error("yaroqsiz payload hisobni o'zgartirdi");
});

await check("[D-041] callback tugmalari seans bermaydi: faqat answerCallbackQuery, xabar yuborilmaydi", async () => {
  const id = nextId();
  const messages = await drive({
    update_id: id,
    callback_query: {
      id: "cb-" + id,
      from: { id: TG.stranger, is_bot: false, first_name: "Sinov" },
      data: "lgok:" + "a".repeat(32),
      message: { message_id: id, date: Math.floor(Date.now() / 1000), chat: { id: TG.stranger, type: "private" } },
    },
  });
  if (messages.length === 0) throw new Error("callback javobsiz qoldi");
  for (const call of messages) {
    if (call[0] !== "answerCallbackQuery") throw new Error("callback boshqa metodni chaqirdi: " + short(call[0]));
  }
  const dump = dumpOf(messages);
  if (/accessToken|refreshToken|login\?token=/i.test(dump)) throw new Error("callback javobida seans belgisi bor");
});

await check("[D-046] chat bo'yicha yumshoq limit: daqiqasiga 30 update, ortiqchasi jimgina tashlanadi", async () => {
  // Alohida chat: boshqa tekshiruvlarning kvotasiga tegmaydi
  const FLOOD_ID = 5000777;
  let answered = 0;
  for (let i = 0; i < 30; i++) {
    if ((await drive(startUpdate(FLOOD_ID, ""))).length > 0) answered++;
  }
  if (answered !== 30) throw new Error("limitdan oldin javobsiz update bor: " + answered);
  let ignored = 0;
  for (let i = 0; i < 5; i++) {
    if ((await drive(startUpdate(FLOOD_ID, ""))).length === 0) ignored++;
  }
  if (ignored !== 5) throw new Error("chat limiti ishlamadi (ortiqcha update javob oldi): " + ignored);
});

await check("[D-042] eskirgan deep-link payload ishlamaydi (aynan o'sha umumiy javob)", async () => {
  const link = await post("/api/telegram/link", {}, { token: uLink.token });
  if (link.status !== 200 || !link.body?.link) throw new Error("link: " + link.status + " " + short(link.body));
  if (!link.body.expiresAt) throw new Error("expiresAt yo'q: " + short(link.body));
  const payload = payloadOf(link.body.link);
  const expired = await model("authChallenge").updateMany({
    where: { userId: uLink.id, purpose: "telegram_link", status: "pending" },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  if (!expired?.count) throw new Error("AuthChallenge qatori topilmadi (purpose=telegram_link)");
  const messages = await drive(startUpdate(TG.link, payload));
  const text = textsOf(messages).join("|");
  if (genericInvalidReply && text !== genericInvalidReply) {
    throw new Error("eskirgan payload boshqacha javob berdi: " + text);
  }
  const state = await prisma.user.findUnique({ where: { id: uLink.id } });
  if (state.telegramChatId) throw new Error("eskirgan payload chatni bog'ladi");
});

let linkPayload = null;
await check("[D-044] telegram_link: deep-link -> guruh chatida ishlamaydi, private chatda kontakt so'raladi", async () => {
  const link = await post("/api/telegram/link", {}, { token: uLink.token });
  if (link.status !== 200) throw new Error("link: " + link.status + " " + short(link.body));
  linkPayload = payloadOf(link.body.link);

  // Guruh chat: auth oqimlari faqat private chatda (D-043, telegram-10)
  const group = {
    update_id: nextId(),
    message: {
      message_id: nextId(),
      date: Math.floor(Date.now() / 1000),
      from: { id: TG.link, is_bot: false, first_name: "Sinov" },
      chat: { id: -100500, type: "supergroup", title: "Guruh" },
      text: `/start ${linkPayload}`,
    },
  };
  await drive(group);
  const afterGroup = await model("authChallenge").findFirst({ where: { userId: uLink.id, purpose: "telegram_link" }, orderBy: { createdAt: "desc" } });
  if (afterGroup?.status === "awaiting_contact" || afterGroup?.telegramUserId) {
    throw new Error("guruh chatidagi /start challenge'ni ilgarilatdi: " + short(afterGroup));
  }

  const messages = await drive(startUpdate(TG.link, linkPayload));
  if (messages.length === 0) throw new Error("bot javob bermadi");
  const challenge = await model("authChallenge").findFirst({ where: { userId: uLink.id, purpose: "telegram_link" }, orderBy: { createdAt: "desc" } });
  if (challenge?.status !== "awaiting_contact") throw new Error("challenge holati: " + short(challenge?.status));
  if (String(challenge?.telegramUserId) !== String(TG.link)) throw new Error("telegramUserId: " + short(challenge?.telegramUserId));
});

await check("[D-044] kontakt ulashish: raqam normalizatsiya qilinadi, telefon tasdiqlanadi, hodisalar yoziladi", async () => {
  // Boshqa odamning kontakti qabul qilinmaydi (contact.user_id !== from.id)
  await drive(contactUpdate(TG.link, "998900000000", TG.stranger));
  let state = await prisma.user.findUnique({ where: { id: uLink.id } });
  if (state.isPhoneVerified) throw new Error("begona kontakt telefonni tasdiqladi");

  // "+" siz va bo'shliqli raqam ham normalizatsiya qilinadi: +998901110011
  const messages = await drive(contactUpdate(TG.link, "998 90 111 00 11"));
  if (messages.length === 0) throw new Error("bot javob bermadi");
  state = await prisma.user.findUnique({ where: { id: uLink.id } });
  if (state.phone !== PHONE.link) throw new Error("telefon: " + short(state.phone));
  if (!state.isPhoneVerified) throw new Error("isPhoneVerified false");
  if (String(state.telegramChatId) !== String(TG.link)) throw new Error("telegramChatId: " + short(state.telegramChatId));
  if (!state.phoneVerifiedAt) throw new Error("phoneVerifiedAt yozilmadi");
  uLink.phone = PHONE.link;
  uLink.telegramId = TG.link;

  const challenge = await model("authChallenge").findFirst({ where: { userId: uLink.id, purpose: "telegram_link" }, orderBy: { createdAt: "desc" } });
  if (challenge?.status !== "completed") throw new Error("challenge yopilmadi: " + short(challenge?.status));

  await waitForEvents(uLink.id, ["telegram_linked", "phone_verified"]);

  const status = await get("/api/telegram/status", { token: uLink.token });
  if (status.body?.linked !== true || status.body?.phoneVerified !== true) throw new Error("status: " + short(status.body));
});

await check("[D-042] ishlatilgan payload qayta ishlatilmaydi (replay)", async () => {
  const messages = await drive(startUpdate(TG.link, linkPayload));
  const text = textsOf(messages).join("|");
  if (genericInvalidReply && text !== genericInvalidReply) throw new Error("replay boshqacha javob berdi: " + text);
  const state = await prisma.user.findUnique({ where: { id: uLink.id } });
  if (state.phone !== PHONE.link) throw new Error("replay telefonni o'zgartirdi: " + short(state.phone));
});

await check("[D-044] tasdiqlangan raqam bor foydalanuvchiga POST /api/telegram/link 409 USE_PHONE_CHANGE beradi", async () => {
  const res = await post("/api/telegram/link", {}, { token: uLink.token });
  if (res.status !== 409 || res.body?.error !== "USE_PHONE_CHANGE") throw new Error(res.status + " " + short(res.body));
  if (res.body?.link) throw new Error("409 javobida deep-link berildi");
});

await check("[D-044] faol challenge'siz kontakt telefonni o'zgartirmaydi", async () => {
  const messages = await drive(contactUpdate(TG.link, "998905550000"));
  if (messages.length === 0) throw new Error("bot javob bermadi");
  const state = await prisma.user.findUnique({ where: { id: uLink.id } });
  if (state.phone !== PHONE.link) throw new Error("challenge'siz kontakt telefonni almashtirdi: " + short(state.phone));
});

// ------------------------------------------------------------
// 4. Yagonalik: bir xil telefon va bir xil Telegram identity
// ------------------------------------------------------------
await check("[D-043] dublikat telefon: boshqa hisob shu raqamni tasdiqlay olmaydi", async () => {
  const link = await post("/api/telegram/link", {}, { token: uDup.token });
  if (link.status !== 200) throw new Error("link: " + link.status + " " + short(link.body));
  await drive(startUpdate(TG.dup, payloadOf(link.body.link)));
  const messages = await drive(contactUpdate(TG.dup, PHONE.link.replace("+", "")));
  if (messages.length === 0) throw new Error("bot javob bermadi");
  const dupState = await prisma.user.findUnique({ where: { id: uDup.id } });
  if (dupState.isPhoneVerified || dupState.phone === PHONE.link) throw new Error("dublikat telefon tasdiqlandi: " + short(dupState.phone));
  const owner = await prisma.user.findUnique({ where: { id: uLink.id } });
  if (owner.phone !== PHONE.link || !owner.isPhoneVerified) throw new Error("egasining raqami o'zgardi: " + short(owner.phone));
});

await check("[D-043] dublikat Telegram identity: boshqa hisobga jim ko'chirilmaydi", async () => {
  const link = await post("/api/telegram/link", {}, { token: uDup.token });
  if (link.status !== 200) throw new Error("link: " + link.status + " " + short(link.body));
  const messages = await drive(startUpdate(TG.link, payloadOf(link.body.link)));
  const text = textsOf(messages).join("|");
  if (genericInvalidReply && text !== genericInvalidReply) {
    // Umumiy javob bo'lmasa ham, asosiysi — hech narsa o'zgarmasligi
    note("band identity uchun javob umumiy matndan farq qiladi: " + text.slice(0, 120));
  }
  const owner = await prisma.user.findUnique({ where: { id: uLink.id } });
  if (String(owner.telegramChatId) !== String(TG.link)) throw new Error("egasining chat bog'lanishi uzildi: " + short(owner.telegramChatId));
  const dupState = await prisma.user.findUnique({ where: { id: uDup.id } });
  if (dupState.telegramChatId) throw new Error("band identity yangi hisobga bog'landi");
});

// ------------------------------------------------------------
// 5. Parolni tiklash (Rule B, I, J)
// ------------------------------------------------------------
/** Foydalanuvchiga tasdiqlangan telefon va Telegram identity beradi (link oqimi orqali). */
async function verifyPhone(account, telegramId, phone) {
  const link = await post("/api/telegram/link", {}, { token: account.token });
  if (link.status !== 200) throw new Error(`${account.email} link: ${link.status} ${short(link.body)}`);
  await drive(startUpdate(telegramId, payloadOf(link.body.link)));
  await drive(contactUpdate(telegramId, phone.replace("+", "")));
  const state = await prisma.user.findUnique({ where: { id: account.id } });
  if (state.phone !== phone || !state.isPhoneVerified) {
    throw new Error(`${account.email} telefon tasdiqlanmadi: ${short(state.phone)}`);
  }
  account.phone = phone;
  account.telegramId = telegramId;
  return state;
}

let r1ResetToken = null;
await check("[D-045] parolni tiklash uchdan-uchgacha: start -> bot -> reset havolasi -> check -> reset", async () => {
  await verifyPhone(uR1, TG.r1, PHONE.r1);
  await login(uR1);
  const oldToken = uR1.token;
  const oldRefresh = uR1.refresh;

  const start = await post("/api/auth/recovery/start", { phone: PHONE.r1 });
  if (start.status !== 200 || !start.body?.link || !start.body?.expiresAt) {
    throw new Error("recovery/start: " + start.status + " " + short(start.body));
  }
  const payload = payloadOf(start.body.link);
  const messages = await drive(startUpdate(TG.r1, payload));
  r1ResetToken = resetTokenOf(messages);

  const checkRes = await post("/api/auth/recovery/check", { token: r1ResetToken });
  if (checkRes.status !== 200 || checkRes.body?.valid !== true) throw new Error("recovery/check: " + checkRes.status + " " + short(checkRes.body));

  const newPassword = keepSecret("yangi-parol-r1-2026");
  const reset = await post("/api/auth/recovery/reset", { token: r1ResetToken, password: newPassword });
  if (reset.status !== 200 || reset.body?.ok !== true) throw new Error("recovery/reset: " + reset.status + " " + short(reset.body));
  if (reset.text.includes("accessToken") || reset.text.includes("refreshToken")) throw new Error("reset javobida token qaytdi");
  // Seans cookie orqali ham berilmaydi: foydalanuvchi yangi parol bilan QAYTA kiradi (D-045)
  if (refreshCookieOf(reset.cookies)) throw new Error("reset javobi refresh cookie o'rnatdi");

  // Eski seanslar bekor
  const me = await get("/api/auth/me", { token: oldToken });
  if (me.status !== 401) throw new Error("tiklashdan keyin eski access token: " + me.status);
  const refreshed = await post("/api/auth/refresh", {}, { cookie: oldRefresh });
  if (refreshed.status !== 200 || refreshed.body?.accessToken !== null) throw new Error("eski refresh cookie: " + short(refreshed.body));

  // Eski parol ishlamaydi, yangisi ishlaydi
  const oldPw = await post("/api/auth/login", { email: uR1.email, password: uR1.password });
  if (oldPw.status !== 401) throw new Error("eski parol bilan kirish: " + oldPw.status);
  uR1.password = newPassword;
  await login(uR1);

  const state = await prisma.user.findUnique({ where: { id: uR1.id } });
  if (!state.passwordChangedAt) throw new Error("passwordChangedAt yozilmadi");

  await waitForEvents(uR1.id, ["recovery_started", "recovery_verified", "recovery_completed", "sessions_invalidated"]);
});

await check("[D-045] reset token bir martalik", async () => {
  const again = await post("/api/auth/recovery/reset", { token: r1ResetToken, password: "boshqa-parol-r1-2026" });
  if (again.status !== 400 || again.body?.error !== "RESET_TOKEN_INVALID") {
    throw new Error("qayta ishlatilgan token: " + again.status + " " + short(again.body));
  }
  const checkRes = await post("/api/auth/recovery/check", { token: r1ResetToken });
  if (checkRes.status !== 200 || checkRes.body?.valid !== false) throw new Error("check: " + checkRes.status + " " + short(checkRes.body));
});

await check("[D-045] muddati o'tgan reset token qabul qilinmaydi", async () => {
  await verifyPhone(uR2, TG.r2, PHONE.r2);
  const start = await post("/api/auth/recovery/start", { phone: PHONE.r2 });
  if (start.status !== 200) throw new Error("recovery/start: " + start.status + " " + short(start.body));
  const messages = await drive(startUpdate(TG.r2, payloadOf(start.body.link)));
  const token = resetTokenOf(messages);
  const expired = await model("authChallenge").updateMany({
    where: { userId: uR2.id, purpose: "password_recovery", status: "verified" },
    data: { resetExpiresAt: new Date(Date.now() - 60_000) },
  });
  if (!expired?.count) throw new Error("password_recovery challenge topilmadi");
  const checkRes = await post("/api/auth/recovery/check", { token });
  if (checkRes.status !== 200 || checkRes.body?.valid !== false) throw new Error("check: " + checkRes.status + " " + short(checkRes.body));
  const reset = await post("/api/auth/recovery/reset", { token, password: "yangi-parol-r2-2026" });
  if (reset.status !== 400 || reset.body?.error !== "RESET_TOKEN_INVALID") throw new Error("reset: " + reset.status + " " + short(reset.body));
  const ok = await post("/api/auth/login", { email: uR2.email, password: uR2.password });
  if (ok.status !== 200) throw new Error("eski parol ishlamay qoldi: " + ok.status);
});

await check("[D-045] yangi tiklashdan keyin eski reset token bloklanadi", async () => {
  await verifyPhone(uR3, TG.r3, PHONE.r3);
  const first = await post("/api/auth/recovery/start", { phone: PHONE.r3 });
  if (first.status !== 200) throw new Error("1-start: " + first.status + " " + short(first.body));
  const token1 = resetTokenOf(await drive(startUpdate(TG.r3, payloadOf(first.body.link))));

  const second = await post("/api/auth/recovery/start", { phone: PHONE.r3 });
  if (second.status !== 200) throw new Error("2-start: " + second.status + " " + short(second.body));
  const token2 = resetTokenOf(await drive(startUpdate(TG.r3, payloadOf(second.body.link))));
  if (token1 === token2) throw new Error("ikki tiklashda bir xil token berildi");

  const newPassword = keepSecret("yangi-parol-r3-2026");
  const reset = await post("/api/auth/recovery/reset", { token: token2, password: newPassword });
  if (reset.status !== 200) throw new Error("2-token bilan reset: " + reset.status + " " + short(reset.body));
  uR3.password = newPassword;

  const stale = await post("/api/auth/recovery/reset", { token: token1, password: "yana-boshqa-parol-2026" });
  if (stale.status !== 400 || stale.body?.error !== "RESET_TOKEN_INVALID") {
    throw new Error("eski token hali ishlaydi: " + stale.status + " " + short(stale.body));
  }
  const ok = await post("/api/auth/login", { email: uR3.email, password: newPassword });
  if (ok.status !== 200) throw new Error("yangi parol bilan kirish: " + ok.status);
});

await check("[D-045] noma'lum raqam uchun javob bir xil (decoy) va bot reset havolasi yubormaydi", async () => {
  const real = await post("/api/auth/recovery/start", { phone: PHONE.r1 });
  const decoy = await post("/api/auth/recovery/start", { phone: PHONE.unknown });
  if (decoy.status !== real.status) throw new Error(`status farqi: ${real.status} vs ${decoy.status}`);
  const realKeys = Object.keys(real.body ?? {}).sort().join(",");
  const decoyKeys = Object.keys(decoy.body ?? {}).sort().join(",");
  if (realKeys !== decoyKeys) throw new Error(`javob shakli farq qiladi: ${realKeys} vs ${decoyKeys}`);
  const messages = await drive(startUpdate(TG.stranger, payloadOf(decoy.body.link)));
  if (RESET_LINK_RE.test(dumpOf(messages))) throw new Error("decoy challenge reset havolasini berdi");
  const bad = await post("/api/auth/recovery/start", { phone: "12" });
  if (bad.status !== 400) throw new Error("noto'g'ri format: " + bad.status + " " + short(bad.body));
});

// ------------------------------------------------------------
// 6. Telefonni almashtirish (Rule G)
// ------------------------------------------------------------
await check("[D-048] telefonni almashtirish: parol majburiy, yangi raqam tasdiqlanadi, seanslar bekor bo'ladi", async () => {
  await verifyPhone(uPc, TG.pc, PHONE.pcOld);
  await login(uPc);
  const oldToken = uPc.token;

  const noPassword = await post("/api/auth/phone/change", {}, { token: uPc.token });
  if (noPassword.status !== 400 && noPassword.status !== 401) throw new Error("parolsiz: " + noPassword.status + " " + short(noPassword.body));
  const wrong = await post("/api/auth/phone/change", { password: "butunlay-boshqa-parol" }, { token: uPc.token });
  if (wrong.status !== 401 || wrong.body?.error !== "INVALID_PASSWORD") throw new Error("noto'g'ri parol: " + wrong.status + " " + short(wrong.body));

  const start = await post("/api/auth/phone/change", { password: uPc.password }, { token: uPc.token });
  if (start.status !== 200 || !start.body?.link) throw new Error("phone/change: " + start.status + " " + short(start.body));
  await drive(startUpdate(TG.pc, payloadOf(start.body.link)));

  // Joriy raqamning o'zi qabul qilinmaydi
  await drive(contactUpdate(TG.pc, PHONE.pcOld.replace("+", "")));
  let state = await prisma.user.findUnique({ where: { id: uPc.id } });
  if (state.phone !== PHONE.pcOld) throw new Error("holat buzildi: " + short(state.phone));

  await drive(contactUpdate(TG.pc, PHONE.pcNew.replace("+", "")));
  state = await prisma.user.findUnique({ where: { id: uPc.id } });
  if (state.phone !== PHONE.pcNew) throw new Error("yangi raqam yozilmadi: " + short(state.phone));
  if (!state.isPhoneVerified) throw new Error("yangi raqam tasdiqlanmagan");
  uPc.phone = PHONE.pcNew;

  const me = await get("/api/auth/me", { token: oldToken });
  if (me.status !== 401) throw new Error("almashtirishdan keyin eski token: " + me.status);

  await waitForEvents(uPc.id, ["phone_changed", "sessions_invalidated"]);
});

await check("[R3-2] parol tiklash ochiq phone_change challenge'ini va boshqa ochiq challenge'larni bekor qiladi (ikkinchi audit backend-1)", async () => {
  const u = await createAccount("cx@test.uz", "job_seeker", { firstName: "Cx", lastName: "Sinov" });
  const tgId = 5000071;
  const phone = "+998901110166";
  const otherPhone = "+998901110177";
  await verifyPhone(u, tgId, phone);
  await login(u);

  // O'g'irlangan seans egasi telefon almashtirishni boshlaydi va kontaktni hali yubormaydi
  const change = await post("/api/auth/phone/change", { password: u.password }, { token: u.token });
  if (change.status !== 200 || !change.body?.link) throw new Error("phone/change: " + change.status + " " + short(change.body));
  await drive(startUpdate(tgId, payloadOf(change.body.link)));

  // Haqiqiy egasi parolni Telegram orqali tiklaydi
  const rec = await post("/api/auth/recovery/start", { phone });
  if (rec.status !== 200 || !rec.body?.link) throw new Error("recovery/start: " + rec.status + " " + short(rec.body));
  const token = resetTokenOf(await drive(startUpdate(tgId, payloadOf(rec.body.link))));
  const reset = await post("/api/auth/recovery/reset", { token, password: keepSecret("cx-yangi-parol-2026") });
  if (reset.status !== 200 || reset.body?.ok !== true) throw new Error("recovery/reset: " + reset.status + " " + short(reset.body));

  // Tiklashdan oldin ochilgan phone_change challenge'i endi raqamni o'zgartira olmaydi
  await drive(contactUpdate(tgId, otherPhone.replace("+", "")));
  const state = await prisma.user.findUnique({ where: { id: u.id } });
  if (state.phone !== phone) throw new Error("tiklashdan keyin eski phone_change challenge raqamni o'zgartirdi: " + short(state.phone));
  const open = await prisma.authChallenge.count({
    where: { userId: u.id, status: { in: ["pending", "awaiting_contact", "verified"] } },
  });
  if (open !== 0) throw new Error("tiklashdan keyin ochiq challenge qoldi: " + open);
});

// ------------------------------------------------------------
// 7. Zaxira telefon (Rule F)
// ------------------------------------------------------------
// Eslatma: telefon oqimlari foydalanuvchi bo'yicha 5/15 daqiqa kvotasiga bo'ysunadi (D-052),
// shuning uchun zaxira raqam ssenariylari ikki hisobga bo'lingan (har birida 3 ta so'rov).
await check("[D-047] zaxira telefon: parol majburiy, asosiy identity zaxira bo'la olmaydi", async () => {
  await verifyPhone(uBk, TG.bkPrimary, PHONE.bkPrimary);
  await login(uBk);

  const wrong = await post("/api/auth/phone/backup", { password: "butunlay-boshqa-parol" }, { token: uBk.token });
  if (wrong.status !== 401) throw new Error("noto'g'ri parol: " + wrong.status + " " + short(wrong.body));

  const start = await post("/api/auth/phone/backup", { password: uBk.password }, { token: uBk.token });
  if (start.status !== 200 || !start.body?.link) throw new Error("phone/backup: " + start.status + " " + short(start.body));

  // Asosiy identity bilan ochilsa — zaxira bo'la olmaydi (identity farq qilishi shart)
  await drive(startUpdate(TG.bkPrimary, payloadOf(start.body.link)));
  const state = await prisma.user.findUnique({ where: { id: uBk.id } });
  if (state.backupPhone || state.backupTelegramId) throw new Error("asosiy identity zaxira sifatida qabul qilindi");
});

await check("[D-047] zaxira telefon boshqa Telegram identity bilan qo'shiladi (asosiy raqam qabul qilinmaydi)", async () => {
  await verifyPhone(uBk2, TG.bk2Primary, PHONE.bk2Primary);
  await login(uBk2);

  const start = await post("/api/auth/phone/backup", { password: uBk2.password }, { token: uBk2.token });
  if (start.status !== 200 || !start.body?.link) throw new Error("phone/backup: " + start.status + " " + short(start.body));
  await drive(startUpdate(TG.bk2Backup, payloadOf(start.body.link)));

  // Asosiy raqamning o'zi zaxira bo'la olmaydi
  await drive(contactUpdate(TG.bk2Backup, PHONE.bk2Primary.replace("+", "")));
  let state = await prisma.user.findUnique({ where: { id: uBk2.id } });
  if (state.backupPhone === PHONE.bk2Primary) throw new Error("asosiy raqam zaxira sifatida yozildi");

  await drive(contactUpdate(TG.bk2Backup, PHONE.bk2Backup.replace("+", "")));
  state = await prisma.user.findUnique({ where: { id: uBk2.id } });
  if (state.backupPhone !== PHONE.bk2Backup) throw new Error("zaxira raqam yozilmadi: " + short(state.backupPhone));
  if (String(state.backupTelegramId) !== String(TG.bk2Backup)) throw new Error("backupTelegramId: " + short(state.backupTelegramId));
  if (!state.backupPhoneVerifiedAt) throw new Error("backupPhoneVerifiedAt yozilmadi");

  await waitForEvents(uBk2.id, ["backup_phone_added"]);

  const status = await get("/api/telegram/status", { token: uBk2.token });
  if (status.body?.backupPhone !== PHONE.bk2Backup) throw new Error("status.backupPhone: " + short(status.body?.backupPhone));
});

await check("[D-043] zaxira raqam ham yagona: boshqa hisob uni tasdiqlay olmaydi", async () => {
  const link = await post("/api/telegram/link", {}, { token: uDup2.token });
  if (link.status !== 200) throw new Error("link: " + link.status + " " + short(link.body));
  await drive(startUpdate(TG.dup2, payloadOf(link.body.link)));
  await drive(contactUpdate(TG.dup2, PHONE.bk2Backup.replace("+", "")));
  const state = await prisma.user.findUnique({ where: { id: uDup2.id } });
  if (state.isPhoneVerified || state.phone === PHONE.bk2Backup) throw new Error("band zaxira raqam tasdiqlandi: " + short(state.phone));
  const owner = await prisma.user.findUnique({ where: { id: uBk2.id } });
  if (owner.backupPhone !== PHONE.bk2Backup) throw new Error("zaxira raqam egasidan olindi");
});

await check("[D-045] tiklash zaxira raqam va zaxira identity bilan ham ishlaydi", async () => {
  const start = await post("/api/auth/recovery/start", { phone: PHONE.bk2Backup });
  if (start.status !== 200) throw new Error("recovery/start: " + start.status + " " + short(start.body));
  const payload = payloadOf(start.body.link);

  // Begona identity reset havolasini olmaydi
  const stranger = await drive(startUpdate(TG.stranger, payload));
  if (RESET_LINK_RE.test(dumpOf(stranger))) throw new Error("begona identity reset havolasini oldi");

  const messages = await drive(startUpdate(TG.bk2Backup, payload));
  const token = resetTokenOf(messages);
  const newPassword = keepSecret("yangi-parol-bk2-2026");
  const reset = await post("/api/auth/recovery/reset", { token, password: newPassword });
  if (reset.status !== 200) throw new Error("reset: " + reset.status + " " + short(reset.body));
  uBk2.password = newPassword;
  await login(uBk2);
});

await check("[D-047] zaxira telefonni olib tashlash (parol bilan) va backup_phone_removed hodisasi", async () => {
  const res = await del("/api/auth/phone/backup", { password: uBk2.password }, { token: uBk2.token });
  if (res.status !== 200 || res.body?.ok !== true) throw new Error("o'chirish: " + res.status + " " + short(res.body));
  const state = await prisma.user.findUnique({ where: { id: uBk2.id } });
  if (state.backupPhone || state.backupTelegramId) throw new Error("zaxira maydonlari tozalanmadi: " + short(state.backupPhone));
  await waitForEvents(uBk2.id, ["backup_phone_removed"]);
});

await check("[D-041] Telegram bog'lanishini uzish parol bilan ishlaydi (telegram_unlinked)", async () => {
  await verifyPhone(uUnlink, TG.unlink, PHONE.unlink);
  await login(uUnlink);
  const wrong = await del("/api/telegram/link", { password: "butunlay-boshqa-parol" }, { token: uUnlink.token });
  if (wrong.status !== 401) throw new Error("noto'g'ri parol: " + wrong.status + " " + short(wrong.body));
  const res = await del("/api/telegram/link", { password: uUnlink.password }, { token: uUnlink.token });
  if (res.status !== 200 || res.body?.ok !== true) throw new Error("uzish: " + res.status + " " + short(res.body));
  const state = await prisma.user.findUnique({ where: { id: uUnlink.id } });
  if (state.telegramChatId) throw new Error("telegramChatId tozalanmadi");
  await waitForEvents(uUnlink.id, ["telegram_unlinked"]);
});

// ------------------------------------------------------------
// 8. Qo'lda tiklash (Rule H)
// ------------------------------------------------------------
let mrRequestCode = null;
let unknownRequestCode = null;
let mrRequestId = null;

await check("[D-049] qo'lda tiklash so'rovi: mavjud va mavjud bo'lmagan email uchun bir xil javob", async () => {
  await verifyPhone(uMr, TG.mr, PHONE.mr);
  const real = await post("/api/auth/recovery/manual", {
    email: uMr.email, fullName: "Mr Sinov", details: "Telefonimni ham, Telegramimni ham yo'qotdim.", contact: "mr@aloqa.test",
  });
  if (real.status !== 200 || typeof real.body?.requestCode !== "string") throw new Error("manual: " + real.status + " " + short(real.body));
  mrRequestCode = keepSecret(real.body.requestCode);

  const unknown = await post("/api/auth/recovery/manual", {
    email: "hech-kim@test.uz", fullName: "Noma'lum", details: "Hisobimga kira olmayapman.",
  });
  if (unknown.status !== real.status) throw new Error(`status farqi: ${real.status} vs ${unknown.status}`);
  const realKeys = Object.keys(real.body).sort().join(",");
  const unknownKeys = Object.keys(unknown.body ?? {}).sort().join(",");
  if (realKeys !== unknownKeys) throw new Error(`javob shakli farq qiladi: ${realKeys} vs ${unknownKeys}`);
  unknownRequestCode = keepSecret(unknown.body.requestCode);

  const status = await post("/api/auth/recovery/manual/status", { requestCode: mrRequestCode });
  if (status.status !== 200 || status.body?.status !== "pending") throw new Error("status: " + status.status + " " + short(status.body));
  const missing = await post("/api/auth/recovery/manual/status", { requestCode: "YOQKODYOQ12" });
  if (missing.status !== 200 || missing.body?.status !== "not_found") throw new Error("noma'lum kod: " + missing.status + " " + short(missing.body));

  const early = await post("/api/auth/recovery/manual/continue", { requestCode: mrRequestCode });
  if (early.status !== 409 || early.body?.error !== "RECOVERY_NOT_APPROVED") {
    throw new Error("tasdiqlanmagan so'rov davom etdi: " + early.status + " " + short(early.body));
  }
  await waitForEvents(uMr.id, ["manual_recovery_requested"]);
});

await check("[D-049] admin tiklash so'rovlari ro'yxati: niqoblangan hisob ma'lumoti, maxfiy maydonlar yo'q", async () => {
  const res = await get("/api/admin/recovery-requests?status=pending&page=1", { token: adminToken });
  if (res.status !== 200 || !Array.isArray(res.body?.items)) throw new Error("ro'yxat: " + res.status + " " + short(res.body));
  for (const key of ["total", "page", "pageSize", "pageCount"]) {
    if (!(key in res.body)) throw new Error(`javobda "${key}" yo'q`);
  }
  const item = res.body.items.find((i) => i.email === uMr.email);
  if (!item) throw new Error("so'rov ro'yxatda yo'q");
  mrRequestId = item.id;
  if (!item.account || item.account.exists !== true) throw new Error("account.exists: " + short(item.account));
  const masked = String(item.account.phoneMasked ?? "");
  if (!masked) throw new Error("phoneMasked yo'q");
  if (masked.replace(/\s/g, "") === PHONE.mr) throw new Error("telefon niqoblanmagan: " + masked);
  if (masked.includes(PHONE.mr.slice(4))) throw new Error("niqob raqamni to'liq ko'rsatmoqda: " + masked);

  const serialized = res.text;
  for (const bad of ["passwordHash", "codeHash", "tokenHash", "resetTokenHash", "$argon2", "accessToken", "refreshToken"]) {
    if (serialized.includes(bad)) throw new Error(`admin javobida "${bad}" bor`);
  }
  for (const secret of secrets) {
    if (serialized.includes(secret)) throw new Error("admin javobida maxfiy qiymat bor (parol/kod/token)");
  }
});

await check("[D-049] admin tasdig'i: hisobsiz so'rov 409, hisobli so'rov tasdiqlanadi va seanslar bekor bo'ladi", async () => {
  const list = await get("/api/admin/recovery-requests?status=pending&page=1", { token: adminToken });
  const orphan = list.body.items.find((i) => i.email === "hech-kim@test.uz");
  if (!orphan) throw new Error("hisobsiz so'rov ro'yxatda yo'q");
  if (orphan.account?.exists !== false) throw new Error("hisobsiz so'rovda account.exists: " + short(orphan.account));
  const approveOrphan = await post(`/api/admin/recovery-requests/${orphan.id}/approve`, { note: "hisob yo'q" }, { token: adminToken });
  if (approveOrphan.status !== 409) throw new Error("hisobsiz so'rov tasdiqlandi: " + approveOrphan.status + " " + short(approveOrphan.body));
  const rejectOrphan = await post(`/api/admin/recovery-requests/${orphan.id}/reject`, { note: "ma'lumot yetarli emas" }, { token: adminToken });
  if (rejectOrphan.status !== 200) throw new Error("rad etish: " + rejectOrphan.status + " " + short(rejectOrphan.body));
  const orphanStatus = await post("/api/auth/recovery/manual/status", { requestCode: unknownRequestCode });
  if (orphanStatus.body?.status !== "rejected") throw new Error("rad etilgan so'rov holati: " + short(orphanStatus.body));

  await login(uMr);
  const oldToken = uMr.token;
  const approve = await post(`/api/admin/recovery-requests/${mrRequestId}/approve`, { note: "hujjat tekshirildi" }, { token: adminToken });
  if (approve.status !== 200) throw new Error("tasdiqlash: " + approve.status + " " + short(approve.body));
  const twice = await post(`/api/admin/recovery-requests/${mrRequestId}/approve`, {}, { token: adminToken });
  if (twice.status !== 409) throw new Error("takroriy tasdiqlash: " + twice.status);

  const state = await prisma.user.findUnique({ where: { id: uMr.id } });
  if (state.phone || state.isPhoneVerified || state.telegramChatId) throw new Error("telefon/Telegram tozalanmadi: " + short(state.phone));
  const me = await get("/api/auth/me", { token: oldToken });
  if (me.status !== 401) throw new Error("tasdiqlashdan keyin eski token: " + me.status);

  await waitForEvents(uMr.id, ["manual_recovery_approved", "sessions_invalidated", "telegram_unlinked"]);
  await waitForEventTypes(["manual_recovery_rejected"]);
});

await check("[D-049] tasdiqlangan so'rov: davom etish -> bot tasdig'i -> yangi parol", async () => {
  const status = await post("/api/auth/recovery/manual/status", { requestCode: mrRequestCode });
  if (status.body?.status !== "approved") throw new Error("holat: " + short(status.body));
  const cont = await post("/api/auth/recovery/manual/continue", { requestCode: mrRequestCode });
  if (cont.status !== 200 || !cont.body?.link) throw new Error("continue: " + cont.status + " " + short(cont.body));
  const payload = payloadOf(cont.body.link);
  await drive(startUpdate(TG.mrNew, payload));
  const messages = await drive(contactUpdate(TG.mrNew, PHONE.mrNew.replace("+", "")));
  const token = resetTokenOf(messages);

  const newPassword = keepSecret("yangi-parol-mr-2026");
  const reset = await post("/api/auth/recovery/reset", { token, password: newPassword });
  if (reset.status !== 200) throw new Error("reset: " + reset.status + " " + short(reset.body));
  uMr.password = newPassword;
  const ok = await post("/api/auth/login", { email: uMr.email, password: newPassword });
  if (ok.status !== 200) throw new Error("yangi parol bilan kirish: " + ok.status);

  const state = await prisma.user.findUnique({ where: { id: uMr.id } });
  if (state.phone !== PHONE.mrNew || !state.isPhoneVerified) throw new Error("yangi raqam: " + short(state.phone));
  if (String(state.telegramChatId) !== String(TG.mrNew)) throw new Error("yangi identity: " + short(state.telegramChatId));

  const finalStatus = await post("/api/auth/recovery/manual/status", { requestCode: mrRequestCode });
  if (finalStatus.body?.status !== "completed") throw new Error("yakuniy holat: " + short(finalStatus.body));
});

await check("[D-049] tiklash so'rovlari ro'yxati va qarorlari faqat adminga (mehmon 401, nomzod/ish beruvchi 403)", async () => {
  const list = "/api/admin/recovery-requests?status=pending&page=1";
  const guest = await get(list);
  if (guest.status !== 401) throw new Error("mehmon ro'yxat: " + guest.status);
  for (const [who, token] of [["nomzod", uLink.token], ["ish beruvchi", uGate.token]]) {
    const res = await get(list, { token });
    if (res.status !== 403) throw new Error(`${who} ro'yxat: ${res.status}`);
    const approve = await post(`/api/admin/recovery-requests/${mrRequestId}/approve`, { note: "sinov" }, { token });
    if (approve.status !== 403) throw new Error(`${who} tasdiqlash: ${approve.status}`);
    const reject = await post(`/api/admin/recovery-requests/${mrRequestId}/reject`, { note: "sinov" }, { token });
    if (reject.status !== 403) throw new Error(`${who} rad etish: ${reject.status}`);
  }
  const guestApprove = await post(`/api/admin/recovery-requests/${mrRequestId}/approve`, {}, {});
  if (guestApprove.status !== 401) throw new Error("mehmon tasdiqlash: " + guestApprove.status);
  // Holat o'zgarmagan bo'lishi shart (403/401 dan keyin hech narsa bajarilmaydi)
  const row = await model("recoveryRequest").findUnique({ where: { id: mrRequestId } });
  if (row?.status !== "completed") throw new Error("so'rov holati o'zgardi: " + short(row?.status));
});

// ------------------------------------------------------------
// 9. Admin javoblari va audit log gigienasi
// ------------------------------------------------------------
await check("[D-050] GET /api/admin/users/:id/security-events faqat adminga (mehmon 401, nomzod/ish beruvchi 403)", async () => {
  const path = `/api/admin/users/${uLink.id}/security-events`;
  const guest = await get(path);
  if (guest.status !== 401) throw new Error("mehmon: " + guest.status);
  for (const [who, token] of [["nomzod", uLink.token], ["ish beruvchi", uGate.token]]) {
    const res = await get(path, { token });
    if (res.status !== 403) throw new Error(`${who}: ${res.status}`);
  }
  const admin = await get(path, { token: adminToken });
  if (admin.status !== 200) throw new Error("admin: " + admin.status + " " + short(admin.body));
  const items = Array.isArray(admin.body) ? admin.body : admin.body?.items;
  if (!Array.isArray(items) || items.length === 0) throw new Error("hodisalar ro'yxati bo'sh: " + short(admin.body));
  if (items.length > 50) throw new Error("50 tadan ko'p hodisa qaytdi: " + items.length);
  for (const secret of secrets) {
    if (admin.text.includes(secret)) throw new Error("hodisalar javobida maxfiy qiymat bor");
  }
});

await check("[D-050] admin javoblarida parol hashi va tokenlar yo'q (/api/admin/users)", async () => {
  const res = await get("/api/admin/users?page=1", { token: adminToken });
  if (res.status !== 200) throw new Error("users: " + res.status + " " + short(res.body));
  for (const bad of ["passwordHash", "password_hash", "$argon2", "tokenVersion", "accessToken", "refreshToken", "tokenHash", "codeHash"]) {
    if (res.text.includes(bad)) throw new Error(`javobda "${bad}" bor`);
  }
  for (const secret of secrets) {
    if (res.text.includes(secret)) throw new Error("javobda maxfiy qiymat bor");
  }
});

await check("[D-050] SecurityEvent yozuvlari: barcha kutilgan turlar bor va meta'da maxfiy maydon yo'q (Rule L)", async () => {
  const expected = [
    "phone_verified", "phone_changed", "backup_phone_added", "backup_phone_removed",
    "telegram_linked", "telegram_unlinked",
    "recovery_started", "recovery_verified", "recovery_completed", "sessions_invalidated",
    "manual_recovery_requested", "manual_recovery_approved", "manual_recovery_rejected",
    "user_blocked", "user_unblocked", "role_changed",
  ];
  const all = await waitForEventTypes(expected);
  if (all.length === 0) throw new Error("hodisalar umuman yozilmagan");

  // meta faqat maxfiy BO'LMAGAN maydonlarni saqlaydi (D-050): niqoblangan telefon, maqsad, so'rov ID, sabab
  const badKey = /(password|secret|hash|^token$|^code$|payload)/i;
  for (const event of all) {
    if (event.meta == null) continue;
    const serialized = JSON.stringify(event.meta);
    for (const secret of secrets) {
      if (serialized.includes(secret)) throw new Error(`meta'da maxfiy qiymat (${event.type})`);
    }
    const walk = (value) => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (badKey.test(key)) throw new Error(`meta kaliti taqiqlangan: ${key} (${event.type})`);
        walk(child);
      }
    };
    walk(event.meta);
    for (const phone of Object.values(PHONE)) {
      if (serialized.includes(phone.slice(4))) throw new Error(`meta'da niqoblanmagan telefon (${event.type})`);
    }
  }
});

// ------------------------------------------------------------
// 10. Olib tashlangan Telegram-login yo'llari (Rule A)
// ------------------------------------------------------------
await check("[D-041] Telegram orqali kirish yo'llari olib tashlangan (404)", async () => {
  const start = await post("/api/auth/telegram/start", {});
  if (start.status !== 404) throw new Error("/api/auth/telegram/start: " + start.status + " " + short(start.body));
  const poll = await post("/api/auth/telegram/poll", { token: "a".repeat(32) });
  if (poll.status !== 404) throw new Error("/api/auth/telegram/poll: " + poll.status + " " + short(poll.body));
});

await check("[R3] telefon gate: tasdiqlanmagan ish beruvchi 403 PHONE_NOT_VERIFIED (Telegram mavjud bo'lganda)", async () => {
  const res = await post("/api/vacancies", { title: "Sinov", description: "Uzun tavsif matni", employmentType: "full_time" }, { token: uGate.token });
  if (res.status !== 403 || res.body?.error !== "PHONE_NOT_VERIFIED") throw new Error(res.status + " " + short(res.body));
});

await check("[D-071] nomzodlar bazasi: telefoni tasdiqlanmagan ish beruvchi 403 PHONE_NOT_VERIFIED, tasdiqlangach 200", async () => {
  const before = await get("/api/candidates", { token: uGate.token });
  if (before.status !== 403 || before.body?.error !== "PHONE_NOT_VERIFIED") throw new Error(before.status + " " + short(before.body));
  // Telefoni tasdiqlangan ish beruvchi ro'yxatni ko'radi (javob shakli va kvota e2e-check.mjs da).
  // uGate ataylab TASDIQLANMAGAN qoladi: pastdagi 'Telegram mavjud emas' tarmog'i shu hisobga tayanadi.
  const verifiedEmployer = await createAccount("cand-emp@test.uz", "employer", { companyName: "Nomzod MChJ" });
  await verifyPhone(verifiedEmployer, 5000088, "+998901110200");
  const after = await get("/api/candidates", { token: verifiedEmployer.token });
  if (after.status !== 200 || !Array.isArray(after.body?.items)) throw new Error(after.status + " " + short(after.body));
});

await check("[D-047] [D-048] tasdiqlangan asosiy raqamsiz telefon oqimlari 409 PHONE_NOT_VERIFIED (parol to'g'ri bo'lsa ham)", async () => {
  const fresh = await createAccount("nophone@test.uz", "job_seeker", { firstName: "No", lastName: "Phone" });
  const change = await post("/api/auth/phone/change", { password: fresh.password }, { token: fresh.token });
  if (change.status !== 409 || change.body?.error !== "PHONE_NOT_VERIFIED") throw new Error("phone/change: " + change.status + " " + short(change.body));
  const backup = await post("/api/auth/phone/backup", { password: fresh.password }, { token: fresh.token });
  if (backup.status !== 409 || backup.body?.error !== "PHONE_NOT_VERIFIED") throw new Error("phone/backup: " + backup.status + " " + short(backup.body));
  const wrong = await post("/api/auth/phone/change", { password: "butunlay-boshqa-parol" }, { token: fresh.token });
  if (wrong.status !== 401 || wrong.body?.error !== "INVALID_PASSWORD") throw new Error("noto'g'ri parol: " + wrong.status + " " + short(wrong.body));
  const state = await prisma.user.findUnique({ where: { id: fresh.id } });
  if (state.phone || state.isPhoneVerified || state.backupPhone) throw new Error("hisob o'zgardi: " + short(state.phone));
});

// ------------------------------------------------------------
// 11. Log gigienasi (Rule L): parol, token, kod va payload logga tushmaydi
// ------------------------------------------------------------
await check("[R3] server logida parol, token, reset kaliti va so'rov kodi yo'q", async () => {
  const found = [];
  for (const secret of secrets) {
    if (log.includes(secret)) found.push(secret.slice(0, 4) + "...");
  }
  if (found.length) throw new Error(`logda ${found.length} ta maxfiy qiymat bor`);
  if (/\$argon2/.test(log)) throw new Error("logda argon2 hash bor");
  if (/"password"\s*:\s*"[^"]{3,}/.test(log)) throw new Error("logda parol maydoni bor");
});

// ------------------------------------------------------------
// 12. Telegram mavjud emas (Rule K): test rejimisiz ikkinchi server
// ------------------------------------------------------------
await check("[D-051] Telegram mavjud bo'lmaganda 503 TELEGRAM_UNAVAILABLE (status.available=false)", async () => {
  offlineServer = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    // Test rejimi YO'Q va bot tokeni bo'sh -> isTelegramAvailable() false
    env: { ...baseEnv, NODE_ENV: "development", PORT: String(PORT_OFFLINE), ADMIN_EMAIL: "", ADMIN_PASSWORD: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  offlineServer.stdout.on("data", (d) => (offlineLog += d));
  offlineServer.stderr.on("data", (d) => (offlineLog += d));
  if (!(await waitForHealth(OFFLINE_BASE))) throw new Error("ikkinchi server ko'tarilmadi:\n" + offlineLog.slice(-1500));

  const token = await (async () => {
    const res = await post("/api/auth/login", { email: uLink.email, password: uLink.password }, { base: OFFLINE_BASE });
    if (res.status !== 200) throw new Error("kirish: " + res.status + " " + short(res.body));
    return keepSecret(res.body.accessToken);
  })();

  const status = await get("/api/telegram/status", { token, base: OFFLINE_BASE });
  if (status.status !== 200 || status.body?.available !== false) throw new Error("status.available: " + short(status.body));

  const link = await post("/api/telegram/link", {}, { token, base: OFFLINE_BASE });
  if (link.status !== 503 || link.body?.error !== "TELEGRAM_UNAVAILABLE") throw new Error("telegram/link: " + link.status + " " + short(link.body));

  const recovery = await post("/api/auth/recovery/start", { phone: PHONE.link }, { base: OFFLINE_BASE });
  if (recovery.status !== 503 || recovery.body?.error !== "TELEGRAM_UNAVAILABLE") throw new Error("recovery/start: " + recovery.status + " " + short(recovery.body));

  const gateToken = await (async () => {
    const res = await post("/api/auth/login", { email: uGate.email, password: uGate.password }, { base: OFFLINE_BASE });
    if (res.status !== 200) throw new Error("gate kirish: " + res.status);
    return keepSecret(res.body.accessToken);
  })();
  const gate = await post("/api/vacancies", { title: "Sinov", description: "Uzun tavsif matni", employmentType: "full_time" }, { token: gateToken, base: OFFLINE_BASE });
  if (gate.status !== 503 || gate.body?.error !== "TELEGRAM_UNAVAILABLE") {
    throw new Error("telefon gate Telegram yo'q bo'lganda: " + gate.status + " " + short(gate.body));
  }
});

await check("[R3] ikkinchi server logida ham maxfiy qiymat yo'q", async () => {
  for (const secret of secrets) {
    if (offlineLog.includes(secret)) throw new Error("logda maxfiy qiymat bor");
  }
});

// Testdan tashqarida qolgan qismlar — jim o'tkazib yubormaymiz, aniq yozamiz
note("Google orqali kirish (D-055) bu yerda tekshirilmaydi: haqiqiy Google ID token kerak — GOOGLE_CLIENT_ID bo'sh.");
note("Rate limit oynalari (D-052) real vaqt talab qiladi; bu skript har so'rovni boshqa X-Forwarded-For bilan yuboradi.");
note("Telegram long-polling (getUpdates) tekshirilmaydi: test rejimida polling yo'q, faqat update ishlovchilari.");

await prisma.$disconnect().catch(() => {});
killServers();
await sleep(1200);

if (failed > 0) {
  console.error("\nServer loglari (oxirgi 40 qator):\n" + log.split("\n").slice(-40).join("\n"));
}
console.log(`\n${passed} ta tekshiruv o'tdi`);
console.log(failed === 0 ? "HAMMASI O'TDI" : `${failed} TA XATO`);
process.exit(failed === 0 ? 0 : 1);
