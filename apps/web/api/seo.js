// robots.txt va sitemap'larni SAYT domenida beradi.
//
// Sitemap'lar API'da (Railway) generatsiya qilinadi, chunki vakansiya va
// kompaniya ro'yxati bazada. Lekin qidiruv tizimlari uchun bu fayllar aynan
// sayt domenida ochilishi shart — `https://sayt.uz/sitemap.xml`, API domenida
// emas. Shuning uchun `vercel.json` bu yo'llarni shu funksiyaga uzatadi.
//
// robots.txt esa ma'lumotga BOG'LIQ EMAS: API o'chiq bo'lsa ham to'g'ri
// javob berishi kerak, aks holda crawler butun saytni "taqiqlangan" yoki
// "xato" deb biladi (audit R3, seo-11). Shuning uchun API javob bermasa
// quyidagi zaxira matn beriladi; sitemap esa 503 + Retry-After oladi.
//
// Manzillar qurilish paytida emas, ISHLASH paytida `process.env` dan olinadi —
// API domenini almashtirish uchun qayta build qilish shart emas.

const API_URL = (process.env.VITE_API_URL ?? process.env.API_URL ?? "").replace(/\/+$/, "");
const SITE_URL = (process.env.VITE_SITE_URL ?? process.env.SITE_URL ?? "").replace(/\/+$/, "");

// Faqat shu yo'llar uzatiladi — ochiq proxy bo'lib qolmasligi uchun.
const ALLOWED = /^\/(robots\.txt|sitemap(-[a-z]+)?\.xml)$/;

const ROBOTS_TIMEOUT_MS = 5000;
const SITEMAP_TIMEOUT_MS = 8000;

// apps/api/src/modules/seo/seo.routes.ts dagi PRIVATE_PATHS bilan bir xil.
// Bu ro'yxat faqat API javob bermaganda ishlatiladi (zaxira robots).
const PRIVATE_PATHS = [
  "/admin",
  "/profile",
  "/messages",
  "/applications",
  "/login",
  "/signup",
  "/favorites",
  "/notifications",
  "/alerts",
  "/employer/vacancies",
  "/employer/applications",
  "/employer/candidates",
];

/** API'siz ham to'g'ri bo'lgan robots.txt (ro'yxatlar statik, bazaga bog'liq emas). */
function fallbackRobots() {
  const lines = ["User-agent: *", "Disallow: /api"];
  for (const p of PRIVATE_PATHS) {
    lines.push(`Disallow: ${p}`);
    lines.push(`Disallow: /ru${p}`);
    lines.push(`Disallow: /en${p}`);
  }
  if (SITE_URL) lines.push("", `Sitemap: ${SITE_URL}/sitemap.xml`);
  return `${lines.join("\n")}\n`;
}

/** `AbortSignal.timeout` Node 18+ da bor; bo'lmasa qo'lda timer bilan. */
function timeoutSignal(ms) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref?.();
  return controller.signal;
}

/**
 * Bitta SEO fayli uchun javob. `server/index.mjs` (self-hosted) ham shu
 * funksiyani ishlatadi — Vercel va self-hosted bir xil natija bersin.
 *
 * @param {string} pathname
 * @returns {Promise<{ status: number, contentType: string, body: string, cacheControl: string, retryAfter?: string }>}
 */
export async function seoResponse(pathname) {
  if (!ALLOWED.test(pathname)) {
    return { status: 404, contentType: "text/plain; charset=utf-8", body: "Not found\n", cacheControl: "no-store" };
  }

  const isRobots = pathname === "/robots.txt";

  if (!API_URL) {
    if (isRobots) {
      return {
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: fallbackRobots(),
        cacheControl: "public, max-age=0, s-maxage=3600",
      };
    }
    // Sitemap'ni to'qib bo'lmaydi — "vaqtincha yo'q" deymiz, bo'sh/noto'g'ri XML emas.
    return unavailableSitemap();
  }

  try {
    const upstream = await fetch(`${API_URL}${pathname}`, {
      headers: { accept: "text/plain, application/xml, */*" },
      signal: timeoutSignal(isRobots ? ROBOTS_TIMEOUT_MS : SITEMAP_TIMEOUT_MS),
    });
    if (!upstream.ok) {
      if (isRobots) return robotsFallbackResponse();
      // 404 — bunday sitemap yo'q; qolgan xatolar vaqtinchalik deb qaraladi.
      if (upstream.status === 404) {
        return { status: 404, contentType: "application/xml; charset=utf-8", body: "", cacheControl: "no-store" };
      }
      return unavailableSitemap();
    }
    const body = await upstream.text();
    if (isRobots && body.trim() === "") return robotsFallbackResponse();
    return {
      status: 200,
      contentType: isRobots ? "text/plain; charset=utf-8" : "application/xml; charset=utf-8",
      body,
      // Sitemap tez-tez o'zgarmaydi — bir soat kesh, keyin fonda yangilanadi.
      cacheControl: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    };
  } catch (err) {
    console.error(`[seo] ${pathname} uchun API'ga ulanib bo'lmadi:`, err instanceof Error ? err.message : err);
    return isRobots ? robotsFallbackResponse() : unavailableSitemap();
  }
}

function robotsFallbackResponse() {
  return {
    status: 200,
    contentType: "text/plain; charset=utf-8",
    body: fallbackRobots(),
    // Zaxira javob uzoq keshlanmasin — API tiklanganda to'liq ro'yxat qaytsin.
    cacheControl: "public, max-age=0, s-maxage=60",
  };
}

function unavailableSitemap() {
  return {
    status: 503,
    contentType: "application/xml; charset=utf-8",
    body: '<?xml version="1.0" encoding="UTF-8"?>\n<!-- sitemap vaqtincha mavjud emas -->\n',
    cacheControl: "no-store",
    retryAfter: "600",
  };
}

/**
 * Vercel Serverless Function.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  const pathname = (req.url ?? "/").split("?")[0];
  const result = await seoResponse(pathname);
  res.statusCode = result.status;
  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Cache-Control", result.cacheControl);
  if (result.retryAfter) res.setHeader("Retry-After", result.retryAfter);
  res.end(result.body);
}
