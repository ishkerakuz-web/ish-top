import { env } from "../../common/env.js";
import { prisma } from "../../common/prisma.js";
import { AppError } from "../../common/errors.js";

export const WORKPLACE_VALUES = ["office", "hybrid", "remote"] as const;
export type WorkplaceValue = (typeof WORKPLACE_VALUES)[number];

/** Zod xatosi bilan bir xil ko'rinish: `maydon: xabar` (frontend maydonni aniqlay oladi). */
const invalid = (field: string, message: string) => new AppError(400, "VALIDATION_ERROR", `${field}: ${message}`);

export interface VacancyPlacement {
  categoryId?: string | null;
  regionId?: string | null;
  workplaceType?: string | null;
}

/** Ish joylashuviga oid maydonlar — so'rov tanasidan yoki bazadagi yozuvdan. */
export interface WorkplaceFields {
  workplaceType?: string | null;
  employmentType?: string | null;
}

/**
 * Yakuniy ish joylashuvi: yuborilgan qiymat → bazadagi qiymat → eski e'londa (maydon yo'q) yakuniy bandlik
 * turi "remote" bo'lsa masofaviy. PUT va PATCH /status bir xil qoidani ishlatadi: ilgari PUT'da fallback
 * yo'q edi va eski masofaviy e'lonni qisman tahrirlash 400 `workplaceType` berardi (audit PHASE 6, U18).
 */
export function effectiveWorkplaceType(body: WorkplaceFields, stored: WorkplaceFields): string | null {
  const employmentType = body.employmentType ?? stored.employmentType ?? null;
  return body.workplaceType ?? stored.workplaceType ?? (employmentType === "remote" ? "remote" : null);
}

/**
 * Vakansiya joylashuvi qoidasi — yaratishda ham, tahrirlashda ham YAKUNIY qiymatlar bo'yicha:
 * - kategoriya majburiy;
 * - ish joylashuvi (ofisda / gibrid / masofaviy) majburiy;
 * - hudud majburiy, masofaviy ishda — ixtiyoriy.
 * Kategoriya va hudud bazada borligi ham tekshiriladi (mavjud bo'lmagan ID saqlanmasin).
 */
export async function assertVacancyPlacement(p: VacancyPlacement): Promise<void> {
  if (!p.categoryId) throw invalid("categoryId", "Kategoriyani tanlang");
  if (!p.workplaceType) throw invalid("workplaceType", "Ish joylashuvini tanlang");
  if (p.workplaceType !== "remote" && !p.regionId) throw invalid("regionId", "Hududni tanlang");

  const [category, region] = await Promise.all([
    prisma.vacancyCategory.findUnique({ where: { id: p.categoryId }, select: { id: true } }),
    p.regionId ? prisma.region.findUnique({ where: { id: p.regionId }, select: { id: true } }) : Promise.resolve(null),
  ]);
  if (!category) throw invalid("categoryId", "Kategoriya topilmadi");
  if (p.regionId && !region) throw invalid("regionId", "Hudud topilmadi");
}

/**
 * Yangi e'lon avval moderatsiyaga tushadimi (VACANCY_PREMODERATION). Sukut — faqat tasdiqlanmagan
 * kompaniyalar: tasdiqlangan ish beruvchi darhol e'lon qiladi, yangi/noma'lum kompaniya e'loni
 * admin ko'rgunicha (yoki 24 soatlik avto-tasdiqgacha) saytga chiqmaydi.
 */
export function requiresPremoderation(company: { isVerified: boolean }): boolean {
  if (env.VACANCY_PREMODERATION === "off") return false;
  if (env.VACANCY_PREMODERATION === "all") return true;
  return !company.isVerified;
}

export type PlacementIssue = "categoryId" | "workplaceType" | "regionId";

/** Joylashuv qoidasidan o'tmasa — qaysi maydon yetishmaydi (admin navbatida sabab sifatida). */
export async function placementIssue(p: VacancyPlacement): Promise<PlacementIssue | null> {
  try {
    await assertVacancyPlacement(p);
    return null;
  } catch (err) {
    const field = /^(\w+):/.exec((err as Error).message)?.[1];
    return field === "categoryId" || field === "workplaceType" || field === "regionId" ? field : "categoryId";
  }
}
