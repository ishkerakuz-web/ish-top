import { prisma } from "../../common/prisma.js";
import { AppError, Errors } from "../../common/errors.js";
import { bumpDataVersion } from "../../common/cache.js";
import { recordModeration } from "../../common/moderation-log.js";
import { notify } from "../notifications/notifications.service.js";
import { assertVacancyPlacement, effectiveWorkplaceType } from "../vacancies/vacancies.rules.js";
import { syncVacancyIndex } from "../vacancies/vacancies.service.js";

/**
 * Vakansiya va sharh moderatsiyasi — bitta qaror ham, ommaviy qaror ham shu yerdan o'tadi:
 * qoidalar, admin qulfi, qidiruv indeksi, egasiga bildirishnoma va moderatsiya jurnali bir xil.
 */

export type VacancyDecision = {
  status?: "active" | "rejected" | "archived";
  reason?: string;
  isPremium?: boolean;
};

export async function moderateVacancy(id: string, input: VacancyDecision, actorId: string) {
  const { status, reason, isPremium } = input;
  const vacancy = await prisma.vacancy.findUnique({
    where: { id },
    include: { company: { select: { ownerUserId: true, name: true, owner: { select: { isBlocked: true } } } } },
  });
  if (!vacancy) throw Errors.notFound();

  if (status === "active") {
    // Bloklangan hisobning e'loni saytga qaytmaydi (audit R3, data-integrity-3): avval blok olinadi
    if (vacancy.company.owner.isBlocked) {
      throw new AppError(409, "OWNER_BLOCKED", "E'lon egasi bloklangan — avval hisob blokini oching");
    }
    // Qoralama — ish beruvchining shaxsiy ishi: moderator uni chop eta olmaydi (audit R3, D-070, admin-staff-6)
    if (vacancy.status === "draft") {
      throw new AppError(409, "VACANCY_IS_DRAFT", "Qoralama e'lonni chop etib bo'lmaydi — uni faqat ish beruvchining o'zi joylashi mumkin");
    }
    // Tasdiqlashda ham kategoriya / ish joylashuvi / hudud qoidalari tekshiriladi
    await assertVacancyPlacement({
      categoryId: vacancy.categoryId,
      regionId: vacancy.regionId,
      workplaceType: effectiveWorkplaceType({}, vacancy),
    });
  }

  const now = new Date();
  const updated = await prisma.vacancy.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(status === "rejected" ? { rejectionReason: reason ?? null } : {}),
      ...(status === "active" ? { rejectionReason: null, publishedAt: vacancy.publishedAt ?? now } : {}),
      // Admin qulfi (audit R3, D-070): rad etilgan/arxivlangan e'lonni ish beruvchi qayta ocholmaydi
      ...(status === "rejected" || status === "archived" ? { adminArchivedAt: now } : {}),
      // Admin ko'rib chiqdi — qulf ham, "avto-tasdiqlangan" belgisi ham olinadi
      ...(status === "active" ? { adminArchivedAt: null, autoApprovedAt: null } : {}),
      ...(isPremium !== undefined ? { isPremium } : {}),
    },
  });

  void syncVacancyIndex(updated.id, updated.status);
  bumpDataVersion();

  const meta = { title: vacancy.title, company: vacancy.company.name, from: vacancy.status };
  if (status) {
    // Faol e'lonni yana "active" qilish — avto-tasdiqlangan e'lonni ko'rib chiqish
    const action = status === "active" ? (vacancy.status === "active" ? "reviewed" : "approved") : status;
    recordModeration({ entityType: "vacancy", entityId: id, action, actorId, reason, meta });
  }
  if (isPremium !== undefined && isPremium !== vacancy.isPremium) {
    recordModeration({ entityType: "vacancy", entityId: id, action: isPremium ? "premium_on" : "premium_off", actorId, meta });
  }

  const ownerId = vacancy.company.ownerUserId;
  if (status === "rejected") {
    void notify({
      userId: ownerId,
      type: "system",
      title: "Vakansiya rad etildi",
      body: `"${vacancy.title}" moderatsiyadan o'tmadi${reason ? `: ${reason}` : ""}`,
      url: "/employer/vacancies",
      i18n: { key: "vacancy.rejected", params: { vacancyTitle: vacancy.title, reason: reason ?? "" } },
    });
  }
  if (status === "archived" && vacancy.status !== "archived") {
    void notify({
      userId: ownerId,
      type: "system",
      title: "Vakansiya yopildi",
      body: `"${vacancy.title}" administrator tomonidan yopildi.`,
      url: "/employer/vacancies",
      i18n: { key: "vacancy.archivedByAdmin", params: { vacancyTitle: vacancy.title } },
    });
  }
  // Navbatdagi e'lon tasdiqlansa — ish beruvchi bilsin (ilgari jim edi)
  if (status === "active" && vacancy.status !== "active") {
    void notify({
      userId: ownerId,
      type: "system",
      title: "Vakansiya e'lon qilindi",
      body: `"${vacancy.title}" moderatsiyadan o'tdi va saytda ko'rinmoqda.`,
      url: "/employer/vacancies",
      i18n: { key: "vacancy.approved", params: { vacancyTitle: vacancy.title } },
    });
  }

  return updated;
}

export async function moderateReview(id: string, status: "pending" | "approved" | "rejected", actorId: string) {
  const before = await prisma.companyReview.findUnique({
    where: { id },
    select: { status: true, rating: true, autoApprovedAt: true, company: { select: { name: true } } },
  });
  if (!before) throw Errors.notFound();
  const review = await prisma.companyReview.update({
    where: { id },
    data: {
      status,
      // Admin qarori "avto-tasdiqlangan" belgisini oladi; navbatga qaytarilsa muddat qaytadan boshlanadi
      autoApprovedAt: null,
      ...(status === "pending" ? { submittedAt: new Date() } : {}),
    },
  });
  bumpDataVersion("reviews", "companies");
  const action = status === "approved" ? (before.status === "approved" ? "reviewed" : "approved") : status;
  recordModeration({
    entityType: "review",
    entityId: id,
    action,
    actorId,
    meta: { company: before.company.name, rating: before.rating, from: before.status },
  });
  return review;
}

export async function deleteReview(id: string, actorId: string) {
  const before = await prisma.companyReview.findUnique({
    where: { id },
    select: { rating: true, comment: true, company: { select: { name: true } } },
  });
  if (!before) throw Errors.notFound();
  await prisma.companyReview.delete({ where: { id } });
  bumpDataVersion("reviews", "companies");
  recordModeration({
    entityType: "review",
    entityId: id,
    action: "deleted",
    actorId,
    // O'chirilgan matn jurnalda qisqa holda qoladi — keyin "nima o'chirildi" savoliga javob
    meta: { company: before.company.name, rating: before.rating, comment: before.comment ?? "" },
  });
}

/** Ommaviy qaror: har bir yozuv alohida tekshiriladi, bittasining xatosi qolganini to'xtatmaydi. */
export async function bulkApply<T>(
  ids: string[],
  apply: (id: string) => Promise<T>
): Promise<{ done: number; failed: { id: string; code: string; message: string }[] }> {
  let done = 0;
  const failed: { id: string; code: string; message: string }[] = [];
  for (const id of ids) {
    try {
      await apply(id);
      done += 1;
    } catch (err) {
      const e = err as AppError & { code?: string };
      failed.push({ id, code: e.code ?? "FAILED", message: e.message });
    }
  }
  return { done, failed };
}
