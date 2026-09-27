import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { Errors } from "../../common/errors.js";
import { isObjectId } from "../../common/validation.js";
import { keyedCache } from "../../common/cache.js";
import { tokenize, tokenRegexSource } from "../../common/search-text.js";

/**
 * Kompaniyalar katalogi: filtr + saralash + keyset (cursor) sahifalash.
 *
 * Nega aggregation: reyting, sharhlar soni va faol vakansiyalar soni Company
 * hujjatida saqlanmaydi — ular sharh/vakansiya kolleksiyalaridan hisoblanadi.
 * Ilgari har bir kompaniya bilan uning BARCHA sharh va vakansiyalari tortilib,
 * hisob Node'da qilinardi (100 ta chegara bilan). Endi hisob, filtr va
 * saralash bazaning o'zida bajariladi, javobga faqat kerakli maydonlar chiqadi.
 *
 * Nega cursor, offset emas: ro'yxat o'qilayotganda kompaniya qo'shilsa yoki
 * o'chirilsa `skip` siljiydi — takror yoki tushib qolgan kartalar chiqadi.
 * Cursor oxirgi ko'rilgan yozuvning (saralash kaliti, _id) juftligini
 * saqlaydi va keyingi sahifa aynan undan keyin boshlanadi.
 *
 * Masshtab eslatmasi: har so'rovda mos keladigan kompaniyalar uchun $lookup
 * hisoblanadi. O'n minglab kompaniyada Company'ga denormalizatsiya qilingan
 * hisoblagichlar (ratingAvg, activeVacancyCount) qo'shish keyingi qadam bo'ladi.
 */

// ---- Soha taksonomiyasi ----
// Kompaniya sohasi erkin matn (ish beruvchi o'zi yozadi), shuning uchun guruh
// kalit so'zlar bo'yicha aniqlanadi. Bitta kompaniya bir nechta guruhga tushishi
// mumkin (masalan "Fintech" — IT ham, moliya ham). `.?` — o'zbekcha tutuq
// belgisining turli variantlari (' ’ ʻ) uchun.
export const INDUSTRY_PATTERNS = {
  it: "axborot|texnolog|dasturiy|dasturlash|software|\\bit\\b|fintech|telekom|telecom|информац|технолог|программ",
  finance: "bank|moliya|fintech|buxgalter|sug.?urta|invest|lizing|soliq|audit|financ|finans|банк|финанс|страхов|бухгалт",
  education: "ta.?lim|o.?quv|akadem|maktab|universitet|education|edtech|образован|обучен",
  trade: "savdo|chakana|ulgurji|retail|e-?commerce|marketplace|торгов|ритейл",
  marketing: "marketing|reklama|brend|media|smm|dizayn|design|маркет|реклам|дизайн",
  government: "davlat|vazirlik|hokimiyat|qo.?mita|government|государ|министер",
  manufacturing: "ishlab chiqarish|zavod|fabrika|to.?qimachilik|tekstil|sanoat|manufactur|производ|завод",
  construction: "qurilish|ko.?chmas mulk|developer|real estate|construction|строит|недвиж",
  tourism: "turizm|mehmonxona|hotel|travel|hospitality|туризм|гостини",
  logistics: "logistika|yetkazib|transport|delivery|логист|доставк",
} as const;
export type IndustrySlug = keyof typeof INDUSTRY_PATTERNS;

// Ish beruvchi formasi `1–10 / 11–50 / 51–100 / 101–500 / 500+` qiymatlarini
// saqlaydi (EmployerCompanyForm). Eski yozuvlardagi yaqin variantlar ham qamrab olingan.
export const COMPANY_SIZES = {
  "1-10": ["1–10", "1-10"],
  "11-50": ["11–50", "11-50", "10–50", "10-50"],
  "51-100": ["51–100", "51-100", "50–100", "50-100"],
  "101-500": ["101–500", "101-500", "100–500", "100-500"],
  "500-plus": ["500+"],
} as const;
export type CompanySize = keyof typeof COMPANY_SIZES;

export const COMPANY_SORTS = ["popular", "rating", "vacancies", "newest"] as const;
export type CompanySort = (typeof COMPANY_SORTS)[number];

const RATING_THRESHOLDS = [3, 3.5, 4, 4.5];
const WORK_TYPES = ["office", "remote"] as const;

