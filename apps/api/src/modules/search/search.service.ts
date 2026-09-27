import { Meilisearch, type Index } from "meilisearch";
import { prisma } from "../../common/prisma.js";
import { env, features } from "../../common/env.js";

/**
 * Vakansiya qidiruvi — ikki drayverli.
 *
 *  1. **Meilisearch** (MEILI_HOST .env'da bo'lsa): xato yozilishga chidamli
 *     ("dasturchu" -> "dasturchi"), so'z shakllariga bardoshli, tez.
 *  2. **PostgreSQL** (default): qo'shimcha xizmatsiz ishlaydi. So'rov so'zlarga
 *     bo'linadi va har bir so'z sarlavha / tavsif / kompaniya nomi / kategoriya
 *     ichida uchrashi talab qilinadi (AND mantiq).
 *
 * Meilisearch ko'tarilmagan bo'lsa yoki so'rov paytida xato bersa — kod jimgina
 * PostgreSQL drayveriga tushadi, sayt hech qachon "qidiruv ishlamayapti" holatiga
 * tushmaydi.
 */

const INDEX_UID = env.MEILI_INDEX;

let client: Meilisearch | null = null;
let indexReady = false;
/** Meili qulab tushsa qayta-qayta urinmaslik uchun bayroq. */
let meiliBroken = false;

function getClient(): Meilisearch | null {
  if (!features.meilisearch || meiliBroken) return null;
  if (!client) {
    client = new Meilisearch({
      host: env.MEILI_HOST,
      ...(env.MEILI_API_KEY ? { apiKey: env.MEILI_API_KEY } : {}),
    });
  }
  return client;
}

export function isSearchEngineEnabled(): boolean {
  return getClient() !== null;
}

async function getIndex(): Promise<Index | null> {
  const c = getClient();
  if (!c) return null;
  try {
    if (!indexReady) {
      await c.createIndex(INDEX_UID, { primaryKey: "id" }).catch(() => undefined);
      const created = c.index(INDEX_UID);
      await created.updateSettings({
        searchableAttributes: ["title", "companyName", "categoryName", "description", "requirements"],
        filterableAttributes: [
          "status",
          "categorySlug",
          "regionSlug",
          "employmentType",
          "workplaceType",
          "experienceRequired",
          "salaryMin",
        ],
        sortableAttributes: ["publishedAt", "salaryMin", "isPremium"],
        // Sarlavhadagi moslik tavsifdagidan muhimroq
        rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"],
        // Standart chegara 1000 ta edi: 51-sahifadan keyin ro'yxat bo'sh qaytardi, `pageCount`
        // esa yana sahifa bor deb turardi (audit R3, gap1-4). Undan chuqurroq sahifa
        // MongoDB drayveriga tushadi (`searchVacancyIds` null qaytaradi).
        pagination: { maxTotalHits: MAX_TOTAL_HITS },
      });
      indexReady = true;
    }
    return c.index(INDEX_UID);
  } catch (e) {
    console.warn("[search] Meilisearch indeksini tayyorlab bo'lmadi:", (e as Error).message);
    meiliBroken = true;
    return null;
  }
}

interface VacancyDoc {
  id: string;
  slug: string;
  title: string;
  description: string;
  requirements: string;
  companyName: string;
  companySlug: string;
  categoryName: string;
  categorySlug: string;
  regionName: string;
  regionSlug: string;
  employmentType: string;
  /** Bo'sh — noma'lum (eski yozuv). */
  workplaceType: string;
  experienceRequired: string;
  /** Yashirilgan yoki ko'rsatilmagan maosh — `null` (filtrga tushmaydi). */
  salaryMin: number | null;
  salaryMax: number | null;
  isPremium: boolean;
  status: string;
  publishedAt: number;
}

interface IndexableVacancy {
  id: string;
  slug: string;
  title: string;
  description: string;
  requirements: string | null;
  status: string;
  employmentType: string;
  workplaceType: string | null;
  experienceRequired: string;
  salaryMin: number | null;
  salaryMax: number | null;
  isSalaryHidden: boolean;
  isPremium: boolean;
  publishedAt: Date | null;
  company: { name: string; slug: string } | null;
  category: { name: string; slug: string } | null;
  region: { name: string; slug: string } | null;
}

function toDoc(v: IndexableVacancy): VacancyDoc {
  return {
    id: v.id,
    slug: v.slug,
    title: v.title,
    description: v.description.slice(0, 4000),
    requirements: (v.requirements ?? "").slice(0, 2000),
    companyName: v.company?.name ?? "",
    companySlug: v.company?.slug ?? "",
    categoryName: v.category?.name ?? "",
    categorySlug: v.category?.slug ?? "",
    regionName: v.region?.name ?? "",
    regionSlug: v.region?.slug ?? "",
    employmentType: v.employmentType,
    workplaceType: v.workplaceType ?? (v.employmentType === "remote" ? "remote" : ""),
    experienceRequired: v.experienceRequired,
    // Yashirilgan yoki ko'rsatilmagan maosh indeksga raqam bo'lib tushmaydi: `salaryMin <= X` filtri
    // ularni tanlamasin va yashirin raqam filtr orqali aniqlanmasin (MongoDB drayveri bilan bir xil; audit ISSUE-033)
    salaryMin: v.isSalaryHidden ? null : v.salaryMin ?? null,
    salaryMax: v.isSalaryHidden ? null : v.salaryMax ?? null,
    isPremium: v.isPremium,
    status: v.status,
    publishedAt: v.publishedAt ? v.publishedAt.getTime() : 0,
  };
}

