import { z } from "zod";

/**
 * MongoDB ObjectId — 24 ta o'n oltilik belgi.
 *
 * Ilgari bu maydonlar `z.string().uuid()` bilan tekshirilardi (PostgreSQL
 * davridan qolgan). MongoDB'da ID formati boshqa, shuning uchun eski tekshiruv
 * har qanday to'g'ri ID'ni ham rad etardi.
 */
export const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export const objectId = () => z.string().regex(OBJECT_ID_RE, "ID formati noto'g'ri");

export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID_RE.test(value);
}

/** `:id` route parametri — noto'g'ri format Prisma'ga yetmasdan 400 bo'ladi. */
export const idParams = z.object({ id: objectId() });

/**
 * Sayt ichidagi nisbiy yo'l ("/..."). "//host" va "/\host" ham "/" bilan
 * boshlanadi, lekin brauzer ularni boshqa saytga ochadi — `null`.
 *
 * Audit PHASE 6, U13: brauzer URL ichidagi TAB/qator ko'chirish belgilarini olib tashlaydi —
 * "/" + TAB + "/evil.example" amalda "//evil.example" bo'lib ochilardi. Shuning uchun boshqaruv
 * belgisi (kod < 32 yoki 127) yoki teskari chiziq (92) bor qiymat butunlay rad etiladi. Bo'shliq mumkin.
 */
export function safeInternalPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  for (let i = 0; i < url.length; i++) {
    const code = url.charCodeAt(i);
    if (code < 32 || code === 127 || code === 92) return null;
  }
  if (!url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) return null;
  return url.slice(0, 500);
}

const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const FALSE_VALUES = new Set(["false", "0", "no", "off", ""]);

/**
 * Satr ko'rinishidagi mantiqiy qiymat (URL query, `.env`).
 *
 * `z.coerce.boolean()` ISHLATMANG: u oddiy `Boolean(value)` chaqiradi, ya'ni
 * `"false"` satri bo'sh emasligi uchun `true` ga aylanadi. Shu sabab
 * `SMTP_SECURE=false` aslida TLS'ni YOQIB yuborardi va 587-portdagi pochta
 * jimgina yuborilmay qolardi; `?unreadOnly=false` ham teskari ishlardi.
 */
export const boolish = () =>
  z
    .union([z.boolean(), z.string(), z.number()])
    .transform((v, ctx) => {
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v !== 0;
      const s = v.trim().toLowerCase();
      if (TRUE_VALUES.has(s)) return true;
      if (FALSE_VALUES.has(s)) return false;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "true yoki false bo'lishi kerak",
      });
      return z.NEVER;
    });
