import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { requireAuth } from "../../common/auth-guard.js";
import { AppError } from "../../common/errors.js";
import { recordSecurityEvent } from "../../common/security-events.js";
import { cancelOpenChallenges, createChallenge } from "../auth/challenges.js";
import { assertPhoneFlowQuota, assertTelegramAvailable, telegramUnavailable, verifyCurrentPassword } from "../auth/reauth.js";
import { getBotUsername, isTelegramAvailable, telegramDeepLink } from "./telegram.service.js";

// Saytdagi aloqa formasi (`POST /api/support`) — modules/support/support.routes.ts

/** Telefon oqimlari uchun IP limiti (foydalanuvchi bo'yicha kvota `assertPhoneFlowQuota` da). */
const phoneFlowLimit = { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } };

export async function telegramRoutes(app: FastifyInstance) {
  // Bog'lanish holati (har qanday rol uchun)
  app.get("/api/telegram/status", { preHandler: [requireAuth] }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { telegramChatId: true, isPhoneVerified: true, phone: true, backupPhone: true },
    });
    return {
      linked: Boolean(user?.telegramChatId),
      phoneVerified: Boolean(user?.isPhoneVerified),
      phone: user?.phone ?? null,
      backupPhone: user?.backupPhone ?? null,
      // Rule K: bot ishlamayotgan bo'lsa UI tasdiqlash tugmalarini o'chiradi (D-051)
      available: isTelegramAvailable(),
      botUsername: getBotUsername(),
    };
  });

  /**
   * Deep-link: Telegramga o'tib telefonni tasdiqlash va hisobni bog'lash (D-042, D-044).
   * Tasdiqlangan raqam allaqachon bor va identity ham bog'langan bo'lsa — raqamni
   * o'zgartirish uchun alohida oqim kerak (409 `USE_PHONE_CHANGE`).
   */
  app.post("/api/telegram/link", { preHandler: [requireAuth], ...phoneFlowLimit }, async (req) => {
    const userId = req.user!.sub;
    await assertPhoneFlowQuota(req.ip, userId);
    assertTelegramAvailable();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPhoneVerified: true, telegramChatId: true },
    });
    if (user?.isPhoneVerified && user.telegramChatId) {
      throw new AppError(
        409,
        "USE_PHONE_CHANGE",
        "Telefon raqamingiz allaqachon tasdiqlangan. Raqamni o'zgartirish uchun «Telefon raqamni o'zgartirish» oqimidan foydalaning."
      );
    }

    const challenge = await createChallenge({ purpose: "telegram_link", userId });
    const link = telegramDeepLink(challenge.token);
    if (!link) throw telegramUnavailable();
    return { link, expiresAt: challenge.expiresAt };
  });

  /** Bog'lanishni uzish — joriy parol bilan tasdiqlanadi (D-047). */
  app.delete("/api/telegram/link", { preHandler: [requireAuth], ...phoneFlowLimit }, async (req) => {
    const userId = req.user!.sub;
    await assertPhoneFlowQuota(req.ip, userId);
    const { password } = z.object({ password: z.string().min(1).max(128) }).parse(req.body);
    await verifyCurrentPassword(userId, password);

    await prisma.user.update({ where: { id: userId }, data: { telegramChatId: null } });
    // Eski identity'ga berilgan reset tokeni va ochiq challenge'lar ham bekor (audit R3, backend-1)
    await cancelOpenChallenges(userId);
    recordSecurityEvent({ type: "telegram_unlinked", userId, actorId: userId });
    return { ok: true };
  });
}
