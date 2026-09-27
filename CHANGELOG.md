# O'zgarishlar tarixi

## Chiqarilmagan

### Admin panel: moderatsiya qayta qurildi

- **24 soatlik avto-tasdiq**: navbatdagi vakansiya va sharhlarni admin
  `MODERATION_AUTO_APPROVE_HOURS` (sukut 24) soat ichida ko'rib chiqmasa, ular avtomatik
  tasdiqlanadi. Fon vazifasi har 10 daqiqada ishlaydi, bir nechta server nusxasida Redis qulfi bilan.
  Egasi bloklangan yoki kategoriya, ish joylashuvi yoki hudud to'ldirilmagan e'lon avtomatik
  chiqmaydi: ish beruvchiga bir marta "to'ldiring" degan xabar boradi. Avtomatik tasdiqlanganlar
  "Avto-tasdiqlangan" belgisini oladi, admin ularni keyin "Tekshirildi" qiladi.
- **Oldindan moderatsiya**: tasdiqlanmagan kompaniyaning yangi e'loni (qoralamani birinchi marta
  chiqarish ham) avval navbatga tushadi. Bu `VACANCY_PREMODERATION=unverified|all|off` bilan
  sozlanadi. Yangi sharhlar ham navbatga tushadi (`REVIEW_PREMODERATION`).
- **Vakansiyani to'liq ko'rish paneli**: matn, aloqa, kompaniya konteksti, shikoyatlar va
  qarorlar tarixi.
- **Rad etish oynasi** tayyor sabablar bilan (3 tilda) — `window.prompt` o'rniga.
- **Ommaviy amallar**: vakansiya va sharhlarni tanlab tasdiqlash, rad etish, arxivlash yoki
  o'chirish mumkin. Har bir yozuv alohida tekshiriladi, bir martada ko'pi bilan 100 ta.
- **Moderatsiya jurnali** (`/admin/moderation-log`): vakansiya, sharh, kompaniya va murojaatlar
  bo'yicha kim, qachon, qanday qaror qilgani qayd etiladi. Avto-tasdiq "Tizim" nomi bilan yoziladi.
- **Murojaatlar qutisi** (`/admin/support`): aloqa formasi va vakansiya shikoyatlari
  (`POST /api/vacancies/:slug/report`) endi bazaga yoziladi, Telegram esa qo'shimcha kanal.
  Qutida holat, ichki izoh, emailga javob (SMTP sozlangan bo'lsa) va shikoyat qilingan
  e'lonni yopish bor. Aloqa formasi Telegram'siz ham ishlaydi.
- **Kompaniya tasdiq so'rovi**: ish beruvchi yuridik nom va STIR bilan so'rov yuboradi, admin
  tasdiqlaydi yoki sabab bilan rad etadi.
- **Moderator roli**: moderator vakansiya, sharh, kompaniya tasdig'i, murojaatlar va jurnal
  bo'limlariga kira oladi. Foydalanuvchilar, to'lovlar, ommaviy xabar va maqolalar bo'limlari
  unga yopiq. Moderator jamoa taklifi orqali qo'shiladi.
- **Foydalanuvchi kartochkasi** (`/admin/users/:id`): hisob, kompaniya, e'lonlar, arizalar,
  sharhlar, murojaatlar va xavfsizlik hodisalari bir sahifada ko'rinadi.
- Menyuda navbatdagilar soni (badge) ko'rsatiladi. Holat nomlari to'g'rilandi: "draft"
  tarjima qilindi, fe'l o'rniga holat nomi chiqadi. Bosh sahifa grafigi endi bazaning o'zida
  hisoblanadi. Ommaviy xabar Redis qulfi bilan himoyalangan va yuborilganlar tarixi saqlanadi.

### Ko'rishlar hisoblagichi qayta ishlandi (views-1, views-2)

- **Ko'rish endi sahifa ma'lumoti so'ralganda emas, brauzerdan alohida signal bilan
  sanaladi** (`POST /api/vacancies/:slug/view`, `POST /api/articles/:slug/view`).
  Ilgari har bir so'rov bazaga alohida `$inc` yozardi: bir odam sahifani yangilasa ham,
  bot kirsa ham, SSR so'rovi ham "ko'rish" edi.
- **Takror filtri**: bitta ko'ruvchi (kirgan bo'lsa hisobi, aks holda IP+User-Agent hash'i)
  bitta e'lonni 24 soatda bir marta sanaydi (`VIEW_DEDUPE_SEC`).
- **Botlar sanalmaydi**: User-Agent brauzernikiga o'xshamasa yoki tanilgan bot bo'lsa — yo'q.
- **Yozuv yig'iladi**: oshirishlar buferda to'planib, `VIEW_FLUSH_MS` (sukut 30 s) oralig'ida
  BITTA bulk yozuv bilan bazaga tushadi. 1000 ta ko'rish = 1 ta so'rov. `SIGTERM` da bufer
  bo'shatiladi. Hisoblagich avvalgidek `updatedAt` ga tegmaydi (sitemap `lastmod` buzilmaydi).
- **Maqolaga "foydali" ovozi** endi bitta ovoz beruvchidan bir marta hisoblanadi. Ilgari
  buni faqat brauzer eslab qolardi (localStorage), ya'ni bir odam hisoblagichni istagancha
  shishira olardi.

### Fayl xotirasi platformadan mustaqil bo'ldi (storage-1)

- Yuklangan fayllar endi **S3-mos xotirada** (Cloudflare R2, AWS S3, B2, MinIO) saqlanishi
  mumkin — `S3_BUCKET` va kalitlar berilsa. Sozlanmasa avvalgidek lokal diskda.
- Nima berdi: Railway Volume'i shart emas, konteyner diski tozalansa fayllar qolaveradi,
  bir nechta nusxa bir xil fayllarni ko'radi, xizmatni boshqa platformaga ko'chirish mumkin.
- **Ochiq fayllar** (logo, muqova) `S3_PUBLIC_BASE_URL` berilganda to'g'ridan-to'g'ri CDN'dan
  beriladi — API orqali o'tmaydi. Berilmasa API orqali beriladi (ishlaydi, sekinroq).
- **PDF rezyume** hech qachon ochiq havola olmaydi: avvalgidek faqat vakolat tekshirilgandan
  keyin API orqali uzatiladi (D-058).
- `/uploads/` javoblari endi bir yillik `immutable` kesh bilan beriladi — fayl nomlari
  tasodifiy va hech qachon o'zgarmaydi, shuning uchun logolar har sahifada qayta so'ralmaydi.
- Sayt CSP'siga `VITE_MEDIA_URL` qo'shildi: rasmlar boshqa domendan kelsa brauzer bloklamaydi.

### Tezlik

- **Foydalanuvchi holati keshi** (`AUTH_CACHE_MS`, sukut 10 s): har bir avtorizatsiyalangan
  so'rovda bazadan bitta qator o'qilardi — bitta sahifa ochilishi 5-10 marta. Endi jarayon
  xotirasidan o'qiladi. Xavfsizlik saqlanadi: bloklash, rol o'zgarishi, logout va telefon
  tasdig'i keshni DARHOL bekor qiladi (Redis bo'lsa — barcha nusxalarda).
