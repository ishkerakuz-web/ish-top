import { prisma } from "./prisma.js";

// O'zbekistonning barcha viloyatlari — har startupda mavjudligi ta'minlanadi
// (qo'lda seed ishlatmasdan ham /api/regions to'liq bo'lishi uchun).
const REGIONS = [
  { slug: "tashkent", name: "Toshkent" },
  { slug: "toshkent-viloyati", name: "Toshkent viloyati" },
  { slug: "andijon", name: "Andijon" },
  { slug: "buxoro", name: "Buxoro" },
  { slug: "fargona", name: "Farg'ona" },
  { slug: "jizzax", name: "Jizzax" },
  { slug: "xorazm", name: "Xorazm" },
  { slug: "namangan", name: "Namangan" },
  { slug: "navoiy", name: "Navoiy" },
  { slug: "qashqadaryo", name: "Qashqadaryo" },
  { slug: "qoraqalpogiston", name: "Qoraqalpog'iston" },
  { slug: "samarqand", name: "Samarqand" },
  { slug: "sirdaryo", name: "Sirdaryo" },
  { slug: "surxondaryo", name: "Surxondaryo" },
];

const CATEGORIES = [
  { name: "Axborot texnologiyalari", slug: "it" },
  { name: "Savdo, mijozlarga xizmat", slug: "savdo" },
  { name: "Marketing, reklama", slug: "marketing" },
  { name: "Moliya, buxgalteriya", slug: "moliya" },
  { name: "Qurilish, ko'chmas mulk", slug: "qurilish" },
  { name: "Turizm, mehmonxonalar", slug: "turizm" },
];

export async function ensureCatalog(): Promise<void> {
  const uz = await prisma.region.upsert({
    where: { slug: "uzbekiston" },
    update: {},
    create: { name: "O'zbekiston", slug: "uzbekiston" },
  });
  for (const r of REGIONS) {
    await prisma.region.upsert({
      where: { slug: r.slug },
      update: { name: r.name, parentId: uz.id },
      create: { name: r.name, slug: r.slug, parentId: uz.id },
    });
  }
  for (const c of CATEGORIES) {
    await prisma.vacancyCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
  }
}
