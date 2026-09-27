import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { AppError } from "../../common/errors.js";
import { requireAuth } from "../../common/auth-guard.js";
import { maskPhone } from "../../common/phone.js";
import { recordSecurityEvent } from "../../common/security-events.js";
import { createChallenge } from "./challenges.js";
import { assertPhoneFlowQuota, assertTelegramAvailable, telegramUnavailable, verifyCurrentPassword } from "./reauth.js";
import { telegramDeepLink } from "../telegram/telegram.service.js";

/**
 * Telefon xavfsizligi: asosiy raqamni almashtirish va zaxira raqam (audit R3, D-047, D-048).
 *
 * Har uchala amal JORIY PAROL bilan tasdiqlanadi va Telegram orqali yakunlanadi — API
 * hech qachon raqamni parolsiz yoki tasdiqsiz o'zgartirmaydi. Marshrutlar `auth.routes.ts`
 * ichida ro'yxatdan o'tkaziladi.
 */

const passwordBody = z.object({ password: z.string().min(1).max(128) });
const phoneFlowLimit = { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } };

const NOT_VERIFIED = () =>
  new AppError(
    409,
    "PHONE_NOT_VERIFIED",
    "Avval Telegram orqali asosiy telefon raqamingizni tasdiqlang."
  );

export async function phoneRoutes(app: FastifyInstance) {
  /** Asosiy raqamni almashtirish: deep-link beriladi, raqam botda tasdiqlanadi (D-048). */
  app.post("/api/auth/phone/change", { preHandler: [requireAuth], ...phoneFlowLimit }, async (req) => {
    const userId = req.user!.sub;
    await assertPhoneFlowQuota(req.ip, userId);
    const { password } = passwordBody.parse(req.body);
    await verifyCurrentPassword(userId, password);
    assertTelegramAvailable();

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isPhoneVerified: true } });
    // Tasdiqlangan raqami yo'q foydalanuvchi oddiy bog'lash oqimidan boshlaydi
    if (!user?.isPhoneVerified) throw NOT_VERIFIED();

    const challenge = await createChallenge({ purpose: "phone_change", userId });
    const link = telegramDeepLink(challenge.token);
    if (!link) throw telegramUnavailable();
    return { link, expiresAt: challenge.expiresAt };
  });

  /** Zaxira raqam qo'shish: BOSHQA Telegram hisobidan tasdiqlanadi (D-047). */
  app.post("/api/auth/phone/backup", { preHandler: [requireAuth], ...phoneFlowLimit }, async (req) => {
    const userId = req.user!.sub;
    await assertPhoneFlowQuota(req.ip, userId);
    const { password } = passwordBody.parse(req.body);
    await verifyCurrentPassword(userId, password);
    assertTelegramAvailable();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPhoneVerified: true, telegramChatId: true },
    });
    if (!user?.isPhoneVerified || !user.telegramChatId) throw NOT_VERIFIED();

    const challenge = await createChallenge({ purpose: "backup_phone", userId });
    const link = telegramDeepLink(challenge.token);
    if (!link) throw telegramUnavailable();
    return { link, expiresAt: challenge.expiresAt };
  });

  /** Zaxira raqamni olib tashlash (D-047). */
  app.delete("/api/auth/phone/backup", { preHandler: [requireAuth], ...phoneFlowLimit }, async (req) => {
    const userId = req.user!.sub;
    await assertPhoneFlowQuota(req.ip, userId);
    const { password } = passwordBody.parse(req.body);
    await verifyCurrentPassword(userId, password);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { backupPhone: true } });
    await prisma.user.update({
      where: { id: userId },
      data: { backupPhone: null, backupPhoneVerifiedAt: null, backupTelegramId: null },
    });
    if (user?.backupPhone) {
      recordSecurityEvent({
        type: "backup_phone_removed",
        userId,
        actorId: userId,
        meta: { phone: maskPhone(user.backupPhone) ?? "" },
      });
    }
    return { ok: true };
  });
}
