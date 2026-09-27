import { prisma } from "../../common/prisma.js";
import { keyedCache } from "../../common/cache.js";
import { apostropheVariants, searchKey, tokenize } from "../../common/search-text.js";
import type { Prisma } from "@prisma/client";
import {
  EMPLOYMENT_VALUES,
  EXPERIENCE_VALUES,
  VACANCY_CARD_SELECT,
  VacancyListQuery,
  splitList,
} from "./vacancies.select.js";


/** Ro'yxat filtrlari: matn, hudud, tajriba, bandlik, kompaniya — shart qurish va saralash tartibi. */

/**
 * Bandlik filtri. "Masofaviy" — ish joylashuvi masofaviy bo'lgan e'lonlarni ham oladi
 * (yangi e'lonlarda masofaviylik `workplaceType`da, eskilarida `employmentType = remote`).
 */
export function employmentWhere(employment: string[]): Prisma.VacancyWhereInput {
  const byType: Prisma.VacancyWhereInput = { employmentType: { in: employment as never } };
  return employment.includes("remote") ? { OR: [byType, { workplaceType: "remote" }] } : byType;
}

/** Facet hisoblashda "o'z" filtri chetlab o'tiladigan o'lchovlar. */
export type FilterDimension = "area" | "experience" | "employment" | "company" | "category";

/**
 * Qidiruv so'zlari — umumiy `tokenize` (audit R3, D-080 / gap1-6): so'z chetidagi
 * tinish belgilari tozalanadi (`dasturchi,` topiladi), takrorlar tashlanadi,
 * 2+ belgili ko'pi bilan 8 ta so'z qoladi. MongoDB drayveri, ID oldindan hisobi
 * va facets bir xil ro'yxatni ko'radi.
 */
export function searchTerms(text: string): string[] {
  return tokenize(text);
}

/** Prisma uchun "ichida bor" (katta-kichik harf farqsiz). */
export const like = (value: string) => ({ contains: value, mode: "insensitive" as const });

/**
 * Nom bo'yicha moslik — tutuq belgisining har bir varianti bilan (audit R3, D-080 / gap1-1):
 * `ko'chmas`, `koʻchmas` va `ko’chmas` bir xil natija beradi. Prisma MongoDB'da `contains`
 * qiymatini o'zi ekranlaydi, shuning uchun regex o'rniga variantlar OR bilan beriladi
 * (ko'pi bilan 7 ta; tutuq belgisi bo'lmagan so'zda bitta shart).
 */
function nameMatches(term: string): { OR: { name: { contains: string; mode: "insensitive" } }[] } {
  return { OR: apostropheVariants(term).map((variant) => ({ name: like(variant) })) };
}

/** Filtr slug'lari va matn so'zlariga mos ID'lar — so'rov boshida bir marta hisoblanadi. */
interface ResolvedFilterIds {
  /** `area` berilgan bo'lsa — mos hudud ID'lari (hech biri topilmasa bo'sh — natija yo'q). */
  regionIds: string[] | null;
  /** `categorySlug` berilgan bo'lsa — kategoriya ID'si (topilmasa bo'sh). */
  categoryIds: string[] | null;
  /** `company` slug'lari berilgan bo'lsa — mos kompaniya ID'lari. */
  companySlugIds: string[] | null;
  /** `verified` bo'lsa — tasdiqlangan kompaniyalar ID'lari. */
  verifiedCompanyIds: string[] | null;
  /** Matn so'zi → nomi shu so'zni o'z ichiga olgan kompaniya / kategoriya ID'lari. */
  companyIdsByTerm: Map<string, string[]>;
  categoryIdsByTerm: Map<string, string[]>;
}

const idsOfRows = (rows: { id: string }[]) => rows.map((row) => row.id);

