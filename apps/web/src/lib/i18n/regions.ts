import type { Locale } from "./config.js";

// O'zbekistonning barcha viloyatlari (slug seed'dagi region slug'lariga mos).
export const REGIONS: { slug: string }[] = [
  { slug: "tashkent" },
  { slug: "toshkent-viloyati" },
  { slug: "andijon" },
  { slug: "buxoro" },
  { slug: "fargona" },
  { slug: "jizzax" },
  { slug: "xorazm" },
  { slug: "namangan" },
  { slug: "navoiy" },
  { slug: "qashqadaryo" },
  { slug: "qoraqalpogiston" },
  { slug: "samarqand" },
  { slug: "sirdaryo" },
  { slug: "surxondaryo" },
];

export const REGION_NAMES: Record<Locale, Record<string, string>> = {
  uz: {
    tashkent: "Toshkent",
    "toshkent-viloyati": "Toshkent viloyati",
    andijon: "Andijon",
    buxoro: "Buxoro",
    fargona: "Farg'ona",
    jizzax: "Jizzax",
    xorazm: "Xorazm",
    namangan: "Namangan",
    navoiy: "Navoiy",
    qashqadaryo: "Qashqadaryo",
    qoraqalpogiston: "Qoraqalpog'iston",
    samarqand: "Samarqand",
    sirdaryo: "Sirdaryo",
    surxondaryo: "Surxondaryo",
  },
  ru: {
    tashkent: "Ташкент",
    "toshkent-viloyati": "Ташкентская обл.",
    andijon: "Андижан",
    buxoro: "Бухара",
    fargona: "Фергана",
    jizzax: "Джизак",
    xorazm: "Хорезм",
    namangan: "Наманган",
    navoiy: "Навои",
    qashqadaryo: "Кашкадарья",
    qoraqalpogiston: "Каракалпакстан",
    samarqand: "Самарканд",
    sirdaryo: "Сырдарья",
    surxondaryo: "Сурхандарья",
  },
  en: {
    tashkent: "Tashkent",
    "toshkent-viloyati": "Tashkent region",
    andijon: "Andijan",
    buxoro: "Bukhara",
    fargona: "Fergana",
    jizzax: "Jizzakh",
    xorazm: "Khorezm",
    namangan: "Namangan",
    navoiy: "Navoiy",
    qashqadaryo: "Kashkadarya",
    qoraqalpogiston: "Karakalpakstan",
    samarqand: "Samarkand",
    sirdaryo: "Syrdarya",
    surxondaryo: "Surkhandarya",
  },
};

export const ALL_REGIONS_LABEL: Record<Locale, string> = {
  uz: "Butun O'zbekiston",
  ru: "Весь Узбекистан",
  en: "All Uzbekistan",
};

export function regionName(locale: Locale, slug: string, fallback?: string | null): string {
  return REGION_NAMES[locale][slug] ?? fallback ?? slug;
}