- **Vakansiya sahifasi keshi** (30 s): saytdagi eng ko'p ochiladigan sahifa har safar ikkita
  so'rov qilardi (e'lon + sharhlar agregatsiyasi). E'lon, kompaniya yoki sharh o'zgarganda
  kesh darhol eskiradi.

### Olib tashlandi

- `Resume.viewsCount` — hech qachon oshirilmaydigan o'lik maydon edi (rezyume ko'rishlari
  sanalmaydi).

### Redis (ixtiyoriy) — gorizontal kengayish poydevori

`REDIS_URL` berilsa quyidagilar API nusxalari orasida umumiy bo'ladi: ko'rishlar buferi va
takror filtri, kvotalar (`quota.ts`), rate-limit, kesh yangilanishi (pub/sub), WebSocket
xabarlari va "onlayn" holati, Telegram long-polling hamda obuna xabarnomalari uchun yagona
nusxa qulfi. Redis o'chiq yoki uzilgan bo'lsa hammasi jarayon xotirasidagi zaxira yo'lda
ishlaydi — sayt yiqilmaydi (Rule K). Holat `/health` da: `"redis": "ready|down|off"`.

Nusxalar sonini oshirishdan oldin yuklangan fayllarni umumiy saqlashga ko'chirish kerak —
batafsil DEPLOY.md, "Redis va bir nechta nusxa".

## 0.4.0 — 2026-09-18 (Round 3 audit)

### Auth va Telegram
- Telegram orqali **kirish olib tashlandi** (`/api/auth/telegram/start` va `/poll` yo'q; Rule A). Telegram faqat telefon tasdig'i, parol tiklash, telefon almashtirish va hisob bog'lash uchun.
- Telegram orqali **parol tiklash**: bir martalik, qisqa muddatli, bazada faqat sha256 saqlanadigan deep-link payload va reset tokeni; tiklashdan keyin barcha seanslar bekor qilinadi.
- **Zaxira telefon** (ixtiyoriy, tasdiqlangan), telefon almashtirish (parol + Telegram), bitta Telegram identity = bitta hisob.
- **Qo'lda tiklash** (parol ham, telefon ham yo'qolganda): so'rov, admin tasdig'i, tasdiqlangan telefonni tozalash va seanslarni bekor qilish. Admin parolni ham, xom tokenni ham ko'rmaydi.
- **Xavfsizlik audit jurnali** (`SecurityEvent`): telefon tasdig'i, Telegram bog'lash/uzish, tiklash, seans bekor qilish, bloklash, rol o'zgarishi.
- Google orqali kirish endi egaligi tasdiqlanmagan hisobga avtomatik birlashmaydi (409 `GOOGLE_ACCOUNT_EXISTS`).

