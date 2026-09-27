import argon2 from "argon2";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { AppError, Errors } from "../../common/errors.js";
import { maskPhone, normalizePhone } from "../../common/phone.js";
import { assertQuota, HOUR_MS } from "../../common/quota.js";
import { recordSecurityEvent } from "../../common/security-events.js";
import { clearLoginFailures } from "../../common/login-guard.js";
import { sendTelegramMessage, telegramDeepLink } from "../telegram/telegram.service.js";
import { normalizeEmail, revokeUserSessions } from "./auth.service.js";
import { assertPasswordAcceptable, passwordField } from "./password.js";
import { assertTelegramAvailable, telegramUnavailable } from "./reauth.js";
import {
  cancelOpenChallenges,
  consumeResetToken,
  createChallenge,
  findValidResetChallenge,
  randomToken,
  sha256hex,
} from "./challenges.js";

/**
 * Parolni tiklash — FAQAT Telegram orqali (audit R3, D-045) va qo'lda tiklash (D-049).
 *
 * Muhim qoidalar:
 *  - `/recovery/start` to'g'ri formatdagi HAR QANDAY raqam uchun bir xil javob qaytaradi
 *    (hisob topilmasa "decoy" challenge) — raqam bo'yicha hisob bor-yo'qligi bilinmaydi;
 *  - reset havolasi faqat botdan, tasdiqlangan Telegram identity'ga boradi;
 *  - API parol, token yoki reset havolasini qaytarmaydi;
 *  - parol tiklangach barcha seanslar bekor bo'ladi (D-054).
 *
 * Marshrutlar `auth.routes.ts` ichida ro'yxatdan o'tkaziladi (server.ts boshqa guruh ixtiyorida).
 */

const startLimit = { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } };
const checkLimit = { config: { rateLimit: { max: 30, timeWindow: "15 minutes" } } };
const resetLimit = { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } };
const manualLimit = { config: { rateLimit: { max: 3, timeWindow: "1 hour" } } };
const manualReadLimit = { config: { rateLimit: { max: 20, timeWindow: "15 minutes" } } };

/** So'rov kodi va reset tokeni — base64url. Formati noto'g'ri bo'lsa bazaga so'rov ketmaydi. */
const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;
const tokenField = z.string().trim().min(8).max(64).regex(TOKEN_RE, "Kod formati noto'g'ri");

const RESET_INVALID = () =>
  new AppError(400, "RESET_TOKEN_INVALID", "Havola yaroqsiz yoki muddati tugagan. Tiklashni qaytadan boshlang.");

