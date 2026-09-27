/**
 * Demo ma'lumotlar — saytning barcha sahifalari "to'la" ko'rinishi uchun.
 *
 *   npm run db:demo                          — demo ma'lumotni (qayta) yaratadi
 *   npm run db:demo -- --reset               — faqat demo ma'lumotni o'chiradi
 *   npm run db:demo -- --for ism@email.com   — demo + shu (o'zingiz ro'yxatdan
 *       o'tgan) nomzod hisobiga ham arizalar, saqlanganlar, chat, bildirishnomalar
 *       va rezyume ulanadi. Bir nechta: `--for a@x.uz --for b@y.uz`.
 *
 * `--for` bilan qo'shilgan yozuvlar haqiqiy hisobda qoladi, lekin to'liq
 * qaytariladi: ariza/saqlangan/chat demo vakansiya va kompaniyalar bilan birga
 * o'chadi; rezyume, bildirishnoma va saqlangan qidiruvlarga Mongo hujjatida
 * `demo_seed: true` belgisi, profilda faqat bo'sh bo'lgan maydonlar to'ldirilib
 * `demo_filled` ga yoziladi — reset ularni (foydalanuvchi o'zgartirmagan
 * bo'lsa) bo'shatadi. Oddiy `db:demo` ham avval shu belgilarni tozalaydi, shuning
 * uchun `--for` ni har safar qayta berish kerak.
 *
 * Demo yozuvlar belgisi: foydalanuvchi email'i `@demo.ish.top` bilan tugaydi.
 * Kompaniya, vakansiya, ariza, chat va h.k. shu hisoblarga bog'langan holda
 * o'chiriladi; maqolalar — DEMO_ARTICLES slug'lari, to'lovlar — `demo-`
 * transactionId orqali. Boshqa hisoblar (admin, haqiqiy ro'yxatdan
 * o'tganlar) tegilmaydi.
 *
 * Ataylab QILINMAYDIGAN narsalar:
 * - Telegram bog'lanmaydi (`telegramChatId` yo'q) — bot haqiqiy xabar yubormasin.
 * - Bildirishnomalar `notify()` orqali emas, bazaga to'g'ridan-to'g'ri yoziladi.
 * - Saqlangan qidiruvlarda `lastNotifiedAt = hozir` — alert scheduler eski
 *   vakansiyalar uchun email/push yubormaydi.
 * - Telefon va telegram kontaktlari — to'qima kompaniyalar haqiqiy begona
 *   raqam/akkauntga ishora qilib qolmasin. Sayt va email faqat zaxiralangan
 *   `.example` domenida (RFC 2606 — hech qachon haqiqiy manzil bo'lmaydi).
 *
 * Har bir ma'lumotli bo'lim to'la bo'lishi kerak (arizalar, saqlanganlar, chat,
 * obunalar, galereyalar, ish beruvchi paneli, admin): yangi sahifa yoki maydon
 * qo'shilganda shu seed ham kengaytiriladi. Media (logo, rasmlar, avatar, PDF)
 * `uploads/demo-*` fayllari sifatida yoziladi — qarang `demo-media.ts`.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import argon2 from "argon2";
import type {
  ApplicationStatus,
  EmploymentType,
  ExperienceRequired,
  NotificationType,
  Prisma,
  ScheduleType,
  VacancyStatus,
} from "@prisma/client";
import { prisma } from "../common/prisma.js";
import { ensureCatalog } from "../common/ensure-catalog.js";
import { ensurePlans } from "../modules/billing/billing.service.js";
import { slugifyText } from "../common/slug.js";
import { SCENES, avatarSvg, logoSvg, removeDemoFiles, resumePdf, sceneSvg, writeDemoFile } from "./demo-media.js";
import { articleDerived } from "../modules/articles/articles.content.js";
import { DEMO_ADMIN_PROFILE, DEMO_ARTICLES, DEMO_COVERS, DEMO_INVITES, DEMO_STAFF, coverFileName } from "./demo-articles.js";

const DOMAIN = "@demo.ish.top";
const PASSWORD = "password123";
const DAY = 86_400_000;
const HOUR = 3_600_000;
const NOW = Date.now();

const ago = (days: number, hours = 0) => new Date(NOW - days * DAY - hours * HOUR);
const ahead = (days: number) => new Date(NOW + days * DAY);
/** Bugun (server vaqti bo'yicha yarim tundan keyin) — "bugungi arizalar" statistikasi uchun. */
function today(hoursAgo: number): Date {
  const midnight = new Date(NOW);
  midnight.setHours(0, 0, 0, 0);
  return new Date(Math.max(midnight.getTime() + 5 * 60_000, NOW - hoursAgo * HOUR));
}
const ym = (value: string) => new Date(`${value}-01T00:00:00.000Z`);
const mln = (n: number) => Math.round(n * 1_000_000);