/** "it,finance,xyz" -> ["it","finance"] — noma'lum qiymatlar jimgina tashlanadi. */
function csvOf<T extends string>(allowed: readonly T[]) {
  return z
    .string()
    .optional()
    .catch(undefined)
    .transform((value) =>
      [...new Set((value ?? "").split(",").map((s) => s.trim()))].filter((s): s is T => allowed.includes(s as T))
    );
}

const flag = z
  .string()
  .optional()
  .catch(undefined)
  .transform((value) => value === "1" || value === "true");

// Buzilgan yoki eskirgan URL sahifani yiqitmasin: noto'g'ri qiymatlar e'tiborsiz
// qoldiriladi (400 emas). Faqat cursor qat'iy tekshiriladi.
export const listCompaniesQuery = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  /** Eski parametr nomi (avvalgi klientlar uchun). */
  text: z.string().trim().max(100).optional().catch(undefined),
  industry: csvOf(Object.keys(INDUSTRY_PATTERNS) as IndustrySlug[]),
  region: z.string().trim().max(60).optional().catch(undefined),
  size: csvOf(Object.keys(COMPANY_SIZES) as CompanySize[]),
  rating: z.coerce
    .number()
    .optional()
    .catch(undefined)
    .transform((v) => (v !== undefined && RATING_THRESHOLDS.includes(v) ? v : undefined)),
  work: csvOf(WORK_TYPES),
  verified: flag,
  hiring: flag,
  saved: flag,
  sort: z.enum(COMPANY_SORTS).catch("popular").default("popular"),
  limit: z.coerce.number().int().min(1).max(50).catch(18).default(18),
  cursor: z.string().max(300).optional(),
});
export type ListCompaniesQuery = z.infer<typeof listCompaniesQuery>;

export interface CompanyListItem {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  description: string;
  industry?: string | null;
  employeeCount?: string | null;
  foundedYear?: number | null;
  isVerified: boolean;
  createdAt: string;
  region?: { name: string; slug: string } | null;
  rating: number;
  reviewCount: number;
  activeVacancyCount: number;
}

export interface CompanyListResult {
  items: CompanyListItem[];
  nextCursor: string | null;
  /** Faqat birinchi sahifada hisoblanadi (keyingilarida `null`). */
  total: number | null;
}

// ---- Cursor ----

interface CursorPayload {
  s: CompanySort;
  k: number;
  i: string;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCursor(raw: string, sort: CompanySort): CursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<CursorPayload>;
    if (parsed.s === sort && typeof parsed.k === "number" && Number.isFinite(parsed.k) && isObjectId(parsed.i)) {
      return parsed as CursorPayload;
    }
  } catch {
    // pastda umumiy xato
  }
  throw Errors.badRequest("Cursor yaroqsiz yoki boshqa saralashga tegishli");
}

// ---- Pipeline ----

const oid = (id: string) => ({ $oid: id });

/**
 * Bloklangan hisoblar ID'lari (audit R3, gap1-8 / D-077): bloklangan ish beruvchining
 * kompaniyasi katalogda, qidiruvda va "o'xshash kompaniyalar"da ko'rinmaydi — sitemap
 * allaqachon shu qoidada edi.
 *
 * Ro'yxat KESHLANMAYDI va kesh kalitiga ham kiradi: admin bloklagan zahoti kompaniya
 * katalogdan yo'qolishi kerak, bloklash esa har doim ham `bumpDataVersion()` chaqirmaydi
 * (masalan faol e'loni bo'lmagan ish beruvchi). So'rov `User @@index([isBlocked])` bo'yicha
 * va odatda bir necha qator qaytaradi. Chegara: 5000 ta bloklangan hisob (undan ortig'ida
 * ro'yxat to'liq bo'lmaydi — 10K maqsadida bunga yetilmaydi).
 */
const BLOCKED_OWNER_LIMIT = 5000;

async function blockedOwnerIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { isBlocked: true },
    select: { id: true },
    take: BLOCKED_OWNER_LIMIT,
  });
  return rows.map((row: { id: string }) => row.id);
}