/**
 * Relation filter (`region: { slug }`, `company: { name }`, `category: { name }`) MongoDB'da har bir
 * vakansiya uchun `$lookup` bajaradi: 20k e'londa hudud filtri va matn qidiruvi soniyalar olardi
 * (audit PHASE 5.3 sintetik benchmark). Endi slug va nomlar kichik kataloglardan (hudud, kategoriya,
 * kompaniya) oldindan ID'ga aylantiriladi va vakansiya indekslangan `regionId / categoryId / companyId`
 * bo'yicha filtrlanadi. Natija semantikasi o'zgarmaydi (e2e filtr va facets tekshiruvlari).
 */
export async function resolveFilterIds(query: VacancyListQuery, text?: string): Promise<ResolvedFilterIds> {
  const areas = splitList(query.area);
  const companies = splitList(query.company);
  const [regionIds, categoryIds, companySlugIds, verifiedCompanyIds, termMatches] = await Promise.all([
    areas.length ? prisma.region.findMany({ where: { slug: { in: areas } }, select: { id: true } }).then(idsOfRows) : null,
    query.categorySlug
      ? prisma.vacancyCategory.findMany({ where: { slug: query.categorySlug }, select: { id: true } }).then(idsOfRows)
      : null,
    companies.length ? prisma.company.findMany({ where: { slug: { in: companies } }, select: { id: true } }).then(idsOfRows) : null,
    query.verified ? prisma.company.findMany({ where: { isVerified: true }, select: { id: true } }).then(idsOfRows) : null,
    Promise.all(
      searchTerms(text ?? "").map(async (term) => {
        const [companyRows, categoryRows] = await Promise.all([
          prisma.company.findMany({ where: nameMatches(term), select: { id: true } }),
          prisma.vacancyCategory.findMany({ where: nameMatches(term), select: { id: true } }),
        ]);
        return { term, companyIds: idsOfRows(companyRows), categoryIds: idsOfRows(categoryRows) };
      })
    ),
  ]);
  return {
    regionIds,
    categoryIds,
    companySlugIds,
    verifiedCompanyIds,
    companyIdsByTerm: new Map(termMatches.map((m) => [m.term, m.companyIds])),
    categoryIdsByTerm: new Map(termMatches.map((m) => [m.term, m.categoryIds])),
  };
}

/** Filtrlar (matndan tashqari) — ikkala drayverda ham bir xil qo'llanadi. */
export function buildFilters(query: VacancyListQuery, resolved: ResolvedFilterIds, except?: FilterDimension): Prisma.VacancyWhereInput {
  const experience = except === "experience" ? [] : splitList(query.experience, EXPERIENCE_VALUES);
  const employment = except === "employment" ? [] : splitList(query.employment, EMPLOYMENT_VALUES);
  // Kompaniya: slug filtri (o'z o'lchovi facet'ida chetlab o'tiladi) va "faqat tasdiqlanganlar" (doim) kesishmasi
  let companyIds: string[] | null = except === "company" ? null : resolved.companySlugIds;
  if (resolved.verifiedCompanyIds) {
    const verified = new Set(resolved.verifiedCompanyIds);
    companyIds = companyIds ? companyIds.filter((id) => verified.has(id)) : resolved.verifiedCompanyIds;
  }
  return {
    status: "active",
    ...(except !== "category" && resolved.categoryIds ? { categoryId: { in: resolved.categoryIds } } : {}),
    ...(except !== "area" && resolved.regionIds ? { regionId: { in: resolved.regionIds } } : {}),
    ...(experience.length ? { experienceRequired: { in: experience as never } } : {}),
    ...(employment.length ? employmentWhere(employment) : {}),
    ...(companyIds ? { companyId: { in: companyIds } } : {}),
    ...(query.premium ? { isPremium: true } : {}),
    // Chop etilgan vaqt oralig'i (publishedAfter; publishedBefore] — obuna aylanishi uchun (audit PHASE 6, V6)
    ...(query.publishedAfter || query.publishedBefore
      ? {
          publishedAt: {
            ...(query.publishedAfter ? { gt: query.publishedAfter } : {}),
            ...(query.publishedBefore ? { lte: query.publishedBefore } : {}),
          },
        }
      : {}),
    // Maosh filtri: vakansiyaning boshlang'ich oyligi (salaryMin) berilgan
    // oraliqda bo'lishi kerak. Masalan [9mln, 10mln] uchun 8mln'dan
    // boshlanadigan vakansiya chiqmaydi. Yashirilgan maosh filtrga tushmaydi —
    // aks holda yashirin raqam filtr natijalari orqali aniqlanardi.
    ...(query.salary || query.salaryTo
      ? {
          NOT: { isSalaryHidden: true },
          salaryMin: {
            ...(query.salary ? { gte: query.salary } : {}),
            ...(query.salaryTo ? { lte: query.salaryTo } : {}),
          },
        }
      : {}),
  };
}

