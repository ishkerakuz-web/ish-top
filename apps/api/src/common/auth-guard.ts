import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@prisma/client";
import { Errors, AppError } from "./errors.js";
import { prisma } from "./prisma.js";
import { cacheAuthUser, getCachedAuthUser, type AuthUser } from "./auth-cache.js";
import { verifyAccessToken, type AccessTokenPayload } from "./jwt.js";
import { isTelegramAvailable } from "../modules/telegram/telegram.service.js";

/** requireAuth bazadan o'qiydigan foydalanuvchi holati — `auth-cache.ts` da (audit PHASE 6, V5). */
export type { AuthUser } from "./auth-cache.js";
export { invalidateAuthUser } from "./auth-cache.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: AccessTokenPayload;
    /** requireAuth o'qigan qator — requirePhoneVerified va requireStaff bazaga qayta murojaat qilmaydi. */
    authUser?: AuthUser;
  }
}

const AUTH_USER_SELECT = { role: true, isBlocked: true, tokenVersion: true, isPhoneVerified: true } as const;

async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const cached = getCachedAuthUser(userId);
  if (cached) return cached;

  // O'qish BOSHLANGAN payt keshga beriladi: shu paytdan keyin holat o'zgargan bo'lsa
  // (bloklash, telefon tasdig'i), eskirgan qiymat keshga tushmaydi — `auth-cache.ts`
  const readStartedAt = Date.now();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: AUTH_USER_SELECT });
  // Mavjud bo'lmagan foydalanuvchi KESHLANMAYDI — keshni "yo'q" qiymat bilan to'ldirib bo'lmasin
  if (!user) return null;
  cacheAuthUser(userId, user, readStartedAt);
  return user;
}

function blockedError() {
  return new AppError(403, "USER_BLOCKED", "Hisobingiz vaqtincha bloklangan. Qo'llab-quvvatlash xizmatiga murojaat qiling.");
}

/**
 * Access token imzosi tekshiriladi, so'ng foydalanuvchi BAZADAN o'qiladi (audit PHASE 6, V5): token'dagi
 * rolga ishonilmaydi. Roli olingan admin, bloklangan hisob va bekor qilingan seans (logout, blok, rol
 * o'zgarishi — tokenVersion oshgan) 15 daqiqalik access token tugashini kutmasdan to'xtatiladi.
 * Narxi: har bir autentifikatsiyalangan so'rovda `_id` bo'yicha bitta indeksli findUnique.
 */
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) throw Errors.unauthorized();

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw Errors.unauthorized("Token yaroqsiz yoki muddati tugagan");
  }

  const user = await loadAuthUser(payload.sub);
  if (!user) throw Errors.unauthorized();
  if (user.isBlocked) throw blockedError();
  // Seans versiyasi MAJBURIY (audit R3, auth-core-12): `v` siz token — bu fix'dan oldin berilgan,
  // muddati (15 daqiqa) allaqachon tugagan token; uni bekor qilib bo'lmagani uchun endi qabul qilinmaydi.
  if (payload.v === undefined || payload.v !== (user.tokenVersion ?? 0)) throw Errors.unauthorized("Seans tugagan");

  req.authUser = user;
  req.user = { ...payload, role: user.role };
}

/** Rol token'dagi emas, requireAuth bazadan olgan qiymat bo'yicha tekshiriladi (audit PHASE 6, V5). */
export function requireRole(...roles: AccessTokenPayload["role"][]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!req.user) throw Errors.unauthorized();
    if (!roles.includes(req.user.role)) throw Errors.forbidden();
  };
}

/**
 * Admin paneli (maqolalar, jamoa) uchun: token'dagi emas, BAZADAGI joriy rol va
 * blok holati tekshiriladi. Jamoa a'zosi faolsizlantirilsa yoki roli
 * o'zgartirilsa, 15 daqiqalik access token tugashini kutmasdan darhol kuchga
 * kiradi. `req.user.role` ham bazadagi qiymatga yangilanadi.
 */
export function requireStaff(...roles: AccessTokenPayload["role"][]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!req.user) throw Errors.unauthorized();
    // requireAuth o'qigan qator qayta ishlatiladi; u yo'q bo'lsa bazadan o'qiladi (audit PHASE 6, V5)
    const user = req.authUser ?? (await loadAuthUser(req.user.sub));
    if (!user || user.isBlocked || !roles.includes(user.role)) throw Errors.forbidden();
    req.user = { ...req.user, role: user.role };
  };
}

/**
 * Kalit amallar (ariza, vakansiya, xabar) uchun — telefon Telegram orqali
 * tasdiqlangan bo'lishi shart. Bu soxta arizalar va spamning oldini oladi.
 */
export async function requirePhoneVerified(req: FastifyRequest, _reply: FastifyReply) {
  if (!req.user) throw Errors.unauthorized();
  // requireAuth o'qigan qator qayta ishlatiladi; u yo'q bo'lsa bazadan o'qiladi (audit PHASE 6, V5)
  const user = req.authUser ?? (await loadAuthUser(req.user.sub));
  if (!user) throw Errors.unauthorized();
  // Bloklangan hisob access token muddati tugaguncha ham kalit amallarni bajara olmasin (audit ISSUE-035)
  if (user.isBlocked) throw blockedError();
  if (!user.isPhoneVerified) {
    // Rule K (audit R3, D-051/D-072; telegram-8, candidate-flows-10): telefon tasdig'i Telegram'ga
    // bog'liq. Bot ishlamayotgan bo'lsa (token yo'q, polling uzilgan) foydalanuvchi "tasdiqlang"
    // degan bajarib bo'lmaydigan ko'rsatmaga emas, ANIQ vaqtinchalik holatga duch keladi.
    if (!isTelegramAvailable()) {
      throw new AppError(
        503,
        "TELEGRAM_UNAVAILABLE",
        "Telegram orqali tasdiqlash hozircha mavjud emas. Keyinroq qayta urinib ko'ring."
      );
    }
    throw new AppError(
      403,
      "PHONE_NOT_VERIFIED",
      "Bu amalni bajarish uchun avval Telegram orqali telefon raqamingizni tasdiqlang. Bu soxta arizalar va spamning oldini olish uchun kerak."
    );
  }
}
