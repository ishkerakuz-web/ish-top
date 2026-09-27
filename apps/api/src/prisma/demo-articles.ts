/**
 * Demo maqolalar va kontent jamoasi (demo-seed.ts ishlatadi).
 *
 * Muqovalar — foydalanuvchi bergan 7 ta referens rasm (`assets/articles/*.webp`):
 * seed ularni `uploads/demo-article-*` ga nusxalaydi, saytda oddiy yuklangan
 * fayl kabi ko'rinadi. 12 ta chop etilgan maqoladan 5 tasi ataylab muqovasiz,
 * bittasi muallifsiz — ixtiyoriy maydonsiz holatlar ham demo'da ko'rinsin.
 * Qo'shimcha: qoralama (muharrir izohi bilan), ko'rib chiqishdagi va arxivdagi
 * maqola — admin panelidagi har bir holat to'la bo'lsin.
 */
import type { ArticleCategory, ArticleStatus } from "@prisma/client";

export const DEMO_COVERS = [
  "01_resume_guide",
  "02_interview",
  "03_salary_growth",
  "04_resume_laptop",
  "05_career_growth",
  "06_ideas_planning",
  "07_company_building",
] as const;
export type DemoCover = (typeof DEMO_COVERS)[number];

/** `01_resume_guide` -> `/uploads/demo-article-01-resume-guide.webp` (writeDemoFile prefiksi bilan). */
export const coverFileName = (cover: DemoCover) => `article-${cover.replace(/_/g, "-")}.webp`;

export interface DemoStaff {
  key: "editor" | "author" | "author2" | "moderator";
  role: "content_editor" | "content_author" | "moderator";
  fullName: string;
  position: string;
  blocked?: boolean;
  avatarHue: number | null;
  daysAgo: number;
}

export const DEMO_STAFF: DemoStaff[] = [
  { key: "editor", role: "content_editor", fullName: "Dilnoza Rahimova", position: "Bosh muharrir", avatarHue: 262, daysAgo: 80 },
  { key: "author", role: "content_author", fullName: "Jasur Qodirov", position: "Karyera bo'yicha muallif", avatarHue: 200, daysAgo: 60 },
  // Faolsizlantirilgan a'zo — jamoa sahifasida "Faol emas" holati ko'rinsin
  { key: "author2", role: "content_author", fullName: "Sardor Umarov", position: "HR muallif", blocked: true, avatarHue: null, daysAgo: 120 },
  // Moderator: vakansiya/sharh navbati, kompaniya tasdig'i, murojaatlar (maqolalarga kirmaydi)
  { key: "moderator", role: "moderator", fullName: "Bekzod Tursunov", position: "Moderator", avatarHue: 150, daysAgo: 45 },
];

/** Demo admin (SUPER_ADMIN) — avatarsiz: bosh harf belgisi ham ko'rinsin. */
export const DEMO_ADMIN_PROFILE = { fullName: "Aziza Karimova", position: "Kontent jamoasi rahbari" };

/** Kutilayotgan va muddati o'tgan taklif (token hash tasodifiy — havola ishlamaydi). */
export const DEMO_INVITES: { local: string; role: "content_editor" | "content_author"; daysAgo: number; expiresInDays: number }[] = [
  { local: "yangi.muallif", role: "content_author", daysAgo: 1, expiresInDays: 6 },
  { local: "muharrir.nomzod", role: "content_editor", daysAgo: 9, expiresInDays: -2 },
];

export interface DemoArticle {
  slug: string;
  previousSlugs?: string[];
  title: string;
  excerpt: string | null;
  meta?: string;
  category: ArticleCategory | null;
  tags: string[];
  cover?: DemoCover;
  author: "admin" | "editor" | "author" | null;
  status: ArticleStatus;
  /** Chop etilgan (yoki arxivdagining chop etilgan) sanasi — necha kun oldin. */
  days: number;
  views: number;
  helpful: [yes: number, no: number];
  reviewNote?: string;
  content: string;
}