export async function recoveryRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------
  // Telefon orqali tiklash
  // ---------------------------------------------------------

  app.post("/api/auth/recovery/start", startLimit, async (req) => {
    const { phone } = z.object({ phone: z.string().trim().min(3).max(32) }).parse(req.body);
    const normalized = normalizePhone(phone);
    if (!normalized) throw Errors.badRequest("Telefon raqami noto'g'ri");
    // Rule K (D-051) AVVAL tekshiriladi: bot uzilganida foydalanuvchi soatlik kvotasini
    // 503 javoblarga sarflab, bot tiklangach bir soat kuta olmay qolmasin (audit R3 reviewer).
    assertTelegramAvailable();
    // Raqam bo'yicha kvota (D-052): bitta raqamga soatiga 5 ta so'rov
    await assertQuota(`recovery:phone:${normalized}`, 5, HOUR_MS);

    // Asosiy raqam (tasdiqlangan va Telegram bog'langan), keyin zaxira raqam
    const primary = await prisma.user.findFirst({
      where: { phone: normalized, isPhoneVerified: true, isBlocked: false, telegramChatId: { not: null } },
      select: { id: true },
    });
    const backup = primary
      ? null
      : await prisma.user.findFirst({
          where: { backupPhone: normalized, isBlocked: false, backupTelegramId: { not: null } },
          select: { id: true },
        });
    const userId = primary?.id ?? backup?.id ?? null;
    const phoneKind = backup ? "backup" : "primary";

    // Hisob topilmasa ham challenge yaratiladi: javob va havola bir xil ko'rinadi (D-045)
    const challenge = await createChallenge({ purpose: "password_recovery", userId, phoneKind });
    const link = telegramDeepLink(challenge.token);
    if (!link) throw telegramUnavailable();
    if (userId) {
      recordSecurityEvent({
        type: "recovery_started",
        userId,
        meta: { phone: maskPhone(normalized) ?? "", phoneKind },
      });
    }
    return { link, expiresAt: challenge.expiresAt };
  });

  /** Reset havolasi hali yaroqlimi (sahifa ochilganda tekshiriladi). */
  app.post("/api/auth/recovery/check", checkLimit, async (req) => {
    const { token } = z.object({ token: tokenField }).parse(req.body);
    return { valid: Boolean(await findValidResetChallenge(token)) };
  });

  /** Yangi parol. Token bir martalik; javobda token yoki seans YO'Q — foydalanuvchi qaytadan kiradi. */
  app.post("/api/auth/recovery/reset", resetLimit, async (req) => {
    const { token, password } = z.object({ token: tokenField, password: passwordField }).parse(req.body);

    // Avval tekshiramiz, keyin tokenni ISHLATAMIZ: zaif parol tufayli havola behuda yonib ketmasin
    const found = await findValidResetChallenge(token);
    if (!found?.userId) throw RESET_INVALID();
    const user = await prisma.user.findUnique({
      where: { id: found.userId },
      select: { id: true, email: true, isBlocked: true, telegramChatId: true },
    });
    if (!user || user.isBlocked) throw RESET_INVALID();
    assertPasswordAcceptable(password, user.email);

    // Bir martalik: bir vaqtda kelgan ikkita so'rovdan faqat bittasi o'tadi
    const challenge = await consumeResetToken(token);
    if (!challenge?.userId || challenge.userId !== user.id) throw RESET_INVALID();

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await argon2.hash(password), passwordChangedAt: new Date() },
    });
    // Barcha seanslar tugaydi va ochiq socketlar yopiladi (D-054)
    await revokeUserSessions(user.id);
    clearLoginFailures(user.email);
    // Shu foydalanuvchining boshqa ochiq tiklash oqimlari bekor qilinadi
    await cancelOpenChallenges(user.id, ["password_recovery", "manual_recovery"]);
    if (challenge.recoveryRequestId) {
      await prisma.recoveryRequest.updateMany({
        where: { id: challenge.recoveryRequestId, status: "approved" },
        data: { status: "completed", completedAt: new Date() },
      });
    }
    recordSecurityEvent({ type: "recovery_completed", userId: user.id, meta: { purpose: challenge.purpose } });
    recordSecurityEvent({ type: "sessions_invalidated", userId: user.id, meta: { reason: "recovery_completed" } });

    if (user.telegramChatId) {
      void sendTelegramMessage(
        user.telegramChatId,
        "🔐 <b>Parol o'zgartirildi</b>\n\nHisobingiz paroli hozirgina tiklandi va barcha qurilmalardagi seanslar tugatildi.\n\n" +
          "Agar bu siz bo'lmasangiz — darhol qo'llab-quvvatlash xizmatiga murojaat qiling."
      );
    }
    return { ok: true };
  });

  // ---------------------------------------------------------
  // Qo'lda tiklash (Telegram ham, telefon ham yo'q bo'lsa)
  // ---------------------------------------------------------

  app.post("/api/auth/recovery/manual", manualLimit, async (req) => {
    const body = z
      .object({
        email: z.string().trim().email().max(254),
        fullName: z.string().trim().min(2).max(80),
        details: z.string().trim().min(10).max(1000),
        contact: z.string().trim().max(160).optional(),
      })
      .parse(req.body);

    const email = normalizeEmail(body.email);
    await assertQuota(`recovery:manual:${email}`, 3, HOUR_MS);

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    // Kod bir marta ko'rsatiladi, bazada faqat sha256
    const code = randomToken(9);
    const request = await prisma.recoveryRequest.create({
      data: {
        ...(user ? { userId: user.id } : {}),
        email,
        fullName: body.fullName,
        details: body.details,
        ...(body.contact ? { contact: body.contact } : {}),
        codeHash: sha256hex(code),
      },
      select: { id: true },
    });
    if (user) {
      recordSecurityEvent({ type: "manual_recovery_requested", userId: user.id, meta: { requestId: request.id } });
    }
    // Javob email mavjudligidan qat'i nazar bir xil (D-049)
    return { requestCode: code };
  });

  app.post("/api/auth/recovery/manual/status", manualReadLimit, async (req) => {
    const { requestCode } = z.object({ requestCode: tokenField }).parse(req.body);
    const request = await prisma.recoveryRequest.findUnique({
      where: { codeHash: sha256hex(requestCode) },
      select: { status: true, continueExpiresAt: true },
    });
    // Faqat holat qaytadi: adminning ichki izohi so'rovchiga ko'rsatilmaydi
    if (!request) return { status: "not_found" as const };
    if (request.status === "approved" && (request.continueExpiresAt?.getTime() ?? 0) <= Date.now()) {
      return { status: "expired" as const };
    }
    return { status: request.status };
  });

  app.post("/api/auth/recovery/manual/continue", manualReadLimit, async (req) => {
    const { requestCode } = z.object({ requestCode: tokenField }).parse(req.body);
    const request = await prisma.recoveryRequest.findUnique({
      where: { codeHash: sha256hex(requestCode) },
      select: { id: true, userId: true, status: true, continueExpiresAt: true },
    });
    const usable =
      request &&
      request.userId &&
      request.status === "approved" &&
      (request.continueExpiresAt?.getTime() ?? 0) > Date.now();
    if (!usable || !request?.userId) {
      throw new AppError(
        409,
        "RECOVERY_NOT_APPROVED",
        "So'rov hali tasdiqlanmagan yoki muddati tugagan. Holatni tekshirib ko'ring."
      );
    }
    assertTelegramAvailable();

    const challenge = await createChallenge({
      purpose: "manual_recovery",
      userId: request.userId,
      recoveryRequestId: request.id,
    });
    const link = telegramDeepLink(challenge.token);
    if (!link) throw telegramUnavailable();
    return { link, expiresAt: challenge.expiresAt };
  });
}

