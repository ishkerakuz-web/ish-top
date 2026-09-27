// Web ilovaning PRODUCTION serveri.
//
// `vike preview` faqat build'ni tez ko'zdan kechirish uchun — Vike ham
// "prod'da ishlatmang" deb ogohlantiradi (u siqmaydi va HTML'ga `no-store`
// qo'yib bfcache'ni o'chiradi). Shu server o'sha uchta bo'shliqni yopadi:
//
//   1. Siqish (brotli/gzip) — SSR HTML ~25 KB dan ~6 KB ga tushadi.
//   2. To'g'ri Cache-Control — hash'langan aktivlar bir yil, HTML `no-cache`
//      (ya'ni qayta tekshiriladi, lekin `no-store` emas → bfcache ishlaydi:
//      "orqaga" tugmasi sahifani qaytadan yuklamaydi).
//   3. Xavfsizlik sarlavhalari — vite.config.ts dagi dev qiymatlari bilan bir xil.
//
// Ishga tushirish (avval `npm run build`):
//   node server/index.mjs            # yoki: npm start
//   PORT=8080 node server/index.mjs
//
// API alohida jarayon (apps/api, 3000-port) — bu server unga tegmaydi,
// brauzer u bilan to'g'ridan-to'g'ri gaplashadi (VITE_API_URL).

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyCompress from "@fastify/compress";
import fastifyStatic from "@fastify/static";
import { renderPage } from "vike/server";
import { seoResponse } from "../api/seo.js";

// Build entry'sini import qilish Vike'ning global kontekstini ro'yxatdan
// o'tkazadi — `renderPage()` shundan keyingina ishlaydi. Fayl `npm run build`
// dan keyin paydo bo'ladi.
import "../dist/server/entry.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CLIENT_DIR = join(ROOT, "dist", "client");

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

// vite.config.ts, api/ssr.js va vercel.json dagilar bilan bir xil bo'lishi
// kerak — dev va prod bir xil sarlavha bersin, Lighthouse'da farq chiqmasin.
//
// Content-Security-Policy bu yerda YO'Q: u har so'rovga nonce bilan
// `src/pages/+headersResponse.ts` da quriladi va Vike javob sarlavhalari
// orqali keladi (audit R3, D-057).
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  // Google Sign-In popup oqimi uchun (audit R3, headers-infra-10).
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

// HSTS faqat HTTPS ustida ma'noga ega (audit R3, headers-infra-14). `preload`
// ATAYLAB yo'q: domen yakuniy bo'lguncha preload ro'yxatiga tushish qaytarib
// bo'lmaydigan qadam.
const HSTS = "max-age=31536000; includeSubDomains";

// So'rov URL'ida kelishi mumkin bo'lgan MAXFIY parametrlar — logga xom holda
// tushmasligi kerak (audit R3, headers-infra-12): staff taklifi, parol tiklash
// tokeni va qo'lda tiklash so'rov kodi.
const SECRET_QUERY_KEYS = new Set(["token", "reset", "code", "access_token", "requestcode"]);

/**
 * `decodeURIComponent` noto'g'ri foiz ketma-ketligida (`?%ZZ=1`) xato tashlaydi.
 * Log serializeri Fastify'ning so'rov ishlovchisi ichida ishlaydi — u yerdagi
 * xato ushlanmagan istisno bo'lib jarayonni yiqitadi, ya'ni bitta so'rov bilan
 * butun sayt o'chirilardi. Shuning uchun dekod hech qachon uloqtirmaydi.
 */
function decodeKeySafe(value) {
  try {
    return decodeURIComponent(value).toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

/** URL'dagi maxfiy query qiymatlarini niqoblaydi; yo'l va boshqa parametrlar qoladi. */
function redactUrl(url) {
  if (typeof url !== "string") return url;
  const at = url.indexOf("?");
  if (at === -1) return url;
  const path = url.slice(0, at);
  const pairs = url.slice(at + 1).split("&").map((pair) => {
    const eq = pair.indexOf("=");
    if (eq === -1) return pair;
    const key = pair.slice(0, eq);
    return SECRET_QUERY_KEYS.has(decodeKeySafe(key)) ? `${key}=[redacted]` : pair;
  });
  return `${path}?${pairs.join("&")}`;
}

const YEAR = 60 * 60 * 24 * 365;
const WEEK = 60 * 60 * 24 * 7;

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    // Fastify sukut serializeri butun `req.url` ni yozadi — unda taklif yoki
    // parol tiklash tokeni bo'lishi mumkin (audit R3, headers-infra-12).
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: redactUrl(request.url),
          remoteAddress: request.ip,
        };
      },
    },
  },
  // Reverse-proxy (nginx/caddy) ortida turganda haqiqiy IP va protokol.
  trustProxy: true,
});

// Siqish: brotli birinchi, keyin gzip. 1 KB dan kichik javoblarni siqish
// foyda bermaydi (paket sarlavhasi siqilgan yutuqdan katta).
await app.register(fastifyCompress, {
  global: true,
  encodings: ["br", "gzip", "deflate"],
  threshold: 1024,
});