/** Kesh kaliti uchun qisqa barmoq izi (FNV-1a): ro'yxat o'zgarsa kalit ham o'zgaradi. */
function fingerprint(ids: string[]): string {
  let hash = 0x811c9dc5;
  for (const id of [...ids].sort()) {
    for (let i = 0; i < id.length; i += 1) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return `${ids.length}:${hash.toString(36)}`;
}

/**
 * Saralash kaliti — bitta son (keyset uchun `_id` bilan juftlikda yetarli).
 * - popular: tasdiqlanganlar oldin; so'ng faol vakansiyalar ko'rilishlari
 *   + 25 × sharhlar + 10 × faol vakansiyalar (e'tibor va faollik signali).
 * - rating: o'rtacha baho (0.1 aniqlikda), teng bo'lsa sharhlari ko'pi oldin.
 * - vacancies: faol vakansiyalar soni, teng bo'lsa ko'rilishlar.
 * - newest: qo'shilgan vaqti.
 */
function sortKeyExpr(sort: CompanySort) {
  switch (sort) {
    case "rating":
      return { $add: [{ $multiply: [{ $round: [{ $multiply: ["$_r.avg", 10] }, 0] }, 1e7] }, { $min: ["$_r.count", 9_999_999] }] };
    case "vacancies":
      return { $add: [{ $multiply: ["$_v.count", 1e7] }, { $min: ["$_v.views", 9_999_999] }] };
    case "newest":
      return { $toDouble: "$created_at" };
    default:
      return {
        $add: [
          { $multiply: [{ $cond: ["$is_verified", 1, 0] }, 1e12] },
          { $min: ["$_v.views", 1e11] },
          { $multiply: ["$_r.count", 25] },
          { $multiply: ["$_v.count", 10] },
        ],
      };
  }
}

/**
 * Vakansiya masofaviymi: ish joylashuvi (`workplace_type`) yozilgan bo'lsa unga qarab,
 * eski yozuvlarda (maydon yo'q) bandlik turi `remote` bo'lsa. Gibrid — joyida ishlash ("office").
 */
const REMOTE_VACANCY_EXPR = {
  $cond: [
    { $in: [{ $ifNull: ["$workplace_type", null] }, ["office", "hybrid", "remote"]] },
    { $eq: ["$workplace_type", "remote"] },
    { $eq: ["$employment_type", "remote"] },
  ],
};

const OUTPUT_STAGES = [
  {
    $lookup: {
      from: "regions",
      localField: "region_id",
      foreignField: "_id",
      pipeline: [{ $project: { _id: 0, name: 1, slug: 1 } }],
      as: "_region",
    },
  },
  {
    $project: {
      _id: 0,
      id: { $toString: "$_id" },
      slug: 1,
      name: 1,
      logoUrl: "$logo_url",
      // Karta 2–3 qatorni ko'rsatadi — to'liq tavsif kompaniya sahifasida
      description: { $substrCP: [{ $ifNull: ["$description", ""] }, 0, 280] },
      industry: 1,
      employeeCount: "$employee_count",
      foundedYear: "$founded_year",
      isVerified: { $ifNull: ["$is_verified", false] },
      createdAt: { $dateToString: { date: "$created_at", format: "%Y-%m-%dT%H:%M:%S.%LZ" } },
      region: { $first: "$_region" },
      rating: 1,
      reviewCount: 1,
      activeVacancyCount: 1,
      _sort: 1,
    },
  },
];

type RawItem = CompanyListItem & { _sort: number | { $numberDouble?: string; $numberLong?: string; $numberInt?: string } };

/** aggregateRaw sonlarni ba'zan Extended JSON ko'rinishida qaytaradi. */
function toNumber(value: RawItem["_sort"]): number {
  if (typeof value === "number") return value;
  return Number(value?.$numberDouble ?? value?.$numberLong ?? value?.$numberInt ?? NaN);
}

const EMPTY: CompanyListResult = { items: [], nextCursor: null, total: 0 };

/**
 * Katalog keshi (audit R3, scale-10k-8). Ilgari faqat companies.routes.ts BIRINCHI sahifani
 * keshlardi: har "yana ko'rsatish" (cursor) va har kompaniya sahifasidagi "o'xshash
 * kompaniyalar" bloki ikkita `$lookup` quvuridan qaytadan o'tardi. Endi kesh shu yerda —
 * cursor sahifalari va `/similar` ham foydalanadi. Kompaniya, vakansiya yoki sharh
 * yozilganda kesh darhol yangilanadi.
 *
 * `saved=1` KESHLANMAYDI: u foydalanuvchining o'z ro'yxatiga bog'liq.
 */
const listCache = keyedCache<CompanyListResult>(60_000, 200, ["companies", "vacancies", "reviews"]);

function listKey(query: ListCompaniesQuery, blockedOwners: string[]): string {
  return JSON.stringify([
    fingerprint(blockedOwners),
    (query.q || query.text || "").trim().toLowerCase(),
    query.industry,
    query.region ?? "",
    query.size,
    query.rating ?? 0,
    query.work,
    query.verified ? 1 : 0,
    query.hiring ? 1 : 0,
    query.sort,
    query.limit,
    query.cursor ?? "",
  ]);
}

export async function listCompanies(query: ListCompaniesQuery, viewerId?: string): Promise<CompanyListResult> {
  const blockedOwners = await blockedOwnerIds();
  if (query.saved) return loadCompanies(query, blockedOwners, viewerId);
  return listCache(listKey(query, blockedOwners), () => loadCompanies(query, blockedOwners));
}

async function loadCompanies(
  query: ListCompaniesQuery,
  blockedOwners: string[],
  viewerId?: string
): Promise<CompanyListResult> {
  const cursor = query.cursor ? decodeCursor(query.cursor, query.sort) : null;

  // 1) Company hujjatining o'z maydonlari bo'yicha filtr (indeks va arzon)
  const base: Record<string, unknown>[] = [];

  const text = query.q || query.text;
  if (text) {
    // Har bir so'z nom, soha yoki tavsifning birida uchrashi kerak. So'zlar vakansiya va
    // nomzod qidiruvi bilan bir xil qoidada ajratiladi, tutuq belgisining barcha variantlari
    // esa bitta belgilar sinfiga aylanadi (audit R3, D-080 / gap1-1, gap1-6).
    for (const word of tokenize(text)) {
      const regex = { $regex: tokenRegexSource(word), $options: "i" };
      base.push({ $or: [{ name: regex }, { industry: regex }, { description: regex }] });
    }
  }
  if (query.industry.length) {
    base.push({
      industry: { $regex: query.industry.map((slug) => `(?:${INDUSTRY_PATTERNS[slug]})`).join("|"), $options: "i" },
    });
  }
  if (query.region) {
    const region = await prisma.region.findUnique({ where: { slug: query.region }, select: { id: true } });
    if (!region) return EMPTY;
    base.push({ region_id: oid(region.id) });
  }
  if (query.size.length) {
    base.push({ employee_count: { $in: query.size.flatMap((size) => [...COMPANY_SIZES[size]]) } });
  }
  if (query.verified) base.push({ is_verified: true });
  if (blockedOwners.length) base.push({ owner_user_id: { $nin: blockedOwners.map(oid) } });
  if (query.saved) {
    if (!viewerId) throw Errors.unauthorized();
    const saved = await prisma.savedCompany.findMany({ where: { userId: viewerId }, select: { companyId: true } });
    if (saved.length === 0) return EMPTY;
    base.push({ _id: { $in: saved.map((row) => oid(row.companyId)) } });
  }

  // 2) Hisoblangan ko'rsatkichlar
  const computed: Record<string, unknown>[] = [
    {
      $lookup: {
        from: "company_reviews",
        localField: "_id",
        foreignField: "company_id",
        pipeline: [{ $match: { status: "approved" } }, { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }],
        as: "_reviews",
      },
    },
    {
      $lookup: {
        from: "vacancies",
        localField: "_id",
        foreignField: "company_id",
        pipeline: [
          { $match: { status: "active" } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              views: { $sum: { $ifNull: ["$views_count", 0] } },
              // Masofaviylik yangi e'lonlarda `workplace_type`da, eskilarida (maydon yo'q) `employment_type`da (audit ISSUE-050)
              remote: { $max: { $cond: [REMOTE_VACANCY_EXPR, 1, 0] } },
              office: { $max: { $cond: [REMOTE_VACANCY_EXPR, 0, 1] } },
            },
          },
        ],
        as: "_vacancies",
      },
    },
    {
      $set: {
        _r: { $ifNull: [{ $first: "$_reviews" }, { avg: 0, count: 0 }] },
        _v: { $ifNull: [{ $first: "$_vacancies" }, { count: 0, views: 0, remote: 0, office: 0 }] },
      },
    },
    {
      $set: {
        rating: { $round: [{ $ifNull: ["$_r.avg", 0] }, 1] },
        reviewCount: "$_r.count",
        activeVacancyCount: "$_v.count",
      },
    },
  ];

  // 3) Hisoblangan qiymatlar bo'yicha filtr
  const after: Record<string, unknown>[] = [];
  if (query.rating !== undefined) after.push({ rating: { $gte: query.rating } });
  if (query.hiring) after.push({ activeVacancyCount: { $gt: 0 } });
  if (query.work.length) {
    // Kompaniyaning ish formati — uning faol vakansiyalaridan: masofaviy
    // vakansiyasi bor = "remote", joyida ishlanadigani bor = "office".
    after.push({ $or: query.work.map((w) => ({ [w === "remote" ? "_v.remote" : "_v.office"]: 1 })) });
  }

  const pipeline: Record<string, unknown>[] = [
    ...(base.length ? [{ $match: { $and: base } }] : []),
    ...computed,
    ...(after.length ? [{ $match: { $and: after } }] : []),
    { $set: { _sort: sortKeyExpr(query.sort) } },
  ];

  const pageStages = [{ $sort: { _sort: -1, _id: -1 } }, { $limit: query.limit + 1 }, ...OUTPUT_STAGES];

  let rawItems: RawItem[];
  let total: number | null = null;

  if (cursor) {
    pipeline.push(
      { $match: { $or: [{ _sort: { $lt: cursor.k } }, { _sort: cursor.k, _id: { $lt: oid(cursor.i) } }] } },
      ...pageStages
    );
    rawItems = (await prisma.company.aggregateRaw({ pipeline: pipeline as never })) as unknown as RawItem[];
  } else {
    // Birinchi sahifa: natijalar + umumiy son bitta so'rovda
    pipeline.push({ $facet: { items: pageStages, total: [{ $count: "n" }] } });
    const [result] = (await prisma.company.aggregateRaw({ pipeline: pipeline as never })) as unknown as {
      items: RawItem[];
      total: { n: number | { $numberInt: string } }[];
    }[];
    rawItems = result?.items ?? [];
    total = result?.total?.[0] ? toNumber(result.total[0].n as RawItem["_sort"]) : 0;
  }

  const hasMore = rawItems.length > query.limit;
  const page = hasMore ? rawItems.slice(0, query.limit) : rawItems;
  const last = page[page.length - 1];

  return {
    items: page.map(({ _sort, ...item }) => ({
      ...item,
      rating: toNumber(item.rating as RawItem["_sort"]),
      reviewCount: toNumber(item.reviewCount as RawItem["_sort"]),
      activeVacancyCount: toNumber(item.activeVacancyCount as RawItem["_sort"]),
      foundedYear: item.foundedYear == null ? null : toNumber(item.foundedYear as RawItem["_sort"]),
    })),
    nextCursor: hasMore && last ? encodeCursor({ s: query.sort, k: toNumber(last._sort), i: last.id }) : null,
    total,
  };
}

