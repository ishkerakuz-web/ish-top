import { PrismaClient, type ArticleCategory, type EmploymentType, type ExperienceRequired } from "@prisma/client";
import argon2 from "argon2";
import { articleDerived } from "../modules/articles/articles.content.js";

const prisma = new PrismaClient();

async function main() {
  // ---- Hududlar (O'zbekistonning barcha viloyatlari) ----
  const uzbekistan = await prisma.region.upsert({
    where: { slug: "uzbekiston" },
    update: {},
    create: { name: "O'zbekiston", slug: "uzbekiston" },
  });

  const regionList = [
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
  const regions: Record<string, string> = {};
  for (const r of regionList) {
    const created = await prisma.region.upsert({
      where: { slug: r.slug },
      update: { name: r.name },
      create: { name: r.name, slug: r.slug, parentId: uzbekistan.id },
    });
    regions[r.slug] = created.id;
  }
  const tashkent = { id: regions["tashkent"] };
  const samarkand = { id: regions["samarqand"] };

  // ---- Kategoriyalar ----
  const categoryData = [
    { name: "Axborot texnologiyalari", slug: "it" },
    { name: "Savdo, mijozlarga xizmat", slug: "savdo" },
    { name: "Marketing, reklama", slug: "marketing" },
    { name: "Moliya, buxgalteriya", slug: "moliya" },
    { name: "Qurilish, ko'chmas mulk", slug: "qurilish" },
    { name: "Turizm, mehmonxonalar", slug: "turizm" },
  ];
  const categories: Record<string, string> = {};
  for (const c of categoryData) {
    const created = await prisma.vacancyCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
    categories[c.slug] = created.id;
  }

  // ---- Foydalanuvchilar ----
  // Bitta hash hammasiga: argon2 ataylab sekin, har bir demo hisob uchun
  // qaytadan hisoblash seed'ni bir necha soniyaga cho'zadi.
  const demoPasswordHash = await argon2.hash("password123");

  const employerUser = await prisma.user.upsert({
    where: { email: "hr@ish.top" },
    update: {},
    create: {
      email: "hr@ish.top",
      passwordHash: demoPasswordHash,
      role: "employer",
      isEmailVerified: true,
    },
  });
  const seekerUser = await prisma.user.upsert({
    where: { email: "seeker@ish.top" },
    update: {},
    create: {
      email: "seeker@ish.top",
      passwordHash: demoPasswordHash,
      role: "job_seeker",
      isEmailVerified: true,
      jobSeekerProfile: { create: { firstName: "Aziz", lastName: "Aliyev", regionId: tashkent.id } },
    },
  });

  // ---- Kompaniyalar ----
  const companyData = [
    {
      slug: "nextbrain",
      name: "NextBrain",
      description:
        "Zamonaviy IT yechimlar kompaniyasi. Veb va mobil mahsulotlar, AI integratsiyalari ustida ishlaymiz.",
      regionId: tashkent.id,
      industry: "Axborot texnologiyalari",
      employeeCount: "50–100",
      foundedYear: 2019,
      isVerified: true,
    },
    {
      slug: "uzum-technologies",
      name: "Uzum Technologies",
      description: "O'zbekistondagi yetakchi e-commerce va fintech platformalarini quramiz.",
      regionId: tashkent.id,
      industry: "E-commerce",
      employeeCount: "500+",
      foundedYear: 2021,
      isVerified: true,
    },
    {
      slug: "mark-formel",
      name: "Mark Formel",
      description: "Marketing va reklama agentligi — brendlar uchun to'liq siklli xizmatlar.",
      regionId: tashkent.id,
      industry: "Marketing, reklama",
      employeeCount: "10–50",
      foundedYear: 2017,
      isVerified: false,
    },
    {
      slug: "sportmaster-uz",
      name: "Sportmaster UZ",
      description: "Sport tovarlari bo'yicha xalqaro chakana savdo tarmog'i.",
      regionId: samarkand.id,
      industry: "Savdo",
      employeeCount: "100–500",
      foundedYear: 2015,
      isVerified: true,
    },
    {
      slug: "tafakkur-group",
      name: "Tafakkur Group",
      description: "Dizayn va mahsulot strategiyasi bo'yicha butik agentlik.",
      regionId: tashkent.id,
      industry: "Dizayn",
      employeeCount: "10–50",
      foundedYear: 2020,
      isVerified: false,
    },
    {
      slug: "dostavlyayu",
      name: "Dostavlyayu",
      description: "O'zbekiston bo'ylab tezkor yetkazib berish xizmati.",
      regionId: tashkent.id,
      industry: "Logistika",
      employeeCount: "500+",
      foundedYear: 2018,
      isVerified: true,
    },
  ];
  const companies: Record<string, string> = {};
  for (const c of companyData) {
    const created = await prisma.company.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        description: c.description,
        regionId: c.regionId,
        industry: c.industry,
        employeeCount: c.employeeCount,
        foundedYear: c.foundedYear,
        isVerified: c.isVerified,
      },
      create: { ...c, ownerUserId: employerUser.id },
    });
    companies[c.slug] = created.id;
  }

  // ---- Vakansiyalar ----
  const reqDev =
    "React, TypeScript bo'yicha amaliy tajriba\nREST API bilan ishlash tajribasi\nGit, kod ko'rib chiqish (code review) madaniyati\nTailwind CSS yoki shunga o'xshash utility-first yondashuv";
  const condStd =
    "Rasmiy ishga joylashtirish\nMoslashuvchan ish jadvali\nZamonaviy ofis, shahar markazida\nMalaka oshirish uchun budjet";

  const vacancyData = [
    {
      slug: "demo-frontend-dasturchi-react",
      title: "Frontend dasturchi (React)",
      company: "nextbrain",
      category: "it",
      regionId: tashkent.id,
      description:
        "React va TypeScript yordamida zamonaviy, tezkor va qulay foydalanuvchi interfeyslarini yaratish. Jamoa bilan birgalikda mahsulotni boshidan oxirigacha qurish jarayonida ishtirok etasiz.",
      requirements: reqDev,
      conditions: condStd,
      employmentType: "full_time" as EmploymentType,
      experienceRequired: "one_to_three" as ExperienceRequired,
      salaryMin: 15_000_000,
      salaryMax: 25_000_000,
      isPremium: true,
      isUrgent: false,
    },
    {
      slug: "demo-backend-dasturchi-nodejs",
      title: "Backend dasturchi (Node.js)",
      company: "uzum-technologies",
      category: "it",
      regionId: tashkent.id,
      description:
        "Yuqori yuklamali xizmatlar uchun barqaror va kengaytiriladigan backend yechimlarni loyihalash. Node.js, PostgreSQL va mikroservis arxitekturasi bilan ishlaysiz.",
      requirements:
        "Node.js, TypeScript bo'yicha chuqur bilim\nPostgreSQL va ma'lumotlar bazasini optimizatsiya qilish\nMikroservislar va message queue tajribasi\nDocker, CI/CD bilan ishlash",
      conditions: condStd,
      employmentType: "full_time" as EmploymentType,
      experienceRequired: "three_to_six" as ExperienceRequired,
      salaryMin: 18_000_000,
      salaryMax: 30_000_000,
      isPremium: false,
      isUrgent: true,
    },
    {
      slug: "demo-marketing-menejeri",
      title: "Marketing menejeri",
      company: "mark-formel",
      category: "marketing",
      regionId: tashkent.id,
      description:
        "Brendlar uchun marketing strategiyasini ishlab chiqish va amalga oshirish. Reklama kampaniyalarini boshqarasiz va natijalarni tahlil qilasiz.",
      requirements:
        "Raqamli marketing bo'yicha tajriba\nSMM, kontekst reklama va analitika\nKontent strategiyasini tuzish\nJamoa bilan ishlash ko'nikmasi",
      conditions: condStd,
      employmentType: "full_time" as EmploymentType,
      experienceRequired: "none" as ExperienceRequired,
      salaryMin: 8_000_000,
      salaryMax: 14_000_000,
      isPremium: false,
      isUrgent: false,
    },
    {
      slug: "demo-buxgalter",
      title: "Bosh buxgalter",
      company: "sportmaster-uz",
      category: "moliya",
      regionId: samarkand.id,
      description:
        "Kompaniyaning to'liq buxgalteriya hisobini yuritish, soliq hisobotlarini tayyorlash va moliyaviy intizomni ta'minlash.",
      requirements:
        "Buxgalteriya hisobi bo'yicha oliy ma'lumot\n1C dasturida ishlash tajribasi\nSoliq qonunchiligini bilish\nDiqqat va mas'uliyat",
      conditions: condStd,
      employmentType: "full_time" as EmploymentType,
      experienceRequired: "one_to_three" as ExperienceRequired,
      salaryMin: 12_000_000,
      salaryMax: 20_000_000,
      isPremium: false,
      isUrgent: false,
    },
    {
      slug: "demo-uiux-designer",
      title: "UI/UX dizayner",
      company: "tafakkur-group",
      category: "it",
      regionId: tashkent.id,
      description:
        "Foydalanuvchi tajribasini chuqur o'rganib, qulay va chiroyli interfeyslar yaratish. Figma'da prototiplar va dizayn tizimlarini quramiz.",
      requirements:
        "Figma bo'yicha kuchli ko'nikma\nDizayn tizimlari bilan ishlash\nUX tadqiqot asoslari\nPortfolio mavjudligi",
      conditions:
        "Masofadan ishlash imkoniyati\nMoslashuvchan jadval\nXalqaro loyihalar\nIjodiy muhit",
      employmentType: "remote" as EmploymentType,
      experienceRequired: "one_to_three" as ExperienceRequired,
      salaryMin: null,
      salaryMax: null,
      isPremium: false,
      isUrgent: false,
    },
    {
      slug: "demo-kuryer",
      title: "Kuryer (avtomobilli)",
      company: "dostavlyayu",
      category: "savdo",
      regionId: tashkent.id,
      description:
        "Buyurtmalarni mijozlarga o'z vaqtida va sifatli yetkazib berish. Moslashuvchan jadval va kunlik to'lovlar.",
      requirements:
        "Haydovchilik guvohnomasi (B toifa)\nShaharni yaxshi bilish\nMas'uliyat va xushmuomalalik\nShaxsiy avtomobil (afzallik)",
      conditions:
        "Kunlik to'lovlar\nMoslashuvchan smenalar\nYoqilg'i kompensatsiyasi\nDo'stona jamoa",
      employmentType: "shift" as EmploymentType,
      experienceRequired: "none" as ExperienceRequired,
      salaryMin: 7_000_000,
      salaryMax: 13_000_000,
      isPremium: false,
      isUrgent: false,
    },
  ];

  for (let i = 0; i < vacancyData.length; i++) {
    const v = vacancyData[i];
    const publishedAt = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    await prisma.vacancy.upsert({
      where: { slug: v.slug },
      update: {
        title: v.title,
        description: v.description,
        requirements: v.requirements,
        conditions: v.conditions,
        companyId: companies[v.company],
        categoryId: categories[v.category],
        regionId: v.regionId,
        employmentType: v.employmentType,
        experienceRequired: v.experienceRequired,
        salaryMin: v.salaryMin,
        salaryMax: v.salaryMax,
        isPremium: v.isPremium,
        isUrgent: v.isUrgent,
        status: "active",
        publishedAt,
      },
      create: {
        slug: v.slug,
        title: v.title,
        description: v.description,
        requirements: v.requirements,
        conditions: v.conditions,
        companyId: companies[v.company],
        categoryId: categories[v.category],
        regionId: v.regionId,
        employmentType: v.employmentType,
        experienceRequired: v.experienceRequired,
        salaryMin: v.salaryMin,
        salaryMax: v.salaryMax,
        isPremium: v.isPremium,
        isUrgent: v.isUrgent,
        status: "active",
        publishedAt,
        applyWithoutResume: true,
      },
    });
  }

  // ---- Maqolalar ----
  // Muallifsiz (ish beruvchi hisobi kontent jamoasi emas); to'liq demo — demo-seed.ts
  const articleData: {
    slug: string;
    title: string;
    excerpt: string;
    category: ArticleCategory;
    tags: string[];
    content: string;
  }[] = [
    {
      slug: "rezyume-qanday-yoziladi-2026",
      title: "Rezyume qanday yoziladi: 2026-yil uchun to'liq qo'llanma",
      excerpt: "Ish beruvchini birinchi 10 soniyada qiziqtiradigan rezyume tuzish bo'yicha amaliy qo'llanma.",
      category: "resume",
      tags: ["Rezyume", "Ish topish"],
      content:
        "Ish beruvchini birinchi 10 soniyada qiziqtiradigan rezyume tuzish bo'yicha amaliy maslahatlar.\n\n## Tuzilma\n\nAniq tuzilma, kuchli yutuqlar va to'g'ri kalit so'zlar — muvaffaqiyatli rezyumening asosi. Ushbu qo'llanmada bosqichma-bosqich har bir bo'limni qanday to'ldirishni ko'rsatamiz.",
    },
    {
      slug: "intervyuga-tayyorgarlik",
      title: "Intervyuga qanday tayyorlanish kerak",
      excerpt: "Ish intervyusiga tayyorlanish bo'yicha amaliy maslahatlar va strategiyalar.",
      category: "interview",
      tags: ["Suhbat", "Intervyu"],
      content:
        "Eng ko'p so'raladigan savollar va ularga ishonchli javob berish strategiyasi.\n\n## STAR usuli\n\nKompaniyani o'rganish, STAR metodi va o'zingizni ishonchli tutish — intervyuda ajralib turishning kalitidir.",
    },
    {
      slug: "birinchi-ish-tajribasiz",
      title: "Tajribasiz birinchi ishni qanday topish mumkin",
      excerpt: "Tajribasiz birinchi ishni topish bo'yicha amaliy yo'l xaritasi.",
      category: "job_search",
      tags: ["Ish topish", "Talabalar"],
      content:
        "Talaba va bitiruvchilar uchun amaliy yo'l xaritasi.\n\n- Amaliyot va stajirovka\n- Ko'ngillilik va pet-loyihalar\n- To'g'ri networking",
    },
  ];
  for (const a of articleData) {
    const fields = {
      title: a.title,
      excerpt: a.excerpt,
      content: a.content,
      category: a.category,
      tags: a.tags,
      status: "published" as const,
      ...articleDerived({ title: a.title, excerpt: a.excerpt, content: a.content, tags: a.tags, category: a.category }),
    };
    await prisma.article.upsert({
      where: { slug: a.slug },
      update: fields,
      create: { slug: a.slug, ...fields, publishedAt: new Date() },
    });
  }

  // ---- Sharhlar (reyting ko'rinishi uchun) ----
  //
  // Har bir sharh ALOHIDA foydalanuvchidan bo'lishi kerak: bazada
  // `@@unique([companyId, userId])` bor (bitta odam bitta kompaniyaga bitta
  // sharh). Ilgari bu yerda hamma sharh bitta demo nomzoddan yozilardi —
  // saytda ham "3 ta sharh, muallif bitta" degan g'alati manzara chiqardi.
  const ratings: Record<string, number[]> = {
    nextbrain: [4, 4, 4],
    "uzum-technologies": [5, 4, 5, 4],
    "mark-formel": [4, 4, 3],
    "sportmaster-uz": [4, 4, 4],
    "tafakkur-group": [5, 5, 4],
    dostavlyayu: [4, 3, 4],
  };
  const REVIEWER_NAMES = [
    ["Dilshod", "Karimov"],
    ["Nilufar", "Rasulova"],
    ["Jasur", "Toshmatov"],
    ["Kamola", "Yusupova"],
  ];
  const reviewerIds: string[] = [];
  for (let i = 0; i < REVIEWER_NAMES.length; i++) {
    const [firstName, lastName] = REVIEWER_NAMES[i];
    const email = `reviewer${i + 1}@ish.top`;
    const reviewer = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: demoPasswordHash,
        role: "job_seeker",
        isEmailVerified: true,
        jobSeekerProfile: { create: { firstName, lastName, regionId: tashkent.id } },
      },
    });
    reviewerIds.push(reviewer.id);
  }

  for (const [slug, values] of Object.entries(ratings)) {
    for (let i = 0; i < values.length; i++) {
      const userId = reviewerIds[i % reviewerIds.length];
      await prisma.companyReview.upsert({
        where: { companyId_userId: { companyId: companies[slug], userId } },
        update: { rating: values[i], status: "approved" },
        create: {
          companyId: companies[slug],
          userId,
          rating: values[i],
          status: "approved",
          comment: "Yaxshi jamoa va qulay ish sharoiti.",
        },
      });
    }
  }

  console.log("Seed muvaffaqiyatli yakunlandi.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