const DOC_INCLUDE = {
  company: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
  region: { select: { name: true, slug: true } },
} as const;

/** Bitta vakansiyani indeksga yozadi (yaratilgan/tahrirlangan paytda chaqiriladi). */
export async function indexVacancy(vacancyId: string): Promise<void> {
  const index = await getIndex();
  if (!index) return;
  try {
    const v = await prisma.vacancy.findUnique({ where: { id: vacancyId }, include: DOC_INCLUDE });
    if (!v) return;
    if (v.status !== "active") {
      await index.deleteDocument(vacancyId);
      return;
    }
    await index.addDocuments([toDoc(v as IndexableVacancy)]);
  } catch (e) {
    console.warn("[search] indekslash xatosi:", (e as Error).message);
  }
}

export async function removeVacancyFromIndex(vacancyId: string): Promise<void> {
  const index = await getIndex();
  if (!index) return;
  await index.deleteDocument(vacancyId).catch(() => undefined);
}

const REINDEX_BATCH = 1000;

/**
 * Meili sahifalash chegarasi (audit R3, gap1-4). Undan chuqurroq sahifa so'ralsa Meili yo'li
 * ishlatilmaydi — MongoDB drayveri chuqur sahifani ham qaytara oladi.
 */
const MAX_TOTAL_HITS = 10_000;

/**
 * Bir vaqtda faqat bitta qayta indekslash (audit R3, admin-staff-13): ikki admin bir vaqtda
 * ishga tushirsa, birinchi skan olgan "faol ID'lar" ro'yxati ikkinchisi qo'shgan yangi
 * hujjatlarni eskirgan deb o'chirishi mumkin edi. Ikkinchi chaqiruv shu vazifani kutadi.
 */
let reindexInFlight: Promise<{ indexed: number; engine: string }> | null = null;

/**
 * Barcha faol vakansiyalarni qaytadan indekslaydi (admin buyrug'i, server ishga tushganda).
 *
 * Audit ISSUE-061: ilgari avval butun indeks o'chirilib (`deleteAllDocuments`), keyin barcha hujjatlar
 * bitta so'rovda qo'shilardi — Meili vazifalari tugaguncha qidiruv bo'sh natija berardi, 20k e'londa esa
 * butun to'plam xotiraga o'qilardi. Endi hujjatlar 1000 talik bo'laklarda upsert qilinadi, so'ng
 * indeksda qolgan eskirgan (endi faol bo'lmagan) ID'lar o'chiriladi.
 */
export async function reindexAll(): Promise<{ indexed: number; engine: string }> {
  if (reindexInFlight) return reindexInFlight;
  const task = runReindex();
  reindexInFlight = task;
  try {
    return await task;
  } finally {
    if (reindexInFlight === task) reindexInFlight = null;
  }
}

async function runReindex(): Promise<{ indexed: number; engine: string }> {
  const index = await getIndex();
  if (!index) return { indexed: 0, engine: "mongodb" };

  const activeIds = new Set<string>();
  // Keyset sahifalash (id > oxirgi): Prisma `cursor` hujjati skan paytida o'chirilsa sikl erta tugardi va
  // quyidagi "eskirgan" bosqichi qolgan barcha faol vakansiyalarni indeksdan o'chirardi (audit PHASE 6, U15)
  let lastId: string | undefined;
  for (;;) {
    const batch = await prisma.vacancy.findMany({
      where: lastId ? { status: "active", id: { gt: lastId } } : { status: "active" },
      include: DOC_INCLUDE,
      orderBy: { id: "asc" },
      take: REINDEX_BATCH,
    });
    if (batch.length === 0) break;
    await index.addDocuments(batch.map((v) => toDoc(v as IndexableVacancy)));
    for (const v of batch) activeIds.add(v.id);
    lastId = batch[batch.length - 1].id;
    if (batch.length < REINDEX_BATCH) break;
  }

  // Indeksda bor, lekin endi faol bo'lmagan (yopilgan/o'chirilgan) hujjatlar
  const stale: string[] = [];
  for (let offset = 0; ; offset += REINDEX_BATCH) {
    const page = await index.getDocuments<{ id: string }>({ fields: ["id"], limit: REINDEX_BATCH, offset });
    for (const doc of page.results) if (!activeIds.has(doc.id)) stale.push(doc.id);
    if (page.results.length < REINDEX_BATCH) break;
  }
  // Skan davomida chop etilgan e'lon "eskirgan" ro'yxatiga tushib qolishi mumkin: o'chirishdan
  // oldin bazadan qayta tekshiriladi va faol bo'lganlari qoldiriladi (audit R3, admin-staff-13)
  if (stale.length > 0) {
    const stillActive = new Set<string>();
    for (let i = 0; i < stale.length; i += REINDEX_BATCH) {
      const rows = await prisma.vacancy.findMany({
        where: { id: { in: stale.slice(i, i + REINDEX_BATCH) }, status: "active" },
        select: { id: true },
      });
      for (const row of rows) stillActive.add(row.id);
    }
    const removable = stale.filter((id) => !stillActive.has(id));
    if (removable.length > 0) await index.deleteDocuments(removable);
  }

  return { indexed: activeIds.size, engine: "meilisearch" };
}

