import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { requireAuth, requireStaff } from "../../common/auth-guard.js";
import { bumpDataVersion } from "../../common/cache.js";
import { ownedCompanyIds } from "../../common/ownership.js";
import { apostropheVariants } from "../../common/search-text.js";
import { syncVacancyIndex } from "../vacancies/vacancies.service.js";

/**
 * Admin bo'limlari uchun UMUMIY qism: rol qo'riqchilari, sahifalash, qidiruv matnini
 * tozalash va og'ir sanoqlar.
 *
 * Ilgari bularning bir qismi `admin.routes.ts` va `admin.moderation.routes.ts` da
 * IKKI marta yozilgan edi (`adminOnly`, `moderatorOnly`). Endi bitta manba.
 */

/**
 * Admin paneli: moderatsiya, foydalanuvchi boshqaruvi, statistika, to'lovlar.
 *
 * Rol va blok holati TOKENDAN emas, har so'rovda BAZADAN tekshiriladi (audit ISSUE-035):
 * roli olingan yoki bloklangan admin 15 daqiqalik access token tugashini kutmasdan kirolmaydi.
 */
export const adminOnly = { preHandler: [requireAuth, requireStaff("admin")] };
/** Moderatsiya bo'limlari: vakansiya, sharh, kompaniya tasdig'i — admin va moderator. */
export const moderatorOnly = { preHandler: [requireAuth, requireStaff("admin", "moderator")] };

export const pageSchema = z.object({
  text: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export function paging(query: z.infer<typeof pageSchema>) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export const like = (v: string) => ({ contains: v, mode: "insensitive" as const });

/**
 * Prisma `contains` MongoDB'da regexga aylanadi — admin qidiruvidagi maxsus belgilar
 * (`.*`, `(`, `|`) zararsizlantiriladi va matn qisqartiriladi (audit R3, admin-staff-11).
 */
export function searchText(value: string | undefined): string {
  return (value ?? "").replace(/[\\^$.*+?()[\]{}|]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * O'zbekcha tutuq belgisi variantlari (audit R3, D-080): `Qo'chqorov` va `Qo’chqorov`
 * bir xil topilsin. Prisma `contains` ga regex berib bo'lmaydi, shuning uchun har variant
 * alohida OR sharti bo'ladi (tutuq belgisi bo'lmasa — bitta shart).
 */
export function textVariants(value: string): string[] {
  return value ? apostropheVariants(value) : [];
}

/**
 * Relation filter ($lookup) o'rniga oldindan yechilgan id ro'yxati (audit R3, admin-staff-11,
 * employer-flows-12, scale-10k-12). Ro'yxat chegaralangan: juda keng qidiruv butun
 * kolleksiyani `$in` ga solib qo'ymaydi.
 */
export const RELATION_MATCH_LIMIT = 1000;

/** Ariza sonlari: har qator uchun `_count` ($lookup) emas, sahifa id'lari bo'yicha bitta guruhlash. */
export async function applicationCounts(vacancyIds: string[]): Promise<Map<string, number>> {
  if (vacancyIds.length === 0) return new Map();
  const groups = await prisma.application.groupBy({
    by: ["vacancyId"],
    where: { vacancyId: { in: vacancyIds } },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.vacancyId, g._count._all]));
}

/** Vakansiyalar bo'yicha ochiq (ko'rib chiqilmagan) shikoyatlar soni. */
export async function openReportCounts(vacancyIds: string[]): Promise<Map<string, number>> {
  if (vacancyIds.length === 0) return new Map();
  const groups = await prisma.supportTicket.groupBy({
    by: ["vacancyId"],
    where: { vacancyId: { in: vacancyIds }, kind: "vacancy_report", status: { in: ["open", "in_progress"] } },
    _count: { _all: true },
  });
  return new Map(groups.filter((g) => g.vacancyId).map((g) => [g.vacancyId as string, g._count._all]));
}

/**
 * Bloklash yoki rol o'zgarishi natijasida ish beruvchining faol e'lonlari yopiladi va
 * `adminArchivedAt` bilan QULFLANADI (audit R3, D-070/D-077): egasi ularni qayta ocholmaydi.
 */
export async function archiveOwnerVacancies(userId: string, reason: string, log?: { warn: (o: unknown, m?: string) => void }): Promise<number> {
  const companyIds = await ownedCompanyIds(userId);
  if (companyIds.length === 0) return 0;
  const where: Prisma.VacancyWhereInput = { companyId: { in: companyIds }, status: "active" };
  const vacancies = await prisma.vacancy.findMany({ where, select: { id: true } });
  if (vacancies.length === 0) return 0;
  await prisma.vacancy.updateMany({ where, data: { status: "archived", adminArchivedAt: new Date() } });
  for (const v of vacancies) void syncVacancyIndex(v.id, "archived");
  bumpDataVersion();
  log?.warn({ userId, reason, count: vacancies.length }, "Ish beruvchining faol vakansiyalari arxivlandi");
  return vacancies.length;
}

/**
 * Toshkent kalendar kunlari bo'yicha sanash — bazaning o'zida (`$group`). Ilgari 14 kunlik barcha
 * yozuvlar xotiraga yuklanib sanalardi: foydalanuvchi va arizalar ko'payganda panel sekinlashardi.
 */
export async function countByDay(collection: "users" | "applications", since: Date): Promise<Map<string, number>> {
  const raw = (await prisma.$runCommandRaw({
    aggregate: collection,
    pipeline: [
      { $match: { created_at: { $gte: { $date: since.toISOString() } } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: "+05:00" } }, n: { $sum: 1 } } },
    ],
    cursor: {},
  })) as { cursor?: { firstBatch?: { _id: string; n: number }[] } };
  return new Map((raw.cursor?.firstBatch ?? []).map((row) => [row._id, row.n]));
}

/**
 * Ommaviy xabar bir vaqtda faqat bittadan yuboriladi. Bir nechta API nusxasida jarayon ichidagi bayroq
 * yetmaydi — Redis qulfi ham olinadi (Redis sozlanmagan bo'lsa bitta nusxa, bayroq yetarli).
 */
export const BROADCAST_LOCK = "admin:broadcast";
export const BROADCAST_LOCK_TTL_MS = 6 * 60 * 60 * 1000;
export const BROADCAST_BATCH = 500;
/**
 * Foydalanuvchilar orasidagi eng kam oraliq — soniyasiga ko'pi bilan ~25 ta (Telegram bot limiti ~30/s).
 * Ilgari tashqi kanallar kutilmay, minglab so'rov bir zumda ketardi va 429 javoblari yo'qolardi (audit PHASE 6, V9).
 */
export const BROADCAST_MIN_GAP_MS = 40;
/** Tasdiqlangan tiklash so'rovi shuncha vaqt davomida davom ettiriladi (audit R3, D-049). */
export const RECOVERY_CONTINUE_TTL_MS = 72 * 60 * 60 * 1000;
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