/**
 * "O'xshash kompaniyalar": sohasi katalogdagi bir xil guruhga tushadiganlar
 * (INDUSTRY_PATTERNS), soha aniqlanmasa — shu hududdagilar. Hisob va "popular"
 * tartibi katalog bilan bir xil; kompaniyaning o'zi chiqmaydi. Mos kelmasa — bo'sh.
 */
export async function similarCompanies(slug: string, limit = 5): Promise<{ items: CompanyListItem[] }> {
  const take = Math.min(Math.max(Math.trunc(limit) || 5, 1), 10);
  const base = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, industry: true, region: { select: { slug: true } } },
  });
  if (!base) throw Errors.notFound("Kompaniya topilmadi");

  const industry = base.industry ?? "";
  const groups = industry
    ? (Object.keys(INDUSTRY_PATTERNS) as IndustrySlug[]).filter((g) => new RegExp(INDUSTRY_PATTERNS[g], "i").test(industry))
    : [];
  const filter = groups.length ? { industry: groups.join(",") } : base.region ? { region: base.region.slug } : null;
  if (!filter) return { items: [] };

  const result = await listCompanies(listCompaniesQuery.parse({ ...filter, sort: "popular", limit: String(take + 1) }));
  return { items: result.items.filter((c) => c.id !== base.id).slice(0, take) };
}
