# ISH BOR! — ish qidirish platformasi

O'zbekiston uchun ish izlovchi ↔ ish beruvchi platformasi. hh.uz tahlili asosida
loyihalangan (to'liq loyihalash hujjati: [`tizim-arxitekturasi.md`](./tizim-arxitekturasi.md)).

Uch tilda ishlaydi (o'zbek / rus / ingliz), sahifalar server tomonda render
qilinadi (SSR) — shuning uchun har bir vakansiya, kompaniya va maosh sahifasi
Google va Telegram preview botlari uchun tayyor meta-teglar bilan keladi.

---

## Tarkib

| Papka | Nima |
|---|---|
| `apps/api` | Node.js + Fastify + Prisma + MongoDB. Barcha biznes-mantiq va API. |
| `apps/web` | Vite + Vike (SSR) + React 18 + TypeScript + Tailwind. Sayt. |
| `DEPLOY.md` | Vercel + Railway + MongoDB Atlas ga chiqarish qo'llanmasi. |
| `tizim-arxitekturasi.md` | Kodlashdan oldingi to'liq loyihalash hujjati. |

---

## Tezkor boshlash

### 1. Baza

Loyiha **MongoDB** da ishlaydi. Prisma tranzaksiyalari **replica set** talab
qiladi, shuning uchun oddiy bitta `mongod` yetmaydi. Ikki yo'l bor:

**A) MongoDB Atlas (eng oson, Docker kerak emas).**
[cloud.mongodb.com](https://cloud.mongodb.com) da bepul M0 klaster oching va
ulanish satrini `.env` ga qo'ying. Dev uchun ham shu yetarli.

**B) Mahalliy MongoDB (replica set).**

MongoDB'ni o'rnatib, uni ALOHIDA port va `--replSet` bilan ishga tushiring —
Windows xizmati sifatida o'rnatilgan oddiy `mongod` (27017, replikatsiyasiz)
Prisma tranzaksiyalariga yaramaydi:

```bash
mongod --port 27018 --replSet rs0 --dbpath <ma'lumot-papkasi> --bind_ip 127.0.0.1
```

Birinchi marta replica set'ni bir marta ishga tushirish kerak:

```bash
mongosh --port 27018 --eval "rs.initiate()"
```

Ulanish satri:
`mongodb://127.0.0.1:27018/ishbor?replicaSet=rs0`

### 2. Backend

```bash
cd apps/api
cp .env.example .env      # ichidagi izohlarni o'qing
npm install               # postinstall o'zi `prisma generate` qiladi
npm run prisma:push       # kolleksiya va indekslarni yaratadi
npm run prisma:seed       # namunaviy ma'lumot (ixtiyoriy)
npm run dev
```

API `http://localhost:3000` da ko'tariladi.
Tekshirish: `GET /health` → `{"ok":true,"db":"up","redis":"off"}`
(`redis` maydoni: `off` — sozlanmagan, `ready` — ulangan, `down` — uzilgan).

### 3. Frontend

```bash
cd apps/web
cp .env.example .env
npm install
npm run dev
```

Sayt `http://localhost:5173` da ochiladi.

> Ildizdan turib ham boshqarish mumkin: `npm run install:all`, `npm run dev:api`,
> `npm run dev:web`, `npm run build`, `npm run typecheck`, `npm run db:push`.

### 4. Admin hisobi

`apps/api/.env` ga qo'ying:

```
ADMIN_EMAIL="siz@example.uz"
ADMIN_PASSWORD="kamida-8-belgi"
```

Server keyingi ko'tarilishida shu email bilan **admin** hisobini yaratadi - faqat
bunday email bilan hisob umuman bo'lmasa. Mavjud hisob avtomatik adminga
KO'TARILMAYDI (audit R3, D-069: aks holda `ADMIN_EMAIL` bilan ro'yxatdan o'tgan
begona odam keyingi restartda admin bo'lib qolardi). Parol qayta yozilmaydi.
Admin panel: `/admin`.

---

## Nima ishlaydi

### Ish izlovchi
- Ro'yxatdan o'tish / kirish: **email + parol** yoki **Google orqali**
  (Telegram orqali kirish YO'Q: Telegram faqat telefonni tasdiqlash va parolni tiklash uchun)
- **Parolni tiklash** Telegram orqali: `/login?recover=1` -> botdagi tasdiq -> yangi parol.
  Telegram ham, telefon ham yo'qolgan bo'lsa - admin ko'rib chiqadigan qo'lda tiklash so'rovi
- Vakansiya qidiruvi: matn, kasb, hudud, tajriba, bandlik turi, maosh oralig'i
- Saralash: mosligi / yangiligi / maosh bo'yicha
- **Saqlangan vakansiyalar** (yurakcha) — `/favorites`
- **Qidiruv obunalari**: so'rovni saqlab qo'yasiz, mos vakansiya chiqsa xabar keladi — `/alerts`
- **Bildirishnomalar**: sayt ichida, Telegram, brauzer push, email — `/notifications`
- Saytda to'ldiriladigan rezyume (tajriba, ta'lim, ko'nikmalar) + PDF yuklash
- Ariza yuborish, holatini kuzatish
- Ish beruvchi bilan real-time chat, o'zaro 5 yulduzli baho
- Kompaniyaga sharh qoldirish (faqat ariza yuborganlar)
- **Maosh statistikasi** — kasb va hudud kesimida mediana/o'rtacha, taqsimot — `/salaries`

### Ish beruvchi
- Kompaniya profili, logotip, hudud, soha
- Vakansiya joylash, **tahrirlash**, arxivlash, o'chirish
- Kelgan arizalar: holat o'zgartirish (ko'rildi / taklif / rad / qabul) + sabab
- Nomzodlar bazasidan qidiruv — bepul; nomzodning email/telefoni faqat shu kompaniya vakansiyasiga ariza yuborgan bo'lsa ko'rinadi, boshqalarga platforma ichidagi chat orqali yoziladi
- Faol vakansiyalar soni cheklanmagan — platforma hozircha to'liq bepul
- Monetizatsiya (tariflar, to'lov) kodi `BILLING_ENABLED=false` bayrog'i ortida o'chiq; `/pricing` sahifasi `/employer` ga yo'naltiriladi

### Admin
- `/admin` — ko'rsatkichlar, 14 kunlik dinamika (ro'yxatdan o'tish / arizalar)
- `/admin/users` — qidiruv, bloklash, rol berish
- `/admin/vacancies` — moderatsiya: tasdiqlash, rad etish (sabab bilan), arxivlash, premium
- `/admin/companies` — tasdiqlangan ish beruvchi belgisi
- `/admin/reviews` - sharhlar moderatsiyasi
- `/admin/articles` - maqolalar (kontent jamoasi), `/admin/team` - jamoa va rollar
- `/admin/users` ichida "Tiklash so'rovlari" - qo'lda hisob tiklash (tasdiqlash / rad etish)
- `/admin/payments` - eski to'lov yozuvlari (monetizatsiya o'chiq)
- Xizmat amallari: qidiruv indeksini qayta qurish, obunalarni tekshirish, ommaviy xabar

### SEO
- Har sahifada unikal `<title>`, `description`, canonical, OG teglar, uch tilli `hreflang`
- Vakansiya sahifalarida JSON-LD (`JobPosting`)
- `robots.txt` - shaxsiy bo'limlar (profil, xabarlar, saqlanganlar, obunalar, admin) uch tilda
  taqiqlangan; `/api` yopiq, lekin `/api/og/` ochiq (OG rasmlar uchun), `/uploads/` yopiq
- `sitemap.xml` -> `sitemap-static.xml` (kasb va hudud kesimidagi maosh sahifalari bilan),
  `sitemap-vacancy.xml`, `sitemap-employer.xml`, `sitemap-articles.xml` (API'da 1 soat keshlanadi)
- Ijtimoiy tarmoq uchun har bir vakansiyaga **dinamik OG rasm**: `/api/og/vacancy/:slug`

---

## Xizmatlar va kalitlar

`.env` da kalit paydo bo'lishi bilan tegishli funksiya o'z-o'zidan yoqiladi.
Bitta xizmat **ixtiyoriy emas**: Telegram boti production'da majburiy (D-072).

| Xizmat | `.env` kaliti | Yo'q bo'lsa nima bo'ladi |
|---|---|---|
| **Telegram bot (production'da MAJBURIY)** | `TELEGRAM_BOT_TOKEN` | Telefonni tasdiqlab bo'lmaydi, shu sababli ariza yuborish, vakansiya joylash, chat, sharh va nomzodlar bazasi ochilmaydi; parolni tiklash ham ishlamaydi. Server yiqilmaydi: startupda ogohlantirish yoziladi, UI esa "Telegram orqali tasdiqlash hozircha mavjud emas" deydi (Rule K) |
| Google kirish | `GOOGLE_CLIENT_ID` | Google tugmasi ko'rinmaydi |
| Email | `SMTP_HOST` va h.k. | Xatlar yuborilmaydi, konsolga yoziladi |
| Brauzer push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Push o'chiq (`npm run push:keys` bilan kalit yaratiladi) |
| Meilisearch | `MEILI_HOST` | Qidiruv MongoDB orqali ishlaydi |
| SSR rate-limit kaliti | `SSR_API_KEY` (API va sayt serverida bir xil) | SSR so'rovlari brauzerlar bilan bitta IP bucket'ida qoladi va katta trafikda 429 bo'lishi mumkin (D-074) |
| Payme / Click | `BILLING_ENABLED=true` + `PAYME_*`, `CLICK_*` | Sukut bo'yicha o'chiq (platforma bepul): tarif, checkout va to'lov webhook yo'llari ro'yxatdan o'tmaydi |

### Telegram nima uchun ishlatiladi

- **Telefonni tasdiqlash** (kontakt ulashish orqali) - spam va soxta arizalarning oldini oladi.
- **Parolni tiklash**: tiklash havolasi faqat hisobga bog'langan Telegram identity'ga boradi.
- **Bildirishnomalar** va support xabarlari.

Telegram **kirish (login) kanali EMAS**: `/api/auth/telegram/start` va `/poll` olib tashlangan
(audit R3, D-041).

### Qidiruv haqida

Qidiruv ikki drayverli:

1. **MongoDB** (default) — qo'shimcha xizmat kerak emas. So'rov so'zlarga
   bo'linadi va har bir so'z sarlavha / tavsif / talablar / kompaniya nomi /
   kategoriya ichida uchrashi talab qilinadi (AND mantiq).
2. **Meilisearch** (`MEILI_HOST` berilsa) — xato yozilishga chidamli
   ("dasturchu" → "dasturchi"), tezroq, relevantlik bo'yicha saralaydi.

Meilisearch ko'tarilmasa yoki so'rov paytida xato bersa, kod jimgina MongoDB
drayveriga tushadi — sayt hech qachon "qidiruv ishlamayapti" holatiga tushmaydi.
Qaysi drayver ishlayotganini `/admin` sahifasida ko'rish mumkin.

### Ko'rishlar hisoblagichi haqida

Vakansiya va maqoladagi "N marta ko'rilgan" soni uch qoida bilan ishlaydi:

1. **Ko'rish sahifa ma'lumoti so'ralganda emas, brauzerdan alohida signal bilan
   sanaladi** — shu sababli botlar, havola ko'rinishlari va SSR so'rovlari sanalmaydi.
2. **Bitta ko'ruvchi 24 soatda bir marta** (`VIEW_DEDUPE_SEC`): sahifani qayta
   yangilash sonni oshirmaydi. Kirgan foydalanuvchi hisobi bo'yicha, kirmagani
   IP + brauzer bo'yicha ajratiladi.
3. **Bazaga yig'ib yoziladi**: oshirishlar buferda to'planib, har 30 soniyada
   (`VIEW_FLUSH_MS`) bitta bulk yozuv bilan tushadi — 1000 ta ko'rish = 1 ta so'rov.
   Shuning uchun sahifadagi son yarim daqiqagacha kechikishi mumkin.

### Yuklangan fayllar haqida

Logo, maqola muqovasi va PDF rezyume ikki xil joyda saqlanishi mumkin:

1. **Lokal disk** (sukut) — `UPLOAD_DIR` papkasi. Dev uchun shunday qulay.
2. **S3-mos xotira** (Cloudflare R2, AWS S3, B2, MinIO) — `S3_BUCKET` va kalitlar berilsa.
   Bunda fayllar platformaga bog'liq bo'lmaydi va API'ni bir nechta nusxada ishlatish mumkin.

PDF rezyume ikkala holatda ham **ochiq havola olmaydi**: u faqat egasiga, ariza kelgan
kompaniyaga va adminga, vakolat tekshirilgandan keyin beriladi.

### Redis haqida (ixtiyoriy)

Redis **shart emas** — u bo'lmasa hamma narsa jarayon xotirasida ishlaydi va sayt
to'liq ishlaydi (bitta nusxada). `REDIS_URL` berilsa ko'rishlar buferi, kvotalar,
rate-limit, kesh yangilanishi va WebSocket xabarlari API nusxalari orasida umumiy
bo'ladi — ya'ni API'ni bir nechta nusxada ishlatish mumkin bo'ladi (DEPLOY.md).
Redis uzilib qolsa kod jimgina xotiradagi zaxira yo'lga tushadi.

### Bildirishnomalar haqida

Barcha bildirishnomalar bitta nuqtadan o'tadi (`notify()` xizmati) va
foydalanuvchining sozlamasiga qarab kanallarga tarqaladi:

- **Saytda** — bazaga yoziladi, sayt ochiq bo'lsa WebSocket orqali darrov keladi
- **Telegram** — bot bog'langan bo'lsa
- **Brauzer push** — obuna bo'lgan bo'lsa
- **Email** — SMTP sozlangan bo'lsa

Foydalanuvchi har bir hodisa turi uchun har bir kanalni alohida yoqib/o'chira
oladi: `/notifications` → «Sozlamalar».

---

## Deploy: Vercel + Railway + MongoDB Atlas

Bosqichma-bosqich qo'llanma — [`DEPLOY.md`](./DEPLOY.md). Qisqacha:

| Qism | Qayerda | Root Directory | Sozlama fayli |
|---|---|---|---|
| Sayt (SSR) | Vercel | `apps/web` | `apps/web/vercel.json` |
| API | Railway | `apps/api` | `apps/api/railway.json` |
| Baza | MongoDB Atlas (M0) | — | — |

Ikkala sozlama fayli repozitoriyda tayyor — dashboard'da faqat Root Directory
va muhit o'zgaruvchilarini kiritish qoladi.

Eng ko'p unutiladigan narsalar:

- Railway'da **`NODE_ENV=production`** - seans cookie'si aynan shunda
  `SameSite=None; Secure` bo'ladi.
- Railway'da **`WEB_ORIGIN`** - saytning domeni. CORS shundan ochiladi.
- **Sayt va API bitta domen ostida bo'lsin** (`ishbor.uz` va `api.ishbor.uz`).
  `*.vercel.app` + `*.up.railway.app` juftligida refresh cookie third-party bo'lib qoladi
  va Safari/Brave uni bloklaydi: seans 15 daqiqada tugaydi (audit R3, D-076).
- **`TELEGRAM_BOT_TOKEN`** - production'da majburiy (D-072).
- **`npm run db:sync`** - sxema o'zgargan bo'lsa deploydan OLDIN qo'lda ishga tushiriladi:
  `npm start` endi `db push` qilmaydi (audit R3, D-056).

---

## O'z serveringizda ishga tushirish

Ikkita jarayon: API va sayt.

```bash
npm run build                  # ikkala ilova

# 1) API  (sxema o'zgargan bo'lsa AVVAL: cd apps/api && npm run db:sync)
cd apps/api && npm start                                   # :3000

# 2) Sayt
cd apps/web && npm start                                   # :3001
```

`apps/web/server/index.mjs` — saytning production serveri (Fastify + Vike SSR).
U uchta ishni bajaradi:

- **siqish** — brotli/gzip (SSR HTML ~25 KB dan ~6 KB ga tushadi);
- **kesh** — `/assets/**` bir yil `immutable` (nomida kontent hash'i bor),
  `sw.js` keshlanmaydi, qolgan statik fayllar bir hafta;
- **HTML uchun `no-cache`** (`no-store` EMAS) — brauzer sahifani saqlaydi,
  «orqaga» tugmasi bfcache'dan darrov ochadi.

Portni `PORT` bilan o'zgartirasiz: `PORT=8080 npm start`.

> `npm run preview` (`vike preview`) faqat build'ni tez ko'zdan kechirish uchun —
> Vike o'zi «prod'da ishlatmang» deb ogohlantiradi: u siqmaydi va HTML'ga
> `no-store` qo'yib bfcache'ni o'chiradi.

Reverse-proxy (nginx/caddy) ortiga qo'ysangiz, HTTPS va `WEB_ORIGIN` ni
haqiqiy domenga moslang — `apps/api` CORS va CSP shundan oladi.

---

## Foydali buyruqlar

```bash
# Tiplarni tekshirish (ikkala ilova)
npm run typecheck

# Production build
npm run build

# Sxema o'zgartirilgandan keyin bazaga qo'llash (MongoDB'da migratsiya yo'q).
# Deployda ham shu buyruq ishlatiladi - `npm start` sxemaga TEGMAYDI (D-056).
npm run db:push                       # ildizdan
npm --prefix apps/api run db:sync     # deploy oldidan (prisma db push --skip-generate)

# Bazani brauzerda ko'rish
npm run db:studio

# Brauzer push uchun VAPID kalitlari
npm run push:keys

# Obuna xabarnomalarini bir marta tekshirish (cron uchun)
npm run alerts:run

# Deploydan oldingi uchdan-uchgacha tekshiruv (alohida TEST bazasi kerak)
npm run build
E2E_DATABASE_URL="mongodb+srv://.../ishbor_test" npm run test:e2e

# O'sha tekshiruv Redis yo'li bilan (ixtiyoriy; sukut bo'yicha Redis ishlatilmaydi)
E2E_DATABASE_URL="..." E2E_REDIS_URL="redis://127.0.0.1:6379/1" npm run test:e2e

# Auth va Telegram oqimlari (bot transporti soxta, mantiq haqiqiy)
AUTH_TEST_DATABASE_URL="mongodb://127.0.0.1:27018/ishbor_authtest?replicaSet=rs0" npm --prefix apps/api run test:auth   # baza nomida "test" bo'lishi shart; berilmasa shu sukut ishlatiladi

# O'sha tekshiruv Redis bilan (foydalanuvchi holati keshi ham yoqiladi — prod sozlamasi)
AUTH_TEST_REDIS_URL="redis://127.0.0.1:6379/2" AUTH_TEST_DATABASE_URL="..." npm --prefix apps/api run test:auth

# Demo hisoblar va demo ma'lumot
npm --prefix apps/api run seed:demo

# Web unit testlari
npm --prefix apps/web run test:unit

# Shrift fayllarini @fontsource-variable dan public/fonts ga yangilash
npm --prefix apps/web run fonts:sync

# Logo o'lchamlarini public/logo.png dan qayta chiqarish (sharp kerak)
cd apps/web && npm i -D sharp && node scripts/build-logos.mjs
```

---

## Texnologiyalar

**Backend:** Node.js 20+, Fastify 4, Prisma 5, MongoDB 6+, Zod, argon2, JWT
(access + httpOnly refresh cookie), `@fastify/websocket`, satori + resvg (OG
rasmlar), nodemailer, web-push, meilisearch.

**Frontend:** Vite 5, Vike (SSR), React 18, TypeScript 5, Tailwind CSS 3,
self-hosted variable shriftlar (Inter / Space Grotesk / JetBrains Mono).

**Xavfsizlik:** helmet (API uchun `default-src 'none'` CSP, HSTS), CORS, rate-limit
(login/ro'yxatdan o'tish/tiklash uchun qattiqroq chegara, SSR uchun alohida bucket),
telefon tasdig'i talab qilinadigan amallar (ariza, vakansiya, xabar, sharh, nomzodlar
bazasi), admin bloklagan hisob seans ocha olmaydi. Nomzodning PDF rezyumesi ochiq
`/uploads/` orqali BERILMAYDI - faqat egasi, ariza kelgan kompaniya egasi va admin
uchun `/api/resume-files/...` (audit R3, D-058).