/**
 * MongoDB matn qidiruvi: so'rov so'zlarga bo'linadi va HAR BIR so'z
 * sarlavha / tavsif / talablar / kompaniya nomi / kategoriya nomidan birida
 * uchrashi shart (AND). Bu "frontend dasturchi toshkent" kabi ko'p so'zli
 * so'rovlarni to'g'ri toraytiradi — oddiy `contains` esa hech narsa topmasdi.
 */
export function textFilter(text: string, resolved: ResolvedFilterIds): Prisma.VacancyWhereInput {
  const terms = searchTerms(text);
  if (terms.length === 0) return {};

  return {
    AND: terms.map((term) => {
      // Kompaniya va soha nomi — oldindan topilgan ID'lar (relation filter $lookup'siz)
      const companyIds = resolved.companyIdsByTerm.get(term) ?? [];
      const categoryIds = resolved.categoryIdsByTerm.get(term) ?? [];
      const byRelation: Prisma.VacancyWhereInput[] = [
        ...(companyIds.length ? [{ companyId: { in: companyIds } }] : []),
        ...(categoryIds.length ? [{ categoryId: { in: categoryIds } }] : []),
      ];
      // Tutuq belgisi variantlari (audit R3, D-080): har bir maydon uchun variantlar OR bilan
      const variants = apostropheVariants(term);
      const inFields = (fields: readonly ("title" | "description" | "requirements")[]): Prisma.VacancyWhereInput[] =>
        fields.flatMap((field) => variants.map((variant) => ({ [field]: like(variant) }) as Prisma.VacancyWhereInput));
      return {
        // Qisqa so'zlar (HR, QA, 1C) tavsif ichida boshqa so'z bo'lagi sifatida
        // ham uchraydi ("sHaHRi") — ular faqat sarlavha, kompaniya va sohadan qidiriladi.
        // So'z chegarasi bo'yicha qidirish (audit R3, gap1-2) Prisma `contains` bilan
        // mumkin emas: u qiymatni ekranlaydi, regex esa faqat `aggregateRaw` da ishlaydi.
        OR:
          term.length < 4
            ? [...inFields(["title"]), ...byRelation]
            : [...inFields(["title", "description", "requirements"]), ...byRelation],
      };
    }),
  };
}

/**
 * Kesh kaliti: `where` ga ta'sir qiladigan hamma narsa (sahifa, o'lcham va saralash kirmaydi).
 * Matn tokenlarga keltiriladi, ya'ni `React ` va `react` bitta kalit (ikkalasi ham bir xil
 * katta-kichik harf farqsiz so'rov). Jami son va facets keshlari shu kalitda (audit R3,
 * db-perf-4 / db-perf-5 / scale-10k-4).
 */
export function filterKey(query: VacancyListQuery): string {
  return JSON.stringify([
    searchTerms(query.text?.trim() ?? "").map(searchKey),
    query.categorySlug ?? "",
    splitList(query.area),
    splitList(query.experience, EXPERIENCE_VALUES),
    splitList(query.employment, EMPLOYMENT_VALUES),
    query.salary ?? 0,
    query.salaryTo ?? 0,
    splitList(query.company),
    query.verified ? 1 : 0,
    query.premium ? 1 : 0,
    query.publishedAfter?.getTime() ?? 0,
    query.publishedBefore?.getTime() ?? 0,
  ]);
}

