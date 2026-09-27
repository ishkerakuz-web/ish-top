import argon2 from "argon2";
import { prisma } from "./prisma.js";
import { env } from "./env.js";

/**
 * Birinchi admin hisobini yaratadi.
 *
 * `.env` da ADMIN_EMAIL va ADMIN_PASSWORD berilgan bo'lsa:
 *  - shunday email bilan foydalanuvchi BO'LMASA — admin sifatida yaratiladi;
 *  - mavjud bo'lsa — HECH NARSA o'zgartirilmaydi (rol ham, parol ham).
 *
 * Mavjud hisobni admin roliga ko'tarish OLIB TASHLANDI (audit R3, D-069;
 * auth-core-5, headers-infra-3, admin-staff-3): aks holda ADMIN_EMAIL bilan
 * ro'yxatdan o'tgan istalgan odam keyingi restartda admin bo'lardi. Rol faqat
 * admin panelidan (PATCH /api/admin/users/:id/role) beriladi; startupda
 * ogohlantirish yoziladi.
 *
 * Paroli hech qachon qayta yozilmaydi (server har ko'tarilganda parolni
 * tiklab yuborishi xavfsiz emas).
 */
export async function ensureAdminUser(log?: {
  info: (o: unknown, m?: string) => void;
  warn: (o: unknown, m?: string) => void;
}): Promise<void> {
  const email = env.ADMIN_EMAIL.trim().toLowerCase();
  if (!email) return;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing) {
    if (existing.role !== "admin") {
      // Ogohlantirish: promote QILINMAYDI (D-069). Operator rolni admin panelidan beradi.
      log?.warn(
        { email, role: existing.role },
        "ADMIN_EMAIL bilan hisob bor, lekin roli admin emas — avtomatik ko'tarilmadi (D-069). Rolni admin panelidan bering."
      );
    }
    return;
  }

  if (env.ADMIN_PASSWORD.length < 8) {
    log?.warn(
      { email },
      "ADMIN_EMAIL berilgan, lekin ADMIN_PASSWORD yo'q yoki 8 belgidan qisqa — admin yaratilmadi"
    );
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(env.ADMIN_PASSWORD),
      role: "admin",
      isEmailVerified: true,
    },
  });
  log?.info({ email }, "Admin hisobi yaratildi");
}