### Xavfsizlik va infratuzilma
- Web'da **CSP** (Vike nonce) joriy qilindi; PDF rezyumelar `/uploads/` dan olib tashlanib, avtorizatsiyali endpointlarga o'tkazildi.
- `prestart` dagi `prisma db push` olib tashlandi (`npm run db:sync`); `TRUST_PROXY` sukuti `1`; SSR so'rovlari uchun alohida rate-limit kaliti.
- Admin arxivlagan vakansiyani ish beruvchi qayta faollashtira olmaydi; oxirgi admin himoyasi; `ADMIN_EMAIL` mavjud hisobni admin qilmaydi.

### Performance (10 000 foydalanuvchi, sintetik baza)
- Ish beruvchi arizalari: server tomonida sahifalash — 3119 ms / 2.6 MB → **259 ms / 38 KB**.
- Nomzodlar bazasi 1803 → **309 ms**, suhbatlar 423 ms / 498 KB → **54 ms / 31 KB**, xabarlar tarixi 252 KB → **13 KB**.
- Bildirishnomalar, suhbatlar va xabarlar uchun cursor sahifalash; filtr sonlari uchun kesh.

### Eslatma
- 0.3.0 dagi "tarif limiti" e2e tavsifi eskirgan: platforma bepul, limit yo'q.

## 0.3.0 — 2026-08-29

Baza PostgreSQL'dan **MongoDB**ga ko'chirildi, loyiha **Vercel (sayt) +
Railway (API) + MongoDB Atlas (baza)** ga chiqarishga tayyorlandi.

### Baza: PostgreSQL → MongoDB

Prisma o'sha-o'sha qoldi (`provider = "mongodb"`), shuning uchun so'rovlar
kodi deyarli tegilmadi. Sxemadagi o'zgarishlar:

- Barcha ID'lar `uuid()` o'rniga `@default(auto()) @map("_id") @db.ObjectId`,
  tashqi kalitlar `@db.ObjectId` bilan belgilandi.
- `prisma/migrations/` o'chirildi — MongoDB'da SQL ma'nosidagi migratsiya yo'q.
  O'rniga `prisma db push` (kolleksiya + indekslar), u `predev` va `prestart`
  da avtomatik ishlaydi.
- `slug` ustidagi ortiqcha `@@index` lar olib tashlandi: MongoDB bir xil kalit
  bo'yicha ikkita indeksni (unique + oddiy) qabul qilmaydi.
- `User.telegramChatId` dan `@unique` olib tashlandi. MongoDB unique indeksi
  `null` larni ham teng deb biladi — botga ulanmagan ikkinchi foydalanuvchi
  yozib bo'lmay qolardi. Yagonalik kodda ta'minlanadi.
- `Payment.transactionId` majburiy qilindi (xuddi shu `null` sababi).
- Yangi unique indekslar: `Application(vacancyId, jobSeekerId)` va
  `CompanyReview(companyId, userId)` — ilgari faqat kodda tekshirilardi,
  endi poyga holatida ham dublikat yaratilmaydi.

### MongoDB'ga moslashtirilgan kod

- **Maosh bo'yicha saralash.** `orderBy: { nulls: "last" }` — SQL imkoniyati,
  MongoDB'da yo'q va u `null` larni o'sish tartibida BIRINCHI qo'yadi. Ya'ni
  "maosh bo'yicha (o'sish)" ro'yxatining boshiga maoshi ko'rsatilmagan
  e'lonlar chiqib qolardi. Endi ro'yxat ikki bo'lakda quriladi: avval maoshi
  bor e'lonlar (maosh bo'yicha), keyin qolganlari (sana bo'yicha).
- **ID validatsiyasi.** `z.string().uuid()` endi ObjectId (24 belgi) naqshini
  tekshiradi — aks holda har qanday to'g'ri ID rad etilardi.
- **Slug.** Ilgari yozuv bo'sh `slug: ""` bilan yaratilib, keyin ID asosida
  yangilanardi. Unique indeksda bu ikkita bir vaqtda yaratilgan yozuvni
  to'qnashtiradi. Endi slug yozuvdan oldin tayyorlanadi (`common/slug.ts`),
  o'zbek va rus harflari transliteratsiya qilinadi.

### Deploy

- `apps/web/vercel.json` + `apps/web/api/ssr.js` — Vike SSR Vercel
  funksiyasi sifatida. `api/seo.js` esa `robots.txt` va `sitemap*.xml` ni
  API'dan olib **sayt domenida** beradi (ilgari ular faqat API domenida
  ochilardi — qidiruv tizimlari uchun foydasiz edi).
