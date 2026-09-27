/**
 * Header'dagi "Xabarlar [n]" belgisi va `/messages` sahifasi o'rtasidagi sinxron:
 * suhbat ochilib o'qilganda yoki yangi xabar kelganda header soni darhol
 * qayta so'raladi (odatiy 20 soniyalik yangilanishni kutmasdan).
 */
export const INBOX_CHANGED = "ishbor:inbox-changed";

export function emitInboxChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(INBOX_CHANGED));
}
