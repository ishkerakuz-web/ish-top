import crypto from "node:crypto";
import type { AuthChallenge, AuthChallengePurpose } from "@prisma/client";
import { prisma } from "../../common/prisma.js";

/**
 * Telegram deep-link challenge'lari (audit R3, D-042).
 *
 * Ilgari bog'lash tokenlari XOTIRADAGI Map'da, ochiq matnda va maqsadga bog'lanmagan holda
 * saqlanardi (telegram-12, headers-infra-8): restartda yo'qolardi, bir nusxadan boshqasiga
 * o'tmasdi va anonim so'rov bilan cheksiz o'stirish mumkin edi. Endi har bir oqim uchun
 * bitta umumiy `AuthChallenge` yozuvi bor:
 *   payload  — 24 bayt tasodifiy (base64url, 32 belgi), bazada FAQAT sha256;
 *   muddati  — 15 daqiqa, bir martalik, maqsadga (purpose) bog'langan;
 *   holatlar — pending -> awaiting_contact | verified -> completed | cancelled.
 *
 * Xom token hech qachon bazaga, logga yoki javobga (havoladan boshqa) tushmaydi.
 */
export const CHALLENGE_TTL_MS = 15 * 60 * 1000;
export const RESET_TTL_MS = 15 * 60 * 1000;

/** Telegram `?start=` parametri: 64 belgigacha, faqat [A-Za-z0-9_-]. Bazaga so'rovdan OLDIN tekshiriladi. */
export const PAYLOAD_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function sha256hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** base64url tasodifiy token (24 bayt -> 32 belgi, 32 bayt -> 43 belgi). */
export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export interface CreateChallengeInput {
  purpose: AuthChallengePurpose;
  /** null — "decoy": raqam bo'yicha hisob topilmadi (javob bir xil bo'lishi uchun, D-045). */
  userId?: string | null;
  phoneKind?: "primary" | "backup";
  recoveryRequestId?: string | null;
}

export interface CreatedChallenge {
  /** Xom payload — faqat havolaga qo'yiladi va darhol unutiladi. */
  token: string;
  expiresAt: Date;
  id: string;
}

export async function createChallenge(input: CreateChallengeInput): Promise<CreatedChallenge> {
  const token = randomToken(24);
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  const created = await prisma.authChallenge.create({
    data: {
      purpose: input.purpose,
      tokenHash: sha256hex(token),
      expiresAt,
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.phoneKind ? { phoneKind: input.phoneKind } : {}),
      ...(input.recoveryRequestId ? { recoveryRequestId: input.recoveryRequestId } : {}),
    },
    select: { id: true },
  });
  return { token, expiresAt, id: created.id };
}

/** Payload bo'yicha OCHIQ (pending, muddati o'tmagan) challenge. Formati noto'g'ri bo'lsa bazaga bormaydi. */
export async function findOpenChallenge(payload: string): Promise<AuthChallenge | null> {
  if (!PAYLOAD_RE.test(payload)) return null;
  const challenge = await prisma.authChallenge.findUnique({ where: { tokenHash: sha256hex(payload) } });
  if (!challenge) return null;
  if (challenge.status !== "pending") return null;
  if (challenge.expiresAt.getTime() <= Date.now()) return null;
  return challenge;
}

/** Kontakt kutilayotgan holatga o'tkazadi (identity tekshiruvidan keyin). */
export async function markAwaitingContact(id: string, telegramUserId: string): Promise<boolean> {
  const res = await prisma.authChallenge.updateMany({
    where: { id, status: "pending", expiresAt: { gt: new Date() } },
    data: { status: "awaiting_contact", telegramUserId },
  });
  return res.count === 1;
}

/** Shu Telegram identity uchun eng oxirgi, muddati o'tmagan kontakt kutayotgan challenge. */
export async function latestAwaitingContact(telegramUserId: string): Promise<AuthChallenge | null> {
  return prisma.authChallenge.findFirst({
    where: { telegramUserId, status: "awaiting_contact", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

/** Challenge'ni yakunlaydi. `false` — allaqachon ishlatilgan (poyga). */
export async function completeChallenge(id: string, fromStatus: "awaiting_contact" | "pending" | "verified"): Promise<boolean> {
  const res = await prisma.authChallenge.updateMany({
    where: { id, status: fromStatus },
    data: { status: "completed", completedAt: new Date() },
  });
  return res.count === 1;
}

/** Foydalanuvchining ochiq challenge'larini bekor qiladi (parol tiklangach — D-045). */
export async function cancelOpenChallenges(userId: string, purposes?: AuthChallengePurpose[]): Promise<void> {
  await prisma.authChallenge.updateMany({
    where: {
      userId,
      status: { in: ["pending", "awaiting_contact", "verified"] },
      ...(purposes ? { purpose: { in: purposes } } : {}),
    },
    data: { status: "cancelled" },
  });
}

/**
 * Bot identity'ni tasdiqlagach — sayt uchun bir martalik reset tokeni.
 * Token 32 bayt, bazada sha256, 15 daqiqa amal qiladi.
 */
export async function issueResetToken(challengeId: string): Promise<{ token: string; expiresAt: Date } | null> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  const res = await prisma.authChallenge.updateMany({
    where: { id: challengeId, status: { in: ["pending", "awaiting_contact"] } },
    data: { status: "verified", resetTokenHash: sha256hex(token), resetExpiresAt: expiresAt },
  });
  if (res.count !== 1) return null;
  return { token, expiresAt };
}

/** Reset tokeni hali yaroqlimi (parolni o'zgartirmasdan tekshirish — `/api/auth/recovery/check`). */
export async function findValidResetChallenge(token: string): Promise<AuthChallenge | null> {
  if (!PAYLOAD_RE.test(token)) return null;
  return prisma.authChallenge.findFirst({
    where: { resetTokenHash: sha256hex(token), resetExpiresAt: { gt: new Date() }, status: "verified" },
  });
}

/**
 * Reset tokenini BIR MARTA ishlatadi: `updateMany` shartli yozuv bo'lgani uchun
 * bir vaqtda kelgan ikkita so'rovdan faqat bittasi muvaffaqiyatli bo'ladi.
 */
export async function consumeResetToken(token: string): Promise<AuthChallenge | null> {
  const challenge = await findValidResetChallenge(token);
  if (!challenge) return null;
  const res = await prisma.authChallenge.updateMany({
    where: { id: challenge.id, status: "verified", resetTokenHash: sha256hex(token) },
    data: { status: "completed", completedAt: new Date(), resetTokenHash: null, resetExpiresAt: null },
  });
  if (res.count !== 1) return null;
  return challenge;
}

/**
 * Telefon yagonaligi (audit R3, D-043): tasdiqlangan asosiy raqam yoki zaxira raqam
 * boshqa hisobda bo'lsa — o'sha hisob qaytariladi. Eski dublikatlar o'zgartirilmaydi.
 */
export async function phoneOwner(phone: string, exceptUserId?: string | null) {
  return prisma.user.findFirst({
    where: {
      ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
      OR: [{ phone, isPhoneVerified: true }, { backupPhone: phone }],
    },
    select: { id: true },
  });
}

/** Telegram identity yagonaligi: bitta identity faqat bitta hisobda (asosiy yoki zaxira). */
export async function telegramOwner(telegramUserId: string, exceptUserId?: string | null) {
  return prisma.user.findFirst({
    where: {
      ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
      OR: [{ telegramChatId: telegramUserId }, { backupTelegramId: telegramUserId }],
    },
    select: { id: true },
  });
}
