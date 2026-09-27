import type { Prisma, SecurityEventType } from "@prisma/client";
import { prisma } from "./prisma.js";

/**
 * Xavfsizlik jurnali (audit R3, D-050; telegram-7, auth-core-7, admin-staff-1, authz-idor-9).
 *
 * Telefon, Telegram, tiklash va admin amallari (bloklash, rol) shu yerda qayd etiladi.
 * Jurnalga FAQAT maxfiy bo'lmagan ma'lumot tushadi: niqoblangan telefon, maqsad, so'rov ID,
 * sabab. Parol, parol hash'i, access/refresh token, bot tokeni, challenge/reset/so'rov kodlari
 * va shaxsiy xabar matnlari hech qachon yozilmaydi — quyidagi filtr ularni tashlab yuboradi.
 *
 * Yozuv xatosi ASOSIY amalni to'xtatmaydi: hodisa fonda yoziladi, xato faqat logga tushadi.
 */

/** Nomi sirga o'xshaydigan maydonlar jurnalga tushmaydi (ehtiyot chorasi). */
const SECRET_KEY_RE = /(token|secret|password|hash|code|credential|challenge|cookie|authorization)/i;
const MAX_VALUE_LENGTH = 200;
const MAX_KEYS = 12;

export type SecurityEventMeta = Record<string, unknown>;

/** Faqat qisqa, maxfiy bo'lmagan skalyar qiymatlarni qoldiradi. */
function sanitizeMeta(meta: SecurityEventMeta | undefined): Prisma.InputJsonValue | undefined {
  if (!meta) return undefined;
  const out: Record<string, string | number | boolean> = {};
  let count = 0;
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null) continue;
    if (SECRET_KEY_RE.test(key)) continue;
    if (count >= MAX_KEYS) break;
    if (typeof value === "string") out[key] = value.slice(0, MAX_VALUE_LENGTH);
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    else continue;
    count += 1;
  }
  return Object.keys(out).length ? (out as Prisma.InputJsonValue) : undefined;
}

export interface SecurityEventInput {
  type: SecurityEventType;
  /** Hodisa tegishli bo'lgan hisob (bo'lmasligi mumkin: noma'lum email bilan qo'lda tiklash so'rovi). */
  userId?: string | null;
  /** Amalni bajargan hisob (admin) — foydalanuvchining o'zi bo'lsa `userId` bilan bir xil. */
  actorId?: string | null;
  meta?: SecurityEventMeta;
}

/** Hodisani yozadi; xato bo'lsa `false` qaytaradi (chaqiruvchini to'xtatmaydi). */
export async function writeSecurityEvent(input: SecurityEventInput): Promise<boolean> {
  try {
    const meta = sanitizeMeta(input.meta);
    await prisma.securityEvent.create({
      data: {
        type: input.type,
        ...(input.userId ? { userId: input.userId } : {}),
        ...(input.actorId ? { actorId: input.actorId } : {}),
        ...(meta !== undefined ? { meta } : {}),
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * "Yoz va unut": asosiy oqim kutmaydi. Xato yutilmaydi — `console.warn` ga tushadi
 * (Fastify logger bu yordamchiga uzatilmaydi, chunki u bot siklidan ham chaqiriladi).
 */
export function recordSecurityEvent(input: SecurityEventInput): void {
  void writeSecurityEvent(input).then((ok) => {
    if (!ok) console.warn(`Xavfsizlik hodisasini yozib bo'lmadi: ${input.type}`);
  });
}
