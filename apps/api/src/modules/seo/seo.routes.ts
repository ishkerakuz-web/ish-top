import type { FastifyInstance } from "fastify";
import { prisma } from "../../common/prisma.js";
import { env } from "../../common/env.js";
import { cached } from "../../common/cache.js";

/**
 * robots.txt va sitemap'lar API'da generatsiya qilinadi, lekin ular ICHIDAGI
 * havolalar OMMAVIY sayt manziliga (Vercel domeni) ishora qilishi kerak —
 * qidiruv tizimlari API domenini emas, saytni indeksga oladi.
 *
 * Fayllarning o'zi ham sayt domenida ochilishi shart: buning uchun Vercel
 * `/robots.txt` va `/sitemap*.xml` so'rovlarini API'ga uzatadi
 * (apps/web/vercel.json dagi rewrites).
 */
const PUBLIC_ORIGIN = env.WEB_ORIGIN;
const LOCALES = ["uz", "ru", "en"] as const;

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Til prefiksli yo'l: uz — prefikssiz, ru/en — /ru, /en. */
function loc(locale: string, path: string): string {
  if (locale === "uz") return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/**
 * Indekslanmaydigan (shaxsiy) yo'llar - har uch tilda taqiqlanadi.
 *
 * Audit R3 (seo-13) bu yerda `Disallow` + sahifadagi `noindex` ikkiligini qayd etdi: taqiqlangan
 * sahifani robot o'qiy olmaydi, ya'ni noindex'ni ko'rmaydi. Ro'yxat ataylab saqlandi - bu sahifalar
 * hech qayerdan havola qilinmaydi, ochib qo'yish esa hisob sahifalarini keraksiz crawl qildiradi va
 * mavjud e2e shartnomasini (PHASE6-U31) buzadi. Har bir sahifada `noindex` ham bor (ikkinchi qavat).
 */
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

// Filtr parametrlari cheksiz URL kombinatsiyasi beradi; `saved` - shaxsiy (brauzerdagi) ro'yxat
const CRAWL_TRAP_PATTERNS = ["/*?*saved="];

export async function seoRoutes(app: FastifyInstance) {
  app.get("/robots.txt", async (_req, reply) => {
    reply.header("Content-Type", "text/plain");
    // `Allow: /api/og/` - `Disallow: /api` dan OLDIN va undan aniqroq (audit R3, seo-6): og:image
    // aynan API domenidagi /api/og/... manzili, shu bois bu fayl API hostida ochilganda rasm
    // taqiqlangan bo'lib qolardi va ijtimoiy tarmoq/qidiruv preview'i bo'sh chiqardi.
    //
    // `/uploads/` ham ochiq qoladi (audit R3, seo-6): kompaniya sahifasining og:image'i
    // (`company.logoUrl`) va maqola muqovalari aynan API hostidagi /uploads/... manzillari -
    // ularni taqiqlash og:image'ni bloklab, seo-6 dagi muammoni qaytarardi. PDF rezyume esa
    // endi bu yerdan UMUMAN berilmaydi (404, D-058), shuning uchun shaxsiy fayl oshkor bo'lmaydi.
    const lines = ["User-agent: *", "Allow: /api/og/", "Allow: /uploads/", "Disallow: /api"];
    for (const p of PRIVATE_PATHS) {
      lines.push(`Disallow: ${p}`);
      lines.push(`Disallow: /ru${p}`);
      lines.push(`Disallow: /en${p}`);
    }
    for (const pattern of CRAWL_TRAP_PATTERNS) lines.push(`Disallow: ${pattern}`);
    lines.push("", `Sitemap: ${PUBLIC_ORIGIN}/sitemap.xml`);
    return lines.join("\n");
  });

  // Asosiy sitemap - sub-sitemaplarga yo'naltiradi
  app.get("/sitemap.xml", async (_req, reply) => {
    reply.header("Content-Type", "application/xml");
    return [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      `<sitemap><loc>${PUBLIC_ORIGIN}/sitemap-static.xml</loc></sitemap>`,
      `<sitemap><loc>${PUBLIC_ORIGIN}/sitemap-vacancy.xml</loc></sitemap>`,
      `<sitemap><loc>${PUBLIC_ORIGIN}/sitemap-employer.xml</loc></sitemap>`,
      `<sitemap><loc>${PUBLIC_ORIGIN}/sitemap-articles.xml</loc></sitemap>`,
      `</sitemapindex>`,
    ].join("\n");
  });

  // Sitemap'lar HAR SO'ROVDA qayta qurilardi (vakansiya fayli ~7 MB, 50 000 qator) - endi
  // jarayon ichida keshlanadi va javobga Cache-Control qo'yiladi (audit R3, seo-9, db-perf-14).
  // Ma'lumot yozilganda (bumpDataVersion) kesh TTL tugashini kutmasdan yangilanadi.
  const SITEMAP_TTL_MS = 60 * 60 * 1000;
  const SITEMAP_LIMIT = 50000;
  const sitemapHeaders = (reply: { header: (k: string, v: string) => unknown }) => {
    reply.header("Content-Type", "application/xml");
    reply.header("Cache-Control", "public, max-age=3600");
  };

  /** Chegaraga yetilgan bo'lsa ogohlantiramiz: qolgan URL'lar sitemap'ga tushmaydi. */
  function warnIfCapped(name: string, count: number) {
    if (count >= SITEMAP_LIMIT) {
      app.log.warn({ sitemap: name, count }, `sitemap ${SITEMAP_LIMIT} qatorlik chegaraga yetdi - qolgan URL'lar tushmadi`);
    }
  }

  const staticSitemap = cached(SITEMAP_TTL_MS, async () => {
    const staticPaths = [
      "/",
      "/vacancies",
      "/companies",
      "/salaries",
      "/articles",
      "/employer",
      "/support",
      "/contact",
    ];

    // Har bir kasb va hudud uchun alohida maosh sahifasi - hh.uz'dagidek
    // "Frontend dasturchi maoshi" kabi so'rovlar bo'yicha organik trafik beradi.
    const [categories, regions] = await Promise.all([
      prisma.vacancyCategory.findMany({ select: { slug: true } }),
      prisma.region.findMany({ where: { parentId: { not: null } }, select: { slug: true } }),
    ]);
    const salaryPaths = [
      ...categories.map((c: { slug: string }) => `/salaries?category=${c.slug}`),
      ...regions.map((r: { slug: string }) => `/salaries?region=${r.slug}`),
    ];

    return buildUrlSet([...staticPaths, ...salaryPaths]);
  });

  const vacancySitemap = cached(SITEMAP_TTL_MS, async () => {
    const vacancies = await prisma.vacancy.findMany({
      where: { status: "active" },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
      take: SITEMAP_LIMIT,
    });
    warnIfCapped("vacancy", vacancies.length);
    return buildUrlSet(
      vacancies.map((v: { slug: string }) => `/vacancies/${v.slug}`),
      vacancies.map((v: { updatedAt: Date }) => v.updatedAt)
    );
  });

  const employerSitemap = cached(SITEMAP_TTL_MS, async () => {
    // Bo'sh profillar indekslanmaydi: faol vakansiyasi yoki tavsifi bor, egasi bloklanmagan
    // kompaniyalar (audit ISSUE-056). Relation filter ($lookup zanjiri) o'rniga oldindan
    // aniqlangan ID'lar (audit R3, seo-9, db-perf-14): groupBy va bloklangan egalar ro'yxati.
    const [withActiveVacancy, blockedOwners] = await Promise.all([
      prisma.vacancy.groupBy({ by: ["companyId"], where: { status: "active" } }),
      prisma.user.findMany({ where: { isBlocked: true }, select: { id: true } }),
    ]);
    const companyIds = withActiveVacancy.map((row: { companyId: string }) => row.companyId);
    const blockedOwnerIds = blockedOwners.map((row: { id: string }) => row.id);

    const companies = await prisma.company.findMany({
      where: {
        // `notIn: []` hamma yozuvga mos keladi - bloklangan ega bo'lmasa filtr ta'sir qilmaydi
        ownerUserId: { notIn: blockedOwnerIds },
        OR: [
          { id: { in: companyIds } },
          { AND: [{ description: { not: null } }, { NOT: { description: "" } }] },
        ],
      },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: SITEMAP_LIMIT,
    });
    warnIfCapped("employer", companies.length);
    return buildUrlSet(
      // Ochiq kompaniya profili - /companies/:slug (/employer/:slug endi faqat redirect)
      companies.map((c: { slug: string }) => `/companies/${c.slug}`),
      companies.map((c: { updatedAt: Date }) => c.updatedAt)
    );
  });

  // Faqat chop etilgan maqolalar (qoralama, ko'rib chiqilayotgan, arxiv - yo'q)
  const articleSitemap = cached(SITEMAP_TTL_MS, async () => {
    const articles = await prisma.article.findMany({
      where: { status: "published" },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
      take: SITEMAP_LIMIT,
    });
    warnIfCapped("articles", articles.length);
    return buildUrlSet(
      articles.map((a: { slug: string }) => `/articles/${a.slug}`),
      articles.map((a: { updatedAt: Date }) => a.updatedAt)
    );
  });

  app.get("/sitemap-static.xml", async (_req, reply) => {
    sitemapHeaders(reply);
    return staticSitemap();
  });

  app.get("/sitemap-vacancy.xml", async (_req, reply) => {
    sitemapHeaders(reply);
    return vacancySitemap();
  });

  app.get("/sitemap-employer.xml", async (_req, reply) => {
    sitemapHeaders(reply);
    return employerSitemap();
  });

  app.get("/sitemap-articles.xml", async (_req, reply) => {
    sitemapHeaders(reply);
    return articleSitemap();
  });
}

// Har bir yo'l uchun uch tilli hreflang alternates bilan <url> hosil qiladi.
function buildUrlSet(paths: string[], dates?: Date[]) {
  const entries = paths.map((path, i) => {
    const lastmod = dates?.[i] ? `<lastmod>${dates[i].toISOString()}</lastmod>` : "";
    const alts = LOCALES.map(
      (lc) => `<xhtml:link rel="alternate" hreflang="${lc}" href="${xmlEscape(PUBLIC_ORIGIN + loc(lc, path))}"/>`
    ).join("");
    const xdefault = `<xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(PUBLIC_ORIGIN + path)}"/>`;
    return `<url><loc>${xmlEscape(PUBLIC_ORIGIN + path)}</loc>${alts}${xdefault}${lastmod}</url>`;
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...entries,
    `</urlset>`,
  ].join("\n");
}
