import { AppError } from "./errors.js";

/**
 * Noto'g'ri kirish urinishlari hisoblagichi (audit ISSUE-011, R3 D-052).
 *
 * Audit R3 (auth-core-3, headers-infra-4): ilgari hisoblagich FAQAT email bo'yicha edi —
 * istalgan odam qurbonining emailiga 10 marta noto'g'ri parol yuborib, uni 15 daqiqaga
 * kirishdan mahrum qila olardi (DoS). Endi asosiy kalit `email|ip`: bitta manba faqat
 * O'ZINI bloklaydi. Taqsimlangan (ko'p IP'li) brute-force uchun email bo'yicha ancha
 * yuqori "shift" chegarasi qoldi — bitta manbadan unga yetib bo'lmaydi.
 *
 * IP `trustProxy` bo'yicha hisoblanadi (D-053: sukut hop soni "1") — soxta X-Forwarded-For
 * bilan kalitni o'zgartirib bo'lmaydi. API bitta nusxada ishlaydi, hisoblagich xotirada.
 */
const WINDOW_MS = 15 * 60 * 1000;
/** Bitta email + bitta IP juftligi uchun chegara. */
const MAX_PER_EMAIL_IP = 10;
/** Email bo'yicha umumiy shift (taqsimlangan hujum). */
const MAX_PER_EMAIL = 50;
/** Xotira chegaralari: kuzatiladigan emaillar va bitta email uchun IP'lar soni. */
const MAX_TRACKED_EMAILS = 50_000;
const MAX_IPS_PER_EMAIL = 64;

const TOO_MANY = "Juda ko'p noto'g'ri urinish. 15 daqiqadan so'ng qayta urinib ko'ring.";

interface Entry {
  first: number;
  total: number;
  byIp: Map<string, number>;
}

const failures = new Map<string, Entry>();

function current(email: string, now: number): Entry | undefined {
  const entry = failures.get(email);
  if (!entry) return undefined;
  if (now - entry.first > WINDOW_MS) {
    failures.delete(email);
    return undefined;
  }
  return entry;
}

export function assertLoginAllowed(email: string, ip: string): void {
  const entry = current(email, Date.now());
  if (!entry) return;
  if (entry.total >= MAX_PER_EMAIL) throw new AppError(429, "TOO_MANY_ATTEMPTS", TOO_MANY);
  if ((entry.byIp.get(ip) ?? 0) >= MAX_PER_EMAIL_IP) throw new AppError(429, "TOO_MANY_ATTEMPTS", TOO_MANY);
}

export function recordLoginFailure(email: string, ip: string): void {
  const now = Date.now();
  let entry = current(email, now);
  if (!entry) {
    if (failures.size >= MAX_TRACKED_EMAILS) {
      // Xotira cheklovi: eng eski yozuvni tashlaymiz (Map qo'shilish tartibini saqlaydi)
      const oldest = failures.keys().next().value;
      if (oldest !== undefined) failures.delete(oldest);
    }
    entry = { first: now, total: 0, byIp: new Map() };
    failures.set(email, entry);
  }
  entry.total += 1;
  const seen = entry.byIp.get(ip);
  // Ko'p IP'li hujumda xotira o'smasin: yangi IP'lar faqat `total` ga qo'shiladi
  if (seen !== undefined) entry.byIp.set(ip, seen + 1);
  else if (entry.byIp.size < MAX_IPS_PER_EMAIL) entry.byIp.set(ip, 1);
}

/** Muvaffaqiyatli kirish yoki parolni tiklash — shu email bo'yicha hamma hisob tozalanadi. */
export function clearLoginFailures(email: string): void {
  failures.delete(email);
}