- `apps/api/railway.json` — build, start, `/health` healthcheck, bitta nusxa.
- To'liq qo'llanma: [`DEPLOY.md`](./DEPLOY.md).

### Tuzatilgan xatolar

- **Seans cross-site'da uzilardi.** Refresh cookie `SameSite=Lax` edi. Sayt
  (Vercel) va API (Railway) har xil domenda bo'lgani uchun brauzer uni
  `/api/auth/refresh` ga qo'shmasdi — foydalanuvchi har sahifa yangilanishida
  tizimdan chiqib ketardi. Prodda endi `SameSite=None; Secure`.
- **Begona arizalarni ko'rish mumkin edi.** `GET /api/vacancies/:id/applications`
  vakansiya egasini tekshirmasdi: istalgan ish beruvchi boshqasining vakansiya
  ID'sini kiritib nomzodlarning ismi, telefoni, emaili va rezyumesini to'liq
  ko'ra olardi.
- **Email registr sezgir edi.** `Ali@mail.uz` bilan ro'yxatdan o'tgan odam
  `ali@mail.uz` bilan kira olmasdi va bitta pochtaga ikkita hisob ochilardi.
  Endi email har doim kichik harfga keltiriladi.
- **Server jim yiqilardi.** `app.listen()` da `.catch()` yo'q edi: port band
  bo'lsa yoki listen xato bersa jarayon "muvaffaqiyatli" tugardi va deploy
  buzilganini bildirmasdi.
- **Rate-limit butun saytni bloklashi mumkin edi.** `trustProxy` yo'q edi,
  shuning uchun proxy ortida hamma so'rov bitta IP'ga yozilardi. Bunga
  qo'shimcha: SSR so'rovlari Vercel'ning umumiy IP'laridan keladi, shuning
  uchun chegara `RATE_LIMIT_MAX` orqali sozlanadigan qilindi (default 600).
- **Healthcheck yolg'on gapirardi.** `/health` faqat `{ok:true}` qaytarardi;
  endi baza bilan aloqani ham tekshiradi va uzilgan bo'lsa 503 beradi.
- **Seed yangi indeksga urilardi.** Demo sharhlarning hammasi bitta
  foydalanuvchidan yozilardi. Endi har biri alohida demo nomzoddan.

### Yangi: deploydan oldingi tekshiruv

`npm run test:e2e` — API'ni haqiqiy MongoDB ustida ko'taradi va ~20 ta oqimni
HTTP orqali tekshiradi (seans cookie'si, ariza, chat, sharh, admin, CORS,
sitemap, OG rasm, tarif limiti). Alohida TEST bazasi talab qilinadi:
`E2E_DATABASE_URL` nomida "test" bo'lmasa skript ishlamaydi, chunki u bazani
tozalaydi. Batafsil: `DEPLOY.md`.

### Boshqa

- Ishga tushish tartibi o'zgardi: katalog/tarif/admin tayyorlash, Telegram bot
  va qidiruv indeksi endi `listen` dan KEYIN, fonda bajariladi — baza sekin
  javob bersa healthcheck timeout bo'lmaydi.
- `SIGTERM`/`SIGINT` da server ochiq so'rovlarni tugatib, bazani yopib chiqadi.
- Yuklanadigan fayllar papkasi `UPLOAD_DIR` orqali sozlanadi (Railway Volume).
- Ishlatilmayotgan `REDIS_URL` va `SITE_URL` sozlamalari olib tashlandi
  (sitemap havolalari endi `WEB_ORIGIN` dan quriladi — ular sayt domenida
  ochilishi kerak, API domenida emas).
- `pnpm-workspace.yaml` o'chirildi: loyiha aslida npm bilan, har bir ilova o'z
  `package-lock.json` i bilan ishlaydi (`pnpm-lock.yaml` esa `.gitignore` da).
  Bu fayl Vercel/Railway'ga noto'g'ri paket menejerini ko'rsatishi mumkin edi.
- Qidiruv sahifasidagi `?sort=` URL parametri endi server tomonda ham
  o'qiladi — ulashilgan havola o'sha tartibda ochiladi.
