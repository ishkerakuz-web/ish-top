/**
 * Sayt uchun API qatlami — ochiq yuzasi.
 *
 * Ilgari bitta 930 qatorli fayl edi: auth, vakansiya, kompaniya, profil, rezyume,
 * ish beruvchi, Telegram va chat so'rovlari aralash yotardi. Endi har bo'lim
 * `lib/api/` ichida alohida faylda, bu yerda esa faqat qayta eksport — shuning
 * uchun chaqiruvchilarning importlari o'zgarmadi.
 */
export * from "./api/core.js";
export * from "./api/auth.js";
export * from "./api/mappers.js";
export * from "./api/vacancies.js";
export * from "./api/companies.js";
export * from "./api/stats.js";
export * from "./api/profile.js";
export * from "./api/resume.js";
export * from "./api/applications.js";
export * from "./api/employer.js";
export * from "./api/telegram.js";
export * from "./api/chat.js";
