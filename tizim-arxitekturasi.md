# Ish Qidirish Platformasi — To'liq Tizim Arxitekturasi

> hh.uz tahlili asosida tayyorlangan, kodlashdan oldingi to'liq loyihalash hujjati.

> **Eslatma (0.3.0, 2026-08-29).** Bu hujjat loyihalash paytidagi holatni
> saqlaydi va unda baza sifatida PostgreSQL tilga olinadi. Amalda loyiha
> **MongoDB** (Atlas) da ishlaydi, Prisma esa o'sha-o'zi qoldi. Ma'lumot
> modeli (8-bo'lim) mazmunan o'zgarmagan — faqat ID turi (`ObjectId`) va
> indekslar boshqacha. Amaldagi sxema: `apps/api/prisma/schema.prisma`,
> deploy qo'llanmasi: `DEPLOY.md`.

---

## 0. Qisqacha

hh.uz'ning bosh sahifasi, vakansiyalar ro'yxati va meta-teglarini real vaqtda tekshirib chiqdim (HTML manbasini to'g'ridan-to'g'ri fetch qilib). Quyida — shu tahlil asosida, sen aytgan stack (**Vite + Node.js + PostgreSQL**) ustida quriladigan to'liq tizim loyihasi.

Bitta muhim narsani boshida aytib qo'yaman, chunki bu butun arxitekturaga ta'sir qiladi:

> **Vite — bu bundler, framework emas.** Agar Vite'ni faqat SPA (React/Vue + client-side rendering) rejimida ishlatsak, Google va boshqa qidiruv tizimlari sahifani indekslashda qiyinchilik chekadi — har bir vakansiya, kompaniya sahifasi uchun alohida `<title>`, `meta description`, `og:image` server tomonidan tayyor kelishi kerak. hh.uz buni aynan shunday qiladi — men fetch qilganda har bir sahifaning HTML'ida tayyor meta-teglar bor edi (JS ishga tushmasdan oldin ham). Demak, **SEO talabini bajarish uchun Vite'ni SSR rejimida** ishlatishimiz kerak. Pastda bu masalaning aniq texnik yechimi bor (4-bo'lim).