- `z.coerce.boolean()` "false" satrini `true` qilardi. Shu sabab
  `SMTP_SECURE=false` aslida TLS'ni yoqib, 587-portdagi pochtani jimgina
  o'chirib qo'yardi; `?verified=false` va `?unreadOnly=false` ham teskari
  ishlardi. O'rniga `boolish()` yordamchisi.
- Canonical/hreflang/og:url manzillari `VITE_SITE_URL` dan olinadi, vakansiya
  og:image esa `VITE_API_URL` dan. Ilgari ikkalasi ham kodda qattiq yozilgan
  domenga ishora qilardi — boshqa manzilga deploy qilinsa Google canonical'ni
  boshqa saytga yuborardi va Telegram preview'lari bo'sh chiqardi.
- OG rasm shriftlari `process.cwd()` orqali, modul yuklanayotganda o'qilardi:
  jarayon boshqa papkadan ishga tushirilsa BUTUN server ko'tarilmasdi. Endi
  `require.resolve` orqali va birinchi so'rovda yuklanadi.
- `/api/companies` chegarasiz edi (har bir kompaniya bilan uning barcha
  sharhlari va vakansiyalari) — 100 ta bilan cheklandi.
- Muhit o'zgaruvchilari noto'g'ri bo'lsa server stack trace o'rniga qaysi
  o'zgaruvchi yetishmayotganini aniq aytadi.

## 0.2.1 — 2026-08-26

Bosh sahifaning birinchi yuklanishi yengillashtirildi. O'lchov: production
build + yangi prod serveri (`npm start`) + headless Chrome netlog;
bosh sahifa, desktop. Til almashtirish CDP orqali brauzerda tekshirildi.

### Shriftlar: statik → variable

Ilgari har (oila × qalinlik × subset) uchun alohida fayl edi va bosh sahifa
**7 ta woff2 / 142 KB** tortardi. `@fontsource-variable` versiyalariga
o'tildi — bitta fayl 100..900 oralig'idagi hamma qalinlikni qoplaydi:
**3 ta fayl / 111 KB**. Oila nomlari o'zgarmadi, `tailwind.config.js` va
`font-display/body/mono` klasslariga tegilmadi.

Preload ro'yxati tuzatildi: ilgari 4 ta fayl qattiq yozib qo'yilgan edi va
sahifa aslida ishlatadigan 7 tadan faqat bir qismiga to'g'ri kelardi. Endi
til bo'yicha tanlanadi — uz/en uchun Inter + Space Grotesk (LCP matni),
ru uchun Inter kirill. JetBrains Mono ataylab preload qilinmaydi.

Eski 48 ta statik shrift fayli (~1 MB) `apps/web/.fonts-static-old/` ga
ko'chirildi — ular endi hech qayerdan chaqirilmaydi.

### CSS: ikkita render-blocking so'rov o'rniga bitta

`fonts.css` endi `global.css` ichiga `@import` bilan kiradi (Vite uni build
paytida singdiradi), `Layout.tsx` faqat `global.css` ni import qiladi.

### Rasmlar va ikonkalar

Hammasi `public/logo.png` (512×512 master) dan qayta chiqarildi — master
o'zi tegilmagan, u og:image sifatida ishlatiladi:

- Header/footer logosi: 77×96 PNG (13.6 KB) → **108×108 WebP (3 KB)**.
  36 CSS px displey uchun @3x yetarli.
- Favicon: 13.6 KB PNG → **48×48 PNG (2.5 KB)**. Brauzer uni yorliqda
  16–32 px qilib chizadi, 48px @1.5x–@3x uchun yetadi.
- `logo-180.png` (apple-touch-icon): 38.4 KB → **13.3 KB**.
- `BrandLogo` ning `hero` varianti 512px/207 KB `logo.png` ni ko'rsatardi —
  256px WebP (8.7 KB) ga o'tkazildi va `width`/`height` qo'shildi.
