import type { Prisma } from "@prisma/client";
import { prisma } from "../../common/prisma.js";
import { env } from "../../common/env.js";
import { acquireLock } from "../../common/redis.js";
import { bumpDataVersion } from "../../common/cache.js";
import { recordModeration, recordModerationMany } from "../../common/moderation-log.js";
import { notify } from "../notifications/notifications.service.js";
import { assertVacancyPlacement, effectiveWorkplaceType } from "../vacancies/vacancies.rules.js";
import { syncVacancyIndex } from "../vacancies/vacancies.service.js";

/**
 * Moderatsiya navbatining avto-tasdig'i.
 *
 * Admin `MODERATION_AUTO_APPROVE_HOURS` (sukut 24) ichida qaror qilmasa, navbatdagi vakansiya va
 * sharhlar avtomatik tasdiqlanadi — ish beruvchi e'loni cheksiz osilib qolmaydi. Admin keyin ham
 * uni rad etishi yoki yopishi mumkin: avto-tasdiqlanganlar `autoApprovedAt` bilan belgilanadi.
 *
 * Admin qo'lda tasdiqlashdagi himoyalar saqlanadi: egasi bloklangan yoki kategoriya/hudud qoidasidan
 * o'tmaydigan e'lon avtomatik faollashmaydi — navbatda admin uchun qoladi.
 */

const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const BATCH = 200;
const HOUR_MS = 60 * 60 * 1000;

export function autoApproveHours(): number {
  return env.MODERATION_AUTO_APPROVE_HOURS;
}

/** Navbatga tushgan vaqt bo'yicha avto-tasdiq muddati (o'chiq bo'lsa null). */
export function autoApproveAt(submittedAt: Date | null | undefined): Date | null {
  const hours = autoApproveHours();
  if (!hours || !submittedAt) return null;
  return new Date(submittedAt.getTime() + hours * HOUR_MS);
}

/**
 * Muddati o'tganlar. Eski hujjatlarda navbatga tushish vaqti yo'q (maydon keyin qo'shilgan) —
 * ular uchun zaxira vaqt (`updatedAt` / `createdAt`) olinadi.
 */
function dueVacancies(cutoff: Date): Prisma.VacancyWhereInput {
  return {
    status: "moderation",
    OR: [
      { moderationSubmittedAt: { lte: cutoff } },
      { moderationSubmittedAt: { isSet: false }, updatedAt: { lte: cutoff } },
      { moderationSubmittedAt: null, updatedAt: { lte: cutoff } },
    ],
  };
}

function dueReviews(cutoff: Date): Prisma.CompanyReviewWhereInput {
  return {
    status: "pending",
    OR: [
      { submittedAt: { lte: cutoff } },
      { submittedAt: { isSet: false }, createdAt: { lte: cutoff } },
      { submittedAt: null, createdAt: { lte: cutoff } },
    ],
  };
}

async function approveDueVacancies(cutoff: Date, log?: SweepLog): Promise<{ approved: number; skipped: number }> {
  let approved = 0;
  let skipped = 0;
  // Keyset sahifalash: o'tkazib yuborilgan (qoidadan o'tmagan) e'lonlar keyingi bo'lakda qayta olinmaydi
  let lastId: string | undefined;
  for (;;) {
    const where = dueVacancies(cutoff);
    const rows = await prisma.vacancy.findMany({
      where: lastId ? { AND: [where, { id: { gt: lastId } }] } : where,
      orderBy: { id: "asc" },
      take: BATCH,
      select: {
        id: true,
        title: true,
        categoryId: true,
        regionId: true,
        workplaceType: true,
        employmentType: true,
        publishedAt: true,
        moderationNudgedAt: true,
        company: { select: { ownerUserId: true, name: true, owner: { select: { isBlocked: true } } } },
      },
    });
    if (rows.length === 0) break;

    for (const v of rows) {
      if (v.company.owner.isBlocked) {
        skipped += 1;
        continue;
      }
      try {
        await assertVacancyPlacement({
          categoryId: v.categoryId,
          regionId: v.regionId,
          workplaceType: effectiveWorkplaceType({}, v),
        });
      } catch (err) {
        // To'ldirilmagan e'lon ochiq ro'yxatga tushmasin — admin qaror qiladi. Ish beruvchiga
        // nima yetishmayotgani BIR MARTA aytiladi: tahrirlasa e'lon qoidadan o'tadi.
        skipped += 1;
        if (!v.moderationNudgedAt) {
          const claimedNudge = await prisma.vacancy.updateMany({
            where: { id: v.id, status: "moderation", OR: [{ moderationNudgedAt: null }, { moderationNudgedAt: { isSet: false } }] },
            data: { moderationNudgedAt: new Date() },
          });
          if (claimedNudge.count === 1) {
            void notify({
              userId: v.company.ownerUserId,
              type: "system",
              title: "Vakansiyani to'ldiring",
              body: `"${v.title}" e'lon qilinishi uchun kategoriya, ish joylashuvi va hududni to'ldiring.`,
              url: "/employer/vacancies",
              i18n: { key: "vacancy.incomplete", params: { vacancyTitle: v.title } },
            });
            recordModeration({
              entityType: "vacancy",
              entityId: v.id,
              action: "auto_skipped",
              reason: (err as Error).message,
              meta: { title: v.title, company: v.company.name },
            });
          }
        }
        continue;
      }

      const now = new Date();
      // Shartli yangilash: admin shu orada qaror qilgan bo'lsa (holat o'zgargan) — tegmaymiz
      const claimed = await prisma.vacancy.updateMany({
        where: { id: v.id, status: "moderation" },
        data: {
          status: "active",
          rejectionReason: null,
          adminArchivedAt: null,
          publishedAt: v.publishedAt ?? now,
          autoApprovedAt: now,
        },
      });
      if (claimed.count !== 1) continue;
      approved += 1;
      recordModeration({
        entityType: "vacancy",
        entityId: v.id,
        action: "auto_approved",
        meta: { title: v.title, company: v.company.name },
      });
      void syncVacancyIndex(v.id, "active");
      void notify({
        userId: v.company.ownerUserId,
        type: "system",
        title: "Vakansiya e'lon qilindi",
        body: `"${v.title}" moderatsiyadan o'tdi va saytda ko'rinmoqda.`,
        url: "/employer/vacancies",
        i18n: { key: "vacancy.approved", params: { vacancyTitle: v.title } },
      });
    }

    lastId = rows[rows.length - 1].id;
    if (rows.length < BATCH) break;
  }
  if (skipped > 0) log?.warn({ skipped }, "Avto-tasdiq: ayrim vakansiyalar qoidadan o'tmadi — admin ko'rib chiqsin");
  return { approved, skipped };
}

