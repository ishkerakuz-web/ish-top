import { PrismaClient } from "@prisma/client";
import { invalidateAuthUser, invalidateAllAuthUsers } from "./auth-cache.js";

/**
 * Prisma klienti + foydalanuvchi holati keshini AVTOMATIK bekor qilish (audit: perf-auth-1).
 *
 * `auth-cache.ts` har so'rovdagi `user` o'qishini keshlaydi (rol, blok, seans versiyasi,
 * telefon tasdig'i). Keshni qo'lda bekor qilish xavfli edi: har bir yangi joyni eslab
 * qolish kerak bo'lardi va bitta unutilgan joy "bloklangan hisob hali ham ishlayapti"
 * yoki "blokdan chiqarilgan hisob hali ham yopiq" degan jim xatoga olib kelardi —
 * aynan shunday xato `auth-telegram-check` da chiqdi (blokdan chiqarish 10 soniya
 * kuchga kirmasdi, chunki blokni OLIB TASHLASH `revokeUserSessions` dan o'tmaydi).
 *
 * Endi qoida bitta joyda: `user` jadvaliga har qanday yozuv keshni tozalaydi.
 * Foydalanuvchi yozuvlari kam (admin amallari, profil), o'qishlar esa juda ko'p —
 * shuning uchun bu narx sezilmaydi.
 */

/** `where` dan aniq ID chiqsa — faqat shu foydalanuvchi, aks holda butun kesh. */
function invalidateFrom(where: unknown): void {
  const id = (where as { id?: unknown } | undefined)?.id;
  if (typeof id === "string") invalidateAuthUser(id);
  else invalidateAllAuthUsers();
}

const base = new PrismaClient();

export const prisma = base.$extends({
  query: {
    user: {
      async update({ args, query }) {
        const result = await query(args);
        invalidateFrom(args.where);
        return result;
      },
      async updateMany({ args, query }) {
        const result = await query(args);
        invalidateFrom(args.where);
        return result;
      },
      async upsert({ args, query }) {
        const result = await query(args);
        invalidateFrom(args.where);
        return result;
      },
      async delete({ args, query }) {
        const result = await query(args);
        invalidateFrom(args.where);
        return result;
      },
      async deleteMany({ args, query }) {
        const result = await query(args);
        invalidateAllAuthUsers();
        return result;
      },
    },
  },
});