- `public/sw.js` dagi push bildirishnoma nishoni ham yangi faylga ko'chirildi
  (`logo-96.png` o'chirildi, unga havola qolmasin).

### Majburiy reflow olib tashlandi

`useReveal` effekt ichida `getBoundingClientRect()` chaqirardi — bu brauzerni
sinxron layout'ga majburlardi (Lighthouse: «Forced reflow»), sahifada o'nlab
kartochka bo'lganda sezilarli. Endi element joylashuvini IntersectionObserver
o'zining birinchi hisobotidan (`entry.boundingClientRect`) olamiz — layout
buzilmaydi. Xatti-harakat aynan o'sha: ko'rinishdagi va ekrandan yuqoridagi
elementlar tegilmaydi, pastdagilari scroll'da ochiladi.

### i18n: faqat kerakli til yuboriladi

Ilgari uchala til bitta modulda edi (`messages.ts` + `messages.extra.ts`) va
bundler ularni bitta chunk qilardi — har bir tashrifchi **uchala** tilni
yuklardi (88 KB / 26 KB gzip), garchi bittasini o'qisa ham. Sabab: lug'at
render paytida sinxron kerak (ichida funksiyalar bor), shuning uchun uni
dinamik import qilib bo'lmasdi.

Endi:

- matnlar til bo'yicha alohida fayllarda — `messages.uz.ts` / `.ru.ts` / `.en.ts`;
- tiplar va umumiy yordamchilar (`grp`, `ruPlural`) — `types.ts`;
- `messages.ts` — registry: dinamik import + sinxron `getMessages()`;
- lug'at render'dan OLDIN yuklanadi — `+onBeforeRenderHtml.ts` (SSR) va
  `+onBeforeRenderClient.ts` (brauzer). Vike ikkalasini ham `await` qiladi,
  shuning uchun hidratsiyada nomuvofiqlik bo'lmaydi.

`vite.config.ts` dagi `manualChunks` olib tashlandi — u aynan shu bo'linishni
buzib, uchala tilni qaytadan bitta chunk'ga yopishtirardi.

O'zbek tilidagi tashrifchi uchun: **26 KB / 9 KB gzip** (ilgari 88 KB / 26 KB).
Til almashtirilganda yangi til chunk'i o'sha payt yuklanadi.

### Production serveri

Saytning production serveri yo'q edi (`vike preview` — Vike o'zi prod uchun
emasligini aytadi). `apps/web/server/index.mjs` qo'shildi (Fastify + Vike SSR),
`npm start` bilan ishga tushadi:

- brotli/gzip siqish — SSR HTML ~25 KB dan ~6 KB ga tushadi;
- `/assets/**` bir yil `immutable`, `sw.js` keshlanmaydi, qolgani bir hafta;
- HTML uchun `no-cache` (`no-store` emas) — bfcache ishlaydi, «orqaga»
  tugmasi sahifani qaytadan yuklamaydi;
- xavfsizlik sarlavhalari `vite.config.ts` dagi dev qiymatlari bilan bir xil.

`apps/api` CORS ro'yxatiga dev rejimida `:3001` qo'shildi (`:4173` yonida) —
build'ni mahalliy tekshirganda soxta CORS xatosi Best Practices'ni tushirmasin.

### Kod tozaligi

Optimallashtirish qo'lda qilingan qadamlarni ortda qoldirmasin deb, ikkitasi
takrorlanadigan skriptga aylantirildi:

- `npm run fonts:sync` (`scripts/sync-fonts.mjs`) — variable shrift fayllarini
  `@fontsource-variable` dan `public/fonts` ga ko'chiradi. Qaysi subsetlar
  kerakligi shu yerda, `fonts.css` bilan bir joyda hujjatlangan.
- `scripts/build-logos.mjs` — `public/logo.png` (512×512 master) dan sayt
  ishlatadigan barcha o'lchamlarni chiqaradi. `sharp` ataylab doimiy
  bog'liqlik emas (~10 MB native paket, natijalar repoda tayyor turadi) —
  skript sarlavhasida `npm i -D sharp` deb yozilgan.

Boshqa tozalashlar:

- `apps/web` dan `@fontsource/*` (statik shriftlar) olib tashlandi — ular
  endi hech qayerda import qilinmaydi. `apps/api` da qoladi: OG rasm generatori
  `.woff` fayllarni to'g'ridan-to'g'ri o'sha paketlardan o'qiydi.
- `@fontsource-variable/*` `devDependencies` ga ko'chdi — ular faqat
  `fonts:sync` uchun manba, ish paytida import qilinmaydi.
- `types.ts` dagi `Locale` importi faqat qayta eksport uchun turgan edi (uni
  hech kim `types.js` dan olmaydi) — olib tashlandi.
- Til fayllarida ikkita alohida `import ... from "./types.js"` bittaga
  birlashtirildi (loyihadagi `import { X, type Y }` uslubi).
- `HeadDefault.tsx` dagi `OG_LOCALE` va `PRELOAD_FONTS` endi
  `Record<Locale, ...>`: yangi til qo'shilsa TypeScript ularni to'ldirishni
  talab qiladi. Hech qachon ishlamaydigan `?? "uz_UZ"` zaxiralari olib tashlandi.
- `getMessages()` dagi «yuklangan istalgan tilga tush» zaxirasi olib tashlandi —
  endi faqat standart tilga tushadi (ogohlantirish bilan), u ham bo'lmasa
  xato beradi. Sahifa jimgina noto'g'ri tilda chiqmaydi.
