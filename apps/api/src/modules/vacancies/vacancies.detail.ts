import { prisma } from "../../common/prisma.js";
import { Errors } from "../../common/errors.js";
import { bumpDataVersion, keyedCache } from "../../common/cache.js";
import {
  VACANCY_CARD_SELECT,
  VACANCY_DETAIL_SELECT,
  withPublicSalary,
} from "./vacancies.select.js";


/** Bitta vakansiya sahifasi, kompaniya reytingi va o'xshash e'lonlar. */

/**
 * Kompaniyaning tasdiqlangan sharhlari bo'yicha reyting va son — bazada agregatsiya.
 * Shakl va yumaloqlash ochiq kompaniya sahifasidagi `reviewSummary` bilan bir xil
 * (companies.routes.ts).
 */
async function companyReviewSummary(companyId: string): Promise<{ rating: number | null; count: number }> {
  const summary = await prisma.companyReview.aggregate({
    where: { companyId, status: "approved" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return {
    rating: summary._avg.rating === null ? null : Math.round(summary._avg.rating * 10) / 10,
    count: summary._count._all,
  };
}

/**
 * Vakansiya sahifasi keshi (audit: perf-detail-1).
 *
 * Bu — saytdagi eng ko'p ochiladigan sahifa. Har ochilishda ikkita so'rov ketardi:
 * e'lonning o'zi va kompaniya sharhlari agregatsiyasi. Javob foydalanuvchiga BOG'LIQ
 * EMAS (shaxsiy ma'lumot yo'q), shuning uchun uni qisqa muddatga keshlash mumkin:
 * mashhur e'londa yuzlab ochilish bitta o'qishga aylanadi.
 *
 * Kesh e'lon, kompaniya yoki sharh o'zgarganda darhol eskiradi (`bumpDataVersion`),
 * shuning uchun tahrir sahifada kechikmaydi. Ko'rishlar soni esa buferdan yozilgani
 * uchun baribir kechikadi (VIEW_FLUSH_MS) — kesh buni sezilarli o'zgartirmaydi.
 */
const detailCache = keyedCache<Awaited<ReturnType<typeof loadVacancyDetail>>>(30_000, 500, [
  "vacancies",
  "companies",
  "reviews",
]);

export async function getVacancyBySlug(slug: string) {
  return detailCache(slug, () => loadVacancyDetail(slug));
}

async function loadVacancyDetail(slug: string) {
  const vacancy = await prisma.vacancy.findUnique({
    where: { slug },
    select: VACANCY_DETAIL_SELECT,
  });
  if (!vacancy || vacancy.status !== "active") throw Errors.notFound("Vakansiya topilmadi");

  // Ko'rishlar hisoblagichi BU YERDA oshmaydi (audit: views-1). Ilgari har bir so'rov bazaga
  // alohida `$inc` yozardi: bitta odam sahifani qayta ochsa ham, bot kirsa ham sanalardi va
  // javob keshlab bo'lmaydigan yon ta'sirga ega edi. Endi ko'rishni brauzer alohida yuboradi
  // (`POST /api/vacancies/:slug/view` → `common/views.ts`), takrori filtrlanadi va bufer orqali
  // yoziladi. Shu sababli bu yo'l endi TOZA o'qish.

  // Ilgari har ochilishda kompaniyaning BARCHA tasdiqlangan sharhlari o'qilardi (cheklanmagan) — endi faqat
  // agregatsiya; javobda `company.reviews` o'rniga `company.reviewSummary` (audit PHASE 6, U17)
  const reviewSummary = await companyReviewSummary(vacancy.companyId);

  return withPublicSalary({ ...vacancy, company: { ...vacancy.company, reviewSummary } });
}

/**
 * O'xshash e'lonlar keshi (audit R3, scale-10k-11): vakansiya sahifasining har SSR'ida
 * so'raladi. Kalit — slug va so'ralgan son; vakansiya yozilganda (`bumpDataVersion`) kesh
 * darhol yangilanadi, ya'ni yopilgan e'lon ro'yxatda qolib ketmaydi.
 *
 * Bo'limlar `vacancies` VA `companies`: kartada kompaniya nomi, logotipi va tasdiq
 * belgisi bor (`VACANCY_CARD_SELECT`), shuning uchun kompaniya tahriri ham keshni
 * yangilashi kerak — chaqiruvchilar bo'limli `bumpDataVersion` ga o'tganda ham
 * eski nom 5 daqiqa qolib ketmasin (audit R3, db-perf-6).
 */
const similarCache = keyedCache<Awaited<ReturnType<typeof loadSimilarVacancies>>>(5 * 60_000, 200, [
  "vacancies",
  "companies",
]);

/**
 * "O'xshash vakansiyalar": shu sohadagi faol e'lonlar — hududi va tajribasi
 * mos kelganlari oldinda. Soha bo'lmasa yoki kam bo'lsa, shu kompaniyaning
 * boshqa vakansiyalari bilan to'ldiriladi. Vakansiyaning o'zi chiqmaydi.
 * Mos e'lon bo'lmasa bo'sh ro'yxat — sahifa blokni yashiradi.
 */
export async function similarVacancies(slug: string, limit = 4) {
  const take = Math.min(Math.max(Math.trunc(limit) || 4, 1), 10);
  return similarCache(`${slug}:${take}`, () => loadSimilarVacancies(slug, take));
}

/**
 * Soha bo'yicha nomzod to'plami: `@@index([categoryId, status, publishedAt, id])` saralashni
 * ham qamrab oladi, shuning uchun 40 ta hujjat o'qiladi — ilgari sohadagi barcha e'lonlar
 * xotirada saralanardi (audit R3, scale-10k-11).
 */
async function loadSimilarVacancies(slug: string, take: number) {
  const base = await prisma.vacancy.findUnique({
    where: { slug },
    select: { id: true, status: true, categoryId: true, regionId: true, companyId: true, experienceRequired: true },
  });
  if (!base || base.status !== "active") throw Errors.notFound("Vakansiya topilmadi");

  const pool = base.categoryId
    ? await prisma.vacancy.findMany({
        where: { status: "active", id: { not: base.id }, categoryId: base.categoryId },
        select: VACANCY_CARD_SELECT,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        take: 40,
      })
    : [];
  const score = (v: (typeof pool)[number]) =>
    (v.regionId === base.regionId ? 2 : 0) + (v.experienceRequired === base.experienceRequired ? 1 : 0);
  // Barqaror saralash: ball teng bo'lsa — yangiroq e'lon oldinda (pool tartibi)
  let items = pool
    .map((v, i) => ({ v, s: score(v), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, take)
    .map((x) => x.v);

  if (items.length < take) {
    const more = await prisma.vacancy.findMany({
      where: { status: "active", id: { notIn: [base.id, ...items.map((v) => v.id)] }, companyId: base.companyId },
      select: VACANCY_CARD_SELECT,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: take - items.length,
    });
    items = [...items, ...more];
  }
  return { items: items.map(withPublicSalary) };
}
