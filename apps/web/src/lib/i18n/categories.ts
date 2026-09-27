import type { Locale } from "./config.js";

// Bosh sahifadagi mashhur kategoriyalar (faqat slug). Nomi tarjima qilinadi; vakansiyalar soni API'dagi
// haqiqiy filtr sonlaridan olinadi (audit ISSUE-015: ilgari bu yerda to'qima raqamlar bor edi).
export const CATEGORIES: { slug: string }[] = [
  { slug: "it" },
  { slug: "savdo" },
  { slug: "marketing" },
  { slug: "moliya" },
  { slug: "qurilish" },
  { slug: "turizm" },
];

export const CATEGORY_NAMES: Record<Locale, Record<string, string>> = {
  uz: {
    it: "Axborot texnologiyalari",
    savdo: "Savdo, mijozlarga xizmat",
    marketing: "Marketing, reklama",
    moliya: "Moliya, buxgalteriya",
    qurilish: "Qurilish, ko'chmas mulk",
    turizm: "Turizm, mehmonxonalar",
  },
  ru: {
    it: "Информационные технологии",
    savdo: "Продажи, обслуживание клиентов",
    marketing: "Маркетинг, реклама",
    moliya: "Финансы, бухгалтерия",
    qurilish: "Строительство, недвижимость",
    turizm: "Туризм, гостиницы",
  },
  en: {
    it: "Information technology",
    savdo: "Sales, customer service",
    marketing: "Marketing, advertising",
    moliya: "Finance, accounting",
    qurilish: "Construction, real estate",
    turizm: "Tourism, hospitality",
  },
};