app.addHook("onSend", async (req, reply) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) reply.header(k, v);
  if (req.protocol === "https") reply.header("Strict-Transport-Security", HSTS);
});

// 1) Statik fayllar (dist/client). `wildcard: false` — plagin ishga tushganda
//    mavjud fayllar uchun aniq marshrutlar yaratadi, shuning uchun fayl bo'lmagan
//    URL'lar pastdagi SSR ishlovchisiga tushadi (`/*` ni yutib yubormaydi).
//
//    Kesh muddati fayl turiga qarab:
//    - /assets/** — nomida kontent hash'i bor, kontent o'zgarsa nom ham
//      o'zgaradi, shuning uchun bir yil + `immutable` xavfsiz;
//    - sw.js — service worker'ni keshlash mumkin emas, aks holda brauzer
//      yangilanishni ko'rmay eski SW'da tirband bo'lib qoladi;
//    - qolgani (shriftlar, logolar) — nomi barqaror, bir hafta.
await app.register(fastifyStatic, {
  root: CLIENT_DIR,
  prefix: "/",
  index: false,
  decorateReply: false,
  cacheControl: false,
  wildcard: false,
  setHeaders: (res, filePath) => {
    const p = filePath.replace(/\\/g, "/");
    const value = p.includes("/assets/")
      ? `public, max-age=${YEAR}, immutable`
      : p.endsWith("/sw.js")
        ? "no-cache"
        : `public, max-age=${WEEK}`;
    res.setHeader("Cache-Control", value);
  },
});

// 2) robots.txt va sitemap'lar. Vercel'da buni `api/seo.js` funksiyasi qiladi;
//    self-hosted'da esa bu yo'llar ilgari umuman yo'q edi va Vike 404
//    SAHIFASINI qaytarardi (audit R3, seo-11). Mantiq bitta joyda — ikkala
//    serving yo'li bir xil javob beradi.
app.get("/robots.txt", async (_request, reply) => sendSeo(reply, "/robots.txt"));
app.get("/sitemap.xml", async (_request, reply) => sendSeo(reply, "/sitemap.xml"));
app.get("/sitemap-:name.xml", async (request, reply) => {
  const name = String(request.params.name ?? "");
  return sendSeo(reply, `/sitemap-${name}.xml`);
});

async function sendSeo(reply, pathname) {
  const result = await seoResponse(pathname);
  reply.header("Content-Type", result.contentType);
  reply.header("Cache-Control", result.cacheControl);
  if (result.retryAfter) reply.header("Retry-After", result.retryAfter);
  reply.status(result.status);
  return reply.send(result.body);
}

// 3) Qolgani — Vike SSR. `/*` `/` ni ham qamrab oladi. Faqat GET (va Fastify
//    avtomatik qo'shadigan HEAD): sahifalar boshqa metodlarga javob bermaydi,
//    yozuv amallari API'da (:3000).
app.get("/*", async (request, reply) => {
  const pageContext = await renderPage({
    urlOriginal: request.raw.url,
    headersOriginal: request.headers,
  });
  const { httpResponse } = pageContext;

  // Vike noma'lum yo'l uchun ham 404 SAHIFASINI qaytaradi; httpResponse bo'sh
  // bo'lishi — Vike umuman javob bermagan holat (masalan `.png` kabi statik
  // so'rov yuqoridagi plaginlardan o'tib ketgan).
  if (!httpResponse) return reply.callNotFound();

  // Vike sarlavhalari: CSP (nonce bilan), Retry-After va Cache-Control.
  for (const [name, value] of httpResponse.headers) reply.header(name, value);

  // `no-cache` — brauzer har safar tekshiradi, LEKIN sahifani saqlaydi.
  // `no-store` bo'lsa bfcache o'chadi va "orqaga" har safar to'liq qayta yuklanadi.
  // Xato javoblari (404/503) Vike'ning `no-store` qiymatida qoladi —
  // vaqtinchalik xato keshlanmasin (audit R3, api-errors-1).
  if (httpResponse.statusCode < 400) reply.header("Cache-Control", "no-cache");
  reply.status(httpResponse.statusCode);
  return reply.send(await httpResponse.getBody());
});

// SSR paytidagi kutilmagan xato — foydalanuvchiga JSON emas, oddiy sahifa.
// (Vike o'zining xato sahifasini bera olgan holatlar yuqorida hal bo'ladi;
// bu yerga faqat renderPage'ning o'zi yiqilganda tushamiz.)
app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  reply
    .status(500)
    .type("text/html; charset=utf-8")
    .header("Cache-Control", "no-store")
    .send("<!doctype html><meta charset=utf-8><title>Xatolik</title><h1>Kutilmagan xatolik</h1>");
});

// Konteyner/PM2 to'xtatganda ochiq so'rovlarni tugatib, keyin chiqamiz —
// aks holda deploy paytida foydalanuvchi uzilgan javob oladi.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    app.log.info(`${signal} — server to'xtatilmoqda`);
    await app.close();
    process.exit(0);
  });
}

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Sayt http://localhost:${PORT} portida ishlamoqda (production)`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
