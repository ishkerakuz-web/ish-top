/**
 * Qidiruv matnini tayyorlash — vakansiya, kompaniya va nomzod qidiruvi uchun
 * umumiy yordamchilar (audit R3, D-080 / gap1-1, gap1-6).
 *
 * Bu yerdagi funksiyalar toza: baza, Prisma va Fastify bilan ishlamaydi,
 * shuning uchun uch qidiruv yo'lida ham bir xil natija beradi.
 *
 * Tutuq belgisi. Bitta o'zbekcha so'z yetti xil belgi bilan yozilishi mumkin
 * (ASCII ', U+0060, U+00B4, U+02BB, U+02BC, U+2018, U+2019): rasmiy lotin
 * yozuvida U+02BB, iOS "smart punctuation" da U+2019, klaviaturada ASCII.
 * Saqlangan ma'lumot o'zgartirilmaydi (backfill yo'q, demo ma'lumot tegilmaydi)
 * — o'rniga so'rov tomonida muqobillar tayyorlanadi: regex uchun belgilar
 * sinfi (`tokenRegexSource`), Prisma `contains` uchun esa so'z variantlari
 * ro'yxati (`apostropheVariants`), chunki Prisma MongoDB'da `contains`
 * qiymatini o'zi ekranlaydi va unga regex kiritib bo'lmaydi.
 *
 * Belgilar kod raqami orqali quriladi — fayl kodirovkasi buzilsa ham qoida
 * o'zgarmaydi.
 */

/** ' ` ´ va turlangan tutuq belgilari (U+02BB, U+02BC, U+2018, U+2019). */
const APOSTROPHE_CODES = [0x27, 0x60, 0xb4, 0x02bb, 0x02bc, 0x2018, 0x2019] as const;

export const APOSTROPHE_CHARS: readonly string[] = APOSTROPHE_CODES.map((code) => String.fromCharCode(code));

const APOSTROPHE_SET = new Set(APOSTROPHE_CHARS);

/** Kanonik (ASCII) tutuq belgisi. */
const CANONICAL_APOSTROPHE = APOSTROPHE_CHARS[0];

/** Regex metabelgilarini ekranlaydi (`$regex` satri va `new RegExp` uchun bir xil). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Regex ichidagi belgilar sinfi: bitta tutuq belgisining istalgan variantiga mos keladi. */
export const APOSTROPHE_CLASS = `[${APOSTROPHE_CHARS.map((ch) =>
  ch === "]" || ch === "^" || ch === "-" || ch === "\\" ? `\\${ch}` : ch
).join("")}]`;

/** Barcha tutuq variantlari bitta ASCII belgiga keltiriladi (xotiradagi solishtirish uchun). */
export function normalizeApostrophes(value: string): string {
  let out = "";
  for (const ch of value) out += APOSTROPHE_SET.has(ch) ? CANONICAL_APOSTROPHE : ch;
  return out;
}

/** Solishtirish kaliti: kichik harf + bitta tutuq belgisi (xotiradagi `includes` uchun). */
export function searchKey(value: string): string {
  return normalizeApostrophes(value).toLowerCase();
}

/**
 * Regex manbasi: so'z ekranlanadi, tutuq belgisi esa har qanday variantga mos
 * keladigan sinfga aylanadi (`ko'chmas` -> `ko[...]chmas`).
 */
export function tokenRegexSource(token: string): string {
  let out = "";
  for (const ch of token) out += APOSTROPHE_SET.has(ch) ? APOSTROPHE_CLASS : escapeRegex(ch);
  return out;
}

/**
 * Prisma `contains` uchun so'z variantlari (regex kiritib bo'lmaydi).
 *
 * Har bir variantda BARCHA tutuq belgilari bitta xil belgiga almashtiriladi,
 * ya'ni ko'pi bilan 7 ta variant: dekart ko'paytma (6^n) so'rovni shishirardi.
 * Bitta so'z ichida ARALASH yozilgan tutuq belgilari (masalan `to'g'ri` da
 * birinchisi ASCII, ikkinchisi U+2019) qamrab olinmaydi — amalda ham so'rov,
 * ham saqlangan matn bitta klaviatura bilan yoziladi.
 */
export function apostropheVariants(token: string): string[] {
  let hasApostrophe = false;
  for (const ch of token) {
    if (APOSTROPHE_SET.has(ch)) {
      hasApostrophe = true;
      break;
    }
  }
  if (!hasApostrophe) return [token];

  const variants: string[] = [];
  for (const apostrophe of APOSTROPHE_CHARS) {
    let variant = "";
    for (const ch of token) variant += APOSTROPHE_SET.has(ch) ? apostrophe : ch;
    if (!variants.includes(variant)) variants.push(variant);
  }
  return variants;
}

/** So'z chetidagi tinish belgilari (harf, raqam, `+` va `#` dan boshqasi). */
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}+#]+|[^\p{L}\p{N}+#]+$/gu;

export const MIN_TOKEN_LENGTH = 2;
export const MAX_TOKENS = 8;

/**
 * So'rovni qidiruv so'zlariga bo'ladi.
 *
 * Qoidalar: bo'shliq bo'yicha bo'linadi, so'z CHETIDAGI tinish belgilari
 * olib tashlanadi (ichkarisi qoladi: `node.js`, `C++`, `C#`, `ta'lim`),
 * takrorlar (katta-kichik harf va tutuq belgisi farqisiz) bir marta olinadi.
 *
 * TASHLANADIGAN so'zlar (ataylab, chaqiruvchi ularni ko'rsatmaydi):
 *  - tozalangandan keyin 2 belgidan qisqa bo'lgani (`C`, `R`, `!!`) — bitta
 *    harf butun ro'yxatni qaytarardi, so'z chegarasi bilan qidirish uchun esa
 *    Prisma `contains` yetarli emas (gap1-2 izohiga qarang);
 *  - 8 tadan keyingilari — juda uzun so'rov bazani skan qilmasin.
 *
 * Birorta so'z qolmasa bo'sh ro'yxat qaytadi va chaqiruvchi matn filtrini
 * umuman qo'llamaydi (tinish belgisidan iborat so'rov bo'sh sahifa bermaydi).
 */
export function tokenize(text: string | undefined | null, maxTokens: number = MAX_TOKENS): string[] {
  if (!text) return [];
  const limit = Math.max(1, Math.min(maxTokens, MAX_TOKENS));
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.trim().split(/\s+/)) {
    const token = raw.replace(EDGE_PUNCTUATION, "");
    if (token.length < MIN_TOKEN_LENGTH) continue;
    const key = searchKey(token);
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push(token);
    if (tokens.length >= limit) break;
  }
  return tokens;
}
