import { prisma } from "../../common/prisma.js";
import { bumpDataVersion, keyedCache } from "../../common/cache.js";
import type { Prisma } from "@prisma/client";
import { searchVacancyIds } from "../search/search.service.js";
import {
  EMPLOYMENT_VALUES,
  EXPERIENCE_VALUES,
  VACANCY_CARD_SELECT,
  VacancyListQuery,
  splitList,
  withPublicSalary,
} from "./vacancies.select.js";
import {
  FilterDimension,
  SORT_ORDERS,
  buildFilters,
  employmentWhere,
  filterKey,
  listBySalary,
  listTotalCache,
  resolveFilterIds,
  textFilter,
} from "./vacancies.filters.js";


/** Vakansiyalar ro'yxati va filtr sonlari (facets). */

export async function listVacancies(query: VacancyListQuery) {
  const page = Math.max(query.page ?? 1, 1);
  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 50);
  const skip = (page - 1) * pageSize;
  const text = query.text?.trim();

  // 1-yo'l: Meilisearch (yoqilgan bo'lsa va matn qidiruvi bo'lsa). Indeksda
  // kompaniya/tasdiq/premium maydonlari yo'q — bunday filtrlar MongoDB'da.
  const engineCanFilter =
    !query.company && !query.verified && !query.premium && !query.publishedAfter && !query.publishedBefore;
  if (text && engineCanFilter && (query.sort ?? "relevance") === "relevance") {
    const engine = await searchVacancyIds({
      text,
      categorySlug: query.categorySlug,
      // Noma'lum enum qiymatlari ikkala drayverda ham bir xil tashlanadi: ilgari Meili
      // yo'lida ular 0 natijali filtrga aylanardi (audit R3, gap1-10)
      areas: splitList(query.area),
      experience: splitList(query.experience, EXPERIENCE_VALUES),
      employment: splitList(query.employment, EMPLOYMENT_VALUES),
      salary: query.salary,
      salaryTo: query.salaryTo,
      page,
      limit: pageSize,
    });

    if (engine) {
      const rows = await prisma.vacancy.findMany({
        // Indeks kechiksa yoki sinxronlash xato bersa ham yopilgan/qoralama e'lon qaytmasin (audit ISSUE-061)
        where: { id: { in: engine.ids }, status: "active" },
        select: VACANCY_CARD_SELECT,
      });
      // Meili relevantlik tartibini saqlaymiz (findMany tartibni kafolatlamaydi)
      const byId = new Map(rows.map((r) => [r.id, r]));
      const items = engine.ids.flatMap((id) => {
        const row = byId.get(id);
        return row ? [withPublicSalary(row)] : [];
      });
      // Drayverlar farqi (audit R3, gap1-3, gap1-4): Meili so'z va xato yozilishga bardoshli,
      // MongoDB esa har so'zni substring sifatida qidiradi — shuning uchun bir xil so'rovda
      // natijalar to'plami farq qilishi mumkin. `total` endi Meili'ning ANIQ `totalHits` soni
      // (ilgari `estimatedTotalHits` edi), lekin indeks kechikkan bo'lsa quyidagi `status:
      // active` filtri ayrim qatorlarni olib tashlashi mumkin — bunda sahifada `total` dan
      // kamroq karta ko'rinadi.
      return {
        items,
        total: engine.total,
        page,
        pageSize,
        pageCount: Math.ceil(engine.total / pageSize),
        engine: "meilisearch" as const,
      };
    }
  }

  // 2-yo'l: MongoDB. Slug va nomlar oldindan ID'larga aylantiriladi (relation filter $lookup'siz)
  const resolved = await resolveFilterIds(query, text);
  const filters = buildFilters(query, resolved);
  const where: Prisma.VacancyWhereInput = text
    ? { AND: [filters, textFilter(text, resolved)] }
    : filters;

  const salarySort =
    query.sort === "salary_desc" ? "desc" : query.sort === "salary_asc" ? "asc" : null;
  const order = SORT_ORDERS[query.sort === "date" || query.sort === "popular" ? query.sort : "relevance"];

  const [rows, total] = await Promise.all([
    salarySort
      ? listBySalary(where, salarySort, skip, pageSize)
      : prisma.vacancy.findMany({
          where,
          select: VACANCY_CARD_SELECT,
          orderBy: order,
          skip,
          take: pageSize,
        }),
    listTotalCache(filterKey(query), () => prisma.vacancy.count({ where })),
  ]);

  return {
    items: rows.map(withPublicSalary),
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
    engine: "mongodb" as const,
  };
}

/**
 * Filtr paneli uchun sonlar ("Toshkent (38)"). Har bir o'lchov o'z filtrini
 * chetlab hisoblanadi: hudud tanlansa ham boshqa hududlar soni ko'rinib turadi
 * va ular qo'shilganda nima bo'lishi oldindan ma'lum bo'ladi. Matn filtri
 * MongoDB qidiruvi bilan bir xil.
 */