export const DEMO_ARTICLES: DemoArticle[] = [
  {
    slug: "rezyume-qanday-yoziladi-2026",
    // Avvalgi manzil — eski havolalar 301 bilan yangisiga o'tadi
    previousSlugs: ["rezyume-qanday-yoziladi"],
    title: "Rezyume qanday yoziladi: 2026-yil uchun to'liq qo'llanma",
    excerpt:
      "Ish beruvchi rezyumega o'rtacha 7–10 soniya ajratadi. Shu vaqt ichida e'tiborni tortadigan tuzilma, natijalar va kalit so'zlarni qanday yozishni bosqichma-bosqich ko'rsatamiz.",
    meta: "Ish beruvchini birinchi 10 soniyada qiziqtiradigan rezyume tuzish bo'yicha amaliy qo'llanma: tuzilma, natijalar, kalit so'zlar.",
    category: "resume",
    tags: ["Rezyume", "Ish topish", "HR maslahat", "Shablon"],
    cover: "01_resume_guide",
    author: "editor",
    status: "published",
    days: 1,
    views: 1840,
    helpful: [96, 7],
    content: `Ish beruvchi bitta rezyumega o'rtacha **7–10 soniya** vaqt sarflaydi. Shu vaqt ichida u ikki savolga javob izlaydi: bu odam vazifani bajara oladimi va boshqa nomzodlardan nimasi bilan farq qiladi. Yaxshi rezyume ana shu ikki savolga tez va aniq javob beradi.

## 1. Sarlavha va qisqa tavsif

"Dasturchi" emas, **"Frontend dasturchi (React, 4 yil)"** deb yozing. Tavsifda 2–3 gap kifoya: kimsiz, qaysi sohada kuchlisiz va qanday natijaga erishgansiz.

> [!TIP]
> Tavsifni har bir vakansiyaga moslab biroz o'zgartiring — bu 5 daqiqa oladi, lekin javob olish ehtimolini sezilarli oshiradi.

## 2. Vazifalar emas, natijalar

Ko'pchilik rezyumeda faqat lavozim vazifalari sanaladi. Ish beruvchini esa natija qiziqtiradi:

- "Saytni qo'llab-quvvatladim" o'rniga — *sahifa yuklanish vaqtini 40% ga qisqartirdim*
- "Mijozlar bilan ishladim" o'rniga — *oyiga 120 ta murojaatni 24 soat ichida yopdim*
- "Hisobotlar tayyorladim" o'rniga — *haftalik hisobotni avtomatlashtirib, 6 soat vaqt tejadim*

## 3. Ko'nikmalarni vakansiyaga moslang

Vakansiyada ko'rsatilgan asosiy texnologiya va ko'nikmalar rezyumeingizda ham aynan shu nomlar bilan uchrasin. Ko'plab kompaniyalar arizalarni avval kalit so'zlar bo'yicha saralaydi.

![Noutbukda rezyume ustida ishlash](/uploads/demo-article-04-resume-laptop.webp)

## 4. Tuzilma: nimani qayerga yozish kerak

1. Ism, lavozim va aloqa ma'lumotlari
2. Qisqa tavsif (2–3 gap)
3. Ish tajribasi — oxirgisidan boshlab
4. Ta'lim va sertifikatlar
5. Ko'nikmalar va tillar

---

## Yakuniy tekshiruv

Yuborishdan oldin rezyumeni bir sahifada saqlashga harakat qiling, kontaktlaringiz dolzarbligini tekshiring va faylni PDF formatida yuklang. Tayyor bo'lsa — [mos vakansiyalarni ko'ring](/vacancies).`,
  },
  {
    slug: "intervyuga-tayyorgarlik",
    title: "Intervyuga qanday tayyorlanish kerak: 10 ta amaliy maslahat",
    excerpt:
      "Intervyu — imtihon emas, ikki tomonlama suhbat. Kompaniyani o'rganish, STAR usuli va to'g'ri savollar bilan o'zingizni ishonchli ko'rsating.",
    meta: "Ish intervyusiga tayyorlanish: eng ko'p beriladigan savollar, STAR usuli va suhbat oxirida beriladigan savollar.",
    category: "interview",
    tags: ["Suhbat", "Intervyu", "HR maslahat"],
    cover: "02_interview",
    author: "author",
    status: "published",
    days: 3,
    views: 2310,
    helpful: [131, 9],
    content: `Intervyu — bu imtihon emas, ikki tomonlama suhbat. Kompaniya sizni tanlayotgani kabi, siz ham kompaniyani tanlaysiz. Shu yondashuv hayajonni kamaytiradi va suhbatni tabiiyroq qiladi.

## Suhbatdan bir kun oldin

- Kompaniyaning mahsuloti, mijozlari va so'nggi yangiliklarini o'rganing
- Vakansiya matnini qayta o'qing va asosiy talablarni belgilab chiqing
- Yo'l yoki video aloqani oldindan tekshiring
- Rezyumeingizdagi har bir band haqida 1–2 daqiqa gapira olishingizga ishonch hosil qiling

## STAR usuli bilan javob bering

Tajribangiz haqida so'rashganda javobni to'rt qismga bo'ling:

1. **Vaziyat** — qanday sharoit edi
2. **Vazifa** — sizdan nima talab qilindi
3. **Harakat** — aynan siz nima qildingiz
4. **Natija** — qanday o'lchanadigan natija bo'ldi

> Eng kuchli javob — raqam bilan tugaydigan javob. "Jarayonni yaxshiladim" emas, "buyurtmalarni qayta ishlash vaqtini 2 kundan 4 soatga tushirdim".

## Eng ko'p beriladigan savollar

- O'zingiz haqingizda gapirib bering
- Nega aynan bizning kompaniyamiz?
- Eng katta muvaffaqiyatingiz va xatoingiz qaysi?
- 3 yildan keyin o'zingizni qayerda ko'rasiz?

> [!TIP]
> "Nega bizda ishlamoqchisiz?" savoliga umumiy emas, kompaniyaga xos javob tayyorlang: mahsulot, jamoa yoki texnologiyadan aniq misol keltiring.

## Suhbat oxirida savol bering

Jamoa qanday ishlaydi, birinchi 3 oyda sizdan nima kutiladi, muvaffaqiyat qanday o'lchanadi — bunday savollar jiddiyligingizni ko'rsatadi. Suhbatdan keyin qisqa minnatdorchilik xati yuborishni ham unutmang.`,
  },
  {
    slug: "maosh-muzokarasi",
    title: "Maosh bo'yicha muzokara: qancha so'rash va qanday asoslash",
    excerpt:
      "To'g'ri tayyorgarlik bilan o'tkazilgan muzokara daromadingizni 10–20% ga oshirishi mumkin. Bozor narxini aniqlash va taklifni to'g'ri qabul qilish bo'yicha qo'llanma.",
    category: "salary",
    tags: ["Maosh", "Muzokara", "Karyera"],
    cover: "03_salary_growth",
    author: "editor",
    status: "published",
    days: 5,
    views: 1520,
    helpful: [74, 6],
    content: `Ko'pchilik maosh haqida gapirishdan qo'rqadi va birinchi taklifga rozi bo'ladi. Holbuki, to'g'ri tayyorgarlik bilan o'tkazilgan muzokara daromadingizni **10–20% ga** oshirishi mumkin.

## 1. Bozorni o'rganing

[Maoshlar bo'limida](/salaries) kasbingiz va hududingiz bo'yicha median, minimal va maksimal ko'rsatkichlarni ko'ring. Shu oraliqqa tayanib o'zingiz uchun ikkita raqam belgilang:

- **maqsad** — so'raydigan summangiz
- **chegara** — undan pastiga rozi bo'lmaydigan minimum

## 2. Raqamni asoslang

Oraliq emas, aniq summa ayting va uni natijalaringiz bilan bog'lang. Masalan: *"Oxirgi loyihada xarajatlarni 15% ga kamaytirdim, shu tajribani sizning jamoangizda ham qo'llay olaman."*

> [!TIP]
> Birinchi bo'lib raqam aytishga shoshilmang. Avval ish beruvchidan vakansiya uchun ajratilgan budjetni so'rab ko'ring.

## 3. Taklifni darhol qabul qilmang

O'ylab ko'rish uchun bir kun so'rash mutlaqo normal. Bu vaqt ichida taklifni boshqa imkoniyatlar bilan solishtiring.

## Maoshdan tashqari shartlar

1. Bonus va yillik indeksatsiya
2. Tibbiy sug'urta
3. Masofadan yoki gibrid ishlash
4. O'qish va konferensiyalar budjeti

Ba'zan aynan shu shartlar umumiy qiymatni sezilarli oshiradi.`,
  },
  {
    slug: "qoshimcha-xat",
    title: "Qo'shimcha xat ish beruvchini qanday qiziqtiradi",
    excerpt:
      "Ko'pchilik qo'shimcha xatni o'tkazib yuboradi — shuning uchun uni yozganlar darhol ajralib turadi. 4–6 gaplik shaxsiy xat tuzilmasi va namunasi.",
    category: "resume",
    tags: ["Rezyume", "Qo'shimcha xat", "Shablon"],
    cover: "04_resume_laptop",
    author: "author",
    status: "published",
    days: 7,
    views: 640,
    helpful: [38, 4],
    content: `Ko'pchilik qo'shimcha xatni o'tkazib yuboradi, shuning uchun uni yozganlar darhol ajralib turadi. Yaxshi xat **4–6 gapdan** iborat bo'ladi va bir daqiqada o'qiladi.

## Xat tuzilmasi

1. **Kirish** — qaysi vakansiyaga murojaat qilayotganingiz va nega aynan shu kompaniya
2. **Asosiy qism** — talablarga eng mos keladigan 1–2 ta yutug'ingiz
3. **Yakun** — suhbatga tayyorligingiz va qisqa minnatdorchilik

## Namuna

> Assalomu alaykum! "Mahsulot dizayneri" vakansiyasi bo'yicha murojaat qilyapman. Ilovangizdan o'zim ham foydalanaman va to'lov jarayonini soddalashtirish g'oyasi menga juda yaqin. Oldingi ish joyimda ro'yxatdan o'tish oqimini qayta loyihalab, konversiyani 18% ga oshirganmiz. Shu tajribani jamoangizga olib kelishni istardim.

## Nimalardan qochish kerak

- "Men mas'uliyatli va jamoada ishlay oladigan odamman" kabi umumiy gaplar
- Rezyumeni so'zma-so'z takrorlash
- Bir xil xatni barcha kompaniyalarga yuborish

> [!TIP]
> Xat oxirida ism va telefon raqamingizni qayta yozing — ish beruvchi rezyumeni qidirib o'tirmaydi.`,
  },
  {
    slug: "talabgir-it-kasblar",
    title: "O'zbekistonda eng talabgir IT kasblar: 2026-yil sharhi",
    excerpt:
      "Fintech, e-commerce va davlat raqamli xizmatlari yangi mutaxassislarga talabni oshirmoqda. Qaysi yo'nalishlarda vakansiyalar ko'p va qanday ko'nikmalar qadrlanadi?",
    category: "career",
    tags: ["Karyera", "IT", "Ish topish"],
    cover: "05_career_growth",
    author: "editor",
    status: "published",
    days: 9,
    views: 980,
    helpful: [52, 5],
    content: `So'nggi yillarda O'zbekistonda IT bozori tez o'smoqda: fintech, e-commerce va davlat raqamli xizmatlari yangi mutaxassislarga talabni oshirmoqda. Quyida vakansiyalar soni va maoshlar bo'yicha eng faol yo'nalishlarni jamladik.

## Dasturlash

Frontend va backend dasturchilar hamon eng ko'p izlanadigan mutaxassislar.

- **Frontend:** React, TypeScript, Next.js
- **Backend:** Node.js, Go, Python, Java
- **Mobil:** Flutter kichik jamoalarda mashhur, yirik kompaniyalar Kotlin va Swift mutaxassislarini qidiradi

## Mutaxassis kam bo'lgan yo'nalishlar

Data analitika, QA avtomatlashtirish va DevOps bo'yicha nomzodlar kam — shuning uchun maoshlar ham raqobatbardosh. Mahsulot dizaynerlari va product manager'larga talab barqaror oshmoqda.

> [!TIP]
> Yo'nalish tanlayotganda faqat maoshga emas, o'zingizga yoqadigan kundalik ish turiga qarang: kod yozish, ma'lumot tahlili yoki odamlar bilan ishlash.

## Qayerdan boshlash kerak

1. Bitta yo'nalishni tanlang va 3 oylik o'quv reja tuzing
2. Har bosqichda kichik loyiha qiling va GitHub'ga joylang
3. Stajirovka va junior vakansiyalarga ariza bering

Joriy takliflarni [vakansiyalar bo'limida](/vacancies) ko'rishingiz mumkin.`,
  },
  {
    slug: "masofaviy-ish",
    title: "Masofaviy ish: samarali ishlash va charchamaslik yo'llari",
    excerpt:
      "Masofaviy ish yo'lga ketadigan vaqtni tejaydi, lekin o'zini boshqarishni talab qiladi. Ish joyi, kun tartibi va muloqot bo'yicha amaliy odatlar.",
    category: "tips",
    tags: ["Maslahatlar", "Masofaviy ish", "Samaradorlik"],
    cover: "06_ideas_planning",
    author: "author",
    status: "published",
    days: 11,
    views: 720,
    helpful: [41, 3],
    content: `Masofaviy ish yo'lga ketadigan vaqtni tejaydi va xalqaro kompaniyalarda ishlash imkonini beradi. Lekin u o'z-o'zini boshqarishni ham talab qiladi.

## Ish joyini ajrating

Hatto kichik burchak bo'lsa ham, u faqat ish uchun bo'lsin. Divan yoki karavotda ishlash diqqatni tez tarqatadi.

## Kun tartibi

- Ish boshlanishi va tugashi uchun aniq vaqt belgilang
- Kunni eng muhim 1–3 vazifani yozishdan boshlang
- Har soatda 5 daqiqalik tanaffus qiling
- Ish tugagach, ish dasturlarini yoping

> Ofisda hamkasbingiz nima bilan bandligini ko'rib turasiz, masofada esa buni yozib bildirish kerak.

## Muloqotni ortiqcha qiling

Kunlik qisqa hisobotlar ishonchni mustahkamlaydi. Savolni bir kun kutib yurmang — darhol yozing.

> [!TIP]
> Haftada bir marta jamoa bilan kamerani yoqib suhbatlashing: yozishmada yo'qoladigan kayfiyat va kontekst shunda saqlanadi.

## Charchoqning oldini oling

Tushlikda sayr qilish, dam olish kunlari ish chatini o'chirib qo'yish va muntazam harakat ish unumdorligiga to'g'ridan-to'g'ri ta'sir qiladi.`,
  },
  {
    slug: "kompaniyani-tanlash",
    title: "Ish beruvchini qanday tanlash: ariza berishdan oldin kompaniyani tekshiring",
    excerpt:
      "Maosh muhim, lekin yagona mezon emas. Kompaniya madaniyati, sharhlar va suhbatdagi belgilarga qarab to'g'ri ish joyini tanlash bo'yicha maslahatlar.",
    category: "job_search",
    tags: ["Ish topish", "Kompaniyalar", "HR maslahat"],
    cover: "07_company_building",
    author: "editor",
    status: "published",
    days: 13,
    views: 510,
    helpful: [29, 2],
    content: `Maosh muhim, lekin yagona mezon emas. Noto'g'ri tanlangan kompaniya bir necha oyda ishdan ketishga olib keladi — bu esa rezyumeda ham, kayfiyatda ham iz qoldiradi.

## Ariza berishdan oldin

- [Kompaniya sahifasida](/companies) tavsif, faol vakansiyalar va xodimlar sharhlarini o'qing
- Vakansiya matni qanchalik aniq yozilganiga e'tibor bering
- Kompaniya qancha vaqtdan beri bozorda ekanini tekshiring

## Suhbatda nimaga qarash kerak

1. Sizga savol berish uchun vaqt ajratiladimi
2. Rahbar jamoa haqida qanday gapiradi
3. Vazifalar va kutilayotgan natijalar aniq aytiladimi
4. Sinov muddati shartlari yozma beriladimi

> [!TIP]
> Suhbatda "Bu lavozimda oldin kim ishlagan va nega ketdi?" deb so'rang. Javob ko'p narsani ochib beradi.

## Ogohlantiruvchi belgilar

- Maosh va shartlar haqida aniq javob berilmaydi
- "Bugunoq qaror qiling" degan bosim
- Rasmiy ishga joylashtirishdan bosh tortish

To'g'ri kompaniya sizni ham xuddi siz uni tanlayotgandek diqqat bilan tanlaydi.`,
  },
  {
    slug: "birinchi-ish-tajribasiz",
    title: "Tajribasiz birinchi ishni qanday topish mumkin",
    excerpt:
      "\"Tajriba kerak, lekin tajriba olish uchun ish kerak\" — bu doiradan chiqish mumkin. Talaba va bitiruvchilar uchun amaliy yo'l xaritasi.",
    category: "job_search",
    tags: ["Ish topish", "Talabalar", "Stajirovka"],
    author: "author",
    status: "published",
    days: 15,
    views: 1300,
    helpful: [67, 8],
    content: `"Tajriba kerak, lekin tajriba olish uchun ish kerak" — bu doira ko'pchilikka tanish. Yaxshi xabar shuki, tajriba faqat rasmiy ish joyida to'planmaydi.

## 1. Stajirovka va yarim kunlik ish

Ko'plab kompaniyalar talabalarni yarim kunlik ishga oladi. [Vakansiyalarda](/vacancies?experience=none) "Tajriba talab qilinmaydi" filtrini tanlang — bunday takliflar siz o'ylagandan ko'p.

## 2. O'z loyihangizni qiling

- Dasturchi uchun — GitHub'dagi ishlaydigan ilova
- Dizayner uchun — Behance portfoliosi
- Marketolog uchun — o'zi yuritgan sahifa va uning natijalari

Bularning barchasi ish beruvchi uchun haqiqiy tajriba sifatida qabul qilinadi.

## 3. Ko'ngillilik va tanlovlar

Xayriya loyihalari, hakatonlar va keys-chempionatlar jamoada ishlash tajribasini beradi va rezyumeda yaxshi ko'rinadi.

> [!TIP]
> Har bir arizaga 3–4 gaplik samimiy xat qo'shing: nima uchun aynan shu kompaniya va nimani o'rganishga tayyorligingizni yozing.

## 4. Tanishlar tarmog'i

Kurs o'qituvchilari, katta kurs talabalari va sohadagi tanishlaringizga ish qidirayotganingizni ayting. Ko'p vakansiyalar hali e'lon qilinmasdan tavsiya orqali to'ladi.`,
  },
  {
    slug: "kasb-almashtirish",
    title: "Kasbni almashtirish: 30 yoshdan keyin yangi sohaga o'tish",
    excerpt:
      "Kasbni almashtirish uchun hech qachon kech emas. Mavjud ko'nikmalarni baholash, o'qish rejasi va birinchi ish joyi haqida real maslahatlar.",
    category: "career",
    tags: ["Karyera", "O'qish", "Motivatsiya"],
    // Muallifsiz maqola — sahifada muallif bloki chiqmaydi
    author: null,
    status: "published",
    days: 18,
    views: 430,
    helpful: [22, 3],
    content: `Kasbni almashtirish uchun hech qachon kech emas. Muhimi — tartibli reja va real kutishlar.

## Mavjud ko'nikmalaringizni yozib chiqing

Muloqot, loyiha boshqaruvi, soha bilimi — ularning ko'pi yangi kasbda ham qadrlanadi. Masalan, buxgalter data analitikaga o'tganda moliyaviy bilimi katta ustunlik beradi.

## O'qishni amaliyot bilan birga olib boring

1. 3–6 oylik kurs tanlang
2. Har modul oxirida kichik loyiha qiling
3. Kurs tugagach, frilans buyurtmalar orqali portfolio yig'ing

> Birinchi ish joyida maosh avvalgisidan past bo'lishi mumkin — buni sarmoya deb qarang. Tajriba to'plangani sari daromad tez tiklanadi.

## Moliyaviy xavfsizlik yostig'i

O'tish davri uchun kamida 3–4 oylik xarajatni jamg'aring. Bu shoshqaloq qarorlardan saqlaydi.

> [!TIP]
> Yangi sohada ishlayotgan 2–3 kishi bilan suhbatlashing: kundalik ish qanday o'tishini kursdan emas, ulardan bilib olasiz.`,
  },
  {
    slug: "intervyudan-keyin",
    title: "Intervyudan keyin: minnatdorchilik xati va javobni kutish",
    excerpt:
      "Suhbat tugagach ham ta'sir qoldirish mumkin. Qisqa minnatdorchilik xati, kutish muddati va rad javobiga to'g'ri munosabat haqida.",
    category: "interview",
    tags: ["Suhbat", "Intervyu", "Maslahatlar"],
    author: "editor",
    status: "published",
    days: 21,
    views: 380,
    helpful: [19, 1],
    content: `Suhbat tugadi, lekin jarayon hali davom etmoqda. Keyingi 48 soatdagi harakatlaringiz ham qarorga ta'sir qilishi mumkin.

## Minnatdorchilik xati

Suhbatdan keyin 24 soat ichida qisqa xat yuboring:

- vaqt ajratgani uchun rahmat ayting
- suhbatdagi bitta muhim mavzuni eslating
- lavozimga qiziqishingizni yana bir bor bildiring

> Rahmat, bugungi suhbat uchun. Ayniqsa, mijozlarni qo'llab-quvvatlash jarayonini avtomatlashtirish rejalaringiz qiziq bo'ldi — bu yo'nalishda tajribam bor va jamoaga foydali bo'lishni istardim.

## Qancha kutish kerak

Agar suhbatda muddat aytilgan bo'lsa, shu muddat o'tgandan keyin bir marta qisqa eslatma yozish mumkin. Muddat aytilmagan bo'lsa — bir hafta kuting.

## Rad javobi kelsa

1. Xushmuomalalik bilan javob qaytaring
2. Qaysi ko'nikmani kuchaytirish kerakligini so'rang
3. Kompaniyani kuzatishda davom eting — keyingi vakansiyada yana murojaat qilishingiz mumkin

> [!TIP]
> Arizalaringiz holatini [Mening arizalarim](/applications) sahifasida kuzatib boring — ish beruvchi javobi o'sha yerda ko'rinadi.`,
  },
  {
    slug: "sinov-muddati",
    title: "Sinov muddatini muvaffaqiyatli o'tish: birinchi 90 kun",
    excerpt:
      "Yangi ish joyidagi birinchi uch oy — o'zingizni ko'rsatish va jamoaga moslashish vaqti. Kutishlarni aniqlash, savol berish va natijani ko'rsatish rejasi.",
    category: "tips",
    tags: ["Maslahatlar", "Karyera", "Yangi ish"],
    author: "author",
    status: "published",
    days: 25,
    views: 290,
    helpful: [15, 2],
    content: `Yangi ish joyidagi birinchi uch oy — o'zingizni ko'rsatish va jamoaga moslashish vaqti. Bu davrda eng muhimi — tezlik emas, aniqlik.

## Birinchi hafta

- Rahbaringiz bilan sinov muddatidagi kutishlarni yozma kelishib oling
- Jamoadagi har bir hamkasb bilan qisqa tanishuv suhbati qiling
- Ichki hujjatlar va jarayonlarni o'rganing

## Birinchi oy

Kichik, lekin ko'rinadigan vazifalarni oxirigacha yetkazing. Tugallangan kichik ish chala qolgan katta ishdan ko'ra ko'proq ishonch uyg'otadi.

> Savol berishdan qo'rqmang. Yangi xodimdan hamma narsani bilish emas, tez o'rganish kutiladi.

## Ikkinchi va uchinchi oy

1. Har ikki haftada rahbardan qisqa fikr so'rang
2. Bitta jarayonni yaxshilash taklifi bilan chiqing
3. Natijalaringizni raqamlar bilan qayd qilib boring

> [!TIP]
> Sinov muddati oxirida qilgan ishlaringiz ro'yxatini o'zingiz tayyorlab boring — yakuniy suhbatda juda qo'l keladi.`,
  },
  {
    slug: "maosh-oshirishni-sorash",
    title: "Maoshni oshirishni qanday so'rash kerak",
    excerpt:
      "Maosh o'z-o'zidan oshmaydi. To'g'ri vaqtni tanlash, natijalarni jamlash va rahbar bilan suhbatni rejalashtirish bo'yicha bosqichma-bosqich qo'llanma.",
    category: "salary",
    tags: ["Maosh", "Karyera", "Muzokara"],
    author: "editor",
    status: "published",
    days: 29,
    views: 350,
    helpful: [17, 2],
    content: `Ko'pchilik yaxshi ishlasa, maosh o'z-o'zidan oshadi deb o'ylaydi. Amalda esa bu masalani ko'pincha xodimning o'zi ko'taradi.

## To'g'ri vaqtni tanlang

- Muhim loyiha muvaffaqiyatli yakunlangandan keyin
- Yillik baholash yoki budjet rejalashtirishdan oldin
- Vazifalaringiz sezilarli kengayganda

## Natijalarni jamlang

Oxirgi 6–12 oydagi yutuqlaringizni raqamlar bilan yozing: qancha mijoz, qancha tejalgan vaqt, qancha daromad. [Maoshlar bo'limidagi](/salaries) bozor ko'rsatkichlari ham dalil bo'ladi.

## Suhbat rejasi

1. Rahbardan alohida uchrashuv so'rang
2. Natijalaringizni qisqa taqdim eting
3. Aniq summa yoki foizni ayting
4. Javob darhol bo'lmasa, qachon qaytishni kelishib oling

> Maosh haqidagi suhbat — shikoyat emas, qiymatingizni ko'rsatish imkoniyati.

> [!TIP]
> Rad javobi bo'lsa, maoshni oshirish uchun nima qilish kerakligini aniq so'rang va 3 oydan keyin qayta uchrashuvni belgilang.`,
  },

  // ---- Admin panelidagi holatlar (saytda ko'rinmaydi) ----
  {
    slug: "portfolio-yaratish",
    title: "Portfolio yaratish: ish beruvchi ko'rmoqchi bo'lgan 5 ta narsa",
    excerpt: "Portfolio rezyumedagi gaplarni isbotlaydi. Qaysi ishlarni tanlash, ularni qanday tavsiflash va qayerga joylash haqida.",
    category: "tips",
    tags: ["Portfolio", "Maslahatlar"],
    author: "author",
    status: "draft",
    days: 0,
    views: 0,
    helpful: [0, 0],
    reviewNote: "Kirish qismini qisqartiring va dizayner portfoliosidan 2–3 ta real misol qo'shing.",
    content: `Portfolio rezyumedagi gaplarni isbotlaydi. Ish beruvchi "React bilaman" degan satrdan ko'ra ishlaydigan loyihaga ko'proq ishonadi.

## 1. Eng yaxshi 3–5 ta ish

Hamma narsani emas, eng kuchli ishlaringizni tanlang. Har biri turli ko'nikmani ko'rsatsin.

## 2. Har bir ish uchun qisqa hikoya

- qanday muammo bor edi
- siz nima qildingiz
- natija qanday bo'ldi

## 3. Aloqa ma'lumotlari

Portfolio oxirida email va Telegram manzilingizni qoldiring.`,
  },
  {
    slug: "soft-skills-7-konikma",
    title: "Soft skills: ish beruvchilar eng ko'p qadrlaydigan 7 ko'nikma",
    excerpt: "Texnik bilim ishga olib kiradi, soft skills esa o'sishga yordam beradi. Muloqot, vaqtni boshqarish va boshqa ko'nikmalarni rivojlantirish yo'llari.",
    category: "career",
    tags: ["Karyera", "Soft skills", "Rivojlanish"],
    author: "author",
    status: "in_review",
    days: 0,
    views: 0,
    helpful: [0, 0],
    content: `Texnik bilim sizni ishga olib kiradi, soft skills esa lavozimda o'sishga yordam beradi. So'rovlarga ko'ra, ish beruvchilar quyidagi ko'nikmalarni eng ko'p qadrlaydi.

## Ro'yxat

1. **Muloqot** — fikrni qisqa va aniq yetkazish
2. **Vaqtni boshqarish** — muddatlarni o'z vaqtida bajarish
3. **Jamoada ishlash** — boshqalarning fikrini tinglash
4. **Muammoni hal qilish** — yechim bilan kelish
5. **Moslashuvchanlik** — o'zgarishlarga tez ko'nikish
6. **Mas'uliyat** — natija uchun javobgarlikni olish
7. **O'rganishga tayyorlik** — yangi bilimni tez o'zlashtirish

> [!TIP]
> Rezyumeda soft skills'ni sanab o'tirmang — ularni tajriba bo'limidagi aniq misollar orqali ko'rsating.`,
  },
  {
    slug: "ish-bozori-2025-yakunlari",
    title: "2025-yil ish bozori: yil yakunlari",
    excerpt: "O'tgan yilda qaysi sohalarda vakansiyalar ko'paydi, maoshlar qanday o'zgardi va nomzodlar nimalarga e'tibor qaratdi.",
    category: "career",
    tags: ["Karyera", "Statistika"],
    author: "editor",
    status: "archived",
    days: 220,
    views: 2140,
    helpful: [58, 11],
    content: `2025-yil ish bozori uchun faol yil bo'ldi: IT, logistika va savdo sohalarida vakansiyalar soni sezilarli oshdi.

## Asosiy tendensiyalar

- masofaviy va gibrid ish takliflari ko'paydi
- junior mutaxassislarga talab barqaror bo'ldi
- ish beruvchilar ko'proq amaliy topshiriq bera boshladi

## Maoshlar

O'rtacha maoshlar IT va moliya sohalarida eng tez o'sdi. Batafsil ko'rsatkichlar maoshlar bo'limida.

Bu maqola arxivlangan: joriy yil bo'yicha yangi sharh tayyorlanmoqda.`,
  },
];
