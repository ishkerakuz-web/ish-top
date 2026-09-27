import { prisma } from "../../common/prisma.js";
import { uniqueSlug } from "../../common/slug.js";
import { bumpDataVersion } from "../../common/cache.js";
import { indexVacancy, removeVacancyFromIndex } from "../search/search.service.js";


/** Vakansiya yaratish va qidiruv indeksini yangilash. */

interface CreateVacancyInput {
  companyId: string;
  title: string;
  description: string;
  requirements?: string;
  conditions?: string;
  categoryId?: string;
  /** Masofaviy ishda bo'sh bo'lishi mumkin. */
  regionId?: string | null;
  workplaceType?: string;
  employmentType: string;
  scheduleType?: string | null;
  experienceRequired?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  isSalaryHidden?: boolean;
  applyWithoutResume?: boolean;
  /**
   * "draft" — qoralama: e'lon qilinmaydi, qidiruv indeksiga tushmaydi. "moderation" — oldindan
   * moderatsiya (admin yoki 24 soatlik avto-tasdiq kutiladi). Standart — darhol faol.
   */
  status?: "active" | "draft" | "moderation";
  contactEmail?: string;
  contactTelegram?: string;
  contactPhone?: string;
}

export async function createVacancy(input: CreateVacancyInput) {
  const status = input.status ?? "active";
  const vacancy = await prisma.vacancy.create({
    data: {
      companyId: input.companyId,
      title: input.title,
      slug: uniqueSlug(input.title, "vakansiya"),
      description: input.description,
      requirements: input.requirements,
      conditions: input.conditions,
      categoryId: input.categoryId,
      regionId: input.regionId ?? undefined,
      workplaceType: input.workplaceType as never,
      employmentType: input.employmentType as never,
      scheduleType: (input.scheduleType ?? undefined) as never,
      experienceRequired: (input.experienceRequired as never) ?? "none",
      // Aniq `null` yoziladi (maydon tushib qolmaydi) — maosh bo'yicha saralash va filtr bir xil ko'radi
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      isSalaryHidden: input.isSalaryHidden ?? false,
      applyWithoutResume: input.applyWithoutResume ?? false,
      contactEmail: input.contactEmail || null,
      contactTelegram: input.contactTelegram || null,
      contactPhone: input.contactPhone || null,
      status,
      publishedAt: status === "active" ? new Date() : null,
      ...(status === "moderation" ? { moderationSubmittedAt: new Date() } : {}),
    },
  });

  // Qidiruv indeksi va obuna signallari — faqat e'lon qilinganda, javobni kutdirmasdan fonda
  if (status === "active") {
    void indexVacancy(vacancy.id);
    // Faqat vakansiya keshlari (audit R3, db-perf-6 / scale-10k-5): sharh va kompaniya
    // keshlari o'z bo'limlariga tegishli
    bumpDataVersion("vacancies");
  }
  return vacancy;
}

/** Holat o'zgarganda indeksni sinxron ushlab turadi. */
export async function syncVacancyIndex(vacancyId: string, status: string): Promise<void> {
  if (status === "active") await indexVacancy(vacancyId);
  else await removeVacancyFromIndex(vacancyId);
}
