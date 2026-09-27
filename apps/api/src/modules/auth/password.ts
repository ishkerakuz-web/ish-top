import { z } from "zod";
import { AppError } from "../../common/errors.js";

/**
 * Parol siyosati (audit R3, auth-core-15).
 *
 * Uzunlik chegarasi o'zgarmaydi (8–128; mavjud hisoblar va e2e testlar bilan mos), lekin
 * eng keng tarqalgan parollar va emailning o'zidan yasalgan parol rad etiladi. Ro'yxat
 * ataylab qisqa va kodda: yangi bog'liqlik qo'shilmaydi. Parol matni hech qayerga
 * (log, javob, xavfsizlik jurnali) yozilmaydi.
 */
const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "password123",
  "qwerty123",
  "qwertyuiop",
  "1q2w3e4r",
  "iloveyou",
  "admin123",
  "administrator",
  "welcome1",
  "welcome123",
  "letmein1",
  "passw0rd",
  "p@ssw0rd",
  "abc12345",
  "11111111",
  "00000000",
  "parol123",
  "parol1234",
  "parolim123",
  "uzbekistan",
  "toshkent123",
]);

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Ro'yxatdan o'tish, taklifni qabul qilish va parolni tiklash uchun umumiy maydon. */
export const passwordField = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

/**
 * Juda oson topiladigan parolni rad etadi. `email` berilsa, parol email yoki uning
 * lokal qismiga teng bo'lishi ham taqiqlanadi.
 */
export function assertPasswordAcceptable(password: string, email?: string): void {
  const normalized = password.trim().toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) {
    throw new AppError(
      400,
      "WEAK_PASSWORD",
      "Bu parol juda oson topiladi. Boshqa, kamida 8 belgili parol tanlang."
    );
  }
  if (email) {
    const lower = email.trim().toLowerCase();
    const local = lower.split("@")[0] ?? "";
    if (normalized === lower || (local.length >= 4 && normalized === local)) {
      throw new AppError(400, "WEAK_PASSWORD", "Parol email manzilingizdan farq qilishi kerak.");
    }
  }
}