async function computeFacets(query: VacancyListQuery) {
  const text = query.text?.trim();
  const resolved = await resolveFilterIds(query, text);
  const where = (except?: FilterDimension): Prisma.VacancyWhereInput => {
    const filters = buildFilters(query, resolved, except);
    return text ? { AND: [filters, textFilter(text, resolved)] } : filters;
  };

  const [byRegion, byEmployment, remoteCount, byExperience, byCompany, byCategory, total] = await Promise.all([
    prisma.vacancy.groupBy({ by: ["regionId"], where: where("area"), _count: { _all: true } }),
    prisma.vacancy.groupBy({ by: ["employmentType"], where: where("employment"), _count: { _all: true } }),
    // "Masofaviy" soni filtr bilan bir xil: bandlik turi yoki ish joylashuvi masofaviy
    prisma.vacancy.count({ where: { AND: [where("employment"), employmentWhere(["remote"])] } }),
    prisma.vacancy.groupBy({ by: ["experienceRequired"], where: where("experience"), _count: { _all: true } }),
    prisma.vacancy.groupBy({ by: ["companyId"], where: where("company"), _count: { _all: true } }),
    prisma.vacancy.groupBy({ by: ["categoryId"], where: where("category"), _count: { _all: true } }),
    prisma.vacancy.count({ where: where() }),
  ]);

  const idsOf = (rows: { [key: string]: unknown }[], key: string) =>
    rows.map((r) => r[key]).filter((v): v is string => typeof v === "string");

  // Kompaniyalar o'lchovi javobda 100 tagacha ko'rsatiladi, lekin ilgari MOS KELGAN BARCHA
  // kompaniya hujjati o'qilib, keyin kesilardi (audit R3, db-perf-5). Endi avval soni bo'yicha
  // eng yuqori 200 tasi ajratiladi va faqat shular o'qiladi; yakuniy tartib (son, keyin nom)
  // o'zgarmaydi — faqat 100-o'rin atrofida soni TENG bo'lgan kompaniyalar orasidan qaysi biri
  // tushishi farq qilishi mumkin.
  const FACET_COMPANY_LOOKUP = 200;
  const topCompanies = [...byCompany]
    .sort((a: (typeof byCompany)[number], b: (typeof byCompany)[number]) => b._count._all - a._count._all)
    .slice(0, FACET_COMPANY_LOOKUP);

  const [regions, companies, categories] = await Promise.all([
    prisma.region.findMany({ where: { id: { in: idsOf(byRegion, "regionId") } }, select: { id: true, slug: true, name: true } }),
    prisma.company.findMany({
      where: { id: { in: idsOf(topCompanies, "companyId") } },
      select: { id: true, slug: true, name: true, isVerified: true },
    }),
    prisma.vacancyCategory.findMany({
      where: { id: { in: idsOf(byCategory, "categoryId") } },
      select: { id: true, slug: true, name: true },
    }),
  ]);

  const byCount = <T extends { count: number; name: string }>(a: T, b: T) => b.count - a.count || a.name.localeCompare(b.name);
  const regionById = new Map(regions.map((r: (typeof regions)[number]) => [r.id, r]));
  const companyById = new Map(companies.map((c: (typeof companies)[number]) => [c.id, c]));
  const categoryById = new Map(categories.map((c: (typeof categories)[number]) => [c.id, c]));

  return {
    total,
    regions: byRegion
      .flatMap((row: (typeof byRegion)[number]) => {
        const region = row.regionId ? regionById.get(row.regionId) : undefined;
        return region ? [{ slug: region.slug, name: region.name, count: row._count._all }] : [];
      })
      .sort(byCount),
    employment: EMPLOYMENT_VALUES.map((value) => ({
      value,
      count: value === "remote" ? remoteCount : byEmployment.find((r: (typeof byEmployment)[number]) => r.employmentType === value)?._count._all ?? 0,
    })),
    experience: EXPERIENCE_VALUES.map((value) => ({
      value,
      count: byExperience.find((r: (typeof byExperience)[number]) => r.experienceRequired === value)?._count._all ?? 0,
    })),
    companies: topCompanies
      .flatMap((row: (typeof byCompany)[number]) => {
        const company = companyById.get(row.companyId);
        return company
          ? [{ slug: company.slug, name: company.name, isVerified: company.isVerified, count: row._count._all }]
          : [];
      })
      .sort(byCount)
      .slice(0, 100),
    categories: byCategory
      .flatMap((row: (typeof byCategory)[number]) => {
        const category = row.categoryId ? categoryById.get(row.categoryId) : undefined;
        return category ? [{ slug: category.slug, name: category.name, count: row._count._all }] : [];
      })
      .sort(byCount),
  };
}

/**
 * Facets keshi (audit R3, db-perf-5 / scale-10k-4). Ilgari FAQAT filtrsiz so'rov keshlanardi:
 * foydalanuvchi har filtr yoki matnni o'zgartirganda 7 ta agregatsiya (biri butun faol to'plam
 * bo'yicha) bazaga tushardi. Endi filtrli so'rovlar ham kalit bo'yicha 60 s keshlanadi
 * (eng ko'pi 200 ta kalit, eng eskisi chiqariladi). Vakansiya yoki kompaniya yozilganda
 * (`bumpDataVersion`) kesh darhol yangilanadi — yangi e'lon jami songa shu zahoti qo'shiladi
 * (audit PHASE 6, U29). Cache-Control o'zgarmaydi.
 */
const facetsCache = keyedCache<Awaited<ReturnType<typeof computeFacets>>>(60_000, 200, ["vacancies", "companies"]);

export async function vacancyFacets(query: VacancyListQuery) {
  return facetsCache(filterKey(query), () => computeFacets(query));
}

