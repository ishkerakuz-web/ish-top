# Deploy qo'llanmasi

Arxitektura:

```
  Brauzer
     │
     ├──── HTML (SSR) ─────►  Vercel        apps/web   (Vike + React)
     │                            │
     │                            └── /robots.txt, /sitemap*.xml → API'ga proxy
     │
     └──── API + WebSocket ►  Railway       apps/api   (Fastify + Prisma)
                                  │
                                  └──────►  MongoDB Atlas
```

Uchta xizmat mustaqil: har biri alohida deploy bo'ladi va bir-birini faqat
manzil (URL) orqali biladi.

---

## 1. MongoDB Atlas

1. [cloud.mongodb.com](https://cloud.mongodb.com) da bepul **M0** klaster yarating.
2. **Database Access** → yangi foydalanuvchi (`readWrite` huquqi bilan).
3. **Network Access** → `0.0.0.0/0` qo'shing (Railway IP'lari o'zgaruvchan).
   Xohlasangiz keyinroq Railway'ning statik IP'si bilan toraytirasiz.
4. **Connect → Drivers → Node.js** dan ulanish satrini oling va oxiriga baza
   nomini yozing:

   ```
   mongodb+srv://<foydalanuvchi>:<parol>@cluster0.xxxxx.mongodb.net/ishbor?retryWrites=true&w=majority
   ```

> **Nega aynan Atlas?** Prisma tranzaksiyalari (ariza holati, to'lov
> tasdiqlash, rezyume saqlash) MongoDB **replica set** talab qiladi. Atlas'da
> u sukut bo'yicha bor; bitta oddiy `mongod` da yo'q.

Parolda `@ : / ?` kabi belgilar bo'lsa ularni URL-encode qiling
(`@` → `%40`), aks holda ulanish satri buziladi.

---

## 2. Backend — Railway

### Xizmat yaratish

1. [railway.app](https://railway.app) -> **New Project -> Deploy from GitHub repo**.
2. Xizmat sozlamalarida **Root Directory** ni `apps/api` qilib qo'ying.
   Qolganini `apps/api/railway.json` o'zi aytadi (build, start, healthcheck).
3. **Settings -> Networking -> Generate Domain** - API manzilini olasiz.

> **DIQQAT: avval hamma fayl commit qilingan bo'lsin.** Railway ham, Vercel ham
> GitHub'dagi HEAD'dan quradi — commit qilinmagan modul deploy paytida "import
> topilmadi" xatosini beradi. Deploydan oldin `git status` bo'sh bo'lsin.

### Variables

`apps/api/.env.example` dagi ro'yxat. Eng kami:

| O'zgaruvchi | Qiymat |
|---|---|
| `DATABASE_URL` | Atlas ulanish satri |
| `JWT_ACCESS_SECRET` | tasodifiy satr, **kamida 32 belgi** (production'da qisqa bo'lsa server ishga tushmaydi) |
| `JWT_REFRESH_SECRET` | boshqa tasodifiy satr, kamida 32 belgi, `JWT_ACCESS_SECRET` bilan bir xil emas |
| `NODE_ENV` | `production` |
| `WEB_ORIGIN` | Vercel domeni, masalan `https://ishbor.vercel.app` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | birinchi admin hisobi (faqat bunday email bilan hisob umuman bo'lmasa yaratiladi, D-069) |
| `TELEGRAM_BOT_TOKEN` | **production'da majburiy** (D-072): telefon tasdiqlash va parolni tiklash faqat Telegram orqali ishlaydi |

Ixtiyoriy, lekin xavfsizlik va tezlik uchun muhim (2026-09 audit, Round 3):

| O'zgaruvchi | Qiymat |
|---|---|
| `TRUST_PROXY` | sukut endi **`1`** (bitta hop). `true` bilan mijozning o'zi yozgan `X-Forwarded-For` olinib, IP bo'yicha barcha limitlar chetlab o'tilardi. Railway va bitta nginx/caddy uchun `1`; Cloudflare + Railway uchun `2`. Deploydan keyin log'dagi `remoteAddress` ni `X-Real-IP` bilan solishtiring - amaldagi qiymat startupda `TRUST_PROXY = ...` qatorida yoziladi |
| `SSR_API_KEY` | kamida 32 belgili tasodifiy satr. AYNAN shu qiymat Vercel'dagi saytga ham `SSR_API_KEY` sifatida qo'yiladi (`VITE_` prefiksisiz!). SSR so'rovlari shunda alohida, kengroq rate-limit bucket'iga tushadi va umumiy Vercel IP'lari tufayli 429 bo'lmaydi (D-074) |
| `CORS_PREVIEW_ORIGIN_REGEX` | Vercel preview domenlari uchun ANIQ regex (to'liq moslik), masalan `https://ishbor-[a-z0-9-]+-myteam\.vercel\.app`. Bo'sh bo'lsa preview'lar API'ga ulanmaydi: istalgan `*.vercel.app` endi ruxsat olmaydi |
| `BILLING_ENABLED` | sukut `false`. Platforma bepul - tarif/checkout/webhook yo'llari faqat `true` bo'lsa yoqiladi |
| `REDIS_URL` | ixtiyoriy (`redis://` yoki `rediss://`). Bo'sh bo'lsa hammasi jarayon xotirasida — sayt to'liq ishlaydi, lekin faqat bitta nusxada. Berilsa kvota, rate-limit, ko'rishlar buferi, kesh yangilanishi va WebSocket fan-out nusxalar orasida umumiy bo'ladi ("Redis va bir nechta nusxa" bo'limi) |
| `VIEW_FLUSH_MS` | sukut `30000`. Ko'rishlar buferi shu oraliqda bitta bulk yozuv bilan bazaga tushadi |
| `MODERATION_AUTO_APPROVE_HOURS` | sukut `24`. Admin shu muddat ichida ko'rmagan navbatdagi vakansiya/sharh avtomatik tasdiqlanadi; `0` — o'chiq |
| `VACANCY_PREMODERATION` | sukut `unverified`. Yangi e'lon avval moderatsiyaga: `unverified` (tasdiqlanmagan kompaniyalar), `all`, `off` |
| `REVIEW_PREMODERATION` | sukut `true`. Yangi kompaniya sharhlari avval moderatsiyaga tushadi |
| `VIEW_DEDUPE_SEC` | sukut `86400` (24 soat). Bitta ko'ruvchi shu muddat ichida bir marta sanaladi |
| `AUTH_CACHE_MS` | sukut `10000`. Foydalanuvchi holati keshi — har bir avtorizatsiyalangan so'rovdagi baza o'qishini olib tashlaydi. Bloklash va rol o'zgarishi keshni darhol bekor qiladi. `0` — o'chiq |
| `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | S3-mos fayl xotirasi (R2, S3, B2, MinIO). Uchtasi birga beriladi. Berilsa Volume kerak emas ("Fayl yuklashlar" bo'limi) |
| `S3_ENDPOINT` / `S3_REGION` / `S3_PREFIX` | R2 uchun `https://<account_id>.r2.cloudflarestorage.com`, `auto`, `uploads/`. AWS S3 da endpoint bo'sh |
| `S3_PUBLIC_BASE_URL` | Ochiq fayllar manzili (bucket'ning ochiq havolasi yoki CDN), masalan `https://pub-xxxx.r2.dev`. Saytga ham `VITE_MEDIA_URL` sifatida qo'yiladi |

Kalit yaratish:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> `PORT` ni **qo'lda kiritmang** — Railway uni o'zi beradi.
>
> `NODE_ENV=production` **majburiy**: seans cookie'si aynan shu holatda
> `SameSite=None; Secure` bo'ladi. Busiz Vercel'dagi sayt Railway'dagi API'ga
> cookie yubora olmaydi va foydalanuvchi har sahifa yangilanishida
> tizimdan chiqib ketadi.

### Fayl yuklashlar: Volume yoki S3-mos xotira

Konteyner diski har deployda tozalanadi — kompaniya logolari va PDF rezyumelar
yo'qoladi. Ikki yechim bor; **ikkinchisi tavsiya etiladi**.

**1-yo'l: Railway Volume (eng sodda, lekin bitta nusxa uchun).**

1. Xizmatga **Volume** qo'shing, Mount path: `/data`.
2. `UPLOAD_DIR=/data/uploads` o'zgaruvchisini qo'shing.

Cheklovi: Volume'ni bir nechta nusxa baham ko'ra olmaydi va u Railway'ga bog'lab qo'yadi.

**2-yo'l: S3-mos xotira (Cloudflare R2, AWS S3, Backblaze B2, MinIO).**

Bunda fayllar platformadan mustaqil bo'ladi: nusxalar soni cheklanmaydi, Volume kerak
emas, xizmatni Railway'dan boshqa joyga ko'chirish ham fayllarga ta'sir qilmaydi.

Cloudflare R2 misolida:

1. R2'da bucket yarating va API token oling (Object Read & Write).
2. API'ga qo'ying:
   ```
   S3_BUCKET="ishbor"
   S3_ACCESS_KEY_ID="..."
   S3_SECRET_ACCESS_KEY="..."
   S3_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
   S3_REGION="auto"
   ```
3. Rasmlar tez ochilishi uchun bucket'ga ochiq havola (yoki CDN domeni) ulang va uni
   ikkala joyga bir xil yozing: API'da `S3_PUBLIC_BASE_URL`, saytda `VITE_MEDIA_URL`.
   Sayt qiymati CSP uchun kerak — busiz brauzer rasmlarni bloklaydi.
   Bo'sh qoldirsangiz ham ishlaydi: fayllar API orqali beriladi, faqat sekinroq.

Nima qayerda beriladi:

| Fayl | Kim ko'radi | Qanday beriladi |
|---|---|---|
| Kompaniya logosi, maqola muqovasi | hamma | ochiq havola (CDN) yoki API orqali |
| PDF rezyume | faqat egasi, ariza kelgan kompaniya va admin | HAR DOIM API orqali, vakolat tekshirilgandan keyin (D-058) — ochiq havola HECH QACHON berilmaydi |

**Eski fayllar:** S3'ga o'tganda bazadagi eski `/uploads/...` havolalar o'z holicha qoladi
va eski diskdan qidiriladi. Ya'ni o'tishdan oldin yuklangan logolar Volume'siz yo'qoladi —
kerak bo'lsa `uploads/` papkasini bucket'ga (`uploads/` prefiksi bilan) qo'lda ko'chiring.

### Redis (ixtiyoriy) va bir nechta nusxa

`railway.json` da `numReplicas: 1` va **Redis'siz shundayligicha qolishi kerak**.
Redis ulangandan keyin nusxalar sonini oshirish mumkin — quyidagi shart bajarilsa.

**Redis'siz (sukut).** Hammasi jarayon xotirasida: ko'rishlar buferi, kvotalar,
keshlar, WebSocket ro'yxati. Sayt to'liq ishlaydi, lekin faqat BITTA nusxada.

**Redis bilan (`REDIS_URL`).** Nusxalar orasida umumiy bo'ladi:

| Nima | Redis'siz | Redis bilan |
|---|---|---|
| Ko'rishlar buferi va takror filtri | nusxa ichida | umumiy (`counters.ts`, `dedupe.ts`) |
| Kvotalar (SMS, ro'yxatdan o'tish, chat) | nusxa ichida — chegara nusxalar soniga ko'payardi | umumiy (`quota.ts`) |
| Rate-limit (IP bo'yicha) | nusxa ichida | umumiy (`@fastify/rate-limit` Redis store) |
| Kesh yangilanishi | faqat o'z nusxasida | pub/sub bilan hammasiga (`cache.ts`) |
| WebSocket xabari va "onlayn" holati | faqat o'z nusxasidagi ulanishlar | pub/sub + presence (`realtime.ts`) |
| Telegram long-polling | ikkita nusxa 409 olardi | qulf: faqat bittasi so'raydi |
| Obuna xabarnomalari jadvali | ikkita nusxa ikki marta yuborardi | qulf: faqat bittasi yuboradi |

Redis uzilsa sayt YIQILMAYDI: har bir chaqiruv xotiradagi zaxira yo'lga tushadi
(chegaralar vaqtincha nusxa ichida hisoblanadi). Holatni `/health` ko'rsatadi:
`{"ok":true,"db":"up","redis":"ready|down|off"}`.

**Nusxalar sonini oshirishdan OLDIN ikkita shart:**

1. `REDIS_URL` berilgan bo'lsin (yuqoridagi jadval).
2. Fayllar S3-mos xotirada bo'lsin ("Fayl yuklashlar" bo'limi). Volume'ni bir nechta
   nusxa baham ko'ra olmaydi: A nusxasiga yuklangan logo B nusxasidan 404 berardi.

Ikkalasi bajarilgach `numReplicas` ni oshirish xavfsiz: Telegram boti va obuna
jadvali qulf tufayli faqat bitta nusxada ishlaydi, WebSocket xabarlari va kvotalar
esa umumiy bo'ladi.

### Baza sxemasi: `npm run db:sync` (deploydan OLDIN)

`npm start` endi sxemani O'ZGARTIRMAYDI: `prestart: prisma db push` olib tashlandi
(audit R3, D-056). Ilgari har bir boot'da `db push` ishlardi - yangi unique indeks
mavjud ma'lumotga to'g'ri kelmasa konteyner qayta-qayta yiqilib, crash-loop bo'lardi.

Migratsiya tartibi (MongoDB'da Prisma `migrate` yo'q, shuning uchun qadam ANIQ va qo'lda):

```bash
# 1. Sxema o'zgarishi faqat ADDITIV bo'lsin (yangi ixtiyoriy maydon, yangi kolleksiya, indeks).
# 2. Kodni deploy qilishdan OLDIN sxemani bazaga qo'llang.
#    `railway run` buyruqni LOKAL papkada bajaradi, shuning uchun avval apps/api ga o'ting:
cd apps/api
railway run npm run db:sync        # = prisma db push --skip-generate
# 3. Natija "Your database is now in sync with your Prisma schema" bo'lsa deploy qiling.
```

`db:sync` da `--accept-data-loss` YO'Q: destruktiv o'zgarishni Prisma rad etadi. Agar u
ma'lumot yo'qotishni so'rasa - to'xtang, bu alohida qaror va alohida rejani talab qiladi.

**Round 3 deploy qadami:** bu relizda yangi kolleksiyalar (`auth_challenges`,
`recovery_requests`, `security_events`), `User` ga yangi ixtiyoriy maydonlar va
yangi indekslar qo'shildi. Shuning uchun tartib qat'iy:

1. `git status` bo'sh (hamma fayl commit qilingan).
2. `cd apps/api && railway run npm run db:sync` - sxema qo'llanadi.
3. API va web BIRGA deploy qilinadi (PDF rezyume endi `/uploads/` orqali ochilmaydi:
   eski frontend build'i rezyume havolasini ocha olmaydi, D-058).
4. `TELEGRAM_BOT_TOKEN` va `SSR_API_KEY` Variables'da borligini tekshiring.

### Demo ma'lumot (faqat demo/staging muhitida)

> **Production bazada ishga tushirmang.** Seed ochiq parolli (`password123`) demo hisoblar va sinov
> kompaniyalarini yaratadi (audit R3 ikkinchi audit, frontend-docs-19). Katalog (hudud va kategoriyalar)
> API startida avtomatik yaratiladi — production uchun seed kerak emas.

```bash
# faqat demo/staging:
railway run npm run prisma:seed
```

---

## 3. Frontend — Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → repozitoriyni tanlang.
2. **Root Directory**: `apps/web`.
3. Build sozlamalari `apps/web/vercel.json` da yozilgan (build buyrug'i,
   `dist/client` chiqish papkasi, SSR funksiyasi, rewrites, sarlavhalar) —
   dashboard'da qo'lda hech narsa o'zgartirish shart emas.
4. **Environment Variables**:

   | O'zgaruvchi | Qiymat |
   |---|---|
   | `VITE_API_URL` | Railway API manzili, oxirida `/` **bo'lmasin** |
   | `VITE_SITE_URL` | Saytning o'z manzili (Vercel domeni yoki o'z domeningiz) |
   | `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID (ixtiyoriy) |
   | `SSR_API_KEY` | Railway'dagi `SSR_API_KEY` bilan AYNAN bir xil satr. `VITE_` prefiksi BO'LMASIN: u faqat SSR (server) kodida o'qiladi va brauzer bundle'iga tushmasligi kerak (D-074) |

   `VITE_API_URL` ikki joyda kerak: build paytida (brauzer kodiga yoziladi) va
   ishlash paytida (`api/seo.js` robots/sitemap'ni API'dan oladi). Shuning
   uchun uni **Production, Preview va Development** — uchalasiga ham qo'ying.

   `VITE_SITE_URL` — canonical, `hreflang` va `og:url` shundan quriladi.
   Noto'g'ri bo'lsa har sahifa "asl nusxam boshqa saytda" deb aytadi va Google
   haqiqiy saytni indeksga olmaydi. Birinchi deploydan keyin Vercel bergan
   domenni shu yerga yozib, qayta build qiling (bu qiymat build paytida
   kodga yoziladi).

### Deploydan keyin Railway'ni yangilang

Vercel domenini olgach, Railway'da `WEB_ORIGIN` ni o'sha manzilga o'zgartiring
va xizmatni qayta ishga tushiring. Aks holda CORS saytni bloklaydi.

O'z domeningiz bo'lsa:

```
WEB_ORIGIN=https://ishbor.uz
CORS_EXTRA_ORIGINS=https://www.ishbor.uz
```

### TALAB: sayt va API bitta domen ostida bo'lsin (audit R3, D-076)

`*.vercel.app` + `*.up.railway.app` juftligi - bu ikki HAR XIL registrable domen, ya'ni
refresh cookie uchinchi tomon (third-party) cookie'si bo'lib qoladi. Safari/iOS va Brave
bunday cookie'ni bloklaydi: foydalanuvchi kiradi, 15 daqiqadan keyin access token tugaydi,
refresh esa cookie'siz ishlamaydi va seans uziladi.

Shuning uchun production'da custom domen MAJBURIY:

```
sayt:  https://ishbor.uz          (Vercel)
API:   https://api.ishbor.uz      (Railway "Custom Domain")
WEB_ORIGIN=https://ishbor.uz
VITE_API_URL=https://api.ishbor.uz
```

Ikkalasi bitta registrable domen (`ishbor.uz`) ostida bo'lgani uchun cookie same-site
bo'ladi va brauzerlar uni bloklamaydi. Domen ulanmaguncha Safari/Brave foydalanuvchilarida
seans 15 daqiqada tugashi mumkin - bu ochiq risk (D-076).

---

## 4. Tekshirish ro'yxati

### Avtomatik tekshiruv (tavsiya etiladi)

Atlas'da ikkinchi, **test** bazasini oching (masalan `ishbor_test`) va
deploydan oldin bir marta ishga tushiring:

```bash
npm run build
E2E_DATABASE_URL="mongodb+srv://<foydalanuvchi>:<parol>@cluster/ishbor_test" npm run test:e2e
```

Skript API'ni haqiqiy MongoDB ustida ko'taradi va asosiy oqimlarni HTTP orqali
tekshiradi: ro'yxatdan o'tish va seans cookie'si (`SameSite=None; Secure`),
vakansiya joylash va tahrirlash (faol vakansiyalar soni cheklanmagan), tarif va
to'lov yo'llari o'chiqligi (`BILLING_ENABLED=false` — 404), ariza, rezyume,
chat, sharh, sevimlilar, maqolalar va kontent jamoasi, admin paneli,
sitemap va robots.txt, OG rasm.

Shuningdek xavfsizlik regressiyalarini tekshiradi: CORS (begona `*.vercel.app`
preview manzillari rad etiladi), JWT (qat'iy algoritm, token turi), `/uploads/`
fayllari CSP `sandbox` va `nosniff` bilan beriladi, WebSocket buzilgan
xabarlarda yiqilmaydi, seans bekor qilinishi (logout, bloklash, rol
o'zgarishi), IDOR (begona resursni o'zgartirib bo'lmaydi), nomzod
ma'lumotlarining maxfiyligi (aloqa ma'lumoti, chatda email chiqmasligi).

Baza nomida "test" bo'lmasa skript ishlashdan bosh tortadi — u bazani
tozalaydi. `dist/` build'i `src/` dagi o'zgarishlardan eski bo'lsa ham to'xtaydi
(avval `npm run build`).

Auth va Telegram oqimlari uchun alohida tekshiruv (bot transporti soxta, mantiq haqiqiy):

```bash
AUTH_TEST_DATABASE_URL="mongodb+srv://<foydalanuvchi>:<parol>@cluster/ishbor_authtest" npm run test:auth   # alohida test bazasi (nomida "test"); skript uni --force-reset bilan tozalaydi
```

### Qo'lda tekshirish

```bash
# 1. API tirikmi va bazani ko'ryaptimi
curl https://<api>.up.railway.app/health
# kutilgan: {"ok":true,"db":"up"}

# 2. Ma'lumot keladimi
curl https://<api>.up.railway.app/api/stats

# 3. robots.txt SAYT domenida ochiladimi
curl https://<sayt>.vercel.app/robots.txt

# 4. Sitemap ichidagi havolalar sayt domeniga ishora qiladimi
curl https://<sayt>.vercel.app/sitemap-vacancy.xml | head
```

Brauzerda:

- [ ] Bosh sahifa ochiladi, vakansiyalar ko'rinadi (SSR — sahifa manbasida HTML bor).
- [ ] Ro'yxatdan o'ting, chiqing, qayta kiring.
- [ ] **Sahifani yangilang — tizimda qolasizmi?** Yo'q bo'lsa: `NODE_ENV=production`
      qo'yilmagan yoki `WEB_ORIGIN` noto'g'ri.
- [ ] Ish beruvchi bo'lib kompaniya yarating va logo yuklang (Volume tekshiruvi).
- [ ] Chat oching — xabar real vaqtda keladimi (WebSocket `wss://` orqali).
- [ ] `ADMIN_EMAIL` bilan kirib `/admin` panelini oching.
- [ ] **Telefonni Telegram orqali tasdiqlang** (profil -> Telegram bo'limi): botdan
      kelgan havolani ochib kontakt ulashasiz. Tasdiqsiz ariza, vakansiya, chat, sharh
      va nomzodlar bazasi ochilmaydi (D-072). Telegram orqali KIRISH endi yo'q.
- [ ] Parolni tiklash: `/login?recover=1` -> Telegram -> bot yuborgan havola bilan yangi parol.
- [ ] Nomzodning PDF rezyumesi `/uploads/...pdf` manzili bilan OCHILMASLIGI kerak (404);
      u faqat `/api/resume-files/...` orqali, vakolatli foydalanuvchiga beriladi (D-058).
- [ ] Railway log'ida `TRUST_PROXY = 1` qatori bor va so'rovlardagi `remoteAddress`
      haqiqiy mijoz IP'si (`X-Real-IP` bilan solishtiring), Railway proxy IP'si emas (D-053).

---

## 5. Ko'p uchraydigan muammolar

**"Sahifani yangilaganda tizimdan chiqib ketyapman"**
Ikki sabab bo'lishi mumkin:
1. Railway'da `NODE_ENV=production` yo'q. Refresh cookie `SameSite=Lax` bo'lib
   qolgan va cross-site so'rovda yuborilmayapti.
2. Sayt va API har xil registrable domenda (`*.vercel.app` + `*.up.railway.app`).
   Safari/iOS va Brave bunday third-party cookie'ni bloklaydi - custom domen kerak
   (yuqoridagi "TALAB: sayt va API bitta domen ostida bo'lsin", D-076).

**Vercel'da har bir sahifa 500 — `ERR_REQUIRE_ESM` (`@brillout/picocolors`)**
Logda shunday chiqadi:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module .../@brillout/picocolors/dist/picocolors.js
from .../react-streaming/dist/cjs/utils/assert.js not supported
```

Sabab: `react-streaming` ning `exports` xaritasi Node ostida CommonJS nusxani
tanlaydi, u esa faqat-ESM bo'lgan `@brillout/picocolors@1.0.23+` ni `require()`
qiladi. Node 22.12 dan boshlab `require(ESM)` ruxsat etilgan, shuning uchun yangi
Node'da xato chiqmaydi va muammo lokalda sezilmaydi — eski Node'da esa butun SSR
yiqiladi (xato sahifasi ham, chunki modul har bir sahifada yuklanadi).

Yechim `apps/web/package.json` da: paket oxirgi CommonJS versiyasiga qotirilgan.

```json
"overrides": { "@brillout/picocolors": "1.0.22" }
```

**Buni olib tashlamang**, agar `vike-react` React 19 ga o'tib `react-streaming@0.4+`
(CJS nusxasi yo'q) ni tortmasa. Hozir loyiha React 18 da, `vike-react@0.6` esa
React 19 talab qiladi.

**Brauzer konsolida CORS xatosi**
Railway'dagi `WEB_ORIGIN` sayt manziliga to'liq mos emas. Protokol va domen
aynan bir xil bo'lishi kerak (`https://`, `www` bor/yo'qligi ham muhim).

**`P2010` / "Transactions are not supported"**
`DATABASE_URL` replica set'siz MongoDB'ga ishora qilyapti. Atlas ishlating.

**"DATABASE_URL: MongoDB ulanish satri bo'lishi kerak"**
Eski PostgreSQL ulanish satri qolib ketgan. `mongodb://` yoki `mongodb+srv://`
bilan boshlanadigan Atlas satrini qo'ying (mahalliy `apps/api/.env` ni ham
yangilashni unutmang).

**`npm run db:sync` da xato**
Atlas **Network Access** da `0.0.0.0/0` yo'q yoki ulanish satridagi parol
noto'g'ri/URL-encode qilinmagan. Eslatma: `db push` endi `npm start` dan OLDIN
avtomatik ishlamaydi - uni deploydan oldin o'zingiz ishga tushirasiz (D-056).

**Yangi indeks yoki maydon ishlamayapti**
Deploydan oldin `railway run npm run db:sync` qilinmagan.

**Vercel'da 404: NOT_FOUND**
Root Directory `apps/web` qilib qo'yilmagan — `vercel.json` topilmagan.

**Yuklangan logolar deploydan keyin yo'qolyapti**
Volume ulanmagan yoki `UPLOAD_DIR` Volume mount path'iga qo'yilmagan.

**Telegram bot 409 `Conflict: terminated by other getUpdates`**
API bir nechta nusxada ishlayapti. `REDIS_URL` berilgan bo'lsa nusxalar qulf orqali
kelishadi va 409 o'z-o'zidan yo'qoladi (bir-ikki daqiqada). Redis yo'q bo'lsa —
`numReplicas` ni 1 ga qaytaring.

**Loglarda `Redis (...) xatosi — xotiradagi zaxira yo'lga o'tildi`**
`REDIS_URL` berilgan, lekin Redis javob bermayapti. Sayt ishlayveradi (chegaralar va
hisoblagichlar vaqtincha nusxa ichida). Redis kerak bo'lmasa `REDIS_URL` ni bo'sh qoldiring.