export interface EngineQuery {
  text: string;
  categorySlug?: string;
  /**
   * Chaqiruvchi ALLAQACHON tekshirgan qiymatlar (audit R3, gap1-10): MongoDB drayveri noma'lum
   * enum qiymatini tashlardi, Meili esa uni `IN [...]` filtriga qo'shib 0 natija qaytarardi.
   */
  areas: string[];
  experience: string[];
  employment: string[];
  salary?: number;
  salaryTo?: number;
  /** 1 dan boshlanadi: Meili `page`/`hitsPerPage` bilan ANIQ `totalHits` qaytaradi. */
  page: number;
  limit: number;
}

/**
 * Meilisearch orqali qidiradi. Natija — ID'lar (tartibi relevantlik bo'yicha).
 * Meili yo'q/xato bo'lsa `null` qaytadi va chaqiruvchi PostgreSQL'ga tushadi.
 */
export async function searchVacancyIds(
  query: EngineQuery
): Promise<{ ids: string[]; total: number } | null> {
  const index = await getIndex();
  if (!index) return null;

  // Chuqur sahifa: Meili `maxTotalHits` dan nariga o'ta olmaydi — bo'sh sahifa o'rniga
  // MongoDB drayveriga tushamiz (audit R3, gap1-4)
  if (query.page * query.limit > MAX_TOTAL_HITS) return null;

  const filters: string[] = ['status = "active"'];
  // Hudud, tajriba va bandlik — chaqiruvchi tekshirgan ro'yxatlar
  const oneOf = (field: string, list: string[]) => {
    if (list.length) filters.push(`${field} IN [${list.map((v) => `"${escapeFilter(v)}"`).join(", ")}]`);
  };
  if (query.categorySlug) filters.push(`categorySlug = "${escapeFilter(query.categorySlug)}"`);
  oneOf("regionSlug", query.areas);
  oneOf("experienceRequired", query.experience);
  // "Masofaviy" — ish joylashuvi masofaviy e'lonlar ham (MongoDB filtri bilan bir xil)
  const employment = query.employment;
  if (employment.length) {
    const byType = `employmentType IN [${employment.map((v) => `"${escapeFilter(v)}"`).join(", ")}]`;
    filters.push(employment.includes("remote") ? `(${byType} OR workplaceType = "remote")` : byType);
  }
  if (query.salary) filters.push(`salaryMin >= ${Math.trunc(query.salary)}`);
  if (query.salaryTo) filters.push(`salaryMin <= ${Math.trunc(query.salaryTo)}`);

  try {
    // `page`/`hitsPerPage` — ANIQ `totalHits` (ilgari `estimatedTotalHits` sahifalar sonini
    // taxminiy ko'rsatardi). `sort` da premium birinchi, so'ng yangiroq e'lon: MongoDB
    // "Eng dolzarb" tartibiga yaqinlashtiradi, lekin `rankingRules` da `sort` matn
    // relevantligidan KEYIN turadi — shuning uchun ikki drayver tartibi baribir bir xil emas
    // (audit R3, gap1-3, gap1-4: hujjatlashtirilgan farq).
    const res = await index.search(query.text, {
      filter: filters.join(" AND "),
      page: query.page,
      hitsPerPage: query.limit,
      sort: ["isPremium:desc", "publishedAt:desc"],
      attributesToRetrieve: ["id"],
    });
    const exact = (res as { totalHits?: number }).totalHits;
    return {
      ids: res.hits.map((h) => (h as { id: string }).id),
      total: typeof exact === "number" ? exact : res.hits.length,
    };
  } catch (e) {
    console.warn("[search] Meilisearch so'rov xatosi, PostgreSQL'ga o'tildi:", (e as Error).message);
    return null;
  }
}

/** Meili filtr satrida qo'shtirnoq va teskari chiziqni tozalash. */
function escapeFilter(value: string): string {
  return value.replace(/["\\]/g, "");
}

/** Server ko'tarilganda indeksni fon rejimida to'ldiradi (Meili yoqilgan bo'lsa). */
export async function warmSearchIndex(): Promise<void> {
  if (!isSearchEngineEnabled()) return;
  try {
    const result = await reindexAll();
    console.log(`[search] Meilisearch indeksi tayyor: ${result.indexed} ta vakansiya`);
  } catch (e) {
    console.warn("[search] indeksni to'ldirib bo'lmadi:", (e as Error).message);
  }
}
