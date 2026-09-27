/**
 * Telefon raqami bilan ishlash (audit R3, D-043/D-044).
 *
 * Bitta manba: bot ham, API ham, admin paneli ham shu yerdagi qoidalardan foydalanadi.
 *  - Normalizatsiya: faqat raqamlar; 9 xonali mahalliy raqamga "998" qo'shiladi; natija "+<raqamlar>".
 *    Uzunlik 10–15 raqam bo'lmasa — yaroqsiz (E.164 chegarasi).
 *  - Niqoblash: jurnal va admin paneli uchun — mamlakat kodi va oxirgi 2 raqam qoladi.
 *    Xavfsizlik hodisalariga (SecurityEvent) FAQAT niqoblangan raqam yoziladi (D-050).
 */

const MIN_DIGITS = 10;
const MAX_DIGITS = 15;

/** Faqat raqamlarni qoldiradi ("+998 90 123-45-67" -> "998901234567"). */
function digitsOnly(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 48 && code <= 57) out += value[i];
  }
  return out;
}

/** Yaroqli bo'lsa "+<raqamlar>", aks holda null (chaqiruvchi 400 qaytaradi). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  let digits = digitsOnly(raw);
  // Mahalliy format: 901234567 -> 998901234567
  if (digits.length === 9) digits = `998${digits}`;
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
  return `+${digits}`;
}

/** Raqam yaroqli formatdami (normalizatsiyadan keyin). */
export function isValidPhone(raw: string | null | undefined): boolean {
  return normalizePhone(raw) !== null;
}

/**
 * Jurnal va admin ko'rinishi uchun: "+998901234567" -> "+998 ** *** ** 67".
 * Boshqa uzunliklarda ham mamlakat kodi va oxirgi 2 raqam qoladi.
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (typeof phone !== "string") return null;
  const digits = digitsOnly(phone);
  if (digits.length < 5) return null;
  // Mamlakat kodi: 12 raqamli (O'zbekiston) raqamda 3 ta, aks holda qolgan uzunlikdan chiqariladi
  const ccLength = digits.length >= 12 ? 3 : Math.max(1, digits.length - 9);
  const cc = digits.slice(0, ccLength);
  const last = digits.slice(-2);
  const hidden = digits.length - ccLength - 2;
  if (hidden <= 0) return `+${cc}${last}`;
  // O'zbekiston raqamlarida odatiy guruhlash: ** *** **
  const groups = hidden === 7 ? [2, 3, 2] : [hidden];
  const masked = groups.map((n) => "*".repeat(n)).join(" ");
  return `+${cc} ${masked} ${last}`;
}