/**
 * Ro'yxatning jami soni (audit R3, db-perf-4): ilgari har sahifa va har saralashda alohida
 * `count` skan bo'lardi — endi bir xil filtr uchun 60 s keshlanadi. Vakansiya yoki kompaniya
 * yozilganda kesh darhol yangilanadi, shuning uchun yangi e'lon sondan tushib qolmaydi.
 */
export const listTotalCache = keyedCache<number>(60_000, 300, ["vacancies", "companies"]);

// Oxirida `id` — sana bir xil bo'lganda sahifalar orasida takror/tushib qolish bo'lmasin
const DATE_ORDER: Prisma.VacancyOrderByWithRelationInput[] = [
  { isPremium: "desc" },
  { publishedAt: "desc" },
  { id: "desc" },
];

export const SORT_ORDERS: Record<"relevance" | "date" | "popular", Prisma.VacancyOrderByWithRelationInput[]> = {
  // "Eng dolzarb": premium e'lonlar oldin, keyin yangilari
  relevance: DATE_ORDER,
  // "Yangi qo'shilgan": faqat sana — premium yuqoriga ko'tarilmaydi
  date: [{ publishedAt: "desc" }, { id: "desc" }],
  // "Mashhurligi bo'yicha": ko'rishlar soni
  popular: [{ viewsCount: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
};

/**
 * Maosh bo'yicha saralash — ikki bo'lakda.
 *
 * MongoDB `nulls: "last"` ni qo'llab-quvvatlamaydi (bu SQL imkoniyati) va
 * o'sish tartibida `null` larni BIRINCHI qo'yadi — ya'ni "maosh bo'yicha
 * saralash" ro'yxatining boshiga maoshi ko'rsatilmagan e'lonlar chiqib qolardi.
 * Shuning uchun avval maoshi ko'rsatilganlar (maosh bo'yicha), keyin
 * ko'rsatilmaganlar (sana bo'yicha) beriladi. Sahifalash ikkala bo'lak ustidan
 * uzluksiz ishlaydi, `total` esa o'zgarmaydi.
 *
 * "Ko'rsatilmagan" — `null`, umuman yozilmagan maydon (Mongo'da `null` filtri unga mos
 * kelmaydi — `isSet: false` kerak) yoki yashirilgan maosh (yashirin raqam tartib orqali
 * ochilmasin). Ilgari yozilmagan maoshli e'lonlar ikkala bo'lakdan ham tushib qolardi.
 */
export async function listBySalary(
  where: Prisma.VacancyWhereInput,
  direction: "asc" | "desc",
  skip: number,
  take: number
) {
  const priced: Prisma.VacancyWhereInput = {
    AND: [where, { NOT: { isSalaryHidden: true } }, { salaryMin: { not: null } }],
  };
  const unpriced: Prisma.VacancyWhereInput = {
    AND: [where, { OR: [{ isSalaryHidden: true }, { salaryMin: null }, { salaryMin: { isSet: false } }] }],
  };

  const pricedCount = await prisma.vacancy.count({ where: priced });

  const head =
    skip < pricedCount
      ? await prisma.vacancy.findMany({
          where: priced,
          select: VACANCY_CARD_SELECT,
          orderBy: [{ isPremium: "desc" }, { salaryMin: direction }, { id: "desc" }],
          skip,
          take,
        })
      : [];

  if (head.length >= take) return head;

  const tail = await prisma.vacancy.findMany({
    where: unpriced,
    select: VACANCY_CARD_SELECT,
    orderBy: DATE_ORDER,
    skip: Math.max(0, skip - pricedCount),
    take: take - head.length,
  });

  return [...head, ...tail];
}