- Prod serveriga yetishmayotgan narsalar qo'shildi: SIGINT/SIGTERM da ochiq
  so'rovlarni tugatib to'xtash va SSR yiqilganda JSON emas, oddiy HTML xato
  sahifasi.

### Mayda tuzatishlar

- `npm run db:deploy` ishlamasdi: `npm --prefix ... exec` faqat paketni topadi,
  ishchi papkani o'zgartirmaydi — Prisma `prisma/schema.prisma` ni topolmasdi.
  Endi `apps/api` dagi yangi `prisma:deploy` skripti orqali chaqiriladi
  (yonidagi `db:migrate` / `db:seed` bilan bir xil uslub).
- Ildizga `start:api` va `start:web` qo'shildi (`dev:api` / `dev:web` yonida).

### Natija (bosh sahifa, birinchi yuklanish, o'zbekcha)

| | Ilgari | Endi |
|---|---|---|
| Shrift fayllari | 7 ta / 142 KB | 3 ta / 111 KB |
| i18n lug'ati | 88 KB / 26 KB gzip | 26 KB / 9 KB gzip |
| Render-blocking CSS | 3 ta so'rov | 2 ta so'rov |
| Logo (header) | 13.6 KB PNG | 3 KB WebP |
| Favicon | 13.6 KB | 2.5 KB |
| apple-touch-icon | 38.4 KB | 13.3 KB |
| HTML siqish | yo'q | brotli (~25 KB → ~6 KB) |

Prod serverda o'lchangan jami: **23 ta so'rov, 231 KB** (brotli bilan).

### Tegilmagani va sababi

`.text-shine` (hero sarlavhadagi oquvchi gradient) Lighthouse'da
«non-composited animation» deb belgilanadi. `background-clip: text` bilan
gradientni GPU'da kompozitsiya qilishning yo'li yo'q — effektni saqlab
tuzatib bo'lmaydi. `global.css` dagi izohda yozilgan brend talabi
(«jonli fon har doim harakatda») saqlandi, animatsiya o'zgarmadi.
Lighthouse bu bandni ballga qo'shmaydi.

Qolgan fon animatsiyalari (`drift`, `aurora`, `particle`, `pulse-ring`,
`breathe`, `spin-slow`) tekshirildi — hammasi `transform`/`opacity` da,
`will-change` bilan; ular allaqachon to'g'ri.

## 0.2.0 — 2026-08-25

Loyihaning tarqalib ketgan bo'laklari bitta joyga yig'ildi va arxitektura
hujjatida rejalashtirilgan, lekin yozilmay qolgan qismlar qo'shildi.

### Birlashtirish

Uchta manba solishtirildi:

| Manba | Sana | Holat |
|---|---|---|
| `Downloads/job-platform/` | iyul boshi | Eng to'liq — asos sifatida olindi |
| `Downloads/job-platform.zip` | 28-iyun | Eski snapshot, hammasi papkada bor |
| `Downloads/job-platform-patch.zip` | 29-iyun | Patch, hammasi papkaga singgan |

Zip'lardagi barcha fayllar bayt-bayt solishtirildi. Papkada yo'q bo'lgan
fayllar (`mockData.ts`, `pages/vacancies/`, `Logo.tsx`, `CareerPathHero.tsx`,
`+route.ts`) — eski CHANGELOG bo'yicha **ataylab olib tashlangan** qismlar,
hech qayerda ishlatilmayapti, shuning uchun qaytarilmadi. Ortiqcha bo'sh
papkalar (`src/{modules,common,prisma}` kabi buzuq nomlar) tozalandi.

### Yangi: bildirishnomalar

- Yagona `notify()` xizmati — bitta chaqiruv to'rt kanalga tarqaladi:
  sayt ichida (WebSocket bilan darrov), Telegram, brauzer push (VAPID), email (SMTP)
- Har bir hodisa turi × kanal uchun alohida sozlama (`/notifications` → Sozlamalar)
- Qo'ng'iroq belgisi header'da, o'qilmaganlar soni bilan
- Ariza va ariza holati o'zgarishi endi shu xizmatdan o'tadi
- Brauzer push uchun service worker (`public/sw.js`) va `npm run push:keys`

### Yangi: saqlangan vakansiyalar

- Ro'yxat, qidiruv va vakansiya sahifalarida yurakcha tugmasi
- `/favorites` sahifasi; yopilgan e'lonlar belgilanadi

### Yangi: qidiruv obunalari (job alerts)

- Qidiruv sahifasidan «Obuna bo'lish» — joriy filtrlar saqlanadi
- Fon jarayoni har 15 daqiqada (sozlanadi) yangi mos vakansiyalarni topib xabar beradi
- Chastota: darrov yoki kuniga bir marta; `/alerts` da boshqariladi
- Cron uchun alohida buyruq: `npm run alerts:run`

