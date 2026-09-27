import { API_URL } from "./api.js";
import { getAccessToken } from "./auth/session.js";

/**
 * Ko'rishni qayd etish (vakansiya va maqola sahifalari).
 *
 * Ilgari hisoblagichni SERVER, sahifa ma'lumoti so'ralganda oshirardi. Natijada
 * SSR so'rovi, bot, havola ko'rinishi va har bir yangilash alohida "ko'rish"
 * bo'lardi. Endi signal faqat BRAUZERDAN, sahifa haqiqatan ochilgandan keyin
 * ketadi; takrorini server ham filtrlaydi (bir ko'ruvchi — sutkada bir marta).
 *
 * So'rov "jo'nat va unut" tarzida: javob kutilmaydi, xatosi yutiladi va sahifa
 * ishiga umuman ta'sir qilmaydi. `keepalive` — foydalanuvchi darhol boshqa
 * sahifaga o'tsa ham so'rov yetib boradi.
 */

/** Shu varaqda allaqachon yuborilgan (qayta render yoki orqaga qaytishda takrorlanmasin). */
const reported = new Set<string>();

function report(path: string, key: string): void {
  if (typeof window === "undefined" || reported.has(key)) return;
  reported.add(key);
  // Kirgan foydalanuvchi bir nechta qurilmadan bitta odam sifatida sanalsin
  const token = getAccessToken();
  void fetch(`${API_URL}${path}`, {
    method: "POST",
    keepalive: true,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }).catch(() => undefined);
}

export function reportVacancyView(slug: string): void {
  report(`/api/vacancies/${encodeURIComponent(slug)}/view`, `v:${slug}`);
}

export function reportArticleView(slug: string): void {
  report(`/api/articles/${encodeURIComponent(slug)}/view`, `a:${slug}`);
}
