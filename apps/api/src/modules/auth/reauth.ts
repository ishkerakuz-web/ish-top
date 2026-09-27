import argon2 from "argon2";
import { prisma } from "../../common/prisma.js";
import { AppError, Errors } from "../../common/errors.js";
import { assertQuota, QUARTER_HOUR_MS } from "../../common/quota.js";
import { isTelegramAvailable } from "../telegram/telegram.service.js";

/**
 * Xavfsizlikka ta'sir qiladigan amallar uchun umumiy yordamchilar (audit R3, D-047, D-048, D-051).
 *
 * Telefonni almashtirish, zaxira raqam qo'shish/olib tashlash va Telegram bog'lanishini uzish
 * JORIY PAROL bilan tasdiqlanadi: o'g'irlangan seans tiklash kanalini o'zgartira olmasin.
 */

/** Rule K matni — UI uch tilda shu kod bo'yicha xabar ko'rsatadi. */
export const TELEGRAM_UNAVAILABLE_MESSAGE =
  "Telegram orqali tasdiqlash hozircha mavjud emas. Keyinroq qayta urinib ko'ring.";

export function telegramUnavailable(): AppError {
  return new AppError(503, "TELEGRAM_UNAVAILABLE", TELEGRAM_UNAVAILABLE_MESSAGE);
}

/** Telegram oqimini boshlaydigan endpointlar shu tekshiruvdan o'tadi (D-051). */
export function assertTelegramAvailable(): void {
  if (!isTelegramAvailable()) throw telegramUnavailable();
}

/**
 * Joriy parolni tekshiradi. Noto'g'ri bo'lsa 401 `INVALID_PASSWORD` — parolning o'zi
 * yoki hash hech qayerga yozilmaydi.
 */
export async function verifyCurrentPassword(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw Errors.unauthorized();
  let valid = false;
  try {
    valid = await argon2.verify(user.passwordHash, password);
  } catch {
    valid = false;
  }
  if (!valid) throw new AppError(401, "INVALID_PASSWORD", "Parol noto'g'ri");
}

/**
 * Telefon oqimlari uchun kvota (D-052): IP bo'yicha 15 daqiqada 10 ta va foydalanuvchi
 * bo'yicha 15 daqiqada 5 ta urinish. Parol urinishlari ham shu yerda sanaladi — brute-force
 * uchun endpoint qulay maydon bo'lib qolmasin.
 */
export async function assertPhoneFlowQuota(ip: string, userId: string): Promise<void> {
  await assertQuota(`phoneflow:ip:${ip}`, 10, QUARTER_HOUR_MS);
  await assertQuota(`phoneflow:user:${userId}`, 5, QUARTER_HOUR_MS);
}