Men frontend uchun **React + TypeScript**ni asos qilib oldim (sen Vitrina, portfolio va boshqa loyihalarda React/Next.js ishlatgansan — shu tajribadan foydalanish tezroq bo'ladi). Agar Vue afzal ko'rsang, arxitektura deyarli o'zgarmaydi, faqat SSR vositasi farq qiladi — ayt, moslashtiraman.

---

## 1. hh.uz tahlili — nimalarni ko'rdim

**Sahifa darajasida (real HTML'dan):**
- Har bir sahifada to'liq meta-teglar to'plami: `canonical`, `meta description`, `og:title/description/image` (600×315), `twitter:card: summary_large_image`, `viewport`, `msapplication-*` (Windows tile ikonlari), `yandex-verification`, `google-site-verification`.
- Sentry orqali production monitoring (`sentry-release=xhh@26.26.5.2` — o'zlarining ichki "xhh" frontend frameworki borligi ko'rinadi).
- Har bir shahar uchun alohida subdomain: `tashkent.hh.uz`, `samarkand.hh.uz`, `bukhara.hh.uz` va h.k. — bu geografik SEO strategiyasi (har bir shahar o'z indekslanadigan sahifasiga ega).

**Funksional jihatdan:**
- Ikki rolli tizim: **ish izlovchi** va **ish beruvchi** (bitta domende, role-based UI).
- Vakansiya kartasi: lavozim, maosh oralig'i (so'm yoki $, "qo'lga"/"soliqdan oldin" izohi bilan), tajriba talabi, ish turi, to'lov chastotasi, manzil, **"hozir N kishi ko'rmoqda"** — real-time social proof.
- **"Rezyumesiz otklik"** — rezyume to'ldirmasdan ham ariza yuborish imkoniyati (ariza chegarasini pasaytirish uchun).
- Tezkor filtrlar: tajribasiz, kechki/tungi, vahta usuli, 5/2 grafik, moslashuvchan grafik, 2/2, oxirgi 3 kun/sutka ichida, to'g'ridan ish beruvchilardan, to'liq/qisman bandlik, nogironlar uchun moslashtirilgan.
- **Email orqali obuna** — "Bu so'rov bo'yicha yangi vakansiyalar chiqsa, sizga yuborilsinmi?" — bu aynan **notification** funksiyasining bir ko'rinishi.
- Kompaniya profillari + faol vakansiyalar soni + "brendlangan" (premium, logotipli) ish beruvchilar — monetizatsiya nuqtasi.
- Maqolalar/blog bo'limi (rezyume yozish, intervyu maslahatlari) — sof SEO content-marketing, organik trafik uchun.
- Kasblar katalogi (kategoriya bo'yicha pastga tushish: "IT" → "Frontend dasturchi" va h.k.) — SEO uchun ham, navigatsiya uchun ham ishlaydi.

Bu kuzatuvlar pastdagi arxitekturaning negizini tashkil qiladi.

---

## 2. Loyiha konsepsiyasi

**Foydalanuvchi turlari:**
1. **Ish izlovchi (job seeker)** — rezyume yaratadi, vakansiya qidiradi, ariza yuboradi, xabarnoma oladi.
2. **Ish beruvchi (employer/HR)** — kompaniya profili, vakansiya joylaydi, arizalarni boshqaradi, to'lov rejasiga ega bo'lishi mumkin.
3. **Admin** — moderatsiya (spam vakansiyalar, qalbaki kompaniyalar), foydalanuvchi boshqaruvi, statistika.

**MVP falsafasi:** Avval ish izlovchi + ish beruvchining asosiy aylanish tsiklini (vakansiya joylash → ko'rish → ariza → holat o'zgarishi) butunlay ishlaydigan qilamiz, SEO va notification'ni boshidanoq arxitekturaga qo'shamiz (keyin qo'shish qiyinroq bo'ladi), so'ng monetizatsiya va kengaytirilgan funksiyalarni ustiga quramiz.

---

## 3. Texnologik stack

| Qatlam | Texnologiya | Izoh |
|---|---|---|
| Frontend | **Vite + React 18 + TypeScript** | SSR uchun **Vike** (avvalgi nomi vite-plugin-ssr) ustida |
| Styling | **Tailwind CSS** | tez, utility-first, sening boshqa loyihalarda ham ishlatganing |
| State/data | **TanStack Query** (server state) + **Zustand** (client state) | |
| Forms | **React Hook Form + Zod** | validatsiya backend bilan bir xil sxema (Zod) orqali |
| Backend | **Node.js + Fastify + TypeScript** | Express'dan tezroq, schema-validation o'zida bor |
| ORM | **Prisma** | PostgreSQL bilan eng yaxshi DX, migratsiyalarni avtomatik boshqaradi |
| Baza | **PostgreSQL 16** | |
| Cache/Queue | **Redis + BullMQ** | sessiya, rate-limit, background job (email, notification) |
| Qidiruv | **Meilisearch** | to'liq matnli qidiruv, filtrlash, typo-tolerance — Elasticsearch'dan ancha yengil, kichik/o'rta loyiha uchun yetarli |
| Real-time | **Socket.io** | in-app notification, "hozir N kishi ko'rmoqda" kabi funksiyalar |
| Fayl saqlash | **S3-compatible (MinIO dev'da, Cloudflare R2/AWS S3 prod'da)** | resume PDF, logotip, avatar |
| Email | **Nodemailer + SMTP / Resend** | |
| Web Push | **web-push (VAPID)** | brauzer push xabarnomalari |
| Deploy | **Docker Compose** (dev) → **VPS/Railway/Vercel** (prod) | backend+DB+Redis konteynerlarda |

---

## 4. Frontend arxitekturasi — SSR va SEO yechimi

Bu eng muhim texnik qaror, shuning uchun batafsil tushuntiraman.

### Muammo
Sof Vite SPA: brauzer bo'sh HTML oladi → JS yuklanadi → React render qiladi → mazmun paydo bo'ladi. Google botlari buni render qila oladi, lekin:
- Sekin (crawl budget cheklangan, ko'p sahifali sayt uchun muhim — sendagi 10,000+ vakansiya bo'lishi mumkin).
- Boshqa botlar (Yandex, ijtimoiy tarmoq preview botlari — Telegram, Facebook) ko'pincha JS'ni umuman ishga tushirmaydi → ulashilganda preview (rasm, sarlavha) chiqmaydi.
- `og:image`, `og:title` kabi teglar **link ulashilgan paytda** kerak bo'ladi — bu JS ishlamasdan, server javobida tayyor bo'lishi shart.

### Yechim: Vike (Vite SSR framework)

```bash
npm create vike@latest
# React + TypeScript template tanlanadi
```

Vike — Vite'ning rasmiy SSR kengaytmasi singari, fayl-asoslangan routing va **har bir sahifa uchun alohida `<head>` boshqaruvi** beradi:

```
pages/
  vacancy/
    @id/
      +Page.tsx        # vakansiya sahifasi komponenti
      +data.ts         # server-side data fetching (DB'dan to'g'ridan)
      +Head.tsx        # bu sahifaga xos <title>, <meta>, JSON-LD
  company/
    @slug/
      +Page.tsx
      +data.ts
  index/
    +Page.tsx          # bosh sahifa
```

Har bir `+data.ts` server tomonida ishlaydi (Node.js process ichida, to'g'ridan-to'g'ri Prisma orqali bazaga so'rov yuboradi yoki backend API'ga ichki so'rov qiladi) va natija HTML bilan birga **render qilingan holda** brauzerga yetadi. Keyin React "hydrate" bo'ladi va sahifa interaktiv SPA'ga aylanadi.

**Qaysi sahifalar SSR bo'lishi kerak (indekslanishi kerak):**
- Bosh sahifa, vakansiyalar ro'yxati/qidiruv, vakansiya detail, kompaniya profili, kasblar katalogi, maqolalar/blog.

**Qaysi sahifalar oddiy SPA (CSR) bo'lib qolishi mumkin (indekslanmaydi, `noindex`):**
- Login/register, dashboard, profil tahrirlash, ariza tarixi, employer panel, chat. Bularga `<meta name="robots" content="noindex">` qo'yiladi va `robots.txt`'da `Disallow` qilinadi.

Bu **hybrid yondashuv** — to'liq Next.js'ga o'tmasdan, lekin xuddi shu natijaga Vite ustida erishamiz, sen aytgan stackni saqlab qolamiz.

### Alternativ (agar Vike yoqmasa)
Qo'lda Express + `vite.createServer({ server: { middlewareMode: true } })` orqali SSR yozish — to'liq nazorat beradi, lekin ko'proq boilerplate talab qiladi. Vike — bu boilerplate'ning tayyor, sinab ko'rilgan versiyasi, shuning uchun birinchi navbatda shuni tavsiya qilaman.

---

## 5. Backend arxitekturasi

```
backend/
  src/
    modules/
      auth/
      users/
      resumes/
      vacancies/
      applications/
      companies/
      notifications/
      search/
      admin/
    common/
      middlewares/   (auth guard, rate-limit, error handler)
      validators/    (Zod sxemalar — frontend bilan umumiy package'da bo'lishi mumkin)
    jobs/            (BullMQ worker'lar: email, push, search-index sync)
    prisma/
      schema.prisma
    server.ts
```

Har bir modul: `*.controller.ts` (route handler) + `*.service.ts` (biznes logika) + `*.repository.ts` (Prisma so'rovlari) qatlamlariga bo'linadi — test qilish va kelajakda almashtirish osonroq bo'ladi.

---

## 6. Foydalanuvchi rollari va ruxsatlar

| Amal | Ish izlovchi | Ish beruvchi | Admin |
|---|---|---|---|
| Rezyume yaratish/tahrirlash | ✅ | ❌ | — |
| Vakansiya joylash | ❌ | ✅ (tarif chegarasida) | ✅ |
| Vakansiyaga ariza | ✅ | ❌ | — |
| Arizalarni ko'rish/boshqarish | o'zinikini | o'z kompaniyasinikini | barchasi |
| Kompaniya profilini tahrirlash | ❌ | o'zinikini | barchasi |
| Foydalanuvchi/vakansiya moderatsiyasi | ❌ | ❌ | ✅ |
| Statistika/analitika paneli | ❌ | o'z kompaniyasi bo'yicha | to'liq |

---

## 7. Funksional talablar

> Quyidagi tartib — men tavsiya qilgan ustuvorlik (xarajat, kerakli ma'lumot hajmi va dev vaqtiga qarab), oxirgi suhbatlarimiz asosida yakunlangan.

### MVP (1-bosqich) — asosiy aylanish + ishonch
- Ro'yxatdan o'tish/kirish (email + parol, keyin Google OAuth qo'shiladi)
- Ish izlovchi: profil, rezyume yaratish (tajriba, ta'lim, ko'nikmalar bloklari), rezyumeni nashr qilish/yashirish
- Ish beruvchi: kompaniya profili, vakansiya yaratish/tahrirlash/o'chirish, arizalarni ko'rish va holatini o'zgartirish (yuborildi → ko'rildi → intervyu → qabul/rad)
- **Ish beruvchi uchun rezyume bazasini qidirish** — faqat kelgan arizalarni kutish emas, balki ochiq rezyumelarni qidirib, nomzodga to'g'ridan-to'g'ri murojaat qilish (8-bo'limda ishlatiladi)
- Vakansiyalar ro'yxati: filtrlash (kasb, shahar, maosh, tajriba, ish turi), saralash, pagination
- Vakansiya detail sahifasi (SSR, to'liq SEO meta)
- Ariza yuborish (rezyume bilan yoki "rezyumesiz")
- **Kompaniya ishonch/sharh tizimi** — ariza yuborgan/intervyu o'tgan nomzod kompaniyaga sharh+yulduz qoldiradi, admin moderatsiyadan o'tkazadi. *(Sabab: hujjat boshidagi tahlilda "firibgar ish beruvchidan ehtiyot bo'ling" tashvishi bir necha marta uchradi — bu eng arzon va eng tezkor ishonch chorasi, schema tayyor.)*
- Asosiy notification: yangi ariza kelganda (employer'ga), ariza holati o'zgarganda (job seeker'ga) — email + in-app
- Sitemap.xml, robots.txt, JSON-LD (JobPosting)

### 2-bosqich — qidiruv, kengaytirilgan ishonch va Telegram
- To'liq matnli qidiruv (Meilisearch integratsiyasi)
- Saqlangan qidiruvlar + "yangi vakansiya chiqsa, xabar ber" obunasi
- Sevimlilar (bookmark)
- Web push xabarnomalar
- Kasblar katalogi, geografik bo'limlar (shahar bo'yicha sahifalar — `/tashkent`, `/samarkand`)
- Maqolalar/blog (SEO content)
- **Telegram-native ariza/chat oqimi** — shunchaki xabarnoma emas, balki nomzod Telegram bot ichida vakansiyani ko'rib, ariza yuboradi, ish beruvchi ham shu yerda javob beradi (sayt kerak emas). `applications` jadvaliga `source: site|telegram` maydoni qo'shiladi, qolgani backend logikasi bilan bog'lanadi.
- **Maosh shaffofligi/statistika sahifalari** — `/maosh/:kasb-slug` — o'z bazamizdagi vakansiyalardan agregatlangan o'rtacha/min/max maosh. Kod yengil (SQL `AVG/MIN/MAX`), lekin ma'lumot kam bo'lganda "yetarli ma'lumot yo'q" ko'rsatiladi — shuning uchun vakansiya hajmi o'sgan sari avtomatik "to'lib boradi".

### 3-bosqich — monetizatsiya va kengaytirilgan funksiyalar
- Ish beruvchi uchun tarif rejalari (cheklangan/cheksiz vakansiya, "premium/brendlangan" ko'rinish) — **schema tayyor, integratsiya kerak bo'lganda** (14-bo'lim)
- To'lov integratsiyasi (Payme/Click) — **hozircha kerak emas**
- **Ko'nikma testlari + tasdiqlangan badge** — til/Excel/tez yozish testlari, o'tgan nomzodga belgi. Asosiy qiyinlik — savollar bankini yozish (vaqt, pul emas), AI baholash shart emas.
- Admin analitika paneli (konversiya, eng ko'p qidirilgan kasblar va h.k.)
- Real-time chat (employer ↔ nomzod, sayt ichida)

### 4-bosqich — AI/til funksiyalari (pullik, xarajat talab qiladi)
- **AI nomzod-vakansiya moslashtirish** (Claude/GPT API orqali moslik foizi va sabab tushuntirish)
- **AI rezyume yozish/yaxshilash yordamchisi**
- **Avtomatik uz↔ru tarjima** (vakansiya tavsifi uchun — thehotelsaas.com'dagi MyMemory naqshiga o'xshash)

> Bu uchtasi har chaqiruvda pul to'laydigan tashqi API'ga muhtoj, shuning uchun sen aytganingdek **trafik/daromad real bo'lgandan keyin** qo'shiladi — kod arxitekturasi (masalan, `resumes`/`vacancies` jadvallari) buni hisobga olib qurilgan, keyin qo'shish qiyin bo'lmaydi.

---

## 8. Ma'lumotlar bazasi (PostgreSQL) sxemasi

> To'liq emas, lekin asosiy jadvallar va ularning bog'liqligi. Prisma schema'ga to'g'ridan-to'g'ri o'tkazish mumkin.

```
users
  id (uuid, PK)
  email (unique)
  phone
  password_hash
  role            enum: job_seeker | employer | admin
  is_email_verified
  created_at, updated_at

job_seeker_profiles
  id, user_id (FK→users, unique)
  first_name, last_name, birth_date, gender
  avatar_url
  region_id (FK→regions)
  is_open_to_work boolean

resumes
  id, job_seeker_id (FK)
  title                 -- masalan "Frontend dasturchi"
  summary
  desired_salary, currency
  employment_types      -- enum array
  status                enum: draft | published | hidden
  views_count
  created_at, updated_at

resume_experience
  id, resume_id (FK), company_name, position,
  start_date, end_date, is_current, description

resume_education
  id, resume_id (FK), institution, degree, field, start_year, end_year

resume_skills
  id, resume_id (FK), skill_name

companies
  id, owner_user_id (FK→users)
  name, legal_name, stir
  logo_url, description, website
  industry_id (FK), region_id (FK)
  is_verified boolean
  subscription_plan_id (FK, nullable)
  created_at, updated_at

company_members            -- bitta kompaniyada bir nechta HR akkaunt uchun
  id, company_id (FK), user_id (FK), role enum: owner | recruiter

vacancies
  id, company_id (FK)
  title, slug (unique, SEO uchun)
  description, requirements, conditions   -- rich text
  category_id (FK→vacancy_categories)
  region_id (FK→regions)
  address, latitude, longitude
  employment_type     enum: full_time | part_time | remote | shift
  schedule_type        enum: "5/2" | "2/2" | "vahta" | "gibkiy" | "smenniy"
  experience_required  enum: none | "1-3" | "3-6" | "6+"
  salary_min, salary_max, currency, salary_type enum: gross|net
  is_salary_hidden boolean
  apply_without_resume boolean
  status               enum: draft | moderation | active | archived | rejected
  is_urgent, is_premium boolean
  published_at, expires_at
  views_count
  created_at, updated_at

vacancy_categories          -- ierarxik kasblar katalogi
  id, parent_id (self-FK, nullable), name, slug

regions                     -- ierarxik geografiya
  id, parent_id (self-FK, nullable), name, slug

applications
  id, vacancy_id (FK), job_seeker_id (FK), resume_id (FK, nullable)
  cover_letter
  source   enum: site | telegram          -- qaysi kanaldan ariza yuborilgani
  status   enum: sent | viewed | invited | rejected | accepted
  created_at, updated_at

application_status_history
  id, application_id (FK), old_status, new_status, changed_by, created_at

favorites
  id, user_id (FK), vacancy_id (FK), created_at

saved_searches
  id, user_id (FK), name, query_params jsonb,
  email_alerts_enabled boolean, frequency enum: instant|daily, created_at

notifications
  id, user_id (FK)
  type     enum: new_application | application_status_changed |
                 new_vacancy_match | system
  title, body, payload jsonb
  is_read boolean, created_at

notification_preferences
  id, user_id (FK), notification_type, channel enum: email|push|in_app|telegram
  is_enabled boolean

articles
  id, title, slug, content, cover_image_url, author_id (FK→users)
  meta_title, meta_description
  published_at

company_reviews
  id, company_id (FK), user_id (FK), rating int, comment
  status enum: pending|approved|rejected, created_at

subscription_plans
  id, name, price, currency, max_active_vacancies, features jsonb, duration_days

payments
  id, company_id (FK), plan_id (FK), amount, status,
  provider enum: payme|click, transaction_id, created_at
```

**Indekslash bo'yicha eslatma:** `vacancies.slug`, `vacancies.status + published_at` (composite, ro'yxat sahifasi uchun), `applications.vacancy_id`, `applications.job_seeker_id`, `notifications.user_id + is_read` — bularga albatta index qo'yilsin, aks holda ro'yxat sahifalari sekinlashadi.

---

## 9. API arxitekturasi (asosiy endpointlar)

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout

GET    /api/me
PATCH  /api/me

# Rezyume
GET    /api/resumes              (o'zinikini)
POST   /api/resumes
PATCH  /api/resumes/:id
POST   /api/resumes/:id/publish
GET    /api/resumes/search       (employer — ochiq rezyumelarni qidirish/filtrlash)

# Kompaniya
GET    /api/companies/:slug      (public)
POST   /api/companies
PATCH  /api/companies/:id

# Vakansiya
GET    /api/vacancies            (public, filter+pagination — bu SSR sahifa shu APIni chaqiradi)
GET    /api/vacancies/:slug      (public)
POST   /api/vacancies            (employer)
PATCH  /api/vacancies/:id
DELETE /api/vacancies/:id

# Ariza
POST   /api/vacancies/:id/apply
GET    /api/applications                    (job seeker, o'zinikini)
GET    /api/vacancies/:id/applications       (employer)
PATCH  /api/applications/:id/status

# Qidiruv (Meilisearch orqali)
GET    /api/search/vacancies?q=&region=&salary_min=&experience=

# Sevimlilar / Saqlangan qidiruv
POST   /api/favorites/:vacancyId
DELETE /api/favorites/:vacancyId
POST   /api/saved-searches
GET    /api/saved-searches

# Notification
GET    /api/notifications
PATCH  /api/notifications/:id/read
WS     /ws  (Socket.io — real-time push)

# SEO
GET    /sitemap.xml              (index, sub-sitemaplarga yo'naltiradi)
GET    /sitemap-vacancies-:n.xml
GET    /robots.txt

# Kompaniya sharhlari
GET    /api/companies/:id/reviews
POST   /api/companies/:id/reviews        (faqat ariza yuborgan/intervyu o'tgan nomzod)
PATCH  /api/admin/reviews/:id/moderate

# Maosh statistikasi
GET    /api/salary-stats/:categorySlug   (agregatlangan, public, SSR sahifa shu yerdan oladi)

# Telegram bot
POST   /api/telegram/webhook             (bot update'larini qabul qiladi)

# Admin
GET    /api/admin/vacancies?status=moderation
PATCH  /api/admin/vacancies/:id/approve
```

---

## 10. SEO strategiyasi (chuqur)

1. **Rendering** — 4-bo'limda tasvirlangan SSR (Vike). Bu hamma narsaning poydevori.

2. **Har sahifaga xos meta-tegtar.** Vakansiya sahifasi misolida:
   ```html
   <title>Frontend dasturchi (React) — UZUM TECHNOLOGIES | hh.uz</title>
   <meta name="description" content="Frontend dasturchi vakansiyasi UZUM TECHNOLOGIES kompaniyasida. Maosh: 15-25 mln so'm. Toshkent." />
   <link rel="canonical" href="https://site.uz/vakansiya/12345-frontend-dasturchi" />
   <meta property="og:title" content="..." />
   <meta property="og:description" content="..." />
   <meta property="og:image" content="https://site.uz/og/vacancy/12345.png" />
   <meta property="og:type" content="website" />
   <meta name="twitter:card" content="summary_large_image" />
   ```
   Bularning hammasi `+Head.tsx` (Vike) ichida, vakansiya ma'lumotidan dinamik generatsiya qilinadi.

3. **JSON-LD `schema.org/JobPosting`** — bu eng katta SEO yutug'i: to'g'ri to'ldirilsa, vakansiya **Google for Jobs**'da maxsus rich-snippet sifatida chiqishi mumkin (oddiy organik natijadan ancha ko'proq bosiladi):
   ```json
   {
     "@context": "https://schema.org/",
     "@type": "JobPosting",
     "title": "Frontend dasturchi",
     "description": "...",
     "datePosted": "2026-06-20",
     "validThrough": "2026-07-20",
     "employmentType": "FULL_TIME",
     "hiringOrganization": {
       "@type": "Organization",
       "name": "UZUM TECHNOLOGIES",
       "logo": "https://..."
     },
     "jobLocation": {
       "@type": "Place",
       "address": { "addressLocality": "Tashkent", "addressCountry": "UZ" }
     },
     "baseSalary": {
       "@type": "MonetaryAmount",
       "currency": "UZS",
       "value": { "@type": "QuantitativeValue", "minValue": 15000000, "maxValue": 25000000, "unitText": "MONTH" }
     }
   }
   ```
   Kompaniya sahifasi uchun `Organization`, navigatsiya uchun `BreadcrumbList` schema ham qo'shiladi.

4. **Sitemap** — vakansiyalar soni minglab bo'lganda bitta faylga sig'maydi (Google chegarasi: faylga 50,000 URL). Shuning uchun **sitemap index** tuzilishi:
   ```
   /sitemap.xml                  → index, quyidagilarga yo'naltiradi
   /sitemap-vacancies-1.xml       → 1-50000 vakansiya
   /sitemap-companies.xml
   /sitemap-articles.xml
   /sitemap-static.xml           → bosh sahifa, kategoriyalar
   ```
   Cron job (BullMQ repeatable job) bilan har necha soatda qayta generatsiya qilinadi va Redis/fayl tizimida keshlanadi (har safar so'rov kelganda DB'ga urilmasin).

5. **robots.txt:**
   ```
   User-agent: *
   Disallow: /dashboard
   Disallow: /admin
   Disallow: /api
   Disallow: /account
   Sitemap: https://site.uz/sitemap.xml
   ```

6. **URL strukturasi** — inson o'qiy oladigan, kalit so'z bor slug:
   `/vakansiya/12345-frontend-dasturchi-react`, `/kompaniya/uzum-technologies`, `/maqola/rezyume-qanday-yoziladi`, `/qidiruv?kasb=it&shahar=tashkent`

7. **Performance (Core Web Vitals)** — rasm uchun WebP/AVIF + lazy-load, route-based code splitting (Vike buni avtomatik qiladi), static asset'lar uchun CDN (Cloudflare), LCP/CLS/INP monitoring (masalan Vercel Analytics yoki o'z Sentry'ing orqali).

8. **Ko'p tillik (agar uz/ru/en rejalashtirilsa)** — `hreflang` teglari + til bo'yicha alohida URL (`/ru/vakansiya/...`) — hh.uz buni qilmaydi (faqat ru), lekin O'zbekiston bozori uchun uz+ru muhim bo'lishi mumkin.

---

## 11. Notification (xabarnoma) tizimi

### Trigger hodisalar
| Hodisa | Qabul qiluvchi | Kanal (default) |
|---|---|---|
| Yangi ariza tushdi | Ish beruvchi | in-app + email |
| Ariza holati o'zgardi (ko'rildi/intervyu/rad/qabul) | Ish izlovchi | in-app + email |
| Saqlangan qidiruvga mos yangi vakansiya chiqdi | Ish izlovchi | email (kunlik/instant) |
| Tarif/obuna tugashiga 3 kun qoldi | Ish beruvchi | in-app + email |
| Profil/rezyume to'ldirilmagan eslatmasi | Ish izlovchi | in-app |

### Arxitektura
```
Hodisa yuz beradi (masalan, ariza yaratildi)
        ↓
NotificationService.create()  → notifications jadvaliga yoziladi
        ↓
BullMQ queue'ga job qo'shiladi (har kanal uchun alohida: email-job, push-job)
        ↓
   ┌────────────┬─────────────┬──────────────┐
   │ email-worker│ push-worker │ telegram-worker (ixtiyoriy)│
   └────────────┴─────────────┴──────────────┘
        ↓
Agar foydalanuvchi onlayn (Socket.io connection mavjud) bo'lsa →
shu zahoti WebSocket orqali ham yuboriladi (bell counter yangilanadi)
```

- **In-app:** Socket.io orqali (`io.to(userId).emit('notification', payload)`), frontendda bell ikonkasi + dropdown ro'yxat.
- **Email:** BullMQ worker → Nodemailer (yoki Resend API, sozlash osonroq) → HTML shablon (React Email kabi kutubxona bilan yozish qulay).
- **Web Push:** `web-push` npm paketi + VAPID kalitlar, foydalanuvchi brauzerda ruxsat bersa, service worker orqali sayt yopiq bo'lsa ham push keladi.
- **Telegram (ixtiyoriy, lekin tavsiya etiladi):** sen aiogram3 bilan tajriban bor — foydalanuvchi profilida "Telegram botni ulash" tugmasi, deep-link orqali `chat_id` saqlanadi, keyin xohlagan xabarni shu orqali ham yuborish mumkin. Bu O'zbekiston foydalanuvchilari uchun email'dan ko'ra ishonchliroq kanal bo'lishi mumkin.
- Har bir foydalanuvchi `notification_preferences` orqali qaysi hodisa uchun qaysi kanalni xohlashini sozlay oladi (hammasi yoqilgan bo'lib boshlanadi, keyin o'chirib qo'yish mumkin).

---

## 12. Qidiruv tizimi

PostgreSQL'ning `ILIKE`/full-text search'i boshlang'ich bosqichda yetadi, lekin filtrlash murakkablashganda (kasb + shahar + maosh + tajriba + kalit so'z — bir vaqtda) sekinlashadi. Shuning uchun:

- **Meilisearch** — vakansiyalar `vacancies` jadvalidan **sync** qilinadi (yangi/yangilangan/o'chirilgan vakansiya → BullMQ job → Meilisearch index yangilanadi).
- Frontend qidiruv so'rovi to'g'ridan-to'g'ri PostgreSQL'ga emas, Meilisearch'ga boradi — natija millisekundlarda, typo-tolerant ("dasturchi" deb yozsa "dasturchhi" ham topadi), faceted filter (har filtr bo'yicha nechta natija borligini ko'rsatadi — xuddi hh.uz'dagi kategoriya yonidagi raqamlar kabi).

---

## 13. Xavfsizlik

- **Auth:** JWT access token (qisqa muddat, 15 daq) + refresh token (HttpOnly cookie, rotatsiya bilan, 30 kun).
- **Rate limiting:** Redis-asoslangan (masalan `@fastify/rate-limit` + Redis store) — ayniqsa `/auth/login`, `/vacancies/:id/apply` endpointlarida (spam ariza/bot himoyasi).
- **Validatsiya:** har bir input Zod sxema orqali — frontend va backend bitta sxemani umumiy `packages/shared-types` paketidan import qilishi mumkin (monorepo bo'lsa).
- **Fayl yuklash:** resume PDF/DOCX uchun fayl turi + hajm cheklovi, virus scan (ClamAV, agar resurs imkon bersa) yoki kamida MIME-type tekshiruvi.
- **CORS:** faqat o'z domeningga ruxsat.
- **SQL injection:** Prisma parametrlangan so'rovlar bilan himoyalangan, lekin raw query yozsang ehtiyot bo'l.

---

## 14. Monetizatsiya modeli — hozircha qisqartirilgan scope

Sen aytganingdek, to'lov tizimi (Payme/Click) **hozir kerak emas** — bu mijozning keyingi bosqich ishi. Shunga ko'ra:

- `subscription_plans` va `payments` jadvallari **sxemada qoladi** (kelajakda kerak bo'lganda osон qo'shish uchun), lekin **hech qanday to'lov integratsiyasi MVP'da yozilmaydi**.
- `vacancies` jadvalida `is_premium`/`is_urgent` maydonlari qoladi, lekin ularni yoqish/o'chirish hozircha **faqat admin panel orqali qo'lda** (mijoz xohlasa, birorta kompaniyaga "qo'lda" premium belgi qo'yadi) — to'liq avtomatik tarif-tizimi keyinroq.

Bu blokni butunlay olib tashlamadim, chunki keyinchalik mijoz "endi to'lov qo'shaylik" desa, schema tayyor turadi — faqat integratsiya qatlami qo'shiladi.

---

## 15. Monorepo / papka strukturasi

```
job-platform/
  apps/
    web/              ← Vite + Vike + React (frontend)
    api/              ← Node.js + Fastify (backend)
```

Frontend va backend bitta repo ichida, lekin mustaqil deploy qilinadi
(web — Vercel, api — Railway).

---

## 16. Rivojlanish bosqichlari (Roadmap)

1. **Hafta 1-2:** Monorepo setup, Prisma schema + migratsiya, auth (register/login/JWT), asosiy CRUD (vacancies, resumes) — hali SSR'siz, oddiy Vite SPA'da tezda ko'rish uchun.
2. **Hafta 3:** Vike'ga o'tish (SSR), vakansiya/kompaniya sahifalariga meta-teg + JSON-LD qo'shish, sitemap+robots.
3. **Hafta 4:** Ariza oqimi to'liq (apply → status o'zgarishi) + **kompaniya ishonch/sharh tizimi** + **ish beruvchi uchun rezyume qidirish**, notification (DB + email, hali real-time'siz).
4. **Hafta 5:** Socket.io real-time notification, Meilisearch qidiruv integratsiyasi.
5. **Hafta 6-7:** **Telegram-native ariza/chat bot** (to'liq oqim, faqat xabarnoma emas), **maosh statistikasi sahifalari**, admin panel.
6. **Hafta 8+:** **Ko'nikma testlari + badge**, monetizatsiya (tarif, Payme/Click — faqat kerak bo'lganda), AI/tarjima funksiyalari (faqat daromad real bo'lganda).

> Eslatma: bu — texnik bosqichlar. **17-bo'lim (bozorga chiqish)** bilan parallel yuradi — masalan, "Hafta 1-2" davomida allaqachon birinchi 10-20 kompaniya bilan qo'lda gaplashishni boshlash kerak, kod tayyor bo'lishini kutib o'tirmasdan.

---

## 17. Bozorga chiqish strategiyasi (Go-to-Market)

Sen "keng O'zbekiston bozori uchun to'liq tijoriy mahsulot" tanlading — bu eng qiyin, lekin eng katta potentsialli yo'l. hh.uz'ning 10,800+ vakansiyasi va yillar davomidagi SEO mavqeiga qarshi **bevosita** kirish ishlamaydi. Shuning uchun: **mahsulot keng bo'lib qoladi, lekin ishga tushirish (launch) tor boshlanishi kerak.**

### Taklif qilinadigan ketma-ketlik

1. **Bitta vertikal/segmentdan boshla, butun bozorga emas.** Eng mantiqiy tanlov — **IT/tex vakansiyalar, Toshkent shahri**: sen bu sohada shaxsan tanish (dev community, Telegram kanallar, hackathon aloqalari), IT kompaniyalarni onlayn ro'yxatdan o'tkazish osonroq (ular allaqachon raqamli), va bu segmentda "tezkor, qulay UX" bilan hh.uz'dan ustun chiqish mumkin (hh.uz — universal, hamma sohaga mo'ljallangan, shuning uchun IT uchun maxsus emas). Keyin segmentlarni asta-baft kengaytirasan (savdo, marketing, va h.k.) — texnik tomondan tizim boshidanoq cheklanmagan, faqat **marketing/onboarding e'tibori** tor boshlanadi.

2. **Birinchi 20-50 kompaniyani qo'lda top.** Kod tayyor bo'lishini kutmasdan, hozir boshlash mumkin: tanish IT kompaniyalar, hackathon orqali tanishgan jamoalar, universitet aloqalari (BuxDU va boshqa universitet kareyra markazlari) — ularga "birinchi bo'lib bepul joylashtiring" deb taklif qil. Bu — eng arzon va eng ishonchli validatsiya: agar 20 kompaniyani ko'ndira olmasang, kodlash boshlanishidan oldin shuni bilish foydaliroq.

3. **Telegram — eng kuchli tarqatish kanali.** O'zbekistonda ish e'lonlari Telegram kanallarida juda faol tarqaladi (men tekshirgan manbalarda buni ko'rdim). Sening aiogram3 tajribang bilan: (a) "Yangi IT vakansiyalar" avtomatik xabar beruvchi kanal/bot yarat — bu ham notification tizimining bir qismi, ham mustaqil marketing kanali; (b) foydalanuvchilar saytga kirmasdan ham Telegram orqali vakansiya ko'rib, "ariza yuborish" tugmasini bosishi mumkin (deep link orqali saytga olib keladi — bu konversiyani oshiradi).

4. **SEO content kuni birinchidan boshlanadi, vakansiyadan oldin.** Maqolalar bo'limi (8-bo'limdagi rejaga ko'ra) — "rezyume qanday yoziladi", "IT sohasida ish qanday topiladi" kabi mavzularda — vakansiya hali kam bo'lsa ham, organik trafik va Google ishonchini yig'a boshlaydi. Bu — vakansiya soni o'sguncha "bo'sh" ko'rinmaslik uchun ham foydali.

5. **Raqobatchidan ma'lumot olishda ehtiyot bo'l.** hh.uz'ni `robots.txt` orqali tekshirganimda vakansiya sahifalari **scraping'dan himoyalangan** ekanini ko'rdim. hh.uz'dan vakansiya "qarzga olish" (scrape qilish) — nafaqat texnik jihatdan to'sib qo'yilgan, balki huquqiy jihatdan ham xavfli. Kontentni faqat kompaniyalarning o'z saytlaridan (ochiq "vakansiyalar" sahifalari) yoki ular bilan to'g'ridan-to'g'ri kelishib olish kerak.

### Eslatma — bu mijoz vakolati

Diyorbek bu loyihani buyurtma asosida quryapti — domen/brend, mijozlarni topish (sales/BD), va to'lov tizimi mijozning o'z ishi. Yuqoridagi 5 band (segmentdan boshlash, kompaniyalarni topish, Telegram tarqatish, SEO content, raqobatchi kontentidan ehtiyot bo'lish) shu sababli **ixtiyoriy ma'lumot** sifatida qoldirildi — mijoz so'ragandagina foydalaniladi, kod arxitekturasiga ta'siri yo'q.

**Faqat bitta band texnik ta'sirga ega va mijozdan so'rash kerak:** ma'lumotlar bazasi serveri **qayerda joylashadi** (O'zbekiston ichida, yoki xorijda — Hetzner/AWS kabi). 4-bo'limdagi huquqiy eslatmaga ko'ra, agar mijoz xizmatni O'zbekistonda rasmiy yuritmoqchi bo'lsa, bu qaror hosting/deploy arxitekturasiga (Docker Compose joylashuvi, backup strategiyasi) ta'sir qiladi — shuning uchun kodlashni boshlashdan oldin emas, lekin **deploy bosqichidan oldin** mijozdan aniqlashtirish kerak bo'ladi.

---

## 18. Keyingi qadam

Qarorlar shu bo'yicha qotdi:
- **Frontend:** Vite + React + TypeScript, SSR — **Vike**
- **Maqsad:** keng O'zbekiston bozori uchun to'liq tijoriy mahsulot (mijoz uchun buyurtma loyihasi)
- **To'lov tizimi:** MVP'da yo'q, schema tayyor turadi (14-bo'lim)
- **Go-to-market/domen/sotish:** mijozning o'z ishi, Diyorbekning vazifasi emas

Qolgan ikkita kichik narsa (ko'p tillik — faqat uz yoki uz+ru ham kerakmi, va DB serveri joylashuvi) — bularni kodlash jarayonida yoki deploy oldidan hal qilsak ham bo'ladi, hozir to'xtatib turishga arzimaydi.

Endi **kodlashga o'tamiz**: monorepo setup'dan boshlab (pnpm workspaces, Prisma schema to'liq yozib, Docker Compose bilan Postgres+Redis), keyin auth + vacancy CRUD'ning birinchi ishlaydigan versiyasini quramiz.

Boshlaymizmi?

---

## 19. Amalga oshirilgan holat (2026-08-25)

Bu hujjat — kodlashdan **oldingi** loyihalash. Quyida rejadagi bo'limlarning
hozirgi kodda qay darajada bajarilgani ko'rsatilgan. Har bir o'zgarish tarixi:
[`CHANGELOG.md`](./CHANGELOG.md).

| Reja bo'limi | Holat | Izoh |
|---|---|---|
| 4. SSR va SEO (Vike) | ✅ | Uch tilli hreflang, canonical, JSON-LD, sitemap, dinamik OG rasm |
| 5. Auth | ✅ | Email+parol, Telegram, Google; argon2 + JWT (access + httpOnly refresh) |
| 8. DB sxemasi | ✅ | To'liq; keyin `is_blocked`, `push_subscriptions`, tarif maydonlari qo'shildi |
| 9. Vakansiya va ariza tsikli | ✅ | Yaratish, tahrirlash, arxivlash, ariza, holat tarixi |
| 10. Rezyume | ✅ | Saytda to'ldiriladi + PDF yuklash |
| 11. Qidiruv (Meilisearch) | ✅ | Meilisearch **ixtiyoriy** drayver; default — PostgreSQL (AND mantiqli) |
| 12. Notification | ✅ | Bitta `notify()` xizmati: sayt / Telegram / brauzer push / email |
| 12b. Saqlangan qidiruv (alerts) | ✅ | Fon jarayoni + cron buyrug'i |
| 13. Real-time chat | ✅ | WebSocket; o'zaro 5 yulduzli baho ham qo'shildi |
| 14. Monetizatsiya | ❌ | **O'chiq** — `BILLING_ENABLED=false` (D-014, D-065). Platforma bepul, vakansiya limiti yo'q, tariflar sahifasi `/employer` ga yo'naltiriladi. Billing kodi meros sifatida turadi. |
| 15. Admin panel | ✅ | Moderatsiya, foydalanuvchilar, statistika, to'lovlar, ommaviy xabar |
| — Maosh statistikasi | ✅ | Rejada alohida bo'lim yo'q edi, hh.uz tahlilidan olingan |
| Redis + BullMQ | ⏳ | Redis konteynerda bor, lekin navbat (queue) ishlatilmayapti — xabarnomalar
to'g'ridan-to'g'ri yuboriladi. Yuklama o'sganda BullMQ'ga o'tkazish kerak. |
| S3 / MinIO fayl saqlash | ⏳ | Fayllar hozircha serverning `uploads/` papkasida. Bir nechta
instansiyaga tarqalganda S3'ga o'tkazish kerak. |
| Shahar bo'yicha subdomain | ⏳ | Hozircha `?area=` query bilan. Subdomain (`tashkent.…`)
SEO uchun keyingi bosqich. |

### Deploy oldidan hal qilinadigan savollar

1. **Baza serveri qayerda joylashadi** (17-bo'lim) — O'zbekiston ichidami yoki xorijda.
2. **To'lov provayderi shartnomasi** — Payme yoki Click merchant kalitlari. Kod
   ikkalasiga ham tayyor; kalit yo'q bo'lsa tizim admin tasdig'i rejimida ishlaydi.
3. **SMTP provayderi** — xabarnoma xatlari uchun.
4. **Domen** — hozircha `SITE_URL` va `apps/web/src/lib/i18n/config.ts` dagi
   `SITE_ORIGIN` da `ishbor-ishkerak.uz` turibdi, domen aniqlanganda ikkalasini
   yangilash kerak.
