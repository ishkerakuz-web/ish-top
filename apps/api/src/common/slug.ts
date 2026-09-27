import crypto from "node:crypto";

/**
 * URL uchun slug yasash.
 *
 * Avval bo'sh `slug: ""` bilan yozuv yaratilib, keyin ID asosida yangilanardi.
 * MongoDB'da `slug` ustidagi unique indeks bu holatda ikkita bir vaqtda
 * yaratilgan yozuvni rad etadi (ikkalasida ham `""`). Endi slug yozuvdan
 * OLDIN tayyorlanadi — bitta yozish, poyga holati yo'q.
 *
 * Lotin bo'lmagan harflar transliteratsiya qilinadi, aks holda o'zbekcha yoki
 * ruscha sarlavhadan bo'sh satr chiqib, hamma slug bir xil bo'lib qolardi.
 */

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh",
  щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
  ў: "o", қ: "q", ғ: "g", ҳ: "h",
  ä: "a", ö: "o", ü: "u", ç: "c", ş: "s", ğ: "g", ı: "i", ñ: "n",
};

/** "Frontend dasturchi (Toshkent)" -> "frontend-dasturchi-toshkent" */
export function slugifyText(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’`ʻʼ]/g, "")
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Yagona slug: matndan olingan asos + tasodifiy qo'shimcha.
 * Asos bo'sh chiqsa (masalan sarlavha faqat belgilardan iborat) `fallback`
 * ishlatiladi, natija hech qachon bo'sh bo'lmaydi.
 */
export function uniqueSlug(input: string, fallback = "item"): string {
  const base = slugifyText(input).slice(0, 60).replace(/-+$/, "");
  const suffix = crypto.randomBytes(4).toString("hex");
  return `${base || fallback}-${suffix}`;
}