### Yangi: qidiruv dvigateli

- Meilisearch drayveri (`MEILI_HOST` berilsa) — xatoga chidamli qidiruv
- PostgreSQL drayveri yaxshilandi: so'rov so'zlarga bo'linib AND mantiqda
  qidiriladi (avval bitta `contains` edi va ko'p so'zli so'rovda hech narsa topmasdi)
- Meili yo'q yoki xato bersa — jimgina PostgreSQL'ga tushadi
- Saralash: mosligi / sana / maosh (o'sish va kamayish)
- Vakansiya yaratilganda, tahrirlanganda va holati o'zgarganda indeks yangilanadi

### Yangi: monetizatsiya

- Uch tarif (Boshlang'ich / Standart / Premium) bazaga avtomatik yoziladi
- Faol vakansiya limiti va nomzodlar bazasiga kirish tarif bo'yicha nazorat qilinadi
- Payme va Click uchun to'lov havolasi; kalit yo'q bo'lsa — admin qo'lda tasdiqlaydi
- Webhook imzosi tekshiriladi (Payme: Basic auth, Click: md5 imzo)
- To'lov tarixi ish beruvchi va admin panelida

### Yangi: admin panel

- `/admin` — ko'rsatkichlar va 14 kunlik dinamika grafigi
- Foydalanuvchilar: qidiruv, bloklash (bloklanganda vakansiyalari arxivlanadi), rol berish
- Vakansiyalar: tasdiqlash / rad etish (sabab bilan, muallifga xabar boradi) / arxivlash / premium
- Kompaniyalar: tasdiqlangan belgisi
- Sharhlar: chop etish / rad etish / o'chirish
- To'lovlar: qo'lda tasdiqlash
- Xizmat amallari: indeksni qayta qurish, obunalarni tekshirish, ommaviy xabar

### Yangi: maosh statistikasi

- `/salaries` — mediana, o'rtacha, 25–75 foizli oraliq, taqsimot grafigi
- Kasb va hudud kesimida jadval, filtrlar URL'da (har kesim alohida indekslanadi)
- SSR — raqamlar qidiruv tizimlariga tayyor holda boradi
- Kasb va hududlar bo'yicha maosh sahifalari `sitemap-static.xml` ga qo'shildi

### Yangi: deploydan oldingi tekshiruv

`npm run test:e2e` — API'ni haqiqiy MongoDB ustida ko'taradi va ~20 ta oqimni
HTTP orqali tekshiradi (seans cookie'si, ariza, chat, sharh, admin, CORS,
sitemap, OG rasm, tarif limiti). Alohida TEST bazasi talab qilinadi:
`E2E_DATABASE_URL` nomida "test" bo'lmasa skript ishlamaydi, chunki u bazani
tozalaydi. Batafsil: `DEPLOY.md`.

### Boshqa o'zgarishlar

- Vakansiyani **tahrirlash** (avval faqat yaratish, arxivlash va o'chirish bor edi)
- Ish beruvchi panelida tarif limiti ko'rsatkichi
- Admin bloklagan hisob seans ocha olmaydi (login / refresh / Telegram / Google)
- WebSocket ro'yxati umumiy qatlamga chiqarildi — chat va bildirishnoma bir manbadan ishlaydi
- `robots.txt` ga yangi shaxsiy yo'llar qo'shildi
- Ildizdagi buyruqlar pnpm o'rniga npm bilan ishlaydigan qilindi (amaldagi holatga mos)
- `docker-compose.yml` ga ixtiyoriy Meilisearch xizmati qo'shildi
  (`docker compose --profile search up -d`)

### Baza sxemasi

Bitta migratsiya: `20260825120000_notifications_billing_admin`

- `users.is_blocked`
- `companies.subscription_expires_at`
- `vacancies.rejection_reason`
- `saved_searches.last_notified_at`
- `subscription_plans`: `slug` (unique), `max_featured_vacancies`,
  `can_search_candidates`, `is_active`, `sort_order`
- `payments`: `paid_at`, `transaction_id` unique, `(company_id, status)` indeksi
- yangi jadval: `push_subscriptions`

### Tekshiruv

- `tsc --noEmit` — ikkala ilovada xatosiz
- `vike build` — muvaffaqiyatli
- API: 39 ta uchidan-uchiga tekshiruv (tariflar, to'lov, limitlar, sevimlilar,
  obunalar, bildirishnoma sozlamalari, admin yo'llari) — hammasi o'tdi
- Sahifalar: 27 ta yo'l (uch tilda + 404) — hammasi SSR bilan ochildi
