/**
 * Kirishdan keyin foydalanuvchi turgan sahifaga qaytishi (audit ISSUE-066).
 *
 * Faqat sayt ichidagi nisbiy yo'l qabul qilinadi: "//host", "/\host" va to'liq URL'lar rad etiladi —
 * aks holda `?returnTo=` havolasi foydalanuvchini begona saytga yuborish (open redirect) uchun ishlatilardi.
 */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return null;
  // Boshqaruv belgilari (tab, yangi qator va h.k.) — brauzer ularni tashlab "//host" hosil qilishi mumkin
  for (let i = 0; i < path.length; i += 1) {
    if (path.charCodeAt(i) < 0x20) return null;
  }
  return path.slice(0, 500);
}

/** Joriy manzildan (brauzerda) `?returnTo=` bilan login havolasi. */
export function loginHrefWithReturn(loginHref: string): string {
  if (typeof window === "undefined") return loginHref;
  const here = `${window.location.pathname}${window.location.search}`;
  const target = safeReturnTo(here);
  return target ? `${loginHref}?returnTo=${encodeURIComponent(target)}` : loginHref;
}

/** Login/ro'yxatdan o'tish sahifasida: URL'dagi `returnTo` (xavfsiz bo'lsa), aks holda `fallback`. */
export function returnTargetOr(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = new URLSearchParams(window.location.search).get("returnTo");
  const target = safeReturnTo(raw);
  // Login sahifasining o'ziga qaytish siklga olib keladi
  if (!target || /\/(login|signup)(\/|\?|$)/.test(target)) return fallback;
  return target;
}