async function approveDueReviews(cutoff: Date): Promise<number> {
  // Muallifi bloklangan sharh ochiq sahifaga chiqmaydi — admin qaror qiladi
  const where: Prisma.CompanyReviewWhereInput = { AND: [dueReviews(cutoff), { user: { isBlocked: false } }] };
  const due = await prisma.companyReview.findMany({
    where,
    select: { id: true, rating: true, company: { select: { name: true } } },
    take: 1000,
  });
  if (due.length === 0) return 0;
  const result = await prisma.companyReview.updateMany({
    where: { id: { in: due.map((r) => r.id) }, status: "pending" },
    data: { status: "approved", autoApprovedAt: new Date() },
  });
  await recordModerationMany(
    due.map((r) => ({
      entityType: "review" as const,
      entityId: r.id,
      action: "auto_approved",
      meta: { company: r.company.name, rating: r.rating },
    }))
  );
  return result.count;
}

type SweepLog = { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void };

export interface AutoApproveResult {
  enabled: boolean;
  vacancies: number;
  vacanciesSkipped: number;
  reviews: number;
}

/** Muddati o'tgan moderatsiya navbatini bir marta tasdiqlaydi. */
export async function runAutoApproveSweep(log?: SweepLog): Promise<AutoApproveResult> {
  const hours = autoApproveHours();
  if (!hours) return { enabled: false, vacancies: 0, vacanciesSkipped: 0, reviews: 0 };
  const cutoff = new Date(Date.now() - hours * HOUR_MS);

  const { approved, skipped } = await approveDueVacancies(cutoff, log);
  const reviews = await approveDueReviews(cutoff);

  if (approved > 0) bumpDataVersion("vacancies");
  if (reviews > 0) bumpDataVersion("reviews");
  return { enabled: true, vacancies: approved, vacanciesSkipped: skipped, reviews };
}

let timer: NodeJS.Timeout | null = null;

/** Davriy tekshiruvni yoqadi (server ko'tarilganda chaqiriladi). */
export function startAutoApproveScheduler(log?: SweepLog): void {
  if (timer || !autoApproveHours()) return;

  const tick = async () => {
    try {
      // Bir nechta nusxada faqat bittasi bajaradi: bildirishnoma ikki marta ketmasin
      const mine = await acquireLock("moderation:auto-approve", SWEEP_INTERVAL_MS - 5_000, "deny");
      if (!mine) return;
      const result = await runAutoApproveSweep(log);
      if (result.vacancies > 0 || result.reviews > 0) {
        log?.info(result, "Moderatsiya navbati avtomatik tasdiqlandi");
      }
    } catch (e) {
      console.warn("[moderation] avto-tasdiq xatosi:", (e as Error).message);
    }
  };

  setTimeout(tick, 90_000).unref?.();
  timer = setInterval(tick, SWEEP_INTERVAL_MS);
  timer.unref?.();
}

export function stopAutoApproveScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