// Takrorlanadigan "tasodif" — har ishga tushirishda bir xil natija
let rngState = 20260912;
function rand(): number {
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (min: number, max: number) => Math.round(min + rand() * (max - min));

// ============================================================
// Kompaniyalar (to'qima nomlar)
// ============================================================

type PlanSlug = "standard" | "premium";

interface CompanyDef {
  key: string;
  name: string;
  owner: string; // email'ning @ dan oldingi qismi
  industry: string;
  region: string;
  employees: string;
  founded: number;
  verified: boolean;
  plan?: PlanSlug;
  planDaysLeft?: number;
  ownerDaysAgo: number;
  description: string;
  perks: string[];
}

const COMPANIES: CompanyDef[] = [
  {
    key: "nextbrain",
    name: "NextBrain",
    owner: "hr",
    industry: "Axborot texnologiyalari",
    region: "tashkent",
    employees: "51–100",
    founded: 2019,
    verified: true,
    plan: "premium",
    planDaysLeft: 24,
    ownerDaysAgo: 60,
    description:
      "Veb va mobil mahsulotlar, AI integratsiyalari ustida ishlaydigan mahsulot kompaniyasi. 8 yil ichida 40 dan ortiq loyihani ishga tushirdik — bank, logistika va ta'lim sohalari uchun.",
    perks: [
      "Rasmiy ishga joylashtirish va tibbiy sug'urta",
      "Gibrid format: haftada 2 kun uydan",
      "Konferensiya va kurslar uchun yillik budjet",
      "Yangi MacBook va ikkinchi monitor",
    ],
  },
  {
    key: "payla",
    name: "Payla Fintech",
    owner: "payla",
    industry: "Fintech",
    region: "tashkent",
    employees: "101–500",
    founded: 2020,
    verified: true,
    plan: "standard",
    planDaysLeft: 18,
    ownerDaysAgo: 40,
    description:
      "To'lovlar va raqamli hamyon ilovasi. Har oy 2 milliondan ortiq foydalanuvchi Payla orqali kommunal to'lovlar, o'tkazmalar va onlayn xaridlarni amalga oshiradi.",
    perks: [
      "Bozordagi eng raqobatbardosh maosh + choraklik bonus",
      "Tibbiy sug'urta oila a'zolari bilan",
      "Ingliz tili kurslari kompaniya hisobidan",
      "Zamonaviy ofis, bepul tushlik",
    ],
  },
  {
    key: "bozor",
    name: "Bozor Online",
    owner: "bozor",
    industry: "E-commerce",
    region: "tashkent",
    employees: "500+",
    founded: 2018,
    verified: true,
    plan: "standard",
    planDaysLeft: 10,
    ownerDaysAgo: 45,
    description:
      "O'zbekiston bo'ylab 300 mingdan ortiq mahsulot va 2 kunda yetkazib berish. Marketplace, omborlar tarmog'i va o'z logistika xizmatimiz bor.",
    perks: [
      "Rasmiy ishga joylashtirish",
      "Xodimlar uchun mahsulotlarga 15% chegirma",
      "Ofisgacha korporativ transport",
      "Karyera o'sishi: ichki vakansiyalarga ustuvorlik",
    ],
  },
  {
    key: "orzubank",
    name: "Orzu Bank",
    owner: "orzubank",
    industry: "Bank va moliya",
    region: "tashkent",
    employees: "500+",
    founded: 2011,
    verified: true,
    plan: "premium",
    planDaysLeft: 27,
    ownerDaysAgo: 50,
    description:
      "Chakana va korporativ mijozlarga xizmat ko'rsatuvchi tijorat banki. 12 viloyatda 60 dan ortiq filial, mobil ilova va raqamli kredit mahsulotlari.",
    perks: [
      "Barqaror maosh va yillik bonus",
      "Imtiyozli kredit va omonat shartlari",
      "Ichki akademiyada bepul o'qitish",
      "Tibbiy sug'urta va dam olish maskanlariga yo'llanma",
    ],
  },
  {
    key: "brandwave",
    name: "Brandwave Agency",
    owner: "brandwave",
    industry: "Marketing, reklama",
    region: "tashkent",
    employees: "11–50",
    founded: 2017,
    verified: false,
    plan: "standard",
    planDaysLeft: 21,
    ownerDaysAgo: 35,
    description:
      "Brendlar uchun to'liq siklli marketing agentligi: strategiya, SMM, performance reklama va video ishlab chiqarish. Mijozlarimiz orasida FMCG, ta'lim va chakana savdo kompaniyalari bor.",
    perks: [
      "Ijodiy jamoa va erkin muhit",
      "Moslashuvchan ish boshlanish vaqti",
      "Portfolio uchun yirik brend loyihalari",
      "Har yarim yilda maosh qayta ko'rib chiqiladi",
    ],
  },
  {
    key: "tafakkur",
    name: "Tafakkur Design",
    owner: "tafakkur",
    industry: "Dizayn",
    region: "tashkent",
    employees: "11–50",
    founded: 2020,
    verified: false,
    ownerDaysAgo: 30,
    description:
      "Mahsulot dizayni va brending bo'yicha butik studiya. Startaplarga g'oyadan prototipgacha, yirik kompaniyalarga dizayn tizimlarini quramiz.",
    perks: [
      "To'liq masofaviy ishlash imkoniyati",
      "Xalqaro mijozlar bilan loyihalar",
      "Figma, Adobe va boshqa litsenziyalar",
      "Oyiga bir marta jamoaviy workshop",
    ],
  },
  {
    key: "tezyetkaz",
    name: "Tez Yetkaz",
    owner: "tezyetkaz",
    industry: "Logistika",
    region: "tashkent",
    employees: "500+",
    founded: 2019,
    verified: true,
    plan: "standard",
    planDaysLeft: 15,
    ownerDaysAgo: 38,
    description:
      "Restoran va do'konlardan 30 daqiqada yetkazib berish xizmati. Toshkent, Samarqand va Buxoroda 1500 dan ortiq kuryer bilan ishlaymiz.",
    perks: [
      "Har kuni yoki har hafta to'lov — o'zingiz tanlaysiz",
      "Moslashuvchan smenalar",
      "Yoqilg'i va mobil aloqa kompensatsiyasi",
      "Eng yaxshi kuryerlarga oylik bonus",
    ],
  },
  {
    key: "savdomarket",
    name: "Savdo Market",
    owner: "savdomarket",
    industry: "Chakana savdo",
    region: "samarqand",
    employees: "101–500",
    founded: 2014,
    verified: true,
    plan: "standard",
    planDaysLeft: 12,
    ownerDaysAgo: 42,
    description:
      "Samarqand va Navoiy viloyatlaridagi 25 ta supermarketdan iborat oziq-ovqat va xo'jalik mollari tarmog'i.",
    perks: [
      "Rasmiy ishga joylashtirish, ish haqi o'z vaqtida",
      "Bepul tushlik va maxsus kiyim",
      "Uyga yaqin filialni tanlash imkoniyati",
      "Sotuv rejasi bajarilganda bonus",
    ],
  },
  {
    key: "silkroad",
    name: "Silk Road Hotels",
    owner: "silkroad",
    industry: "Mehmonxona biznesi",
    region: "buxoro",
    employees: "101–500",
    founded: 2016,
    verified: true,
    ownerDaysAgo: 33,
    description:
      "Buxoro va Xivadagi butik mehmonxonalar tarmog'i. Tarixiy binolarda zamonaviy servis — mehmonlarimizning 70% i xorijlik sayyohlar.",
    perks: [
      "Bepul ovqatlanish va forma",
      "Xalqaro standartlar bo'yicha o'qitish",
      "Turistik mavsumda qo'shimcha bonus",
      "Yotoqxona (boshqa shahardan kelganlarga)",
    ],
  },
  {
    key: "registon",
    name: "Registon Travel",
    owner: "registon",
    industry: "Turizm",
    region: "samarqand",
    employees: "11–50",
    founded: 2015,
    verified: false,
    ownerDaysAgo: 28,
    description:
      "Samarqand, Buxoro va Xiva bo'ylab inbound turlar tashkil qiluvchi agentlik. Yevropa va Osiyodan kelgan guruhlar bilan ishlaymiz.",
    perks: [
      "Mavsumda yuqori daromad",
      "Sayohat xarajatlari kompaniya hisobidan",
      "Til amaliyoti uchun ajoyib imkoniyat",
      "Moslashuvchan jadval",
    ],
  },
  {
    key: "yangishahar",
    name: "Yangi Shahar Qurilish",
    owner: "yangishahar",
    industry: "Qurilish",
    region: "toshkent-viloyati",
    employees: "101–500",
    founded: 2012,
    verified: true,
    plan: "standard",
    planDaysLeft: 8,
    ownerDaysAgo: 48,
    description:
      "Turar-joy majmualari va ijtimoiy obyektlar quruvchi bosh pudratchi. Hozirda Toshkent viloyatida 6 ta obyektda qurilish olib borilmoqda.",
    perks: [
      "Rasmiy ishga joylashtirish",
      "Obyektgacha transport va tushlik",
      "Vahta usulida ishlaganlarga yotoqxona",
      "Mehnat muhofazasi vositalari bilan ta'minlash",
    ],
  },
  {
    key: "grandbuild",
    name: "Grand Build Invest",
    owner: "grandbuild",
    industry: "Ko'chmas mulk",
    region: "navoiy",
    employees: "51–100",
    founded: 2018,
    verified: false,
    ownerDaysAgo: 26,
    description:
      "Navoiy va Toshkentda premium turar-joy majmualari developeri. Loyihalash, qurilish va sotuvni bir jamoada boshqaramiz.",
    perks: [
      "Sotuvdan foiz — daromadga chegara yo'q",
      "Xizmat avtomobili (menejerlar uchun)",
      "Rasmiy ishga joylashtirish",
      "Xodimlar uchun kvartiraga imtiyoz",
    ],
  },
  {
    key: "hisobpro",
    name: "Hisob Pro",
    owner: "hisobpro",
    industry: "Buxgalteriya xizmatlari",
    region: "namangan",
    employees: "11–50",
    founded: 2016,
    verified: false,
    ownerDaysAgo: 22,
    description:
      "Kichik va o'rta biznes uchun buxgalteriya autsorsingi, soliq maslahati va hisobotlarni topshirish xizmati. 180 dan ortiq doimiy mijoz.",
    perks: [
      "Masofadan yoki ofisda ishlash",
      "1C va soliq qonunchiligi bo'yicha muntazam treninglar",
      "Mijozlar soniga qarab bonus",
      "Barqaror va tinch ish muhiti",
    ],
  },
  {
    key: "educode",
    name: "EduCode Academy",
    owner: "educode",
    industry: "Ta'lim",
    region: "andijon",
    employees: "11–50",
    founded: 2021,
    verified: true,
    ownerDaysAgo: 20,
    description:
      "Farg'ona vodiysidagi dasturlash o'quv markazi. Frontend, backend va mobil dasturlash bo'yicha 6 oylik amaliy kurslar; bitiruvchilarning 60% i ishga joylashgan.",
    perks: [
      "Kechki smenalar — asosiy ish bilan birga olib borsa bo'ladi",
      "O'quvchilar natijasiga qarab bonus",
      "Pedagogik mahorat bo'yicha treninglar",
      "Do'stona va yosh jamoa",
    ],
  },
  {
    key: "fargonatekstil",
    name: "Farg'ona Tekstil",
    owner: "fargonatekstil",
    industry: "To'qimachilik",
    region: "fargona",
    employees: "500+",
    founded: 2009,
    verified: true,
    ownerDaysAgo: 55,
    description:
      "Paxta ipi va trikotaj matolar ishlab chiqaruvchi korxona. Mahsulotlarimiz Yevropa va MDH davlatlariga eksport qilinadi.",
    perks: [
      "Rasmiy ishga joylashtirish",
      "Bepul ovqatlanish va korporativ transport",
      "Yillik moddiy rag'batlantirish",
      "Barqaror, uzoq muddatli ish",
    ],
  },
];

// ============================================================
// Vakansiyalar
// ============================================================

interface VacancyDef {
  c: string;
  title: string;
  cat: string;
  region?: string;
  type: EmploymentType;
  schedule?: ScheduleType;
  exp: ExperienceRequired;
  min?: number;
  max?: number;
  hidden?: boolean;
  days: number;
  premium?: boolean;
  urgent?: boolean;
  noResume?: boolean;
  status?: VacancyStatus;
  rejection?: string;
  desc: string;
  req: string[];
}

const VACANCIES: VacancyDef[] = [
  // ---- NextBrain ----
  {
    c: "nextbrain", title: "Frontend dasturchi (React)", cat: "it", type: "full_time", schedule: "five_two", exp: "one_to_three",
    min: 15, max: 25, days: 6, premium: true,
    desc: "Bank va logistika mijozlari uchun React + TypeScript'da ichki panellar va mijoz ilovalarini yaratasiz. Dizayner va backend jamoasi bilan birga funksiyani g'oyadan production'gacha olib chiqasiz.",
    req: ["React va TypeScript bo'yicha kamida 1 yillik tajriba", "REST API va holatni boshqarish (Redux Toolkit yoki Zustand)", "Tailwind CSS, responsive va accessibility asoslari", "Git va code review madaniyati"],
  },
  {
    c: "nextbrain", title: "Senior Backend dasturchi (Node.js)", cat: "it", type: "full_time", schedule: "five_two", exp: "three_to_six",
    min: 30, max: 45, days: 1, urgent: true,
    desc: "Kuniga millionlab so'rovga xizmat qiladigan to'lov va logistika xizmatlari arxitekturasini loyihalaysiz, jamoadagi 4 nafar dasturchiga texnik yo'nalish berasiz.",
    req: ["Node.js / TypeScript bo'yicha 4+ yil tajriba", "PostgreSQL, Redis, message queue (Kafka yoki RabbitMQ)", "Mikroservislar, kuzatuv (observability) va yuklama testlari", "Kichik jamoaga mentorlik qilish tajribasi"],
  },
  {
    c: "nextbrain", title: "QA muhandis (avtomatlashtirish)", cat: "it", type: "full_time", schedule: "five_two", exp: "one_to_three",
    min: 12, max: 18, days: 3,
    desc: "Veb va mobil mahsulotlar uchun avtotestlar to'plamini yaratasiz va CI'ga ulaysiz. Relizlar sifati uchun javobgar asosiy shaxslardan biri bo'lasiz.",
    req: ["Playwright yoki Cypress bilan ishlash tajribasi", "API testlash (Postman, REST)", "Test-case va bug-report yozish madaniyati", "SQL asoslari"],
  },
  {
    c: "nextbrain", title: "DevOps muhandis", cat: "it", type: "remote", exp: "three_to_six",
    min: 28, max: 40, days: 5,
    desc: "Kubernetes klasterlari, CI/CD va monitoring infratuzilmasini boshqarasiz. Maqsad — har kuni xavfsiz relizlar va 99.9% mavjudlik.",
    req: ["Kubernetes, Docker, Helm", "Terraform yoki Ansible", "Prometheus, Grafana, loglarni markazlashtirish", "Linux va tarmoq asoslarini chuqur bilish"],
  },
  {
    c: "nextbrain", title: "Mobil dasturchi (Flutter)", cat: "it", type: "full_time", schedule: "five_two", exp: "one_to_three",
    min: 14, max: 22, days: 8,
    desc: "Ta'lim platformasining iOS va Android ilovasini Flutter'da rivojlantirasiz: offline rejim, push-bildirishnomalar va to'lov integratsiyasi.",
    req: ["Flutter / Dart bo'yicha 1+ yil tajriba", "Bloc yoki Riverpod", "Firebase, push-bildirishnomalar", "App Store va Google Play'ga chiqarish tajribasi"],
  },
  {
    c: "nextbrain", title: "Junior Python dasturchi", cat: "it", type: "full_time", exp: "none",
    min: 7, max: 10, days: 32, status: "archived",
    desc: "Ichki avtomatlashtirish skriptlari va ma'lumotlarni qayta ishlash xizmatlarini yozish.",
    req: ["Python asoslari", "SQL asoslari", "O'rganishga ishtiyoq"],
  },
  // Ish beruvchi panelida barcha holatlar ko'rinsin: qoralama, moderatsiyada, rad etilgan
  {
    c: "nextbrain", title: "Data muhandis (ETL)", cat: "it", type: "full_time", schedule: "five_two", exp: "three_to_six",
    min: 25, max: 35, days: 1, status: "draft",
    desc: "Ombor (DWH) va ETL jarayonlarini loyihalash: bank va logistika mijozlari ma'lumotlarini yagona analitik bazaga yig'ish.",
    req: ["SQL va Python", "Airflow yoki shunga o'xshash orkestrator", "ClickHouse yoki PostgreSQL bilan ishlash"],
  },
  {
    c: "nextbrain", title: "UX tadqiqotchi", cat: "it", type: "remote", exp: "one_to_three",
    min: 14, max: 20, days: 0, status: "moderation",
    desc: "Mijozlar bilan intervyu, foydalanish qulayligi testlari va mahsulot jamoasiga tavsiyalar tayyorlash.",
    req: ["UX tadqiqot metodlari", "Intervyu va so'rovnomalar o'tkazish tajribasi", "Figma asoslari"],
  },
  {
    c: "nextbrain", title: "IT stajyor", cat: "it", type: "part_time", exp: "none",
    days: 2, status: "rejected", rejection: "Maosh va ish vaqti ko'rsatilmagan — shartlarni to'ldirib, qayta yuboring.",
    desc: "Talabalar uchun 3 oylik amaliyot dasturi.",
    req: ["Dasturlashga qiziqish", "Haftasiga 20 soat vaqt"],
  },

  // ---- Payla Fintech ----
  {
    c: "payla", title: "Product manager (to'lovlar)", cat: "it", type: "full_time", schedule: "five_two", exp: "three_to_six",
    min: 25, max: 35, days: 2, premium: true,
    desc: "O'tkazmalar va kommunal to'lovlar yo'nalishini boshqarasiz: foydalanuvchi tadqiqoti, roadmap, metrikalar va 8 kishilik kross-funksional jamoa bilan ishlash.",
    req: ["Raqamli mahsulot boshqaruvida 3+ yil tajriba", "Metrikalar bilan ishlash: SQL, Amplitude yoki shunga o'xshash", "Fintech yoki marketplace tajribasi afzallik", "Ingliz tili — hujjatlarni o'qish darajasida"],
  },
  {
    c: "payla", title: "Data analitik", cat: "it", type: "full_time", schedule: "five_two", exp: "one_to_three",
    min: 16, max: 24, days: 4,
    desc: "Foydalanuvchilar xulq-atvori va to'lov voronkalarini tahlil qilasiz, A/B testlar natijasini baholaysiz va mahsulot jamoasiga qaror uchun asos tayyorlaysiz.",
    req: ["SQL — murakkab so'rovlar va oynali funksiyalar", "Python (pandas) yoki R", "Power BI, Superset yoki Tableau", "Statistika va A/B test asoslari"],
  },
  {
    c: "payla", title: "Android dasturchi (Kotlin)", cat: "it", type: "full_time", schedule: "five_two", exp: "three_to_six",
    min: 22, max: 32, days: 9,
    desc: "2 million foydalanuvchili hamyon ilovasining Android versiyasini rivojlantirasiz: Jetpack Compose'ga o'tish, xavfsizlik va tezlikni oshirish.",
    req: ["Kotlin, Coroutines, Jetpack Compose", "Clean Architecture, MVVM", "Xavfsiz saqlash va shifrlash tajribasi", "Unit va UI testlar yozish"],
  },
  {
    c: "payla", title: "Risk menejer", cat: "moliya", type: "full_time", schedule: "five_two", exp: "three_to_six",
    min: 18, max: 26, days: 12,
    desc: "Firibgarlikka qarshi qoidalar va skoring modellarini sozlaysiz, shubhali tranzaksiyalar bo'yicha tekshiruvlarni muvofiqlashtirasiz.",
    req: ["Bank yoki fintech'da risk yo'nalishida 3+ yil", "AML/KYC talablarini bilish", "Excel va SQL'da tahlil", "Markaziy bank me'yoriy hujjatlarini bilish"],
  },

  // ---- Bozor Online ----
  {
    c: "bozor", title: "Mijozlarni qo'llab-quvvatlash operatori", cat: "savdo", type: "shift", schedule: "two_two", exp: "none",
    min: 5, max: 7, days: 0, urgent: true, noResume: true,
    desc: "Chat va telefon orqali xaridorlarning buyurtma, yetkazib berish va qaytarish bo'yicha savollariga javob berasiz. Tajriba shart emas — 2 haftalik o'qitish bor.",
    req: ["O'zbek va rus tillarida erkin muloqot", "Kompyuterda tez yozish", "Xushmuomalalik va sabr", "2/2 smena jadvalida ishlashga tayyorlik"],
  },
  {
    c: "bozor", title: "Ombor mudiri", cat: "savdo", type: "full_time", schedule: "five_two", exp: "one_to_three",
    min: 9, max: 12, days: 6,
    desc: "Sergeli tumanidagi saralash omborida qabul, joylashtirish va jo'natish jarayonlarini boshqarasiz, 25 kishilik smena jamoasiga rahbarlik qilasiz.",
    req: ["Omborda rahbarlik tajribasi 1+ yil", "WMS tizimlari bilan ishlash", "Inventarizatsiya va hisobot yuritish", "Jamoani boshqarish ko'nikmasi"],
  },
  {
    c: "bozor", title: "Performance marketolog", cat: "marketing", type: "full_time", schedule: "five_two", exp: "one_to_three",
    min: 12, max: 18, days: 3,
    desc: "Meta, Google va Yandex'dagi reklama kampaniyalarini boshqarasiz. Maqsad — buyurtma narxini (CPO) kamaytirgan holda yangi xaridorlarni jalb qilish.",
    req: ["Performance marketingda 1+ yil tajriba", "Meta Ads, Google Ads, Yandex Direct", "GA4 va web-analitika", "Kreativlarni A/B testlash tajribasi"],
  },
  {
    c: "bozor", title: "Kategoriya menejeri (elektronika)", cat: "savdo", type: "full_time", schedule: "five_two", exp: "three_to_six",
    min: 14, max: 20, days: 10,
    desc: "Elektronika kategoriyasining assortimenti, narx siyosati va sotuvchilar bilan munosabatlar uchun javob berasiz.",
    req: ["E-commerce yoki chakana savdoda 3+ yil", "Yetkazib beruvchilar bilan muzokara tajribasi", "Excel'da chuqur tahlil", "Elektronika bozorini bilish afzallik"],
  },
  {
    c: "bozor", title: "UI/UX dizayner", cat: "it", type: "remote", exp: "one_to_three",
    min: 13, max: 20, hidden: true, days: 7,
    desc: "Marketplace ilovasi va sotuvchi kabinetining foydalanuvchi tajribasini yaxshilaysiz: tadqiqot, prototip, dizayn tizimi komponentlari.",
    req: ["Figma'da kuchli ko'nikma, auto-layout va komponentlar", "Mobil ilova dizayni tajribasi", "UX tadqiqot va intervyu o'tkazish", "Portfolio"],
  },
  {
    c: "bozor", title: "Kontent menejer", cat: "marketing", type: "full_time", exp: "none",
    min: 6, max: 8, days: 0, status: "moderation",
    desc: "Mahsulot kartochkalari uchun matn va tavsiflarni tayyorlash.",
    req: ["Savodli yozish", "Rus tilini bilish"],
  },

  // ---- Orzu Bank ----
  {
    c: "orzubank", title: "Kredit mutaxassisi", cat: "moliya", type: "full_time", schedule: "five_two", exp: "none",
    min: 7, max: 10, days: 1,
    desc: "Jismoniy shaxslarga kredit mahsulotlari bo'yicha maslahat berasiz, hujjatlarni tekshirib, arizalarni ko'rib chiqishga tayyorlaysiz.",
    req: ["Iqtisodiy yoki moliyaviy oliy ma'lumot", "Mijozlar bilan muloqot ko'nikmasi", "Kompyuter savodxonligi", "Bitiruvchilar ham ko'rib chiqiladi"],
  },
  {
    c: "orzubank", title: "Bosh buxgalter", cat: "moliya", type: "full_time", schedule: "five_two", exp: "six_plus",
    min: 20, max: 28, days: 4, premium: true,
    desc: "Bank filiallari tarmog'ining buxgalteriya hisobini yuritasiz, MHXS bo'yicha hisobotlar va auditorlar bilan ishlashni muvofiqlashtirasiz.",
    req: ["Bankda buxgalteriya bo'yicha 6+ yil tajriba", "MHXS (IFRS) bo'yicha sertifikat afzallik", "Soliq qonunchiligini chuqur bilish", "Jamoani boshqarish tajribasi"],
  },
  {
    c: "orzubank", title: "Kassir-operator", cat: "moliya", region: "samarqand", type: "shift", schedule: "smenniy", exp: "none",
    min: 5, max: 6.5, days: 2, noResume: true,
    desc: "Samarqanddagi filialda naqd pul operatsiyalari, valyuta ayirboshlash va kommunal to'lovlarni qabul qilasiz.",
    req: ["O'rta maxsus yoki oliy ma'lumot", "Diqqatlilik va halollik", "Kompyuterda ishlash", "Smenali jadvalga tayyorlik"],
  },
  {
    c: "orzubank", title: "Axborot xavfsizligi mutaxassisi", cat: "it", type: "full_time", schedule: "five_two", exp: "three_to_six",
    min: 25, max: 38, days: 11,
    desc: "Bankning SOC jamoasida hodisalarni kuzatasiz, zaifliklarni baholaysiz va xavfsizlik siyosatlarining bajarilishini nazorat qilasiz.",
    req: ["SIEM tizimlari bilan ishlash tajribasi", "Tarmoq xavfsizligi va pentest asoslari", "ISO 27001 yoki PCI DSS bilan tanishlik", "CEH, OSCP kabi sertifikatlar afzallik"],
  },
  {
    c: "orzubank", title: "Filial menejeri", cat: "moliya", region: "andijon", type: "full_time", schedule: "five_two", exp: "three_to_six",
    min: 15, max: 20, days: 14,
    desc: "Andijondagi filialning sotuv rejasi, xizmat sifati va 18 kishilik jamoasi uchun javob berasiz.",
    req: ["Bank yoki savdoda rahbarlik tajribasi 3+ yil", "Sotuv rejasini bajarish tajribasi", "Kredit va omonat mahsulotlarini bilish", "Andijon shahrida yashash"],
  },

  // ---- Brandwave Agency ----
  {
    c: "brandwave", title: "SMM menejer", cat: "marketing", type: "full_time", schedule: "five_two", exp: "one_to_three",
    min: 7, max: 11, days: 2,
    desc: "3–4 ta brend sahifasini yuritasiz: kontent-reja, suratga olish brifi, hamjamiyat bilan ishlash va oylik hisobotlar.",
    req: ["SMM'da 1+ yil tajriba va portfolio", "Instagram, Telegram, TikTok algoritmlarini tushunish", "Kontent-reja va kopirayting", "Canva yoki CapCut'da oddiy montaj"],
  },
  {
    c: "brandwave", title: "Grafik dizayner", cat: "marketing", type: "part_time", exp: "one_to_three",
    min: 6, max: 9, days: 5,
    desc: "Reklama bannerlari, SMM postlar va brend identifikatsiyasi elementlarini tayyorlaysiz. Yarim kunlik ish, ofis yoki masofadan.",
    req: ["Adobe Illustrator, Photoshop yoki Figma", "Tipografika va kompozitsiya hissi", "Portfolio", "Tezkor tuzatishlarga tayyorlik"],
  },
  {
    c: "brandwave", title: "Kopirayter (o'zbek va rus tillari)", cat: "marketing", type: "remote", exp: "none",
    min: 5, max: 8, days: 9,
    desc: "Reklama shiorlari, post matnlari va landing sahifalar uchun matn yozasiz. Tajribasi kam, lekin yozishni yaxshi ko'radiganlarni ham ko'rib chiqamiz.",
    req: ["O'zbek va rus tillarida savodli yozish", "Ijodiy fikrlash", "Test topshirig'ini bajarish", "Deadline'larga rioya qilish"],
  },
  {
    c: "brandwave", title: "Marketing direktori", cat: "marketing", type: "full_time", schedule: "five_two", exp: "six_plus",
    days: 15,
    desc: "Agentlikning strategik yo'nalishi, yirik mijozlar portfeli va 20 kishilik ijodiy jamoaga rahbarlik qilasiz. Maosh suhbat natijasida kelishiladi.",
    req: ["Marketingda 6+ yil, shundan 2+ yil rahbarlikda", "Yirik brendlar bilan ishlagan portfolio", "Budjet va P&L boshqaruvi", "Ingliz tili — muzokara darajasida"],
  },

  // ---- Tafakkur Design ----
  {
    c: "tafakkur", title: "Mahsulot dizayneri (Product designer)", cat: "it", type: "remote", exp: "three_to_six",
    min: 20, max: 30, days: 6,
    desc: "Startap mijozlar uchun g'oyadan tayyor prototipgacha bo'lgan jarayonni boshqarasiz: tadqiqot, user flow, UI va dasturchilarga topshirish.",
    req: ["Mahsulot dizaynida 3+ yil tajriba", "Figma'da dizayn tizimlari", "Foydalanuvchi tadqiqoti va usability test", "Ingliz tilida muloqot (xalqaro mijozlar)"],
  },
  {
    c: "tafakkur", title: "Motion dizayner", cat: "marketing", type: "part_time", exp: "one_to_three",
    min: 8, max: 12, days: 13,
    desc: "Ilova interfeysi animatsiyalari va brend videolari uchun motion grafika yaratasiz.",
    req: ["After Effects yoki Rive", "Lottie eksporti tajribasi", "Portfolio / showreel", "UI animatsiya tamoyillarini tushunish"],
  },

  // ---- Tez Yetkaz ----
  {
    c: "tezyetkaz", title: "Kuryer (avtomobilli)", cat: "savdo", type: "shift", schedule: "gibkiy", exp: "none",
    min: 7, max: 13, days: 0, urgent: true, noResume: true,
    desc: "Restoran va do'konlardan buyurtmalarni mijozlarga yetkazasiz. Qancha ko'p buyurtma — shuncha yuqori daromad, jadvalni o'zingiz tuzasiz.",
    req: ["B toifali haydovchilik guvohnomasi", "Shaxsiy avtomobil", "Smartfon (Android 9+ yoki iOS 14+)", "Shaharni yaxshi bilish"],
  },
  {
    c: "tezyetkaz", title: "Piyoda kuryer", cat: "savdo", type: "part_time", schedule: "gibkiy", exp: "none",
    min: 4, max: 7, days: 1, noResume: true,
    desc: "Shahar markazidagi yaqin masofalarga buyurtma yetkazish. Talabalar uchun qulay — kuniga 4 soatdan ishlash mumkin.",
    req: ["18 yoshdan katta", "Smartfon", "Mas'uliyat va xushmuomalalik"],
  },
  {
    c: "tezyetkaz", title: "Logistika dispetcheri", cat: "savdo", type: "shift", schedule: "two_two", exp: "one_to_three",
    min: 6, max: 9, days: 3,
    desc: "Kuryerlar oqimini real vaqtda taqsimlaysiz, kechikishlar va muammoli buyurtmalarni hal qilasiz.",
    req: ["Dispetcherlik yoki call-markazda tajriba", "Stressli vaziyatda tez qaror qabul qilish", "Excel va xarita xizmatlari", "Rus tilini bilish"],
  },
  {
    c: "tezyetkaz", title: "Filial rahbari", cat: "savdo", region: "samarqand", type: "full_time", schedule: "five_two", exp: "three_to_six",
    min: 12, max: 16, days: 8,
    desc: "Samarqand filialini noldan kengaytirasiz: kuryerlar yollash, hamkor restoranlar bilan ishlash va xizmat sifati.",
    req: ["Operatsion boshqaruvda 3+ yil", "Jamoa yollash va o'qitish tajribasi", "KPI bilan ishlash", "Samarqandda yashash"],
  },
  {
    c: "tezyetkaz", title: "Call-markaz operatori", cat: "savdo", type: "shift", exp: "none",
    min: 5, max: 6, days: 0, status: "moderation",
    desc: "Kiruvchi qo'ng'iroqlarga javob berish.",
    req: ["Xushmuomalalik"],
  },

  // ---- Savdo Market ----
  {
    c: "savdomarket", title: "Sotuvchi-konsultant", cat: "savdo", region: "samarqand", type: "shift", schedule: "two_two", exp: "none",
    min: 4.5, max: 6, days: 1, noResume: true,
    desc: "Supermarketda xaridorlarga maslahat berasiz, javonlarni to'ldirasiz va mahsulotlar muddatini nazorat qilasiz.",
    req: ["Xushmuomalalik", "Jamoada ishlash", "Smenali jadvalga tayyorlik"],
  },
  {
    c: "savdomarket", title: "Do'kon direktori", cat: "savdo", region: "samarqand", type: "full_time", schedule: "five_two", exp: "three_to_six",
    min: 12, max: 16, days: 5,
    desc: "Yangi ochilayotgan 1200 m² supermarketni boshqarasiz: jamoa, tovar zaxirasi, savdo rejasi va xarajatlar.",
    req: ["Chakana savdoda rahbarlik tajribasi 3+ yil", "Tovar aylanmasi va inventarizatsiya", "Jamoani boshqarish", "Samarqandda yashash"],
  },
  {
    c: "savdomarket", title: "Merchandayzer", cat: "savdo", region: "samarqand", type: "part_time", exp: "none",
    min: 4, max: 5.5, days: 7,
    desc: "Planogramma bo'yicha mahsulotlarni joylashtirish va aksiyalar uchun savdo zalini tayyorlash.",
    req: ["Diqqatlilik", "Jismoniy chidamlilik", "Yarim kunlik ishga tayyorlik"],
  },
  {
    c: "savdomarket", title: "Buxgalter", cat: "moliya", region: "samarqand", type: "full_time", schedule: "five_two", exp: "one_to_three",
    min: 8, max: 11, days: 12,
    desc: "Tarmoq filiallarining birlamchi hujjatlari, ish haqi hisob-kitobi va soliq hisobotlarini tayyorlaysiz.",
    req: ["1C: Buxgalteriya", "Soliq hisobotlarini topshirish tajribasi", "Excel", "Oliy iqtisodiy ma'lumot"],
  },
  {
    c: "savdomarket", title: "Kassir", cat: "savdo", region: "samarqand", type: "shift", exp: "none",
    min: 4, max: 5, days: 27, status: "archived",
    desc: "Kassada xaridorlarga xizmat ko'rsatish.",
    req: ["Diqqatlilik"],
  },

  // ---- Silk Road Hotels ----
  {
    c: "silkroad", title: "Mehmonxona administratori", cat: "turizm", region: "buxoro", type: "shift", schedule: "smenniy", exp: "one_to_three",
    min: 6, max: 8, days: 2,
    desc: "Mehmonlarni kutib olish, joylashtirish va bron qilish tizimini yuritish. Mehmonlarimizning ko'pchiligi xorijliklar.",
    req: ["Ingliz tili — erkin muloqot darajasida", "Mehmonxona yoki xizmat sohasida tajriba", "PMS tizimlari (Opera, Fidelio) afzallik", "Tartibli tashqi ko'rinish"],
  },
  {
    c: "silkroad", title: "Sous-shef", cat: "turizm", region: "buxoro", type: "full_time", schedule: "smenniy", exp: "three_to_six",
    min: 10, max: 14, days: 6, urgent: true,
    desc: "Restoran oshxonasida bosh oshpazning o'rinbosari: menyu, sifat nazorati, xarajatlar va oshxona jamoasi.",
    req: ["Restoran oshxonasida 3+ yil tajriba", "Milliy va Yevropa taomlari", "HACCP sanitariya talablarini bilish", "Jamoani boshqarish"],
  },
  {
    c: "silkroad", title: "Housekeeping menejeri", cat: "turizm", region: "buxoro", type: "full_time", schedule: "five_two", exp: "one_to_three",
    min: 7, max: 9, days: 16,
    desc: "Xonalar tozaligi va xizmat standartlari, xizmatchilar jadvali va inventar hisobi uchun javob berasiz.",
    req: ["Mehmonxonada 1+ yil tajriba", "Tashkilotchilik", "Ingliz tili asoslari"],
  },

  // ---- Registon Travel ----
  {
    c: "registon", title: "Gid-tarjimon (ingliz tili)", cat: "turizm", region: "samarqand", type: "part_time", schedule: "gibkiy", exp: "one_to_three",
    min: 8, max: 15, days: 3, premium: true,
    desc: "Xorijiy guruhlarga Samarqand, Buxoro va Xiva bo'ylab ekskursiyalar o'tkazasiz. Mavsum — mart–noyabr.",
    req: ["Ingliz tili C1 darajasida", "O'zbekiston tarixi va madaniyatini bilish", "Gid guvohnomasi afzallik", "Safarlarga tayyorlik"],
  },
  {
    c: "registon", title: "Tur menejer", cat: "turizm", region: "samarqand", type: "full_time", schedule: "five_two", exp: "none",
    min: 6, max: 9, days: 9,
    desc: "Xorijiy hamkorlardan kelgan so'rovlar bo'yicha tur dasturlarini tuzasiz, mehmonxona va transportni bron qilasiz.",
    req: ["Ingliz tili B2+", "Excel va pochta bilan ishlash", "Tashkilotchilik", "Turizm bo'yicha ma'lumot afzallik"],
  },

  // ---- Yangi Shahar Qurilish ----
  {
    c: "yangishahar", title: "Qurilish muhandisi (PTO)", cat: "qurilish", region: "toshkent-viloyati", type: "full_time", schedule: "five_two", exp: "three_to_six",
    min: 14, max: 20, days: 1,
    desc: "Ishlab chiqarish-texnik bo'limida loyiha hujjatlari, bajarilgan ishlar dalolatnomalari va texnik nazorat bilan ishlaysiz.",
    req: ["Qurilish bo'yicha oliy ma'lumot", "PTO'da 3+ yil tajriba", "AutoCAD, ShNQ me'yorlari", "Ijro hujjatlarini yuritish"],
  },
  {
    c: "yangishahar", title: "Prorab", cat: "qurilish", region: "toshkent-viloyati", type: "full_time", schedule: "vahta", exp: "three_to_six",
    min: 15, max: 22, days: 4, urgent: true,
    desc: "9 qavatli turar-joy binolari qurilishida ishlarni tashkil qilasiz: brigadalar, material yetkazib berish, muddat va sifat nazorati.",
    req: ["Ko'p qavatli binolar qurilishida 3+ yil", "Chizmalarni o'qish", "Mehnat muhofazasi talablarini bilish", "Vahta usulida ishlashga tayyorlik"],
  },
  {
    c: "yangishahar", title: "Smeta mutaxassisi", cat: "qurilish", region: "toshkent-viloyati", type: "full_time", schedule: "five_two", exp: "one_to_three",
    min: 10, max: 14, days: 10,
    desc: "Loyiha va bajarilgan ishlar bo'yicha smetalar tuzasiz, pudratchilar hisob-kitoblarini tekshirasiz.",
    req: ["Smeta dasturlari (ShNK, Grand-Smeta)", "1+ yil tajriba", "Excel", "Qurilish me'yorlarini bilish"],
  },
  {
    c: "yangishahar", title: "Elektrik (montajchi)", cat: "qurilish", region: "toshkent-viloyati", type: "full_time", schedule: "five_two", exp: "one_to_three",
    min: 8, max: 11, days: 18,
    desc: "Turar-joy binolarida ichki elektr tarmoqlarini montaj qilish va ishga tushirish.",
    req: ["Elektr xavfsizligi guruhi (III+)", "Montaj tajribasi 1+ yil", "Chizmalarni o'qish"],
  },

  // ---- Grand Build Invest ----
  {
    c: "grandbuild", title: "Ko'chmas mulk bo'yicha sotuv menejeri", cat: "qurilish", region: "tashkent", type: "full_time", schedule: "five_two", exp: "none",
    min: 6, max: 15, days: 2,
    desc: "Sotuv ofisida mijozlarga turar-joy majmualarimizni taqdim etasiz, shartnoma tuzishgacha hamroh bo'lasiz. Belgilangan maosh + har bir sotuvdan foiz.",
    req: ["Sotuvda tajriba afzallik, lekin shart emas", "O'zbek va rus tillarida erkin muloqot", "CRM bilan ishlash", "Natijaga yo'naltirilganlik"],
  },
  {
    c: "grandbuild", title: "Arxitektor", cat: "qurilish", region: "navoiy", type: "full_time", schedule: "five_two", exp: "three_to_six",
    min: 18, max: 25, days: 8,
    desc: "Turar-joy majmualarining eskiz va ishchi loyihalarini ishlab chiqasiz, vizualizatsiya jamoasi bilan ishlaysiz.",
    req: ["Arxitektura bo'yicha oliy ma'lumot", "Revit, ArchiCAD yoki AutoCAD", "Turar-joy loyihalari portfoliosi", "Me'yoriy hujjatlarni bilish"],
  },
  {
    c: "grandbuild", title: "Agent (foizga ishlash)", cat: "qurilish", type: "full_time", exp: "none",
    days: 0, status: "rejected", rejection: "Vazifalar va daromad shartlari aniq ko'rsatilmagan — tavsifni to'ldirib, qayta yuboring.",
    desc: "Foizga ishlash.",
    req: ["Xohish"],
  },

  // ---- Hisob Pro ----
  {
    c: "hisobpro", title: "Buxgalter (autsorsing)", cat: "moliya", region: "namangan", type: "remote", exp: "one_to_three",
    min: 7, max: 10, days: 3,
    desc: "8–10 ta kichik biznes mijozning buxgalteriya hisobini masofadan yuritasiz: birlamchi hujjatlar, ish haqi, soliq hisobotlari.",
    req: ["1C: Buxgalteriya 8.3", "Soliq hisobotlarini my.soliq.uz orqali topshirish", "1+ yil tajriba", "Mustaqil ishlash va vaqtni boshqarish"],
  },
  {
    c: "hisobpro", title: "Soliq maslahatchisi", cat: "moliya", region: "namangan", type: "full_time", schedule: "five_two", exp: "three_to_six",
    min: 12, max: 17, days: 11,
    desc: "Mijozlarga soliq optimallashtirish, tekshiruvlarga tayyorgarlik va nizoli masalalar bo'yicha maslahat berasiz.",
    req: ["Soliq kodeksini chuqur bilish", "Soliq maslahatchisi malaka sertifikati", "3+ yil tajriba", "Yozma xulosalar tayyorlash"],
  },

  // ---- EduCode Academy ----
  {
    c: "educode", title: "Frontend mentor", cat: "it", region: "andijon", type: "part_time", schedule: "gibkiy", exp: "three_to_six",
    min: 9, max: 14, days: 4,
    desc: "12–15 kishilik guruhlarga HTML, CSS, JavaScript va React bo'yicha kechki darslar o'tasiz, loyiha ishlarini tekshirasiz.",
    req: ["Frontend'da 3+ yil amaliy tajriba", "React va zamonaviy JavaScript", "Tushuntirish qobiliyati", "Kechki soat 18:00–21:00 da bo'sh vaqt"],
  },
  {
    c: "educode", title: "O'quv markaz administratori", cat: "savdo", region: "andijon", type: "full_time", schedule: "five_two", exp: "none",
    min: 4.5, max: 6, days: 6,
    desc: "Kursga yoziluvchilarni qabul qilish, qo'ng'iroqlarga javob berish, guruhlar jadvali va to'lovlarni hisobga olish.",
    req: ["Xushmuomalalik", "Kompyuter savodxonligi", "Tashkilotchilik"],
  },

  // ---- Farg'ona Tekstil ----
  {
    c: "fargonatekstil", title: "Eksport bo'yicha menejer", cat: "savdo", region: "fargona", type: "full_time", schedule: "five_two", exp: "three_to_six",
    min: 14, max: 22, days: 5,
    desc: "Yevropa va MDH xaridorlari bilan muzokaralar, shartnomalar va eksport hujjatlarini tayyorlashni boshqarasiz.",
    req: ["Tashqi savdoda 3+ yil tajriba", "Ingliz va rus tillari — muzokara darajasida", "Incoterms, bojxona rasmiylashtiruvi", "To'qimachilik sohasini bilish afzallik"],
  },
  {
    c: "fargonatekstil", title: "Ishlab chiqarish buxgalteri", cat: "moliya", region: "fargona", type: "full_time", schedule: "five_two", exp: "one_to_three",
    min: 7, max: 9, days: 13,
    desc: "Xomashyo, tayyor mahsulot va tannarx hisobini yuritasiz, oylik inventarizatsiyada qatnashasiz.",
    req: ["1C: Ishlab chiqarish korxonasi boshqaruvi", "Tannarx kalkulyatsiyasi", "1+ yil tajriba"],
  },
];

// ---- Katalogni to'ldiruvchi qo'shimcha kompaniyalar ----
// /companies sahifasida cheksiz yuklash (18 tadan) va filtrlar haqiqiy hajmda
// ko'rinishi uchun. Profil qisqaroq: 0–2 ta vakansiya, standart shartlar.

/** To'liq profilli asosiy kompaniyalar soni (qo'shimchalar shundan keyin qo'shiladi). */
const MAIN_COMPANY_COUNT = COMPANIES.length;
const isMainCompany = (key: string) => COMPANIES.findIndex((c) => c.key === key) < MAIN_COMPANY_COUNT;
/** Galereyaning barcha ko'rinishlari (1, 2, 3, 4, 5+ rasm) demo'da uchrasin. */
const GALLERY_SIZES = [5, 4, 3, 2, 1, 6];

const GENERIC_PERKS = [
  "Rasmiy ishga joylashtirish",
  "Ish haqi o'z vaqtida, yiliga bir marta indeksatsiya",
  "Malaka oshirish imkoniyati",
  "Do'stona jamoa",
];

/** [kalit, nom, soha, hudud, xodimlar, tashkil etilgan, tasdiqlangan, tavsif] */
const EXTRA_COMPANIES: [string, string, string, string, string, number, boolean, string][] = [
  ["aloqatelekom", "Aloqa Telekom", "Telekommunikatsiya", "tashkent", "500+", 2008, true, "Mobil aloqa va keng polosali internet provayderi. 9 viloyatda o'z tarmog'i va 400 dan ortiq xizmat ko'rsatish nuqtasi."],
  ["codecraft", "CodeCraft Studio", "IT autsorsing, dasturiy ta'minot", "tashkent", "11–50", 2020, true, "Yevropa mijozlari uchun veb va mobil ilovalar ishlab chiquvchi autsorsing studiyasi."],
  ["medline", "MedLine Klinikasi", "Sog'liqni saqlash", "tashkent", "101–500", 2013, true, "Ko'p tarmoqli xususiy klinika: diagnostika, laboratoriya va 20 dan ortiq yo'nalish bo'yicha mutaxassislar."],
  ["kapitalsugurta", "Kapital Sug'urta", "Sug'urta", "tashkent", "101–500", 2009, true, "Avtomobil, mulk va sog'liq sug'urtasi bo'yicha xizmatlar; onlayn polis rasmiylashtirish."],
  ["farmlider", "Farm Lider", "Farmatsevtika", "tashkent", "101–500", 2007, true, "Dori vositalari distribyutori va dorixonalar tarmog'i — 120 ta dorixona."],
  ["jizzaxsement", "Jizzax Sement", "Sanoat, qurilish materiallari ishlab chiqarish", "jizzax", "500+", 2011, true, "Yiliga 2 mln tonna sement ishlab chiqaruvchi zavod."],
  ["samarqandnon", "Samarqand Non Kombinati", "Oziq-ovqat ishlab chiqarish", "samarqand", "101–500", 1998, true, "Non va qandolat mahsulotlari ishlab chiqaruvchi kombinat, viloyat bo'ylab o'z yetkazib berish xizmati."],
  ["sirdaryopaxta", "Sirdaryo Paxta Klasteri", "Qishloq xo'jaligi, to'qimachilik", "sirdaryo", "500+", 2018, true, "Paxta yetishtirishdan tayyor ipgacha bo'lgan to'liq zanjirni boshqaruvchi klaster."],
  ["yashilenergiya", "Yashil Energiya", "Energetika", "navoiy", "101–500", 2020, true, "Quyosh elektr stansiyalarini loyihalash, qurish va ularga xizmat ko'rsatish."],
  ["toshkentmebel", "Toshkent Mebel Fabrikasi", "Ishlab chiqarish, mebel", "toshkent-viloyati", "101–500", 2005, true, "Ofis va uy mebellari ishlab chiqaruvchi fabrika, MDH davlatlariga eksport."],
  ["sharqlizing", "Sharq Lizing", "Moliya, lizing", "tashkent", "51–100", 2015, true, "Kichik biznes uchun uskunalar va transport lizingi."],
  ["cargoexpress", "Cargo Express", "Logistika, yuk tashish", "tashkent", "51–100", 2018, false, "Xalqaro va mahalliy yuk tashish, bojxona rasmiylashtiruvi va omborxona xizmatlari."],
  ["kitobolami", "Kitob Olami", "Chakana savdo", "tashkent", "51–100", 2016, false, "Kitob do'konlari tarmog'i va onlayn kitob do'koni — 40 mingdan ortiq nom."],
  ["zaminagro", "Zamin Agro", "Qishloq xo'jaligi", "qashqadaryo", "101–500", 2010, false, "Meva-sabzavot yetishtirish va sovutgichli omborlarda saqlash."],
  ["najottalim", "Najot Ta'lim Markazi", "Ta'lim", "namangan", "11–50", 2019, false, "Maktab o'quvchilari uchun matematika, ingliz tili va IT kurslari."],
  ["edupro", "EduPro Online", "Onlayn ta'lim, EdTech", "tashkent", "11–50", 2023, false, "Kasbiy ko'nikmalar bo'yicha video-kurslar platformasi."],
  ["uzsoftlab", "UzSoft Lab", "Dasturiy ta'minot", "tashkent", "11–50", 2022, false, "Kichik biznes uchun hisob-kitob va CRM dasturlari."],
  ["pixelmedia", "Pixel Media", "Media va reklama", "tashkent", "11–50", 2021, false, "Video prodakshn va raqamli reklama agentligi."],
  ["oqsaroy", "Oq Saroy Mehmonxonasi", "Mehmonxona biznesi", "xorazm", "51–100", 2017, false, "Xivadagi 60 xonali mehmonxona va restoran."],
  ["buxorogilam", "Buxoro Gilamlari", "To'qimachilik, hunarmandchilik", "buxoro", "51–100", 2012, false, "Qo'lda to'qilgan gilam va so'zanalar ishlab chiqarish."],
  ["andijonavto", "Andijon Avto Servis", "Avtoservis", "andijon", "11–50", 2014, false, "Yengil avtomobillarga texnik xizmat ko'rsatish va ehtiyot qismlar savdosi."],
  ["surxonqurilish", "Surxon Qurilish Invest", "Qurilish", "surxondaryo", "51–100", 2016, false, "Ijtimoiy obyektlar va yo'l qurilishi bo'yicha pudratchi."],
  ["smartretail", "Smart Retail", "Chakana savdo, e-commerce", "fargona", "51–100", 2020, false, "Maishiy texnika do'konlari va onlayn-do'kon."],
  ["oroltravel", "Orol Travel", "Turizm", "qoraqalpogiston", "1–10", 2019, false, "Orol dengizi va Qoraqalpog'iston bo'ylab ekoturlar."],
  ["mahallamarket", "Mahalla Market", "Chakana savdo", "toshkent-viloyati", "11–50", 2022, false, "Uyga yaqin minimarketlar tarmog'i."],
  ["auditgroup", "Audit Consulting Group", "Audit va konsalting", "tashkent", "11–50", 2011, false, "Moliyaviy audit, soliq maslahati va MHXSga o'tish bo'yicha konsalting."],
  ["yangiavlodfondi", "Yangi Avlod Davlat Fondi", "Davlat tashkiloti", "tashkent", "51–100", 2017, true, "Yoshlar tadbirkorligini qo'llab-quvvatlash bo'yicha davlat dasturlarini amalga oshiruvchi fond."],
];

for (const [i, [key, name, industry, region, employees, founded, verified, description]] of EXTRA_COMPANIES.entries()) {
  COMPANIES.push({ key, name, owner: key, industry, region, employees, founded, verified, ownerDaysAgo: 4 + ((i * 7) % 50), description, perks: GENERIC_PERKS });
}

const GENERIC_REQ: Record<string, string[]> = {
  it: ["Tegishli sohada kamida 1 yillik tajriba", "Zamonaviy vositalar bilan ishlash", "Jamoada ishlash va mas'uliyat"],
  savdo: ["Mijozlar bilan muloqot ko'nikmasi", "O'zbek va rus tillari", "Natijaga yo'naltirilganlik"],
  moliya: ["Iqtisodiy oliy ma'lumot", "1C va Excel", "Diqqatlilik"],
  marketing: ["Portfolio", "Ijodiy fikrlash", "Raqamli vositalarni bilish"],
  qurilish: ["Tegishli ma'lumot yoki tajriba", "Chizmalarni o'qish", "Mehnat muhofazasi qoidalarini bilish"],
  turizm: ["Ingliz tili", "Xushmuomalalik", "Moslashuvchan jadvalga tayyorlik"],
};

/** [kompaniya, lavozim, kategoriya, bandlik, tajriba, min, max, necha kun oldin] */
const EXTRA_JOBS: [string, string, string, EmploymentType, ExperienceRequired, number, number, number][] = [
  ["aloqatelekom", "Tarmoq muhandisi", "it", "full_time", "one_to_three", 12, 18, 2],
  ["aloqatelekom", "Savdo ofisi menejeri", "savdo", "full_time", "none", 6, 9, 5],
  ["codecraft", "React Native dasturchi", "it", "remote", "one_to_three", 15, 24, 1],
  ["codecraft", "QA muhandis (manual)", "it", "remote", "none", 7, 10, 7],
  ["medline", "Registrator-administrator", "savdo", "shift", "none", 5, 6.5, 3],
  ["kapitalsugurta", "Sug'urta agenti", "moliya", "full_time", "none", 5, 12, 4],
  ["farmlider", "Farmatsevt", "savdo", "shift", "one_to_three", 6, 8, 6],
  ["jizzaxsement", "Mexanik muhandis", "qurilish", "full_time", "three_to_six", 11, 15, 9],
  ["samarqandnon", "Ekspeditor", "savdo", "full_time", "none", 5, 7, 2],
  ["yashilenergiya", "Elektr muhandisi", "qurilish", "full_time", "one_to_three", 13, 19, 8],
  ["sharqlizing", "Kredit tahlilchisi", "moliya", "full_time", "one_to_three", 9, 13, 10],
  ["cargoexpress", "Logist", "savdo", "full_time", "one_to_three", 8, 11, 3],
  ["kitobolami", "Sotuvchi-maslahatchi", "savdo", "part_time", "none", 3.5, 5, 1],
  ["uzsoftlab", "Backend dasturchi (Python)", "it", "full_time", "one_to_three", 12, 17, 5],
  ["pixelmedia", "Videomontajchi", "marketing", "part_time", "one_to_three", 6, 9, 4],
  ["oqsaroy", "Ofitsiant", "turizm", "shift", "none", 3.5, 5, 2],
  ["smartretail", "Onlayn-do'kon menejeri", "savdo", "full_time", "one_to_three", 7, 10, 6],
  ["auditgroup", "Kichik auditor", "moliya", "full_time", "none", 6, 8, 11],
  // /salaries "ommabop kasblar" tugmalari bo'sh qolmasin
  ["codecraft", "Frontend dasturchi (Vue.js)", "it", "remote", "three_to_six", 18, 26, 3],
  ["uzsoftlab", "Data analitik (BI)", "it", "full_time", "three_to_six", 16, 24, 5],
  ["uzsoftlab", "HR menejer (IT rekruter)", "it", "full_time", "one_to_three", 9, 13, 4],
  ["aloqatelekom", "HR menejer", "savdo", "full_time", "three_to_six", 10, 14, 6],
  ["smartretail", "Sotuv bo'yicha menejer (B2B)", "savdo", "full_time", "one_to_three", 8, 14, 2],
  ["pixelmedia", "UX/UI dizayner (junior)", "it", "full_time", "none", 6, 9, 3],
  ["auditgroup", "Buxgalter (1C)", "moliya", "full_time", "one_to_three", 8, 11, 6],
];

for (const [c, title, cat, type, exp, min, max, days] of EXTRA_JOBS) {
  const company = EXTRA_COMPANIES.find(([key]) => key === c)!;
  VACANCIES.push({
    c,
    title,
    cat,
    type,
    exp,
    min,
    max,
    days,
    desc: `${company[1]} jamoasi "${title}" lavozimiga xodim qidirmoqda. ${company[7]}`,
    req: GENERIC_REQ[cat] ?? GENERIC_REQ.savdo,
  });
}

// ============================================================
// Nomzodlar
// ============================================================

interface SeekerDef {
  key: string;
  first: string;
  last: string;
  headline: string;
  region: string;
  born: number;
  daysAgo: number;
  salary: number;
  types: EmploymentType[];
  summary: string;
  exp: { company: string; position: string; from: string; to?: string; desc?: string }[];
  edu: { institution: string; degree?: string; field?: string; from: number; to?: number }[];
  skills: string[];
  openToWork?: boolean;
}

const SEEKERS: SeekerDef[] = [
  {
    key: "seeker", first: "Aziz", last: "Aliyev", headline: "Frontend dasturchi (React)", region: "tashkent", born: 1998, daysAgo: 21,
    salary: 20, types: ["full_time", "remote"],
    summary: "4 yillik tajribaga ega frontend dasturchiman. React va TypeScript'da tezkor, qulay interfeyslar yarataman; so'nggi loyihamda admin panelning yuklanish vaqtini 40% ga qisqartirdim. Mahsulot jamoasida o'sishni va murakkab UI muammolarini hal qilishni yoqtiraman.",
    exp: [
      { company: "Digital Craft", position: "Frontend dasturchi", from: "2022-03", desc: "Logistika mijozlari uchun React + TypeScript'da dispetcherlik paneli. Dizayn tizimini noldan qurdim, 60+ komponent. Lighthouse ko'rsatkichini 62 dan 94 ga ko'tardim." },
      { company: "WebStudio Pro", position: "Junior frontend dasturchi", from: "2020-09", to: "2022-02", desc: "Korporativ saytlar va landing sahifalar. Vue'dan React'ga migratsiyada qatnashdim." },
    ],
    edu: [{ institution: "Toshkent axborot texnologiyalari universiteti", degree: "Bakalavr", field: "Dasturiy injiniring", from: 2016, to: 2020 }],
    skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Redux Toolkit", "REST API", "Git", "Figma"],
  },
  {
    key: "madina", first: "Madina", last: "Karimova", headline: "UI/UX dizayner", region: "tashkent", born: 1999, daysAgo: 12,
    salary: 16, types: ["remote", "full_time"],
    summary: "Mobil ilovalar va SaaS mahsulotlar uchun dizayn qilaman. Tadqiqotdan boshlab dizayn tizimigacha butun jarayonni yuritaman.",
    exp: [
      { company: "Pixel Lab", position: "UI/UX dizayner", from: "2021-06", desc: "Fintech va ta'lim ilovalari, 3 ta dizayn tizimi." },
    ],
    edu: [{ institution: "Kamoliddin Behzod nomidagi Milliy rassomlik va dizayn instituti", degree: "Bakalavr", field: "Grafik dizayn", from: 2017, to: 2021 }],
    skills: ["Figma", "Prototiplash", "UX tadqiqot", "Dizayn tizimlari", "Adobe Illustrator"],
  },
  {
    key: "jasur", first: "Jasur", last: "Toshmatov", headline: "Backend dasturchi (Node.js)", region: "tashkent", born: 1995, daysAgo: 10,
    salary: 35, types: ["full_time"],
    summary: "Yuqori yuklamali backend tizimlar bo'yicha 6 yillik tajriba. To'lov shlyuzi va buyurtmalar xizmatlarini loyihalaganman.",
    exp: [
      { company: "CloudPay", position: "Senior backend dasturchi", from: "2021-01", desc: "To'lov shlyuzi: sekundiga 1500 tranzaksiya, Kafka asosidagi hodisalar arxitekturasi." },
      { company: "SoftLine", position: "Backend dasturchi", from: "2018-08", to: "2020-12" },
    ],
    edu: [{ institution: "O'zbekiston Milliy universiteti", degree: "Bakalavr", field: "Amaliy matematika", from: 2013, to: 2017 }],
    skills: ["Node.js", "NestJS", "PostgreSQL", "Redis", "Docker", "Kafka"],
  },
  {
    key: "nilufar", first: "Nilufar", last: "Rasulova", headline: "Bosh buxgalter", region: "samarqand", born: 1988, daysAgo: 9,
    salary: 18, types: ["full_time"],
    summary: "Savdo va ishlab chiqarish korxonalarida 10 yillik buxgalteriya tajribasi, MHXS bo'yicha sertifikatlangan.",
    exp: [
      { company: "Samarqand Agro Invest", position: "Bosh buxgalter", from: "2018-02", desc: "3 ta yuridik shaxs hisobini yuritish, soliq tekshiruvlarini muvaffaqiyatli o'tkazish." },
      { company: "Ziyo Savdo", position: "Buxgalter", from: "2014-05", to: "2018-01" },
    ],
    edu: [{ institution: "Samarqand iqtisodiyot va servis instituti", degree: "Magistr", field: "Buxgalteriya hisobi va audit", from: 2010, to: 2012 }],
    skills: ["1C: Buxgalteriya", "MHXS", "Soliq hisoboti", "Excel", "Audit"],
  },
  {
    key: "sardor", first: "Sardor", last: "Yusupov", headline: "Performance marketolog", region: "tashkent", born: 1997, daysAgo: 8,
    salary: 15, types: ["full_time", "remote"],
    summary: "E-commerce va ta'lim loyihalari uchun reklama kampaniyalarini boshqaraman; oylik 50 000$ gacha budjet bilan ishlaganman.",
    exp: [
      { company: "Growth Media", position: "Performance marketolog", from: "2022-01", desc: "CPO'ni 3 oyda 35% ga kamaytirish, GA4 va server-side tracking joriy qilish." },
    ],
    edu: [{ institution: "Toshkent davlat iqtisodiyot universiteti", degree: "Bakalavr", field: "Marketing", from: 2015, to: 2019 }],
    skills: ["Meta Ads", "Google Ads", "GA4", "Looker Studio", "A/B test"],
  },
  {
    key: "kamola", first: "Kamola", last: "Nazarova", headline: "Mijozlarga xizmat ko'rsatish mutaxassisi", region: "tashkent", born: 2001, daysAgo: 7,
    salary: 6, types: ["shift", "full_time"],
    summary: "Call-markaz va chat qo'llab-quvvatlashda 2 yillik tajriba, o'zbek, rus va ingliz tillarida muloqot qilaman.",
    exp: [{ company: "Mobi Aloqa", position: "Call-markaz operatori", from: "2023-04", to: "2025-06" }],
    edu: [{ institution: "O'zbekiston davlat jahon tillari universiteti", degree: "Bakalavr", field: "Ingliz filologiyasi", from: 2019, to: 2023 }],
    skills: ["CRM", "Muloqot", "Rus tili", "Ingliz tili", "Nizolarni hal qilish"],
  },
  {
    key: "bekzod", first: "Bekzod", last: "Ergashev", headline: "QA muhandis", region: "tashkent", born: 1996, daysAgo: 11,
    salary: 16, types: ["full_time"],
    summary: "Qo'lda va avtomatlashtirilgan testlash bo'yicha 3 yillik tajriba. Regressiya testlarini 2 kundan 40 daqiqaga qisqartirganman.",
    exp: [{ company: "Smart Solutions", position: "QA muhandis", from: "2022-05", desc: "Playwright'da 400+ avtotest, GitLab CI integratsiyasi." }],
    edu: [{ institution: "Inha universiteti (Toshkent)", degree: "Bakalavr", field: "Kompyuter injiniringi", from: 2014, to: 2018 }],
    skills: ["Playwright", "Postman", "SQL", "Jira", "Test dizayn"],
  },
  {
    key: "dilshod", first: "Dilshod", last: "Karimov", headline: "Qurilish muhandisi", region: "toshkent-viloyati", born: 1990, daysAgo: 13,
    salary: 17, types: ["full_time"],
    summary: "Turar-joy va ma'muriy binolar qurilishida 8 yillik tajriba: PTO, texnik nazorat va smeta.",
    exp: [{ company: "Mega Qurilish", position: "PTO muhandisi", from: "2017-03", desc: "12 qavatli 4 ta turar-joy binosi hujjatlarini yuritish." }],
    edu: [{ institution: "Toshkent arxitektura-qurilish universiteti", degree: "Bakalavr", field: "Sanoat va fuqarolik qurilishi", from: 2008, to: 2012 }],
    skills: ["AutoCAD", "Smeta", "PTO hujjatlari", "Revit", "ShNQ"],
  },
  {
    key: "shahnoza", first: "Shahnoza", last: "Abdullayeva", headline: "Mehmonxona administratori", region: "buxoro", born: 1998, daysAgo: 6,
    salary: 7, types: ["shift", "full_time"],
    summary: "Butik mehmonxonalarda 3 yillik front-ofis tajribasi, ingliz tilida erkin muloqot qilaman.",
    exp: [{ company: "Old Bukhara Inn", position: "Resepshn administratori", from: "2022-04" }],
    edu: [{ institution: "Buxoro davlat universiteti", degree: "Bakalavr", field: "Turizm", from: 2016, to: 2020 }],
    skills: ["Opera PMS", "Ingliz tili", "Bron qilish", "Mehmonlarga xizmat"],
  },
  {
    key: "otabek", first: "Otabek", last: "Rahimov", headline: "Flutter dasturchi", region: "andijon", born: 2000, daysAgo: 5,
    salary: 18, types: ["remote", "full_time"],
    summary: "Flutter'da 5 ta ilovani Google Play va App Store'ga chiqarganman. Toshkentga ko'chib o'tishga tayyorman.",
    exp: [{ company: "Freelance", position: "Mobil dasturchi", from: "2022-01", desc: "Yetkazib berish va onlayn ta'lim ilovalari, Firebase va to'lov integratsiyalari." }],
    edu: [{ institution: "Andijon davlat universiteti", degree: "Bakalavr", field: "Informatika", from: 2018, to: 2022 }],
    skills: ["Flutter", "Dart", "Firebase", "Bloc", "REST API"],
  },
  {
    key: "gulnoza", first: "Gulnoza", last: "Ismoilova", headline: "Data analitik", region: "tashkent", born: 1997, daysAgo: 4,
    salary: 20, types: ["full_time", "remote"],
    summary: "Mahsulot analitikasi va BI hisobotlar bo'yicha 3 yillik tajriba. Ma'lumotdan aniq biznes qarorlar chiqarishni yoqtiraman.",
    exp: [{ company: "Retail Data", position: "Ma'lumotlar tahlilchisi", from: "2022-09", desc: "Power BI'da 20+ dashboard, churn prognoz modeli." }],
    edu: [{ institution: "Vestminster xalqaro universiteti (Toshkent)", degree: "Bakalavr", field: "Biznes informatika", from: 2015, to: 2019 }],
    skills: ["Python", "SQL", "Power BI", "Pandas", "A/B test"],
  },
  {
    key: "javlon", first: "Javlon", last: "Mirzayev", headline: "Haydovchi-kuryer", region: "tashkent", born: 1994, daysAgo: 3,
    salary: 10, types: ["shift", "part_time"],
    summary: "Shaxsiy avtomobilim bor, Toshkentni yaxshi bilaman. 4 yil taksi va yetkazib berish xizmatlarida ishlaganman.",
    exp: [{ company: "Taxi Plus", position: "Haydovchi", from: "2020-02", to: "2024-10" }],
    edu: [],
    skills: ["B toifa", "Shahar bo'ylab navigatsiya", "Mijozlarga xizmat"],
  },
  {
    key: "zarina", first: "Zarina", last: "Qodirova", headline: "Gid-tarjimon", region: "samarqand", born: 1996, daysAgo: 2,
    salary: 12, types: ["part_time", "full_time"],
    summary: "Ingliz va fransuz tillarida ekskursiyalar o'tkazaman, 5 mavsum davomida 200 dan ortiq guruh bilan ishlaganman.",
    exp: [{ company: "Samarkand Tours", position: "Gid-tarjimon", from: "2020-03" }],
    edu: [{ institution: "Samarqand davlat chet tillar instituti", degree: "Bakalavr", field: "Tarjima nazariyasi", from: 2014, to: 2018 }],
    skills: ["Ingliz tili (C1)", "Fransuz tili (B2)", "O'zbekiston tarixi", "Guruh boshqaruvi"],
    openToWork: false,
  },
];

// ============================================================
// Arizalar, chat, sharh va boshqalar
// ============================================================

/** [nomzod, "kompaniya/vakansiya sarlavhasi", holat, necha kun oldin (0 = bugun), qo'shimcha xat?] */
const APPLICATIONS: [string, string, ApplicationStatus, number, string?][] = [
  ["seeker", "nextbrain/Frontend dasturchi (React)", "invited", 4, "Assalomu alaykum! 4 yillik React tajribam va logistika panellari ustida ishlaganim sizning mijozlaringiz uchun foydali bo'ladi deb o'ylayman."],
  ["seeker", "tafakkur/Mahsulot dizayneri (Product designer)", "accepted", 6],
  ["seeker", "payla/Product manager (to'lovlar)", "viewed", 2],
  ["seeker", "educode/Frontend mentor", "viewed", 2, "Bo'sh vaqtimda yoshlarga frontend o'rgatishni istayman, kechki darslar menga mos."],
  ["seeker", "bozor/UI/UX dizayner", "sent", 0],
  ["seeker", "nextbrain/Mobil dasturchi (Flutter)", "rejected", 7],
  ["seeker", "nextbrain/Junior Python dasturchi", "viewed", 28],
  // /applications 10 tadan ko'p bo'lsin (sahifalash) — holatlar va sanalar aralash
  ["seeker", "codecraft/Frontend dasturchi (Vue.js)", "invited", 3, "Vue va React bilan ishlaganman, Yevropa mijozlari uchun loyihalarda qatnashishni istayman."],
  ["seeker", "codecraft/React Native dasturchi", "sent", 1],
  ["seeker", "pixelmedia/UX/UI dizayner (junior)", "rejected", 3],
  ["seeker", "uzsoftlab/Data analitik (BI)", "viewed", 5],
  ["seeker", "payla/Android dasturchi (Kotlin)", "sent", 3],
  ["seeker", "tafakkur/Motion dizayner", "viewed", 9, "Motion dizaynni frontend bilan birlashtirgan loyihalarim portfoliomda bor."],
  ["jasur", "nextbrain/Senior Backend dasturchi (Node.js)", "sent", 0, "6 yillik backend tajribam bor, to'lov tizimlarida yuqori yuklama bilan ishlaganman."],
  ["bekzod", "nextbrain/QA muhandis (avtomatlashtirish)", "viewed", 2],
  ["otabek", "nextbrain/Mobil dasturchi (Flutter)", "invited", 5],
  ["gulnoza", "nextbrain/QA muhandis (avtomatlashtirish)", "sent", 1],
  ["madina", "nextbrain/Frontend dasturchi (React)", "sent", 0],
  ["otabek", "nextbrain/Frontend dasturchi (React)", "rejected", 3],
  ["nilufar", "orzubank/Bosh buxgalter", "viewed", 3],
  ["nilufar", "savdomarket/Buxgalter", "sent", 1],
  ["sardor", "bozor/Performance marketolog", "invited", 3],
  ["sardor", "brandwave/SMM menejer", "sent", 0],
  ["kamola", "bozor/Mijozlarni qo'llab-quvvatlash operatori", "accepted", 0],
  ["dilshod", "yangishahar/Qurilish muhandisi (PTO)", "viewed", 1],
  ["dilshod", "yangishahar/Prorab", "sent", 2],
  ["shahnoza", "silkroad/Mehmonxona administratori", "invited", 2],
  ["javlon", "tezyetkaz/Kuryer (avtomobilli)", "sent", 0],
  ["zarina", "registon/Gid-tarjimon (ingliz tili)", "viewed", 3],
  ["madina", "tafakkur/Mahsulot dizayneri (Product designer)", "sent", 1],
  ["madina", "bozor/UI/UX dizayner", "viewed", 5],
  ["gulnoza", "payla/Data analitik", "invited", 4],
];

const FAVORITES: [string, string][] = [
  ["seeker", "nextbrain/DevOps muhandis"],
  ["seeker", "payla/Android dasturchi (Kotlin)"],
  ["seeker", "bozor/UI/UX dizayner"],
  ["seeker", "educode/Frontend mentor"],
  ["seeker", "orzubank/Axborot xavfsizligi mutaxassisi"],
  ["seeker", "nextbrain/Senior Backend dasturchi (Node.js)"],
  ["seeker", "uzsoftlab/Backend dasturchi (Python)"],
  ["seeker", "smartretail/Onlayn-do'kon menejeri"],
  // /favorites: barcha ish turlari (smenali ham) va sahifalash (10 tadan ko'p) ko'rinsin
  ["seeker", "tezyetkaz/Logistika dispetcheri"],
  ["seeker", "silkroad/Mehmonxona administratori"],
  // Yopilgan vakansiya — "Saqlanganlar"da "Yopilgan" belgisi ko'rinsin
  ["seeker", "nextbrain/Junior Python dasturchi"],
  ["madina", "tafakkur/Motion dizayner"],
  ["gulnoza", "payla/Product manager (to'lovlar)"],
];

const REVIEW_COMMENTS = [
  "Jamoa juda do'stona, rahbariyat fikringizni tinglaydi. Maosh har doim o'z vaqtida beriladi.",
  "Ofis qulay, o'sish uchun imkoniyat ko'p. Ba'zan deadline'lar tig'iz bo'ladi, lekin jamoa yordam beradi.",
  "Ishga qabul jarayoni tez va shaffof bo'ldi, suhbatda barcha savollarimga aniq javob berishdi.",
  "Yaxshi tajriba maktabi, lekin ish hajmi katta — ba'zan qo'shimcha soatlar uchraydi.",
  "Rasmiy ishga joylashtirish, tibbiy sug'urta bor. Do'stlarimga tavsiya qilaman.",
  "Kuchli mutaxassislar bilan ishlash imkoniyati, yangi yondashuvlarni sinab ko'rishga ruxsat berishadi.",
  "Maosh bozordan biroz past, lekin jamoa va muhit buni qoplaydi.",
  "Jarayonlar hali to'liq yo'lga qo'yilmagan, ammo rahbariyat yaxshilashga harakat qilyapti.",
];

/** Kompaniya bo'yicha tasdiqlangan sharhlar reytinglari. */
const RATINGS: Record<string, number[]> = {
  nextbrain: [5, 5, 4, 5, 4],
  payla: [5, 4, 4, 5],
  bozor: [4, 3, 4, 4, 5],
  orzubank: [4, 4, 3, 4],
  brandwave: [5, 4, 4],
  tafakkur: [5, 5, 4],
  tezyetkaz: [3, 4, 4, 3],
  savdomarket: [4, 3, 4],
  silkroad: [5, 4, 5],
  registon: [5, 4],
  yangishahar: [4, 3, 4],
  grandbuild: [3, 4],
  hisobpro: [4, 5],
  educode: [5, 4, 5],
  fargonatekstil: [4, 4, 3],
};

const PENDING_REVIEWS: [string, string, number, string][] = [
  ["javlon", "tezyetkaz", 2, "Buyurtmalar kam bo'lgan kunlarda daromad sezilarli tushib ketadi, bu haqda oldindan aytishmagan."],
  ["kamola", "grandbuild", 3, "Suhbatdan keyin uzoq vaqt javob bo'lmadi."],
  ["zarina", "silkroad", 5, "Mehmonxona jamoasi bilan hamkorlik qilish juda yoqimli, hammasi professional."],
];

/** Demo maqolalar (demo-articles.ts): joriy va eski slug'lar — reset ikkalasi bo'yicha tozalaydi. */
const DEMO_ARTICLE_SLUGS = DEMO_ARTICLES.flatMap((a) => [a.slug, ...(a.previousSlugs ?? [])]);

/** "seeker" kuzatayotgan kompaniyalar (/companies?saved=1). */
const SAVED_COMPANIES = ["nextbrain", "tafakkur", "payla", "codecraft", "bozor", "orzubank"];

/** [nomzod, nom, qidiruv parametrlari, chastota, email ogohlantirish, necha kun oldin] */
const SAVED_SEARCHES: [string, string, Record<string, string | number>, "daily" | "instant", boolean, number][] = [
  ["seeker", "React — Toshkent", { text: "React", area: "tashkent" }, "daily", true, 15],
  ["seeker", "Masofaviy, 15 mln+", { employment: "remote", salary: 15_000_000 }, "instant", false, 9],
  ["seeker", "Frontend — masofaviy", { text: "Frontend", employment: "remote" }, "daily", true, 6],
  ["seeker", "UI/UX dizayner", { text: "dizayner", area: "tashkent" }, "instant", true, 2],
  ["gulnoza", "Data analitik", { text: "analitik" }, "daily", true, 3],
];

interface ConversationDef {
  /** Kompaniya kaliti yoki "admin" — admin ham nomzodga yoza oladi (qo'llab-quvvatlash) */
  employer: string;
  seeker: string;
  messages: [who: "e" | "s", text: string, hoursAgo: number, read: boolean][];
  ratings?: [who: "e" | "s", score: number, comment?: string][];
}

const CONVERSATIONS: ConversationDef[] = [
  {
    employer: "nextbrain", seeker: "seeker",
    messages: [
      ["e", "Assalomu alaykum, Aziz! Rezyumengiz bilan tanishdik — «Frontend dasturchi (React)» vakansiyasi bo'yicha suhbatga taklif qilmoqchimiz.", 80, true],
      ["s", "Va alaykum assalom! Taklif uchun rahmat, bajonidil. Qaysi kun qulay bo'ladi?", 78, true],
      ["e", "Payshanba soat 15:00 da ofisimizda yoki Google Meet orqali — qaysi biri sizga qulay?", 30, true],
      ["s", "Ofisga kela olaman. Qo'shimcha nima olib kelishim kerak?", 29, true],
      ["e", "Ofisimiz manzili xaritada: https://yandex.uz/maps/-/CDbq4ZzT — 3-qavat, qabulxonaga ismingizni ayting.", 28, true],
      ["e", "Ajoyib! Hech narsa shart emas, faqat so'nggi loyihangizdan bir-ikki misol ko'rsatsangiz yaxshi bo'ladi. Ko'rishguncha!", 2, false],
    ],
    ratings: [["s", 5, "Tez va aniq javob berishdi, suhbat jarayoni qulay."]],
  },
  {
    employer: "tafakkur", seeker: "seeker",
    messages: [
      ["e", "Aziz, test topshirig'ingiz jamoamizga juda yoqdi. Sizga taklif yuborishdan xursandmiz!", 140, true],
      ["s", "Rahmat! Shartlar bilan tanishib, ertaga javob beraman.", 138, true],
      ["e", "Albatta. Savollaringiz bo'lsa, shu yerga yozing.", 137, true],
    ],
    ratings: [["e", 5, "Mas'uliyatli, muloqotda ochiq nomzod."], ["s", 5]],
  },
  {
    employer: "payla", seeker: "seeker",
    messages: [
      ["e", "Aziz, salom! Product manager vakansiyasi bo'yicha arizangizni ko'rib chiqyapmiz. Mahsulot bilan ishlash tajribangiz haqida qisqacha yozib bera olasizmi?", 44, true],
      ["s", "Salom! Oxirgi 2 yilda dispetcherlik paneli bo'yicha mahsulot jamoasi bilan birga roadmap tuzganman, foydalanuvchi intervyularida qatnashganman.", 42, true],
      ["e", "Rahmat, jamoa bilan maslahatlashib, shu hafta ichida javob beramiz.", 18, false],
    ],
  },
  {
    employer: "codecraft", seeker: "seeker",
    messages: [
      ["e", "Assalomu alaykum! Vue.js vakansiyamiz bo'yicha onlayn suhbatga taklif qilamiz. Juma kuni soat 11:00 qulaymi?", 26, true],
      ["s", "Va alaykum assalom! Ha, juma 11:00 menga qulay.", 25, true],
      ["e", "Zo'r, havolani shu yerga yuboramiz. Suhbat taxminan 45 daqiqa davom etadi.", 4, false],
      ["e", "Suhbat havolasi: https://meet.google.com/ish-bor-codecraft — juma, 11:00. Kamerani yoqib kiring.", 3.5, false],
    ],
    ratings: [["s", 4, "Javob tez keldi."]],
  },
  {
    employer: "nextbrain", seeker: "otabek",
    messages: [
      ["e", "Otabek, salom! Flutter vakansiyamiz bo'yicha texnik suhbatga taklif qilamiz. Toshkentga kelish imkoningiz bormi?", 100, true],
      ["s", "Salom! Ha, keyingi hafta Toshkentda bo'laman. Seshanba yoki chorshanba qulay.", 96, true],
      ["s", "Yana bir savol: masofadan ishlash varianti ham ko'rib chiqiladimi?", 3, false],
    ],
  },
  {
    employer: "nextbrain", seeker: "bekzod",
    messages: [
      ["e", "Bekzod, rezyumengizni ko'rib chiqdik. Playwright'dagi tajribangiz haqida qisqacha gaplashsak bo'ladimi?", 40, true],
      ["s", "Albatta, bugun soat 18:00 dan keyin bo'shman.", 38, true],
    ],
    ratings: [["e", 5, "Kuchli texnik bilim."], ["s", 4]],
  },
  {
    employer: "bozor", seeker: "kamola",
    messages: [
      ["e", "Kamola, tabriklaymiz — siz jamoamizga qabul qilindingiz! O'qitish dushanba kuni soat 9:00 da boshlanadi.", 6, true],
      ["s", "Katta rahmat! Dushanba vaqtida boraman.", 5, true],
    ],
  },
  {
    employer: "bozor", seeker: "sardor",
    messages: [
      ["e", "Sardor, portfolioingiz qiziq ekan. Keyingi bosqich — kichik test topshirig'i. Yuborsak bo'ladimi?", 50, true],
      ["s", "Ha, yuboring, 2 kun ichida bajaraman.", 20, false],
    ],
  },
  // Admin "Xabarlar" bo'limi ham bo'sh qolmasin
  {
    employer: "admin", seeker: "kamola",
    messages: [
      ["s", "Assalomu alaykum! Profilimda telefon raqamini o'zgartira olmayapman — maydon qulflangan.", 28, true],
      ["e", "Va alaykum assalom, Kamola! Raqam Telegram orqali tasdiqlangani uchun qulflangan. Yangi raqamni Telegram bot orqali qayta tasdiqlasangiz, u avtomatik yangilanadi.", 26, true],
      ["s", "Tushundim, rahmat! Hozircha eski raqam qolaversin.", 3, false],
    ],
  },
  {
    employer: "admin", seeker: "javlon",
    messages: [
      ["e", "Javlon, salom! «Tez Yetkaz» haqidagi sharhingiz moderatsiyada. Aniq holatni (qaysi oy, qaysi filial) qo'shsangiz, tezroq ko'rib chiqamiz.", 20, true],
      ["s", "Salom! Mayli, bugun kechqurun to'ldirib qo'yaman.", 7, true],
      ["e", "Rahmat! Yangilangan sharh 24 soat ichida ko'rib chiqiladi.", 6, false],
    ],
  },
];

/** [kimga ("hr" = NextBrain egasi, "admin" yoki nomzod kaliti), turi, sarlavha, matn, havola, necha soat oldin, o'qilgan] */
type NotificationDef = [user: string, type: NotificationType, title: string, body: string, url: string, hoursAgo: number, read: boolean];

const NOTIFICATIONS: NotificationDef[] = [
  ["seeker", "application_status_changed", "Ariza holati o'zgardi", "«Frontend dasturchi (Vue.js)» bo'yicha: Suhbatga taklif qilindingiz 🎉", "/applications?status=invited", 4, false],
  ["seeker", "application_status_changed", "Ariza holati o'zgardi", "«Frontend dasturchi (React)» bo'yicha: Suhbatga taklif qilindingiz 🎉", "/applications?status=invited", 30, false],
  ["seeker", "new_vacancy_match", "\"React — Toshkent\" bo'yicha 2 ta yangi vakansiya", "Frontend dasturchi (React), Frontend mentor", "/vacancies?q=React&region=tashkent", 20, false],
  ["seeker", "system", "Suhbatga tayyorlaning", "Intervyuga tayyorgarlik bo'yicha 10 ta amaliy maslahat — maqolani o'qing.", "/articles/intervyuga-tayyorgarlik", 16, false],
  ["seeker", "application_status_changed", "Ariza holati o'zgardi", "«Data analitik (BI)» bo'yicha: Ko'rildi 👀", "/applications?status=viewed", 26, true],
  ["seeker", "application_status_changed", "Ariza holati o'zgardi", "«Product manager (to'lovlar)» bo'yicha: Ko'rildi 👀", "/applications?status=viewed", 40, true],
  ["seeker", "new_vacancy_match", "\"Frontend — masofaviy\" bo'yicha yangi vakansiya", "Frontend dasturchi (Vue.js) — CodeCraft Studio", "/vacancies?q=Frontend&employment=remote", 70, true],
  ["seeker", "application_status_changed", "Ariza holati o'zgardi", "«UX/UI dizayner (junior)» bo'yicha: Rad etildi ❌", "/applications?status=rejected", 60, true],
  ["seeker", "application_status_changed", "Ariza holati o'zgardi", "«Mahsulot dizayneri (Product designer)» bo'yicha: Qabul qilindingiz ✅", "/applications?status=accepted", 130, true],
  ["seeker", "application_status_changed", "Ariza holati o'zgardi", "«Mobil dasturchi (Flutter)» bo'yicha: Rad etildi ❌", "/applications?status=rejected", 200, true],
  ["seeker", "system", "Ish.top'ga xush kelibsiz!", "Profilingizni to'ldiring — to'liq profillar ish beruvchilarga 3 barobar ko'proq ko'rinadi.", "/profile", 500, true],
  ["hr", "new_application", "Yangi ariza", "\"Senior Backend dasturchi (Node.js)\" vakansiyasiga yangi nomzod ariza yubordi", "/employer/applications", 1, false],
  ["hr", "new_application", "Yangi ariza", "\"Frontend dasturchi (React)\" vakansiyasiga yangi nomzod ariza yubordi", "/employer/applications", 2, false],
  ["hr", "system", "Vakansiya moderatsiyada", "«UX tadqiqotchi» vakansiyasi tekshirilmoqda — odatda 1 soat ichida e'lon qilinadi.", "/employer/vacancies", 5, false],
  ["hr", "system", "Vakansiya rad etildi", "«IT stajyor»: maosh va ish vaqti ko'rsatilmagan — shartlarni to'ldirib, qayta yuboring.", "/employer/vacancies", 30, true],
  ["hr", "new_application", "Yangi ariza", "\"QA muhandis (avtomatlashtirish)\" vakansiyasiga yangi nomzod ariza yubordi", "/employer/applications", 22, true],
  ["hr", "system", "Premium tarif faollashtirildi", "Obuna 30 kunga faol: 100 tagacha vakansiya va nomzodlar bazasi ochiq.", "/pricing", 144, true],
  ["admin", "system", "Moderatsiya navbati", "3 ta vakansiya tekshiruvni kutmoqda: «UX tadqiqotchi», «Kontent menejer», «Call-markaz operatori».", "/admin/vacancies", 1, false],
  ["admin", "system", "Yangi sharhlar", "3 ta kompaniya sharhi moderatsiyani kutmoqda.", "/admin/reviews", 4, false],
  ["admin", "system", "To'lov kutilmoqda", "Grand Build Invest — Standard tarif to'lovi hali tasdiqlanmagan.", "/admin/payments", 6, false],
  ["admin", "system", "To'lov amalga oshmadi", "Registon Travel — Standard tarif to'lovi o'tmadi (Payme).", "/admin/payments", 26, true],
  ["admin", "system", "Tasdiqlanmagan kompaniyalar", "Yangi kompaniyalar hujjatlari tekshiruvni kutmoqda.", "/admin/companies", 50, true],
  ["admin", "system", "Qidiruv indeksi yangilandi", "Vakansiyalar qidiruv indeksi muvaffaqiyatli qayta qurildi.", "/admin", 120, true],
];

// ============================================================
// Umumiy yozuvchilar — demo hisoblar va `--for` hisoblari uchun bir xil
// ============================================================

interface VacancyInfo {
  id: string;
  title: string;
  companyKey: string;
  publishedAt: Date;
}

interface SeedIds {
  ownerId: Record<string, string>;
  companyId: Record<string, string>;
  regionId: Record<string, string>;
  adminId: string;
  vacancyRef: (ref: string) => VacancyInfo;
}

/** Mongo hujjatidagi qo'shimcha maydon: Prisma sxemasida yo'q, ilova uni o'qimaydi. */
const DEMO_MARK = "demo_seed";
/** Profilda seed to'ldirgan maydonlar nusxasi: { ustun: qiymat }. */
const DEMO_FILLED = "demo_filled";
const MARKED = { filter: { [DEMO_MARK]: true }, options: { projection: { _id: 1 } } };

type RawDoc = { _id: { $oid: string } } & Record<string, unknown>;
const rawIds = (rows: unknown) => (rows as RawDoc[]).map((row) => row._id.$oid);

async function markDemo(collection: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.$runCommandRaw({
    update: collection,
    updates: [{ q: { _id: { $in: ids.map((id) => ({ $oid: id })) } }, u: { $set: { [DEMO_MARK]: true } }, multi: true }],
  });
}

function seekerResumePdf(s: SeekerDef, fullName: string): Buffer {
  return resumePdf(
    fullName,
    s.headline,
    [
      { heading: "Qisqacha", lines: [s.summary] },
      {
        heading: "Ish tajribasi",
        lines: s.exp.map((e) => `${e.position} - ${e.company} (${e.from} - ${e.to ?? "hozir"})${e.desc ? `. ${e.desc}` : ""}`),
      },
      {
        heading: "Ta'lim",
        lines: s.edu.map((e) => `${e.institution}${e.degree ? `, ${e.degree}` : ""}${e.field ? ` (${e.field})` : ""}, ${e.from} - ${e.to ?? "hozir"}`),
      },
      { heading: "Ko'nikmalar", lines: [s.skills.join(", ")] },
    ].filter((section) => section.lines.length > 0)
  );
}

async function createResume(profileId: string, s: SeekerDef, createdAt: Date): Promise<string> {
  const resume = await prisma.resume.create({
    data: {
      jobSeekerId: profileId,
      title: s.headline,
      summary: s.summary,
      desiredSalary: mln(s.salary),
      currency: "UZS",
      employmentTypes: s.types,
      status: "published",
      createdAt,
    },
  });
  // Bo'sh massiv bilan createMany MongoDB'da xato beradi — faqat borida
  if (s.exp.length) {
    await prisma.resumeExperience.createMany({
      data: s.exp.map((e) => ({
        resumeId: resume.id,
        companyName: e.company,
        position: e.position,
        startDate: ym(e.from),
        endDate: e.to ? ym(e.to) : null,
        isCurrent: !e.to,
        description: e.desc,
      })),
    });
  }
  if (s.edu.length) {
    await prisma.resumeEducation.createMany({
      data: s.edu.map((e) => ({
        resumeId: resume.id,
        institution: e.institution,
        degree: e.degree,
        field: e.field,
        startYear: e.from,
        endYear: e.to,
      })),
    });
  }
  if (s.skills.length) {
    await prisma.resumeSkill.createMany({ data: s.skills.map((skillName) => ({ resumeId: resume.id, skillName })) });
  }
  return resume.id;
}

/** `seekerId`/`resumeId` — nomzod kaliti -> haqiqiy id (demo nomzod yoki `--for` hisobi). */
async function seedApplications(
  rows: typeof APPLICATIONS,
  ids: SeedIds,
  seekerId: Record<string, string>,
  resumeId: Record<string, string>
): Promise<void> {
  for (let i = 0; i < rows.length; i++) {
    const [seeker, ref, status, days, coverLetter] = rows[i];
    const v = ids.vacancyRef(ref);
    // Ariza vakansiya e'lon qilinganidan keyin va hozirdan oldin bo'lsin
    const raw = days === 0 ? today(0.5 + i * 0.3) : ago(days, between(0, 8));
    const createdAt = new Date(Math.min(NOW - 5 * 60_000, Math.max(v.publishedAt.getTime() + 30 * 60_000, raw.getTime())));
    const changedAt = new Date(
      Math.max(createdAt.getTime() + 60_000, Math.min(NOW - 60_000, createdAt.getTime() + between(2, 20) * HOUR))
    );
    const application = await prisma.application.create({
      data: {
        vacancyId: v.id,
        jobSeekerId: seekerId[seeker],
        resumeId: resumeId[seeker],
        coverLetter,
        source: i % 6 === 5 ? "telegram" : "site",
        status,
        createdAt,
      },
    });
    // sent -> (viewed) -> yakuniy holat; o'zgarishlarni ish beruvchi qiladi
    const steps: ApplicationStatus[] = ["sent"];
    if (status !== "sent" && status !== "viewed") steps.push("viewed");
    if (status !== "sent") steps.push(status);
    const employer = ids.ownerId[v.companyKey];
    await prisma.applicationStatusHistory.createMany({
      data: steps.map((newStatus, idx) => ({
        applicationId: application.id,
        oldStatus: idx === 0 ? null : steps[idx - 1],
        newStatus,
        changedBy: idx === 0 ? seekerId[seeker] : employer,
        createdAt:
          idx === 0
            ? createdAt
            : new Date(createdAt.getTime() + ((changedAt.getTime() - createdAt.getTime()) * idx) / (steps.length - 1)),
      })),
    });
  }
}

async function seedFavorites(rows: typeof FAVORITES, ids: SeedIds, seekerId: Record<string, string>): Promise<void> {
  for (const [i, [seeker, ref]] of rows.entries()) {
    await prisma.favorite.create({ data: { userId: seekerId[seeker], vacancyId: ids.vacancyRef(ref).id, createdAt: ago(i % 4, between(1, 20)) } });
  }
}

/** lastNotifiedAt = hozir: alert scheduler eski vakansiyalar uchun xabar yubormasin. */
async function seedSavedSearches(rows: typeof SAVED_SEARCHES, seekerId: Record<string, string>): Promise<string[]> {
  const created: string[] = [];
  for (const [seeker, name, queryParams, frequency, emailAlertsEnabled, days] of rows) {
    const search = await prisma.savedSearch.create({
      data: { userId: seekerId[seeker], name, queryParams, frequency, emailAlertsEnabled, lastNotifiedAt: new Date(), createdAt: ago(days) },
    });
    created.push(search.id);
  }
  return created;
}

async function seedConversations(
  defs: ConversationDef[],
  ids: SeedIds,
  seekerId: Record<string, string>,
  rename: (text: string) => string = (text) => text
): Promise<void> {
  for (const conv of defs) {
    const isAdmin = conv.employer === "admin";
    const employerUserId = isAdmin ? ids.adminId : ids.ownerId[conv.employer];
    const seekerUserId = seekerId[conv.seeker];
    const lastAt = ago(0, Math.min(...conv.messages.map((m) => m[2])));
    const created = await prisma.conversation.create({
      data: {
        employerUserId,
        seekerUserId,
        companyId: isAdmin ? null : ids.companyId[conv.employer],
        createdAt: ago(0, conv.messages[0][2]),
        updatedAt: lastAt,
      },
    });
    await prisma.message.createMany({
      data: conv.messages.map(([who, body, hoursAgo, read]) => ({
        conversationId: created.id,
        senderId: who === "e" ? employerUserId : seekerUserId,
        body: rename(body),
        isRead: read,
        createdAt: ago(0, hoursAgo),
      })),
    });
    for (const [who, score, comment] of conv.ratings ?? []) {
      await prisma.peerRating.create({
        data: {
          conversationId: created.id,
          raterUserId: who === "e" ? employerUserId : seekerUserId,
          ratedUserId: who === "e" ? seekerUserId : employerUserId,
          score,
          comment,
        },
      });
    }
  }
}

/** payload.url — bildirishnomadagi havola. */
async function seedNotifications(rows: NotificationDef[], userIdOf: (key: string) => string): Promise<string[]> {
  const created: string[] = [];
  for (const [user, type, title, body, url, hoursAgo, isRead] of rows) {
    const notification = await prisma.notification.create({
      data: { userId: userIdOf(user), type, title, body, payload: { url }, isRead, createdAt: ago(0, hoursAgo) },
    });
    created.push(notification.id);
  }
  return created;
}

// ============================================================
// O'chirish
// ============================================================

async function resetDemo(): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const companyIds = (await prisma.company.findMany({ where: { ownerUserId: { in: userIds } }, select: { id: true } })).map((c) => c.id);
  const vacancyIds = (await prisma.vacancy.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } })).map((v) => v.id);
  const applicationIds = (
    await prisma.application.findMany({
      where: { OR: [{ vacancyId: { in: vacancyIds } }, { jobSeekerId: { in: userIds } }] },
      select: { id: true },
    })
  ).map((a) => a.id);
  // `--for` hisoblari: seed yaratgan profil (faqat hisobda profil bo'lmagan bo'lsa) va rezyumelar
  const profileIds = [
    ...(await prisma.jobSeekerProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((p) => p.id),
    ...rawIds(await prisma.jobSeekerProfile.findRaw(MARKED)),
  ];
  const resumeIds = [
    ...(await prisma.resume.findMany({ where: { jobSeekerId: { in: profileIds } }, select: { id: true } })).map((r) => r.id),
    ...rawIds(await prisma.resume.findRaw(MARKED)),
  ];
  const conversationIds = (
    await prisma.conversation.findMany({
      where: { OR: [{ employerUserId: { in: userIds } }, { seekerUserId: { in: userIds } }, { companyId: { in: companyIds } }] },
      select: { id: true },
    })
  ).map((c) => c.id);

  // Tartib muhim: MongoDB'da bog'lanishlarni Prisma emulyatsiya qiladi,
  // shuning uchun avval bolalar, keyin ota yozuvlar o'chiriladi.
  await prisma.applicationStatusHistory.deleteMany({
    where: { OR: [{ applicationId: { in: applicationIds } }, { changedBy: { in: userIds } }] },
  });
  await prisma.application.deleteMany({ where: { id: { in: applicationIds } } });
  await prisma.favorite.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { vacancyId: { in: vacancyIds } }] } });
  await prisma.savedCompany.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { companyId: { in: companyIds } }] } });
  await prisma.message.deleteMany({ where: { OR: [{ conversationId: { in: conversationIds } }, { senderId: { in: userIds } }] } });
  await prisma.peerRating.deleteMany({
    where: { OR: [{ conversationId: { in: conversationIds } }, { raterUserId: { in: userIds } }, { ratedUserId: { in: userIds } }] },
  });
  await prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } });
  // Moderatsiya jurnali, murojaatlar va ommaviy xabarlar tarixi (demo obyektlar yoki demo xodimlar bo'yicha)
  const reviewIds = (
    await prisma.companyReview.findMany({ where: { OR: [{ companyId: { in: companyIds } }, { userId: { in: userIds } }] }, select: { id: true } })
  ).map((r) => r.id);
  const ticketIds = (
    await prisma.supportTicket.findMany({
      where: {
        OR: [{ userId: { in: userIds } }, { vacancyId: { in: vacancyIds } }, { handledById: { in: userIds } }, { email: { endsWith: DOMAIN } }],
      },
      select: { id: true },
    })
  ).map((t) => t.id);
  await prisma.moderationEvent.deleteMany({
    where: { OR: [{ actorId: { in: userIds } }, { entityId: { in: [...vacancyIds, ...companyIds, ...reviewIds, ...ticketIds] } }] },
  });
  await prisma.supportTicket.deleteMany({ where: { id: { in: ticketIds } } });
  await prisma.broadcast.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.companyReview.deleteMany({ where: { OR: [{ companyId: { in: companyIds } }, { userId: { in: userIds } }] } });
  await prisma.payment.deleteMany({ where: { OR: [{ companyId: { in: companyIds } }, { transactionId: { startsWith: "demo-" } }] } });
  await prisma.companyMember.deleteMany({ where: { OR: [{ companyId: { in: companyIds } }, { userId: { in: userIds } }] } });
  await prisma.vacancy.deleteMany({ where: { id: { in: vacancyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  // Haqiqiy vakansiyaga demo rezyume bilan yuborilgan ariza qolsa — rezyumesiz qoladi
  await prisma.application.updateMany({ where: { resumeId: { in: resumeIds } }, data: { resumeId: null } });
  await prisma.resumeExperience.deleteMany({ where: { resumeId: { in: resumeIds } } });
  await prisma.resumeEducation.deleteMany({ where: { resumeId: { in: resumeIds } } });
  await prisma.resumeSkill.deleteMany({ where: { resumeId: { in: resumeIds } } });
  await prisma.resume.deleteMany({ where: { id: { in: resumeIds } } });
  await prisma.jobSeekerProfile.deleteMany({ where: { id: { in: profileIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.notificationPreference.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.savedSearch.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.pushSubscription.deleteMany({ where: { userId: { in: userIds } } });

  // `--for` hisoblari: belgili bildirishnoma va saqlangan qidiruvlar, profilda
  // seed to'ldirgan maydonlar (foydalanuvchi keyin o'zgartirganlariga tegilmaydi)
  await prisma.$runCommandRaw({ delete: "notifications", deletes: [{ q: { [DEMO_MARK]: true }, limit: 0 }] });
  await prisma.$runCommandRaw({ delete: "saved_searches", deletes: [{ q: { [DEMO_MARK]: true }, limit: 0 }] });
  const filledProfiles = (await prisma.jobSeekerProfile.findRaw({ filter: { [DEMO_FILLED]: { $exists: true } } })) as unknown as RawDoc[];
  for (const doc of filledProfiles) {
    const filled = (doc[DEMO_FILLED] ?? {}) as Record<string, unknown>;
    const untouched = Object.keys(filled).filter((column) => JSON.stringify(doc[column]) === JSON.stringify(filled[column]));
    await prisma.$runCommandRaw({
      update: "job_seeker_profiles",
      updates: [{ q: { _id: { $oid: doc._id.$oid } }, u: { $unset: Object.fromEntries([...untouched, DEMO_FILLED].map((column) => [column, ""])) } }],
    });
  }
  await prisma.article.deleteMany({
    where: { OR: [{ slug: { in: DEMO_ARTICLE_SLUGS } }, { previousSlugs: { hasSome: DEMO_ARTICLE_SLUGS } }, { authorId: { in: userIds } }] },
  });
  await prisma.staffInvite.deleteMany({ where: { OR: [{ invitedById: { in: userIds } }, { email: { endsWith: DOMAIN } }] } });
  await prisma.staffProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  const files = await removeDemoFiles();

  console.log(
    `Demo ma'lumot o'chirildi: ${userIds.length} foydalanuvchi, ${companyIds.length} kompaniya, ${vacancyIds.length} vakansiya, ${files} fayl.`
  );
}

// ============================================================
// Yaratish
// ============================================================

async function createDemo(): Promise<SeedIds> {
  await ensureCatalog();
  await ensurePlans();

  const regionId = Object.fromEntries((await prisma.region.findMany({ select: { slug: true, id: true } })).map((r) => [r.slug, r.id]));
  const categoryId = Object.fromEntries((await prisma.vacancyCategory.findMany({ select: { slug: true, id: true } })).map((c) => [c.slug, c.id]));
  const plans = await prisma.subscriptionPlan.findMany({ select: { slug: true, id: true, price: true } });
  const plan = Object.fromEntries(plans.map((p) => [p.slug, p]));

  const passwordHash = await argon2.hash(PASSWORD);
  let phoneSeq = 1_000_000;
  const nextPhone = () => `+99890${String(phoneSeq++).slice(-7)}`;

  // ---- Ish beruvchilar va kompaniyalar ----
  const ownerId: Record<string, string> = {};
  const companyId: Record<string, string> = {};
  const companyImages: Record<string, string[]> = {};
  for (const [ci, c] of COMPANIES.entries()) {
    const createdAt = ago(c.ownerDaysAgo);
    // Logo va ofis/jamoa rasmlari — har kompaniyada (asosiylarida 1–6, qo'shimchalarida 1–3)
    const hue = (ci * 47 + 12) % 360;
    const photoCount = ci < MAIN_COMPANY_COUNT ? GALLERY_SIZES[ci % GALLERY_SIZES.length] : 1 + (ci % 3);
    const logoUrl = await writeDemoFile(`logo-${c.key}.svg`, logoSvg(c.name, hue, ci));
    const images = await Promise.all(
      Array.from({ length: photoCount }, (_, k) =>
        writeDemoFile(`photo-${c.key}-${k + 1}.svg`, sceneSvg(SCENES[(ci + k) % SCENES.length], hue))
      )
    );
    companyImages[c.key] = images;
    const owner = await prisma.user.create({
      data: {
        email: `${c.owner}${DOMAIN}`,
        passwordHash,
        role: "employer",
        phone: nextPhone(),
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt,
      },
    });
    ownerId[c.key] = owner.id;
    const company = await prisma.company.create({
      data: {
        ownerUserId: owner.id,
        name: c.name,
        legalName: `"${c.name}" MChJ`,
        slug: slugifyText(c.name),
        logoUrl,
        images,
        website: `https://${slugifyText(c.name)}.example`,
        description: c.description,
        industry: c.industry,
        employeeCount: c.employees,
        foundedYear: c.founded,
        regionId: regionId[c.region],
        isVerified: c.verified,
        subscriptionPlanId: c.plan ? plan[c.plan].id : null,
        subscriptionExpiresAt: c.plan ? ahead(c.planDaysLeft ?? 30) : null,
        createdAt: new Date(createdAt.getTime() + HOUR),
        members: { create: { userId: owner.id, role: "owner", createdAt } },
      },
    });
    companyId[c.key] = company.id;
  }

  // ---- Vakansiyalar ----
  const vacancy: Record<string, { id: string; title: string; companyKey: string; publishedAt: Date }> = {};
  for (let i = 0; i < VACANCIES.length; i++) {
    const v = VACANCIES[i];
    const company = COMPANIES.find((c) => c.key === v.c)!;
    const status = v.status ?? "active";
    const published = status === "active" || status === "archived";
    const publishedAt = v.days === 0 ? today(1 + (i % 5)) : ago(v.days, between(1, 10));
    const created = await prisma.vacancy.create({
      data: {
        companyId: companyId[v.c],
        title: v.title,
        slug: `${slugifyText(v.title).slice(0, 60).replace(/-+$/, "")}-${(0x5eed0000 + i).toString(16)}`,
        description: v.desc,
        requirements: v.req.join("\n"),
        conditions: company.perks.join("\n"),
        categoryId: categoryId[v.cat],
        regionId: regionId[v.region ?? company.region],
        employmentType: v.type,
        scheduleType: v.schedule,
        experienceRequired: v.exp,
        salaryMin: v.min !== undefined ? mln(v.min) : null,
        salaryMax: v.max !== undefined ? mln(v.max) : null,
        isSalaryHidden: v.hidden ?? false,
        applyWithoutResume: v.noResume ?? false,
        // Ish joyi rasmlari (kompaniya rasmlaridan) va aloqa emaili (`.example`)
        images: (companyImages[v.c] ?? []).slice(0, isMainCompany(v.c) ? 1 + (i % 4) : 1),
        contactEmail: isMainCompany(v.c) ? `hr@${slugifyText(company.name)}.example` : null,
        status,
        isPremium: v.premium ?? false,
        isUrgent: v.urgent ?? false,
        rejectionReason: v.rejection,
        publishedAt: published ? publishedAt : null,
        expiresAt: published ? new Date(publishedAt.getTime() + 30 * DAY) : null,
        viewsCount: published ? between(20, 90) + Math.round(between(15, 60) * Math.max(1, v.days)) : 0,
        createdAt: new Date(publishedAt.getTime() - HOUR),
      },
    });
    vacancy[`${v.c}/${v.title}`] = { id: created.id, title: v.title, companyKey: v.c, publishedAt };
  }
  const vacancyRef = (ref: string) => {
    const found = vacancy[ref];
    if (!found) throw new Error(`Demo seed: vakansiya topilmadi — ${ref}`);
    return found;
  };

  // ---- Nomzodlar va rezyumelar ----
  const seekerId: Record<string, string> = {};
  const resumeId: Record<string, string> = {};
  for (const [si, s] of SEEKERS.entries()) {
    const createdAt = ago(s.daysAgo, between(1, 12));
    // Avatar va PDF rezyume — profil, nomzodlar bazasi va arizalarda ko'rinadi
    const avatarUrl = await writeDemoFile(`avatar-${s.key}.svg`, avatarSvg(s.first, s.last, (si * 61 + 200) % 360));
    const resumeUrl = await writeDemoFile(`resume-${s.key}.pdf`, seekerResumePdf(s, `${s.first} ${s.last}`));
    const user = await prisma.user.create({
      data: {
        email: `${s.key}${DOMAIN}`,
        passwordHash,
        role: "job_seeker",
        phone: nextPhone(),
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt,
        jobSeekerProfile: {
          create: {
            firstName: s.first,
            lastName: s.last,
            headline: s.headline,
            birthDate: new Date(Date.UTC(s.born, between(0, 11), between(1, 28))),
            regionId: regionId[s.region],
            isOpenToWork: s.openToWork ?? true,
            avatarUrl,
            resumeUrl,
          },
        },
      },
      include: { jobSeekerProfile: true },
    });
    seekerId[s.key] = user.id;
    resumeId[s.key] = await createResume(user.jobSeekerProfile!.id, s, new Date(createdAt.getTime() + HOUR));
  }

  // ---- Admin (moderatsiya, foydalanuvchilar, to'lovlar, qo'llab-quvvatlash chati) ----
  const admin = await prisma.user.create({
    data: {
      email: `admin${DOMAIN}`,
      passwordHash,
      role: "admin",
      phone: nextPhone(),
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: ago(90),
      // Super admin ham kontent jamoasi rahbari — maqolalarda muallif belgisi shu profildan
      staffProfile: { create: DEMO_ADMIN_PROFILE },
    },
  });
  const ids: SeedIds = { ownerId, companyId, regionId, adminId: admin.id, vacancyRef };

  // ---- Arizalar, saqlanganlar, obunalar ----
  await seedApplications(APPLICATIONS, ids, seekerId, resumeId);
  await seedFavorites(FAVORITES, ids, seekerId);
  await prisma.savedCompany.createMany({
    data: SAVED_COMPANIES.map((key, i) => ({ userId: seekerId.seeker, companyId: companyId[key], createdAt: ago(i + 1) })),
  });
  await seedSavedSearches(SAVED_SEARCHES, seekerId);

  // ---- Chat ----
  await seedConversations(CONVERSATIONS, ids, seekerId);

  // ---- Kompaniya sharhlari ----
  // Har bir sharh boshqa foydalanuvchidan (unique: companyId + userId)
  const reviewers = SEEKERS.map((s) => s.key);
  let commentIdx = 0;
  // Qo'shimcha kompaniyalar: 0–4 ta sharh (ba'zilarida sharh yo'q — bo'sh holat ham ko'rinsin)
  const extraRatings = Object.fromEntries(
    EXTRA_COMPANIES.map(([key], i) => [key, Array.from({ length: i % 5 }, (_, j) => 3 + ((i + j * 2) % 3))])
  );
  for (const [key, values] of Object.entries({ ...RATINGS, ...extraRatings })) {
    for (let i = 0; i < values.length; i++) {
      await prisma.companyReview.create({
        data: {
          companyId: companyId[key],
          userId: seekerId[reviewers[(i + key.length) % reviewers.length]],
          rating: values[i],
          comment: REVIEW_COMMENTS[commentIdx++ % REVIEW_COMMENTS.length],
          status: "approved",
          createdAt: ago(between(2, 40)),
        },
      });
    }
  }
  for (const [seeker, key, rating, comment] of PENDING_REVIEWS) {
    await prisma.companyReview.upsert({
      where: { companyId_userId: { companyId: companyId[key], userId: seekerId[seeker] } },
      update: { rating, comment, status: "pending", createdAt: ago(0, between(2, 20)), submittedAt: ago(0, between(1, 20)) },
      create: {
        companyId: companyId[key],
        userId: seekerId[seeker],
        rating,
        comment,
        status: "pending",
        createdAt: ago(0, between(2, 20)),
        submittedAt: ago(0, between(1, 20)),
      },
    });
  }

  // ---- To'lovlar ----
  let txSeq = 0;
  const payments: [company: string, planSlug: PlanSlug, status: "paid" | "pending" | "failed", days: number, provider: "payme" | "click"][] = [
    ["nextbrain", "premium", "paid", 6, "payme"],
    ["nextbrain", "standard", "paid", 36, "click"],
    ["orzubank", "premium", "paid", 3, "click"],
    ["payla", "standard", "paid", 12, "payme"],
    ["bozor", "standard", "paid", 20, "payme"],
    ["brandwave", "standard", "paid", 9, "click"],
    ["tezyetkaz", "standard", "paid", 15, "payme"],
    ["savdomarket", "standard", "paid", 18, "click"],
    ["yangishahar", "standard", "paid", 22, "payme"],
    ["grandbuild", "standard", "pending", 0, "click"],
    ["registon", "standard", "failed", 1, "payme"],
  ];
  for (const [key, planSlug, status, days, provider] of payments) {
    const createdAt = days === 0 ? today(3) : ago(days, between(1, 6));
    await prisma.payment.create({
      data: {
        companyId: companyId[key],
        planId: plan[planSlug].id,
        amount: plan[planSlug].price,
        status,
        provider,
        transactionId: `demo-${(++txSeq).toString().padStart(4, "0")}-${key}`,
        paidAt: status === "paid" ? new Date(createdAt.getTime() + 2 * 60_000) : null,
        createdAt,
      },
    });
  }

  // ---- Kontent jamoasi (/admin/articles, /admin/team) ----
  const staffId: Record<string, string> = { admin: admin.id };
  for (const s of DEMO_STAFF) {
    const [first, last = ""] = s.fullName.split(" ");
    const avatarUrl = s.avatarHue === null ? null : await writeDemoFile(`avatar-staff-${s.key}.svg`, avatarSvg(first, last, s.avatarHue));
    const user = await prisma.user.create({
      data: {
        email: `${s.key}${DOMAIN}`,
        passwordHash,
        role: s.role,
        isEmailVerified: true,
        isBlocked: s.blocked ?? false,
        createdAt: ago(s.daysAgo),
        staffProfile: { create: { fullName: s.fullName, position: s.position, avatarUrl } },
      },
    });
    staffId[s.key] = user.id;
  }
  // Takliflar: token tasodifiy va saqlanmaydi — havolasi ishlamaydi, faqat ro'yxatda ko'rinadi
  for (const invite of DEMO_INVITES) {
    await prisma.staffInvite.create({
      data: {
        email: `${invite.local}${DOMAIN}`,
        role: invite.role,
        tokenHash: crypto.randomBytes(32).toString("hex"),
        invitedById: admin.id,
        createdAt: ago(invite.daysAgo),
        expiresAt: new Date(NOW + invite.expiresInDays * DAY),
      },
    });
  }

  // ---- Maqolalar (muqovalar — berilgan referens rasmlar, uploads/demo-article-*) ----
  const coverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "assets", "articles");
  const coverUrl = Object.fromEntries(
    await Promise.all(
      DEMO_COVERS.map(async (cover) => [
        cover,
        await writeDemoFile(coverFileName(cover), fs.readFileSync(path.join(coverDir, `${cover}.webp`))),
      ])
    )
  );
  for (const a of DEMO_ARTICLES) {
    const publishedAt = a.status === "published" || a.status === "archived" ? ago(a.days, 3) : null;
    const touched = publishedAt ?? ago(0, 6);
    await prisma.article.create({
      data: {
        slug: a.slug,
        previousSlugs: a.previousSlugs ?? [],
        title: a.title,
        excerpt: a.excerpt,
        content: a.content,
        coverImageUrl: a.cover ? coverUrl[a.cover] : null,
        category: a.category,
        tags: a.tags,
        authorId: a.author ? staffId[a.author] : null,
        status: a.status,
        reviewNote: a.reviewNote ?? null,
        metaDescription: a.meta ?? null,
        viewsCount: a.views,
        helpfulYes: a.helpful[0],
        helpfulNo: a.helpful[1],
        publishedAt,
        createdAt: new Date(touched.getTime() - 2 * DAY),
        updatedAt: a.status === "archived" ? ago(12) : touched,
        ...articleDerived({ title: a.title, excerpt: a.excerpt, content: a.content, tags: a.tags, category: a.category }),
      },
    });
  }


  // ---- Moderatsiya: navbat muddatlari, jurnal, murojaatlar, tasdiq so'rovlari, ommaviy xabarlar ----
  await seedModeration(ids, seekerId, staffId);

  // ---- Bildirishnomalar ----
  await seedNotifications(NOTIFICATIONS, (key) => (key === "hr" ? ownerId.nextbrain : key === "admin" ? admin.id : seekerId[key]));

  const active = VACANCIES.filter((v) => (v.status ?? "active") === "active").length;
  console.log(
    `Demo ma'lumot yaratildi: ${COMPANIES.length} kompaniya, ${VACANCIES.length} vakansiya (${active} faol), ` +
      `${SEEKERS.length} nomzod, ${APPLICATIONS.length} ariza, ${CONVERSATIONS.length} suhbat, ` +
      `${DEMO_ARTICLES.filter((a) => a.status === "published").length} maqola (+${DEMO_ARTICLES.filter((a) => a.status !== "published").length} admin holatida).`
  );
  console.log(`\nKirish (parol: ${PASSWORD}):`);
  console.log(`  Nomzod        seeker${DOMAIN}`);
  console.log(`  Ish beruvchi  hr${DOMAIN}   (NextBrain, Premium)`);
  console.log(`  Admin         admin${DOMAIN}   (super admin: panel, maqolalar, jamoa)`);
  console.log(`  Muharrir      editor${DOMAIN}   (maqolalarni ko'rib chiqadi va chop etadi)`);
  console.log(`  Muallif       author${DOMAIN}   (qoralama yozadi, ko'rib chiqishga yuboradi)`);
  console.log(`  Moderator     moderator${DOMAIN}   (vakansiya/sharh navbati, kompaniya tasdig'i, murojaatlar)`);
  return ids;
}

/**
 * Moderatsiya bo'limlari demo hisoblarda bo'sh ko'rinmasin: navbatdagi e'lonlarning turli avto-tasdiq
 * muddatlari, avto-tasdiqlangan (tekshirilmagan) e'lonlar, qarorlar jurnali, murojaatlar qutisi,
 * kompaniya tasdiq so'rovlari va ommaviy xabarlar tarixi.
 */
async function seedModeration(ids: SeedIds, seekerId: Record<string, string>, staffId: Record<string, string>): Promise<void> {
  const { companyId, adminId } = ids;
  const moderatorId = staffId.moderator ?? adminId;

  // Navbat: har xil kutish vaqti — "3 soatdan keyin avto-tasdiq", "20 soatdan keyin" va h.k.
  const queued = await prisma.vacancy.findMany({ where: { companyId: { in: Object.values(companyId) }, status: "moderation" }, select: { id: true } });
  const waits = [21, 9, 2];
  for (const [i, v] of queued.entries()) {
    const submitted = ago(0, waits[i % waits.length]);
    await prisma.vacancy.update({ where: { id: v.id }, data: { moderationSubmittedAt: submitted, createdAt: new Date(submitted.getTime() - 10 * 60_000) } });
  }

  // Avto-tasdiqlangan, admin hali ko'rmagan e'lonlar (tasdiqlanmagan kompaniyalardan)
  const autoApproved = await prisma.vacancy.findMany({
    where: { companyId: { in: [companyId.brandwave, companyId.tafakkur, companyId.grandbuild] }, status: "active" },
    select: { id: true, title: true, company: { select: { name: true } } },
    take: 2,
  });
  for (const [i, v] of autoApproved.entries()) {
    const at = ago(0, 4 + i * 7);
    await prisma.vacancy.update({ where: { id: v.id }, data: { autoApprovedAt: at, moderationSubmittedAt: new Date(at.getTime() - DAY) } });
    await prisma.moderationEvent.create({
      data: { entityType: "vacancy", entityId: v.id, action: "auto_approved", meta: { title: v.title, company: v.company.name }, createdAt: at },
    });
  }

  // Qarorlar jurnali: admin va moderator qarorlari
  const decided = await prisma.vacancy.findMany({
    where: { companyId: { in: Object.values(companyId) }, status: { in: ["active", "rejected", "archived"] }, OR: [{ autoApprovedAt: null }, { autoApprovedAt: { isSet: false } }] },
    select: { id: true, title: true, status: true, rejectionReason: true, company: { select: { name: true } } },
    take: 12,
  });
  for (const [i, v] of decided.entries()) {
    const action = v.status === "active" ? "approved" : v.status;
    await prisma.moderationEvent.create({
      data: {
        entityType: "vacancy",
        entityId: v.id,
        action,
        actorId: i % 3 === 0 ? moderatorId : adminId,
        reason: v.status === "rejected" ? v.rejectionReason : null,
        meta: { title: v.title, company: v.company.name },
        createdAt: ago(1 + i * 2, between(1, 8)),
      },
    });
  }
  const reviews = await prisma.companyReview.findMany({
    where: { companyId: { in: Object.values(companyId) }, status: "approved" },
    select: { id: true, rating: true, company: { select: { name: true } } },
    take: 4,
  });
  for (const [i, r] of reviews.entries()) {
    await prisma.moderationEvent.create({
      data: {
        entityType: "review",
        entityId: r.id,
        action: "approved",
        actorId: moderatorId,
        meta: { company: r.company.name, rating: r.rating },
        createdAt: ago(3 + i * 4, 2),
      },
    });
  }
  for (const key of ["nextbrain", "payla", "orzubank"]) {
    const c = await prisma.company.findUnique({ where: { id: companyId[key] }, select: { name: true } });
    await prisma.moderationEvent.create({
      data: { entityType: "company", entityId: companyId[key], action: "verified", actorId: adminId, meta: { company: c?.name ?? key }, createdAt: ago(40 + key.length) },
    });
  }

  // Tasdiq so'rovlari: biri kutilmoqda, biri avval rad etilgan (izoh bilan)
  await prisma.company.update({
    where: { id: companyId.tafakkur },
    data: { legalName: "«Tafakkur Ta'lim» MChJ", stir: "306512874", verificationRequestedAt: ago(0, 6), verificationNote: null },
  });
  await prisma.company.update({
    where: { id: companyId.grandbuild },
    data: {
      legalName: "«Grand Build» MChJ",
      stir: "307001245",
      verificationRequestedAt: null,
      verificationNote: "STIR yuridik nomga mos kelmadi — guvohnomadagi nomni kiriting.",
    },
  });
  await prisma.moderationEvent.create({
    data: {
      entityType: "company",
      entityId: companyId.grandbuild,
      action: "verification_rejected",
      actorId: moderatorId,
      reason: "STIR yuridik nomga mos kelmadi — guvohnomadagi nomni kiriting.",
      meta: { company: "Grand Build" },
      createdAt: ago(2, 3),
    },
  });

  // Murojaatlar: aloqa formasi va vakansiya shikoyatlari (turli holatlarda)
  const reported = await prisma.vacancy.findMany({
    where: { companyId: { in: [companyId.brandwave, companyId.registon, companyId.tezyetkaz] }, status: "active" },
    select: { id: true },
    take: 2,
  });
  const tickets: Parameters<typeof prisma.supportTicket.create>[0]["data"][] = [
    { kind: "contact", subject: "technical", name: "Aziz", email: `seeker${DOMAIN}`, userId: seekerId.seeker, message: "Rezyumeni PDF qilib yuklab bo'lmayapti — sahifa qotib qolyapti.", status: "open", createdAt: ago(0, 3) },
    { kind: "contact", subject: "partnership", name: "Madina Yusupova", email: "madina@hamkor.example", message: "Universitetimiz bitiruvchilari uchun karyera kuni o'tkazmoqchimiz, hamkorlik qilsak bo'ladimi?", status: "in_progress", adminNote: "Marketing bilan gaplashildi, javob yozamiz", handledById: adminId, createdAt: ago(1, 5) },
    { kind: "contact", subject: "suggestion", name: "Kamola", email: `kamola${DOMAIN}`, userId: seekerId.kamola, message: "Maosh bo'yicha filtrda \"qo'lga\" va \"yalpi\" ni ajratib qo'yish mumkinmi?", status: "resolved", adminNote: "Rejaga qo'shildi", handledById: moderatorId, handledAt: ago(3), createdAt: ago(5) },
    ...(reported[0]
      ? [
          { kind: "vacancy_report" as const, subject: "fraud", message: "Ishga olishdan oldin \"forma uchun\" 300 ming so'm to'lashni so'rashdi.", vacancyId: reported[0].id, userId: seekerId.javlon, status: "open" as const, createdAt: ago(0, 2) },
          { kind: "vacancy_report" as const, subject: "wrong", message: "Maosh e'londagidan ikki baravar kam ekan.", vacancyId: reported[0].id, email: "anonim@pochta.example", status: "open" as const, createdAt: ago(0, 9) },
        ]
      : []),
    ...(reported[1]
      ? [{ kind: "vacancy_report" as const, subject: "outdated", message: "Bu vakansiya allaqachon yopilgan, telefon qilganimda aytishdi.", vacancyId: reported[1].id, userId: seekerId.zarina, status: "dismissed" as const, adminNote: "Kompaniya e'lon faol ekanini tasdiqladi", handledById: moderatorId, handledAt: ago(1), createdAt: ago(2) }]
      : []),
  ];
  for (const data of tickets) {
    const t = await prisma.supportTicket.create({ data });
    if (data.status === "resolved" || data.status === "dismissed") {
      await prisma.moderationEvent.create({
        data: {
          entityType: "ticket",
          entityId: t.id,
          action: "ticket_status",
          actorId: data.handledById ?? moderatorId,
          reason: data.adminNote ?? null,
          meta: { from: "open", to: data.status, kind: data.kind, subject: (data.subject as string | null | undefined) ?? null },
          createdAt: (data.handledAt as Date | undefined) ?? ago(1),
        },
      });
    }
  }

  // Ommaviy xabarlar tarixi
  await prisma.broadcast.createMany({
    data: [
      { title: "Yangi funksiya: saqlangan qidiruvlar", body: "Endi qidiruvni saqlab, mos vakansiyalar haqida xabar olishingiz mumkin.", audience: "job_seeker", url: "/alerts", actorId: adminId, total: 42, delivered: 42, status: "done", createdAt: ago(6), finishedAt: ago(6) },
      { title: "Kompaniya tasdig'i", body: "Tasdiqlangan ish beruvchilar e'lonlari moderatsiyasiz chiqadi — profil sahifasidan so'rov yuboring.", audience: "employer", url: "/profile", actorId: adminId, total: 18, delivered: 18, status: "done", createdAt: ago(2), finishedAt: ago(2) },
    ],
  });
}

// ============================================================
// --for: mavjud nomzod hisobini to'ldirish
// ============================================================

function accountArgs(argv: string[]): string[] {
  const emails: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--for" && argv[i + 1]) emails.push(argv[++i]);
    else if (argv[i].startsWith("--for=")) emails.push(argv[i].slice("--for=".length));
  }
  return emails;
}

async function findAccount(email: string) {
  const trimmed = email.trim();
  if (trimmed.toLowerCase().endsWith(DOMAIN)) throw new Error(`--for ${email}: bu demo hisob — u allaqachon to'la.`);
  const user = await prisma.user.findFirst({
    where: { email: { in: [trimmed, trimmed.toLowerCase()] } },
    select: { id: true, email: true, role: true },
  });
  if (!user) throw new Error(`--for ${email}: bunday hisob topilmadi.`);
  if (user.role !== "job_seeker") {
    throw new Error(
      `--for ${email}: hisob roli "${user.role}". Hozircha faqat nomzod hisobi to'ldiriladi — ` +
        `ish beruvchi tomonini hr${DOMAIN}, admin panelni admin${DOMAIN} bilan ko'ring.`
    );
  }
  return user;
}

/**
 * Demo nomzod "seeker" ning barcha bo'limlarini (arizalar, saqlanganlar, obunalar,
 * chat, bildirishnomalar, rezyume) mavjud nomzod hisobiga ham yozadi.
 */
async function attachToAccount(email: string, ids: SeedIds): Promise<void> {
  const account = await findAccount(email);
  const def = SEEKERS.find((s) => s.key === "seeker")!;
  const loadProfile = () =>
    prisma.jobSeekerProfile.findUnique({
      where: { userId: account.id },
      include: {
        resumes: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            createdAt: true,
            summary: true,
            experience: { select: { id: true }, take: 1 },
            education: { select: { id: true }, take: 1 },
            skills: { select: { id: true }, take: 1 },
          },
        },
      },
    });

  let profile = await loadProfile();
  if (!profile) {
    // Hisobda profil yo'q edi — seed yaratadi, reset uni butunlay o'chiradi
    const created = await prisma.jobSeekerProfile.create({ data: { userId: account.id, firstName: def.first, lastName: def.last } });
    await markDemo("job_seeker_profiles", [created.id]);
    profile = (await loadProfile())!;
  }
  const firstName = profile.firstName || def.first;
  const fullName = [firstName, profile.lastName].filter(Boolean).join(" ");

  // Profil: faqat bo'sh maydonlar to'ldiriladi; nusxasi DEMO_FILLED ga — reset shu bo'yicha bo'shatadi
  const filled: Record<string, Prisma.InputJsonValue> = {};
  if (!profile.headline) filled.headline = def.headline;
  if (!profile.regionId) filled.region_id = { $oid: ids.regionId[def.region] };
  if (!profile.birthDate) filled.birth_date = { $date: new Date(Date.UTC(def.born, 4, 14)).toISOString() };
  if (!profile.avatarUrl) filled.avatar_url = await writeDemoFile(`avatar-account-${account.id}.svg`, avatarSvg(firstName, profile.lastName, 250));
  if (!profile.resumeUrl) filled.resume_url = await writeDemoFile(`resume-account-${account.id}.pdf`, seekerResumePdf(def, fullName));
  if (Object.keys(filled).length > 0) {
    await prisma.$runCommandRaw({
      update: "job_seeker_profiles",
      updates: [{ q: { _id: { $oid: profile.id } }, u: { $set: { ...filled, [DEMO_FILLED]: filled } } }],
    });
  }

  // Mazmunli rezyume bo'lsa arizalar o'sha bilan; yo'q yoki bo'sh bo'lsa demo rezyume
  // eng eski qilib yaratiladi (/api/resume eng eski rezyumeni ko'rsatadi)
  const own = profile.resumes.find((r) => r.summary || r.experience.length || r.education.length || r.skills.length);
  let resumeForApps = own?.id;
  if (!resumeForApps) {
    const oldest = profile.resumes[0]?.createdAt.getTime() ?? NOW;
    resumeForApps = await createResume(profile.id, def, new Date(Math.min(oldest - 60_000, ago(def.daysAgo).getTime())));
    await markDemo("resumes", [resumeForApps]);
  }

  const as = { seeker: account.id };
  const applications = APPLICATIONS.filter(([seeker]) => seeker === "seeker");
  const favorites = FAVORITES.filter(([seeker]) => seeker === "seeker");
  const searches = SAVED_SEARCHES.filter(([seeker]) => seeker === "seeker");
  const conversations = CONVERSATIONS.filter((c) => c.seeker === "seeker");
  const notifications = NOTIFICATIONS.filter(([user]) => user === "seeker");

  await seedApplications(applications, ids, as, { seeker: resumeForApps });
  await seedFavorites(favorites, ids, as);
  await prisma.savedCompany.createMany({
    data: SAVED_COMPANIES.map((key, i) => ({ userId: account.id, companyId: ids.companyId[key], createdAt: ago(i + 1) })),
  });
  await markDemo("saved_searches", await seedSavedSearches(searches, as));
  // Chat matnlarida demo ism o'rniga hisob egasining ismi
  await seedConversations(conversations, ids, as, (text) => text.split(def.first).join(firstName));
  await markDemo("notifications", await seedNotifications(notifications, () => account.id));

  console.log(
    `\n${account.email} hisobiga ulandi: ${applications.length} ariza, ${favorites.length} saqlangan vakansiya, ` +
      `${SAVED_COMPANIES.length} kompaniya, ${searches.length} obuna, ${conversations.length} suhbat, ` +
      `${notifications.length} bildirishnoma, ${own ? "mavjud rezyume" : "demo rezyume"}, ` +
      `profilda to'ldirilgan maydonlar: ${Object.keys(filled).join(", ") || "yo'q"}.`
  );
}

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    throw new Error("Demo seed production muhitida ishga tushirilmaydi (majburan: --force).");
  }
  const reset = process.argv.includes("--reset");
  const accounts = reset ? [] : accountArgs(process.argv.slice(2));
  // Noto'g'ri hisob berilgan bo'lsa — hech narsani o'chirishdan oldin to'xtaymiz
  for (const email of accounts) await findAccount(email);
  await resetDemo();
  if (reset) return;
  const ids = await createDemo();
  for (const email of accounts) await attachToAccount(email, ids);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
