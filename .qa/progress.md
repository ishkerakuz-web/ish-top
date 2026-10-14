# QA Progress Tracker

## Current Phase: 8 — Final QA & Closure (COMPLETE)

## Phase Status

| Phase | Name | Status | Bugs Found | Bugs Fixed |
|-------|------|--------|------------|------------|
| 0 | Project Discovery | COMPLETE | — | — |
| 1 | Public Pages & Navigation | COMPLETE | 0 | 0 |
| 2 | Auth & Signup Flows | COMPLETE | 3 | 3 |
| 3 | Job Seeker Flows | COMPLETE | 0 | 0 |
| 4 | Employer Flows | COMPLETE | 0 | 0 |
| 5 | Admin Panel | COMPLETE | 0 | 0 |
| 6 | Cross-Cutting Concerns | COMPLETE | 0 | 0 |
| 7 | Integration & Edge Cases | COMPLETE | 0 | 0 |
| 8 | Final QA & Closure | COMPLETE | 0 | 0 |

## Environment Status (last checked: 2026-10-14)

| Service | Status |
|---------|--------|
| Web (5173) | UP |
| API (3000) | UP (via `npx tsx`, bypassed predev hook) |
| MongoDB (27018) | UP (rs0 PRIMARY) |

## Session Log

### 2026-10-13 — Phase 0
- Mapped 46 frontend page routes
- Cataloged 100+ API endpoints across 20+ route modules
- Documented 34 Prisma models, 26 enums
- Identified auth middleware chain (requireAuth → requireRole → requirePhoneVerified)
- Inventoried existing test scripts (unit-check, e2e-check, auth-telegram-check)
- Verified git state: clean tree, main branch, commit c4adca4
- Created .qa/ directory with project-map, roadmap, progress, backlog, rules

### 2026-10-13 — Phase 1 (partial — API not running)

**Pages tested (render without API):**
- ✅ `/employer` — hero, 3 feature cards, both CTAs → `/signup?role=employer`
- ✅ `/login` — form, Google/Apple OAuth buttons, recovery link
- ✅ `/signup` — role toggle, `?role=employer` pre-selects employer tab
- ✅ `/contact` — contact form (name, email, subject, message)
- ✅ `/support` — help center: search, 3 categories, 5 FAQ items, contact CTA
- ✅ 404 page — "Bu yo'l hali xaritada yo'q", action buttons
- ✅ 503 page — "Sahifa vaqtincha mavjud emas", retry/home/vacancies buttons

**Pages needing API (show 503 — will retest with full stack):**
- `/` (home), `/vacancies`, `/companies`, `/articles`, `/salaries`
- `/vacancies/:slug`, `/companies/:slug`, `/articles/:slug`

**Legacy redirects (all working):**
- ✅ `/search/vacancy` → `/vacancies`
- ✅ `/article` → `/articles`
- ✅ `/article/:slug` → `/articles/:slug`
- ✅ `/pricing` → `/employer`
- ✅ `/employer/:slug` → `/companies/:slug`
- ✅ `/vacancy/:slug` → `/vacancies/:slug`

**i18n (all 3 locales verified):**
- ✅ UZ (default, no prefix), RU (`/ru/`), EN (`/en/`)
- ✅ Locale selector dropdown: switches URL prefix and content
- ✅ Page titles translate (confirmed on /employer)

**Dark/Light mode:**
- ✅ Toggle works, proper color scheme in both modes
- ✅ Button label updates: "Yorug' rejim" ↔ "Tungi rejim"

**Responsive layout:**
- ✅ Desktop (1280px): full nav bar, horizontal card layout
- ✅ Tablet (768px): hamburger menu, 3-column cards
- ✅ Mobile (375px): hamburger menu, stacked layout, MobileBottomNav (5 icons)
- ✅ No horizontal scroll on any viewport

**SEO/Head tags (code inspection):**
- ✅ HeadDefault: default og:image, twitter:card, og:locale, hreflang alternates
- ✅ Vacancy detail: dynamic OG image via `/api/og/vacancy/:slug`, JSON-LD JobPosting
- ✅ Article detail: og:image from cover image
- ✅ Font preloading per locale (latin vs cyrillic)

**Console errors:** Only `ERR_CONNECTION_REFUSED` (API not running) — no JS/React errors

**Bugs found: 0**

**Note:** Data-dependent pages (home, vacancies, companies, articles, salaries) need the full stack for complete testing. Their content rendering, search, filters, and pagination will be covered when the API is started.

### 2026-10-14 — Phase 1 RETEST (full stack running)

**API-dependent pages retested:**
- ✅ `/` (home) — hero with search, stats (75 vacancies, 42 companies), top companies carousel with SVG logos, 5 category quick-links with counts, 6 latest vacancy cards (salary, experience, badges), company cards with ratings/verification, employer CTA. Zero console errors, zero failed network requests.
- ✅ `/vacancies` — 75 vacancies listed, search bar, region filter (Toshkent 48, Samarqand 9, Farg'ona 4, etc.), job type filter, popular search suggestions (Frontend Developer, Backend Developer, etc.), sort dropdown, vacancy cards with company logos, salary ranges, experience, tags (SQL, Amplitude, etc.), "Obuna bo'lish" button. Zero errors.
- ✅ `/companies` — 42 companies, category filter tabs (Barchasi, IT, Bank va moliya, Ta'lim, etc.), search bar, top companies carousel (Orzu Bank 3.8★, Bozor Online 4.0★, NextBrain 4.6★, etc.), verification badges, grid/list view toggle, sort by popularity. Zero errors.
- ✅ `/articles` — 12 articles, category tabs (Karyera 2, Rezyume 2, Suhbat 2, Maosh 2, Ish topish 2, Maslahatlar 2), search bar, sort dropdown, featured article card with excerpt, article list with dates and reading times. Zero errors.
- ✅ `/salaries` — salary statistics based on 73 real vacancies, mediana 11M so'm, o'rtacha 13M so'm, range 7.5M–17M so'm with bar chart, salary distribution histogram (0–3mln through 25+mln), experience-level breakdown (Junior 6.25M → Lead 24M), category breakdown table (IT highest at 20M), region breakdown table (Navoiy 18.75M → Xorazm 4.25M), key insights section, filtered vacancy CTA links. Zero errors.

**All API requests returning 200.** Auth refresh, stats, vacancies, companies, articles, categories, regions, salary stats — all successful.

**Console errors:** Zero (clean tab, no stale errors)
**Failed network requests:** Zero (all uploads/logos loading correctly)

**Detail pages (not requested but now available):**
- `/vacancies/:slug`, `/companies/:slug`, `/articles/:slug` — untested in this retest (can be tested on request)

**Bugs found: 0**

### 2026-10-14 — Phase 2: Auth & Signup Flows

#### Login
- ✅ Login page renders correctly: email/password form, Google/Apple OAuth buttons, password recovery link, signup link
- ✅ Invalid credentials: generic error "Email yoki parol noto'g'ri" — does not leak whether email exists (security best practice)
- ✅ Demo account login (seeker@demo.ish.top): successful, redirected to home with authenticated header (Profil, Saqlanganlar, Xabarlar, notifications badge)
- ✅ Demo account login (hr@demo.ish.top): successful, redirected to `/employer/applications` with employer header (Vakansiyalarim, Nomzodlar, Murojaatlar, Xabarlar)
- ✅ Password visibility toggle: switches between `type="password"` and `type="text"`, button label updates ("Parolni ko'rsatish" ↔ "Parolni yashirish")

#### Signup
- ✅ Signup form renders: role toggle (Ish izlovchi / Ish beruvchi), first name, last name, email, password
- ✅ `?role=employer` param pre-selects employer tab
- ✅ HTML5 validation: email and password fields are `required`; name fields are optional
- ✅ Common password rejection: "password123" → localized error "Bu parol juda oson topiladi. Boshqa, kamida 8 belgili parol tanlang."
- ✅ Duplicate email rejection: localized error "Bu email bilan foydalanuvchi allaqachon mavjud"
- ⚠️ **[AUTH-001]** Short password error: raw English Zod message `password: String must contain at least 8 character(s)` instead of localized text — **P2 BUG**
- ⏭️ Signup success flow: not tested to avoid creating accounts in demo DB

#### Password Recovery
- ✅ Phone recovery mode: accessible via "Parolni unutdingizmi?" link → `/login?recover=1`
- ✅ Manual recovery mode: alternative path for accounts without phone
- ✅ Both modes render correctly with form inputs

#### OAuth (Social Login)
- ✅ Google button: shows "Bu usul hozircha ulanmagan." when `VITE_GOOGLE_CLIENT_ID` not set
- ✅ Apple button: shows "Bu usul hozircha ulanmagan." (backend not connected)
- ✅ Both buttons use proper accessibility: `aria-label`, `title`, `role="status"` on note

#### Session & Token Management
- ✅ Session persistence: page reload preserves auth state
- ✅ Logout flow (seeker): clears session, redirects to login with returnTo
- ✅ Logout flow (employer): clears session, redirects to login with returnTo
- ✅ Token refresh: 12-min background refresh interval (code-verified; AuthContext.tsx:30)
- ✅ Cross-tab sync: storage event listener for token changes (code-verified; session.ts:226-244)
- ✅ Fetch interceptor: 401 → auto refresh retry (code-verified; session.ts:183-222)

#### Route Guards & Role Protection
- ✅ Unauthenticated → `/profile` redirects to `/login?returnTo=%2Fprofile`
- ✅ Unauthenticated → `/employer/vacancies` redirects to `/login?returnTo=%2Femployer%2Fvacancies`
- ✅ Seeker → `/employer/applications` redirects to `/`
- ✅ Seeker → `/admin` redirects to `/`
- ✅ Employer → `/profile` renders "Kompaniya profili" (role-aware rendering)
- ✅ Employer → `/applications` redirects to `/employer/applications`
- ✅ Employer → `/favorites` redirects to `/employer/candidates`

#### Security: Open Redirect Prevention
- ✅ `returnTo=//evil.com` → sanitized, redirected to `/` (protocol-relative URL blocked)
- ✅ `safeReturnTo()` validates: starts with `/`, not `//` or `/\`, no control chars, max 500 chars (code-verified)

#### Console & Network
- ✅ Zero JS/React errors during auth flows
- ⚠️ Minor: one missing demo avatar (`demo-avatar-account-*.svg`) returns ERR_BLOCKED_BY_ORB on employer applications page
- ✅ All auth API endpoints return expected status codes

**Bugs found: 3 — all VERIFIED fixed**
- AUTH-001 (P2): Signup password Zod min/max errors → localized in `password.ts`
- AUTH-002 (P2): Signup email/role/name Zod errors → localized in `registerSchema`
- AUTH-003 (P2): Login email/password Zod errors → localized in `loginSchema`

**Verification (2026-10-14):**
- `npm run typecheck` — PASS (API + web)
- `npm --prefix apps/web run test:unit` — PASS (all assertions)
- `npm run test:e2e` — SKIP (requires E2E_DATABASE_URL)
- API curl tests: 7 invalid-input scenarios all return Uzbek messages
- Regression: common password, duplicate email, wrong password, valid login — all unchanged
- Browser retest: signup short password shows localized alert

### 2026-10-14 — Phase 3: Job Seeker Flows

#### Profile — Overview Tab
- ✅ Profile header: avatar initials, "Telefon tasdiqlangan" badge, name "Aziz Aliyev", title "Frontend dasturchi (React)", location "Toshkent", "Ish qidiryapman" status
- ✅ Profile completeness: 100% with congratulatory message
- ✅ Tab navigation: Umumiy, Shaxsiy ma'lumotlar, Rezyume, Tajriba, Ta'lim, Ko'nikmalar, Arizalarim (13), Saqlanganlar (11), Telegram, Sozlamalar

#### Profile — Shaxsiy ma'lumotlar (Personal Data)
- ✅ Name, job title, region, birth date, gender fields
- ✅ Phone: +998901000042 with verified badge
- ✅ Email: seeker@demo.ish.top (read-only, edit disabled)
- ✅ "Ish qidiryapman" toggle

#### Profile — Rezyume (Resume Wizard)
- ✅ 6-step wizard with progress indicator
- ✅ Steps 2-5 marked as completed (bajarildi)
- ✅ Step 1: Personal info (auto-filled from profile)
- ✅ Step 6 (Ko'rib chiqish): Full resume preview — name, title, contact, salary (20M so'm), about section, 2 work experiences, education (TATU), 8 skills
- ✅ PDF upload section with "Ko'rish" and "Almashtirish" buttons

#### Profile — Tajriba (Experience)
- ✅ 2 work entries: Digital Craft (mar 2022 — present), WebStudio Pro (sep 2020 — feb 2022)
- ✅ Descriptions, technologies, position titles visible

#### Profile — Ta'lim (Education)
- ✅ 1 entry: TATU, Dasturiy injiniring, Bakalavr, 2016-2020

#### Profile — Ko'nikmalar (Skills)
- ✅ 8 skills: React, TypeScript, Next.js, Tailwind CSS, Redux Toolkit, REST API, Git, Figma
- ✅ Recommendation section present

#### Profile — Telegram Tab
- ✅ Telegram connection section: phone verified, Telegram not connected
- ✅ Benefits listed (ariza holati, ish beruvchi xabarlari)
- ✅ Graceful degradation: "Telegram orqali tasdiqlash hozircha mavjud emas"
- ✅ Phone & security section: primary phone, backup phone placeholder, management buttons

#### Profile — Sozlamalar (Settings)
- ✅ Account section: email (read-only), phone with verified badge
- ✅ Preferences: language, theme, notifications management
- ✅ Security: password reset via Telegram, logout
- ✅ Danger zone: account deletion via support

#### Applications
- ✅ 13 applications across 5 statuses, side statistics (77% reviewed)
- ✅ Search, filter, sort functionality
- ✅ Pagination (10 per page)
- ✅ Application cards with company info, dates, status badges

#### Favorites
- ✅ 11 saved vacancies with filter and pagination
- ✅ 1 closed vacancy noted with appropriate badge
- ✅ Vacancy cards with salary, location, type info

#### Messages
- ✅ 4 conversations with unread badges
- ✅ Message thread: NextBrain conversation with realistic history, timestamps, read receipts
- ✅ Employer info card in thread view

#### Notifications
- ✅ 11 notifications in 3 categories
- ✅ Unread filter, mark-all-read button
- ✅ Per-notification action buttons

#### Vacancy Detail & Apply Flow
- ✅ Vacancy detail page: full content (salary, requirements, company info, similar vacancies, photos, reviews tab, share/save)
- ✅ Already-applied state: "Ariza yuborilgan", status "Ko'rib chiqilmoqda", submission date
- ✅ Apply card on unapplied vacancy: seeker name, resume info, "Ariza yuborish" button
- ✅ `requirePhoneVerified` guard confirmed on API endpoint (code-verified)
- ✅ PhoneGateNotice component renders when phone not verified (code-verified)
- ⏭️ Apply submission: not tested to avoid creating data in demo DB (flow confirmed via code review — no confirmation modal, direct API call)

#### Saved Searches / Alerts (`/alerts`)
- ✅ 4 saved searches: "UI/UX dizayner", "Frontend — masofaviy", "Masofaviy, 15 mln+", "React — Toshkent"
- ✅ Active/Paused states with toggle (To'xtatish / Davom ettirish)
- ✅ Frequency options: Darrov (immediately), Kuniga bir marta (once daily)
- ✅ Delete button per search
- ✅ Last check date shown (01 okt 2026)

#### Console & Network
- ✅ All API requests returning 200 OK on Phase 3 pages
- ✅ Zero current JS/React errors (stale Phase 2 auth test errors in buffer only)
- ✅ All profile/resume/applications/favorites/messages/notifications/alerts endpoints functional

**Bugs found: 0**

**Test limitations:**
- Apply submission not tested (would create data in demo DB; flow verified via code)
- Telegram verification not testable (no Telegram bot in dev environment)
- PDF resume "Ko'rish" viewer not clicked (would trigger file download/view)

### 2026-10-14 — Phase 4: Employer Flows

#### Login & Navigation
- ✅ Employer login (hr@demo.ish.top): successful, redirected to employer panel
- ✅ Employer header: Vakansiyalarim, Nomzodlar, Murojaatlar, Xabarlar, Bildirishnomalar (3), account menu "hr"

#### Company Profile (`/profile` — role-aware)
- ✅ Renders "Kompaniya profili" for employer role (vs "Mening profilim" for seeker)
- ✅ Logo upload section (PNG/JPG/WebP/SVG, max 5MB)
- ✅ Company fields: name (required), description, industry, region, staff size, founding year, website
- ✅ Save button, "Ommaviy profilni ko'rish" link to public profile
- ✅ Verification badge: "Kompaniyangiz tasdiqlangan" (verified)
- ✅ Telegram section: phone verified, Telegram not connected, graceful unavailability
- ✅ Phone & security: primary phone, backup phone management

#### Vacancy Management (`/employer/vacancies`)
- ✅ 9 vacancies displayed across 5 statuses: FAOL (5), MODERATSIYADA (1), QORALAMA (1), RAD ETILGAN (1), YOPILGAN (1)
- ✅ Statistics: 9 total, 5 active, 1 moderation, 1 draft, 1 rejected
- ✅ 12 total applications across vacancies
- ✅ Search bar, status filter, city filter, category filter, sort
- ✅ Status-appropriate actions per vacancy:
  - Active: Arizalarni ko'rish / Tahrirlash / Yopish
  - Draft: Tahrirlash / Faollashtirish
  - Rejected: Tahrirlash / Yopish (with rejection reason displayed)
  - Closed: Arizalarni ko'rish / Tahrirlash / Faollashtirish
  - Moderation: Tahrirlash / Yopish
- ✅ Pagination with page size selector

#### Create Vacancy (`/employer/vacancies/new`)
- ✅ 4-step wizard: Asosiy ma'lumotlar, Tavsif va talablar, Qo'shimcha ma'lumotlar, Ko'rib chiqish
- ✅ Required fields: name, category, employment type, location, region
- ✅ Optional fields: schedule, experience, salary range (from/to), "hide salary" checkbox
- ✅ Description with rich text hints (H3, lists, subheadings)
- ✅ Requirements and conditions (per-line entry)
- ✅ Additional: resume-optional toggle, contact info (email, Telegram, phone)
- ✅ Live preview panel on right side
- ✅ Tips sidebar (4 helpful suggestions)
- ✅ Actions: Saqlash va yuborish, Ko'rib chiqish, Qoralama sifatida saqlash, Bekor qilish
- ⏭️ Not submitted to avoid creating data

#### Edit Vacancy (`/employer/vacancies/:id/edit`)
- ✅ Same form as create, pre-populated with existing data
- ✅ Tested with "Frontend dasturchi (React)" — all fields filled correctly
- ✅ Category (IT), employment type, location, region, schedule, experience, salary range, description (194 chars), 4 requirements, 4 conditions
- ✅ Live preview matches current data
- ⏭️ Not saved to avoid modifying data

#### Applications Management (`/employer/applications`)
- ✅ 12 applications displayed across 5 statuses: Yangi (3), Ko'rib chiqilmoqda (3), Suhbatga taklif (3), Qabul qilingan (0), Rad etilgan (3)
- ✅ Search bar, filters, status tabs
- ✅ Application detail panel (auto-selects first): candidate name, title, location, status
- ✅ Resume tabs: Rezyume, Ariza xati, Faoliyat
- ✅ Full resume view: PDF button, title, expected salary, about, skills, work experience, education
- ✅ Contact info: email, phone, region
- ✅ Status change: dropdown with new status, optional note to candidate
- ✅ Quick actions: Suhbatga taklif qilish, Qabul qilish, Nomzodga xabar yozish, Rad etish
- ✅ Vacancy info card in detail panel
- ✅ Pagination: 1-10/12, page 2

#### Candidate Search (`/employer/candidates`)
- ✅ 13 candidates displayed with avatar, name, rating, title, location
- ✅ Search bar with placeholder "Masalan: Frontend, buxgalter, sotuv..."
- ✅ Peer ratings shown (Aziz 5.0, Bekzod 5.0)
- ✅ Detail panel prompt: "Ma'lumotini ko'rish uchun nomzodni tanlang"
- ✅ Two "Aziz Aliyev" entries: confirmed as two separate users (seeker@demo.ish.top + ism@email.com) — NOT a bug

#### Employer Messages (`/messages`)
- ✅ 4 conversations with candidates, 1 unread
- ✅ Last messages visible per conversation
- ✅ Search bar, All/Unread filter
- ✅ Detail panel prompt when no conversation selected

#### Employer Notifications (`/notifications`)
- ✅ 6 notifications (3 unread) across employer-relevant types:
  - Yangi ariza (3): new application notifications
  - Vakansiya moderatsiyada (1): moderation status
  - Vakansiya rad etildi (1): rejection with reason
  - Premium tarif faollashtirildi (1): subscription notification
- ✅ Read/unread filter, category filter, mark all read
- ✅ Per-notification actions: view, mark read, delete
- ✅ Category breakdown sidebar (Tizim xabarlari 3, Yangi arizalar 3)
- ✅ Settings and help links

#### Missing Pages (Roadmap vs Reality)
- ⚠️ `/employer/dashboard` — does NOT exist (no +Page.tsx). URL caught by legacy redirect `employer/:slug → /companies/:slug`, shows "Kompaniya topilmadi"
- ⚠️ `/employer/company` — does NOT exist. Company profile editing is role-aware via `/profile`
- ⚠️ `/employer/billing` — does NOT exist. Caught by legacy redirect
- ℹ️ `/employer/messages` — uses shared `/messages` route (role-aware rendering)

#### Console & Network
- ✅ All API requests returning 200 OK on employer pages
- ✅ Zero current JS/React errors
- ✅ All employer endpoints functional: vacancies, applications, candidates, notifications, messages

**Bugs found: 0**

**Notes:**
- 3 pages listed in roadmap don't exist: dashboard, company editor (separate page), billing. Company editing is available via role-aware `/profile`. Dashboard and billing are not implemented.
- Create/edit vacancy forms not submitted to preserve demo data
- Legacy `employer/:slug` redirect catches all non-existent employer sub-routes

#### API Log Review (post-Phase 4)

**404 Responses — EXPECTED BEHAVIOR (not bugs):**
- `GET /api/companies/dashboard` + `/api/companies/dashboard/similar` (404) — caused by deliberate QA navigation to `/employer/dashboard` (non-existent page). Legacy guard at `apps/web/src/pages/employer/@slug/+guard.ts` 301-redirects `/employer/:slug → /companies/:slug`. Company detail page `+data.ts` then fetched "dashboard" as a company slug → API correctly returned 404 → frontend rendered "Kompaniya topilmadi".
- `GET /api/companies/company` + `/api/companies/company/similar` (404) — same mechanism, QA navigated to `/employer/company`.
- `GET /api/companies/billing` + `/api/companies/billing/similar` (404) — same mechanism, QA navigated to `/employer/billing`.
- All 6 requests are the normal result of visiting non-existent `/employer/*` routes that the `@slug` catch-all redirects to `/companies/*`. The API, frontend redirect, and 404 rendering all behave correctly.

**Redis Fallback Messages — EXPECTED BEHAVIOR (not bugs):**
- `.env` sets `REDIS_URL="redis://localhost:6379"` but no Redis server is running in the dev environment.
- `redisEnabled = true` (because `REDIS_URL` is non-empty), so ioredis clients (`main` + `subscriber`) are created and attempt connections, which fail with ECONNREFUSED.
- ~18 fallback messages appeared across the session, rate-limited to once/minute per scope by `logError()` in `apps/api/src/common/redis.ts:41-46`.
- Messages appear primarily after WebSocket connections (`/ws/chat`), when the real-time pub/sub subscriber tries to subscribe.
- App design principle **Rule K** (`redis.ts:14`): "Redis yiqilsa sayt yiqilmaydi" — every Redis call goes through `redisCall()`, which returns `null` on failure; callers fall back to in-memory implementations.
- **Features working via in-memory fallback** (verified in QA — no functional degradation observed):
  - View deduplication (`dedupe.ts`): per-process only (acceptable for single-instance dev)
  - Quotas / rate limits (`quota.ts`): per-process only
  - Rate limiting (`@fastify/rate-limit`): uses Fastify's built-in memory store
  - Leader locks (`acquireLock`): defaults to `whenUnavailable: "allow"` — single instance proceeds
  - WebSocket fan-out: no cross-instance messaging (irrelevant in single-instance dev)
  - Cache invalidation: no cross-instance sync (irrelevant in single-instance dev)
- **Recommendation**: For a cleaner dev log, either remove `REDIS_URL` from `.env` (app works identically without it per `env.ts:166-169`) or start a local Redis on port 6379. This is an environment config concern, not an application defect.

### 2026-10-14 — Phase 5: Admin Panel

#### Login & Navigation
- ✅ Admin login (admin@demo.ish.top): successful, admin panel accessible
- ✅ Sidebar navigation: Umumiy, Foydalanuvchilar, Vakansiyalar (3), Kompaniyalar (1), Sharhlar (3), Murojaatlar (5), Jurnal, Maqolalar, Jamoa
- ✅ Badge counts on sidebar items reflect pending moderation queues

#### Dashboard (`/admin`)
- ✅ Stats cards: 62 users, 42 companies, 75 vacancies, 6 moderation queue items
- ✅ 14-day activity chart
- ✅ Service actions: search index rebuild, subscription check, auto-approve queue processing
- ✅ Broadcast messaging with target audience (Barchasi/Ish izlovchilar/Ish beruvchilar), recent broadcast history

#### Users (`/admin/users`)
- ✅ 62 users across 3 pages, pagination functional
- ✅ Role filter dropdown
- ✅ User cards: name, email, role, application count, registration date, phone verified badge
- ✅ Per-user actions: Bloklash, Admin qilish, role change
- ✅ Recovery requests tab

#### Vacancies (`/admin/vacancies`)
- ✅ 83 vacancies across 4 pages, status filter
- ✅ Moderation flags: TASDIQLANMAGAN KOMPANIYA, Avto-tasdiq navbatda, SHIKOYAT, AVTO-TASDIQLANGAN
- ✅ Inline rejection reasons visible
- ✅ Per-row actions: Ko'rish, Tasdiqlash, Rad etish, Arxivlash, Premium qilish/olib tashlash, Tekshirildi

#### Companies (`/admin/companies`)
- ✅ 42 companies across 2 pages, pagination functional (client-side state)
- ✅ Company details: name, legal name (yuridik nom), website, owner email, vacancy count, review count
- ✅ Verification states: TASDIQLANGAN (verified), unverified, TASDIQ SO'RALGAN (pending request with timestamp)
- ✅ Rejection notes with reasons (e.g., Grand Build: "STIR yuridik nomga mos kelmadi")
- ✅ Actions: Tasdiqlash / Tasdiqni olib tashlash / So'rovni rad etish (for pending requests)
- ✅ Sidebar badge "1" matches one pending verification request (Tafakkur Design)

#### Reviews (`/admin/reviews`)
- ✅ 3 reviews in moderation queue (matches sidebar badge)
- ✅ Review details: company, star rating, review text, author name, date
- ✅ Status: "Moderatsiyada" with auto-approve queue indicator
- ✅ Actions: Chop etish (Publish), Rad etish (Reject), O'chirish (Delete)

#### Support / Murojaatlar (`/admin/support`)
- ✅ 7 total tickets, 5 needing attention (3 new + 2 in review — matches sidebar badge "5")
- ✅ Status filter: Barcha holatlar, Yangi, Ko'rilmoqda, Hal qilindi, Rad etildi
- ✅ Type filter: Barcha turlar
- ✅ Ticket types: VAKANSIYA SHIKOYATI (vacancy complaint), ALOQA FORMASI (contact form)
- ✅ Categories: Firibgarlik, Texnik muammo, Noto'g'ri ma'lumot, Hamkorlik, Eskirgan, Taklif
- ✅ Linked vacancy references (clickable links to vacancy detail)
- ✅ Internal note textbox (Ichki izoh — Faqat jamoa ko'radi)
- ✅ Status change actions per ticket
- ✅ Email status indicators: "Email qoldirilmagan" / "Email xizmati sozlanmagan" (expected — email not configured in dev)

#### Moderation Log / Jurnal (`/admin/moderation-log`)
- ✅ 24 audit trail entries
- ✅ Columns: Time (VAQT), Object (OBYEKT), Decision (QAROR), Who (KIM)
- ✅ Filters: section (Barcha bo'limlar), actor (Hamma)
- ✅ Object types: Vakansiya, Kompaniya, Sharh, Murojaat
- ✅ Decision types: Tasdiqlandi, Avtomatik tasdiqlandi, Rad etildi, Arxivlandi, Holati o'zgardi
- ✅ Actors: Tizim (system auto-approve), Bekzod Tursunov, Aziza Karimova
- ✅ Decision notes visible with ↳ prefix

#### Articles CMS / Maqolalar (`/admin/articles`)
- ✅ 15 articles with status workflow
- ✅ Status tabs with counts: Barchasi (15), Qoralama (1), Ko'rib chiqilmoqda (1), Chop etilgan (12), Arxivda (1)
- ✅ Search bar, "Yangi maqola" (New article) button
- ✅ Columns: title (with slug), author, category, status, updated date, published date, actions
- ✅ Categories: Karyera, Maslahatlar, Rezyume, Suhbat, Maosh, Ish topish
- ✅ Authors: Jasur Qodirov (7), Dilnoza Rahimova (7), Muallifsiz (1)
- ✅ Editor notes visible on drafts (e.g., "Kirish qismini qisqartiring...")

#### Team Management / Jamoa (`/admin/team`)
- ✅ 6 team members with role management
- ✅ Roles: Super admin, Muharrir, Moderator, Muallif
- ✅ Member details: name, email, title, article count, join date, active/inactive status
- ✅ Current user indicator ("Siz")
- ✅ Actions: role change dropdown, name/title editing, Faollashtirish/Faolsizlantirish toggle
- ✅ Invite system: email + role, "Taklif havolasi 7 kun amal qiladi va bir marta ishlatiladi"
- ✅ Pending invitations section: 2 expired invitations with "Bekor qilish" action

#### Payments (`/admin/payments`) — hidden page
- ✅ 11 payment records (page exists but not in sidebar — billing disabled by default)
- ✅ Columns: company, plan, amount, provider, status, actions
- ✅ Plans: Standart (490,000 so'm), Premium (1,290,000 so'm)
- ✅ Providers: click, payme
- ✅ Statuses: Kutilmoqda, Muvaffaqiyatsiz, To'langan
- ✅ Action: "To'landi deb belgilash" for pending payments

#### Non-existent Admin Pages (404)
- ℹ️ `/admin/settings` — 404 (no separate settings page)
- ℹ️ `/admin/broadcasts` — 404 (broadcast messaging is on dashboard)

#### Admin Route Protection
- ✅ No auth → 401 "Avtorizatsiyadan o'tilmagan"
- ✅ Seeker auth → 403 "Ruxsat yo'q"
- ✅ API-level guards confirmed via direct fetch tests

#### Console & Network
- ✅ All admin API requests returning 200 OK
- ✅ Console errors are stale from Phase 2 auth testing — no new errors
- ✅ One Redis fallback message (expected — Redis not running)
- ✅ WebSocket connections functional

**Bugs found: 0**

**Notes:**
- Moderation actions (approve, reject, archive) not executed to preserve demo data state
- Broadcast messaging not sent to avoid creating notifications for demo users
- Team invite not created to avoid modifying team composition

### 2026-10-14 — Phase 6: Cross-Cutting Concerns

#### i18n — All 3 Locales
- ✅ **UZ** (default, no prefix): homepage, vacancies, companies, profile, admin — all UI labels in Uzbek
- ✅ **RU** (`/ru/`): homepage, vacancies pages tested — all UI labels translated to Russian (hero, filters, categories, badges, pagination, employment types, experience levels)
- ✅ **EN** (`/en/`): homepage, companies pages tested — all UI labels translated to English (hero, filters, categories, badges, employment types)
- ✅ URL prefix switching works correctly across all 3 locales
- ✅ Hreflang tags present: uz, ru, en, x-default with correct URLs
- ✅ Canonical URL set correctly
- ✅ Page titles localized per locale
- ✅ Database content (vacancy titles, company names, descriptions) stays in original language — expected behavior, not translatable data
- ✅ Company industry labels on cards show DB values while filter tabs use translated UI strings — consistent pattern, not a bug

#### Responsive Design
- ✅ **Mobile (375px)**: profile page — proper single-column layout, bottom nav (5 icons), no horizontal scroll
- ✅ **Mobile (375px)**: admin dashboard — sidebar collapses to horizontal scrollable tabs, stats cards stack vertically
- ✅ **Mobile (375px)**: admin vacancies table — readable with minor column truncation (acceptable for admin on mobile)
- ✅ Phase 1 already verified: desktop (1280px), tablet (768px), mobile (375px) on all public pages — hamburger menu, stacked layouts, MobileBottomNav

#### Dark Mode
- ✅ Theme toggle functional (verified Phase 1, confirmed Phase 6)
- ✅ `class="dark"` on html element controls theme
- ✅ Dark background `rgb(11, 15, 26)` applied correctly
- ✅ All pages tested in dark mode throughout Phases 1-6 without contrast issues

#### Error Handling
- ✅ 404 page: renders "Bu yo'l hali xaritada yo'q" with "Bosh sahifaga qaytish" and "Vakansiyalarni ko'rish" action buttons
- ✅ API validation errors: localized Uzbek messages (verified Phase 2 — AUTH-001/002/003 fixes)
- ✅ Auth errors: "Email yoki parol noto'g'ri" (generic, no email enumeration)
- ✅ 503 page: "Sahifa vaqtincha mavjud emas" with retry/home/vacancies buttons (verified Phase 1)

#### Loading States
- ✅ Extensive skeleton system: 115 files reference loading/skeleton patterns
- ✅ Dedicated skeleton components: VacancySkeleton, VacancyDetailSkeleton, CompanySkeleton, ArticleSkeleton, SalarySkeleton, ContactSkeleton, SupportSkeleton
- ✅ State management components (*States.tsx) for loading/empty/error states in every major section

#### SEO
- ✅ JSON-LD `JobPosting` schema on vacancy detail: title, description, salary (UZS), employmentType, experienceRequirements, hiringOrganization (name, logo, URL), jobLocation, skills, validThrough
- ✅ JSON-LD `BreadcrumbList` schema: proper 3-level hierarchy
- ✅ Meta tags: og:title, og:description, og:url, og:locale (uz_UZ), og:site_name, og:type, og:image (1200x630), twitter:card (summary_large_image)
- ✅ Canonical URLs and hreflang alternates for all 3 locales

#### Accessibility
- ✅ Form labels: email ("Email yoki telefon raqam"), password ("Parol"), all required fields marked
- ✅ Autocomplete attributes: "username" on email, "current-password" on password
- ✅ Aria-labels on navbar buttons: "Bildirishnomalar (3)", "Yorug' rejim", "Til: O'zbekcha", "Akkaunt menyusi: ..."
- ✅ Password toggle: aria-label "Parolni ko'rsatish" / "Parolni yashirish"
- ✅ Tab navigation: all interactive elements in tab order (tabIndex 0)
- ✅ Language selector: role="combobox" with aria-label

#### Security
- ✅ **JSON-LD XSS prevention**: `serializeJsonLd()` escapes `<`, `>`, `&`, U+2028, U+2029 — prevents `</script>` injection in user content (audit ISSUE-005)
- ✅ **Open redirect prevention**: `safeReturnTo()` validates returnTo starts with `/`, not `//` or `/\`, no control chars, max 500 chars (verified Phase 2: `//evil.com` → sanitized to `/`)
- ✅ **Admin route protection**: 401 without auth, 403 for non-admin (verified Phase 5)
- ✅ **CORS**: API returns proper CORS headers (OPTIONS → 204)
- ✅ **Password security**: common password rejection, bcrypt/argon2 hashing, no email enumeration on login error

#### Console & Network
- ✅ All current API requests returning 200 OK across all pages
- ✅ Console errors are all stale from Phase 2 auth testing — no new JS/React errors
- ✅ No failed network requests during normal navigation
- ✅ WebSocket connections functional

**Bugs found: 0**

### 2026-10-14 — Phase 7: Integration & Edge Cases

#### WebSocket Chat
- ✅ WebSocket endpoint `/ws/chat?token=...` accepts connections (confirmed via API terminal)
- ✅ Conversation thread opens correctly with message history, read receipts, composer
- ✅ Real-time message delivery within single-instance dev environment

#### Deep Linking & URL State
- ✅ Vacancy filter state persists in URL params: `region=samarqand&workType=full-time&sort=salary`
- ✅ Filters correctly restore on page load from URL params
- ✅ Browser back/forward preserves filter state

#### Rate Limiting
- ✅ Login lockout triggers after 10 failed attempts → 429 "Juda ko'p noto'g'ri urinish. 15 daqiqadan so'ng qayta urinib ko'ring."
- ✅ Global rate limit message localized: "Juda ko'p so'rov. N soniyadan so'ng qayta urinib ko'ring."

#### Push Notifications (Code Review)
- ✅ VAPID-based Web Push with SSRF protection (whitelist of allowed push endpoints)
- ✅ Graceful degradation: `features.push` check, returns 0 if VAPID keys not configured
- ✅ Subscription cleanup on 404/410, 10-second timeout per push delivery

#### File Upload Handling
- ✅ **Magic bytes validation** (`uploads.ts:detectFileKind`): PNG, JPG, WebP, PDF — Content-Type header NOT trusted (audit ISSUE-043)
- ✅ **Random filenames**: `<prefix><32 hex chars>.<ext>` — no userId or timestamp (audit ISSUE-029)
- ✅ **SVG rejected**: prevents script injection (audit ISSUE-002)
- ✅ **Size limit**: 5MB enforced at multipart level + stream level
- ✅ **Memory-first**: file validated before save — no orphaned temp files
- ✅ **Orphan cleanup**: if DB write fails, new file is deleted; old file deleted on replacement

#### Resume File Access Control (files.routes.ts)
- ✅ PDF resumes served ONLY through authenticated API route
- ✅ Access: owner, vacancy company owner, admin — all others → 403
- ✅ Path traversal protection: SAFE_NAME regex + `..` check
- ✅ Security headers: private no-store, nosniff, noindex

#### Company Logo & Article Cover Upload
- ✅ Logo: employer auth, rate limited (20/min), PNG/JPG/WebP only
- ✅ Verification reset on logo change (audit D-073)
- ✅ Article cover: staff-only auth, rate limited (20/min), PNG/JPG/WebP only

#### Telegram Integration
- ✅ Status endpoint returns linked/available/phone/botUsername
- ✅ Dev: `available: false` — UI shows graceful unavailability
- ✅ Unlink requires current password, cancels open challenges
- ✅ Telegram login REMOVED (audit D-041)

#### Billing / Payment Flow
- ✅ Behind `BILLING_ENABLED` feature flag — disabled in dev
- ✅ `/pricing` → 301 redirect to `/employer` (platform is free, D-040)
- ✅ Webhook with signature verification, Payme/Click providers

#### Concurrent Sessions & Auth Edge Cases
- ✅ Auth guard checks `tokenVersion` on EVERY request — bumped version invalidates all tokens
- ✅ Logout revokes via `revokeUserSessions()` (only if cookie version matches)
- ✅ Access token: stateless JWT (15-min TTL) + server-side tokenVersion check

#### Error Response Consistency
- ✅ 404, 401, 403, 429 — all consistently structured and localized in Uzbek

#### CORS & Multipart Configuration
- ✅ CORS: whitelist-based, credentials enabled, preflight cached 10 min
- ✅ Multipart: 5MB file, 1 file, 10 fields max, 1KB field size

#### Storage Layer
- ✅ Dual-mode: local disk (dev) or S3-compatible (prod)
- ✅ Lazy S3 client, immutable random filenames, proper cache headers

**Phase 7 Bugs found: 0**

**Test limitations:**
- Telegram link/unlink not functionally tested (bot not available in dev) — code-reviewed
- Billing checkout not tested (feature disabled) — code-reviewed
- Push notification delivery not tested (VAPID keys not configured) — code-reviewed
- WebSocket cross-instance fan-out not testable (single-instance dev)

### 2026-10-14 — Phase 8: Final QA & Closure

---

#### 1. Cross-Phase Results Summary

| Phase | Scope | Bugs | Method |
|-------|-------|------|--------|
| 0 | Project Discovery (46 routes, 100+ API endpoints, 34 models) | — | Code reading |
| 1 | Public Pages & Navigation (home, vacancies, companies, articles, salaries, employer landing, 404/503, legacy redirects, i18n, dark mode, responsive, SEO) | 0 | Browser-verified |
| 2 | Auth & Signup Flows (login, signup, recovery, OAuth, session management, route guards, open redirect prevention) | 3 FIXED | Browser-verified + API curl |
| 3 | Job Seeker Flows (profile tabs, resume wizard, applications, favorites, messages, notifications, alerts, vacancy detail) | 0 | Browser-verified |
| 4 | Employer Flows (company profile, vacancy CRUD, applications management, candidate search, messages, notifications) | 0 | Browser-verified |
| 5 | Admin Panel (dashboard, users, vacancies, companies, reviews, support, moderation log, articles CMS, team, payments) | 0 | Browser-verified |
| 6 | Cross-Cutting Concerns (i18n 3 locales, responsive 3 breakpoints, dark mode, error handling, loading states, SEO/JSON-LD, accessibility, security) | 0 | Browser-verified + code review |
| 7 | Integration & Edge Cases (WebSocket, deep linking, rate limiting, file uploads, Telegram, billing, concurrent sessions, CORS) | 0 | Mixed (see section 6) |

**Totals: 3 bugs found, 3 approved, 3 fixed, 3 verified. 0 regressions. 0 open bugs.**

---

#### 2. AUTH Fix Integrity Check

All three approved fixes remain as unstaged modifications (confirmed via `git diff`):

| Bug | File | Change | Status |
|-----|------|--------|--------|
| AUTH-001 | `apps/api/src/modules/auth/password.ts` | Added Uzbek `.min()` / `.max()` messages to `passwordField` | INTACT (unstaged, +5 −1 lines) |
| AUTH-002 | `apps/api/src/modules/auth/auth.routes.ts` | Added Uzbek messages to `registerSchema` (email, role, names) | INTACT (unstaged, +7 −7 lines) |
| AUTH-003 | `apps/api/src/modules/auth/auth.routes.ts` | Added Uzbek messages to `loginSchema` (email, password) | INTACT (unstaged, same file) |

No other files are modified. `.qa/` directory is untracked.

---

#### 3. Build, Typecheck & Test Evidence

| Check | Result | Timestamp |
|-------|--------|-----------|
| `npm run typecheck` (API + web) | PASS | 2026-10-14 |
| **`npm run build`** (root — API + web) | **PASS, exit code 0** | 2026-10-14 |
| — Prisma generate (API) | PASS (Prisma Client v5.22.0, 725ms) | 2026-10-14 |
| — API TypeScript build (`tsc -p tsconfig.json`) | PASS (zero errors) | 2026-10-14 |
| — Web production build (`vike build`) | PASS (built in 1.44s) | 2026-10-14 |
| `npm --prefix apps/web run test:unit` | PASS (18/18 assertions, "HAMMASI O'TDI") | 2026-10-14 |
| `npm run test:e2e` | SKIP (`E2E_DATABASE_URL` not configured) | 2026-10-14 |

The API server (terminal tab c5, started for QA via `npx tsx`) was stopped gracefully (Ctrl-C / SIGINT) before the final root build to release the Prisma query engine file lock. Port 3000 confirmed free before build execution.

Unit tests cover: `serializeJsonLd` (XSS), `safeReturnTo` / `safeInternalUrl` (open redirect), employer application query parsing, recovery mode/error parsing, `minutesUntil`, resume file URLs (D-058), notification i18n templates (D-059), `formatNumber` / `formatSalary` (i18n-6/7), `regionDisplayName` (i18n-4).

---

#### 4. Critical User Journey Verification (Phase 8 re-check)

| Journey | Status | Evidence |
|---------|--------|----------|
| **Seeker**: home → vacancies (75) → profile → messages → notifications | PASS | Browser page renders + API 200 |
| **Employer**: login → company profile (NextBrain) → vacancies → applications → candidates → messages | PASS | API returns company/user data |
| **Admin**: login → users (62) → vacancies (83) → companies (42) → moderation | PASS | API returns paginated data |
| **Auth flow**: login → /me → session refresh → logout | PASS | API curl verified |
| **Cross-role guard**: seeker → admin routes (403), no-auth → protected (401) | PASS | API curl verified |

---

#### 5. Untested / Partially Tested / Blocked Items

**A. Data-mutating flows NOT exercised (to preserve demo DB):**
- Vacancy creation submission (form UI verified, not submitted)
- Vacancy editing save (form pre-populated, not saved)
- Apply to vacancy (UI verified, not submitted; `requirePhoneVerified` guard confirmed in code)
- Moderation actions: approve/reject vacancy, review, company verification
- Broadcast messaging (admin dashboard — form UI verified, not sent)
- Team invite creation (UI verified, not submitted)
- Support ticket reply/status change
- Article publish/reject workflow execution

**B. Infrastructure-blocked features:**
- E2E test suite (`E2E_DATABASE_URL` not configured)
- Telegram link/unlink execution (bot not running in dev; `available: false`)
- Push notification delivery (VAPID keys not configured; `features.push = false`)
- Billing checkout → payment callback (billing feature disabled; `BILLING_ENABLED` not set)
- Redis cross-instance coordination (Redis not running; in-memory fallback used)
- WebSocket cross-instance fan-out (single-instance dev)
- Email sending (SMTP not configured; dev shows "Email xizmati sozlanmagan")

**C. Not tested (no way to exercise in dev):**
- Google OAuth actual flow (no `GOOGLE_CLIENT_ID` configured)
- Apple OAuth (backend not connected)
- S3 storage path (S3 env vars not set; local disk used)
- Production CORS with real domain origin
- PDF resume actual download via `/api/resume-files/me` (would require uploaded PDF in demo)

---

#### 6. Browser-Verified vs Code-Reviewed Distinction

| Feature Area | Verification Method |
|-------------|---------------------|
| Public pages rendering (home, vacancies, companies, articles, salaries) | BROWSER-VERIFIED |
| Login / signup / logout flows | BROWSER-VERIFIED + API curl |
| Zod validation error localization (AUTH-001/002/003) | BROWSER-VERIFIED + API curl |
| Job seeker profile (all 10 tabs) | BROWSER-VERIFIED |
| Employer panel (vacancies, applications, candidates, messages) | BROWSER-VERIFIED |
| Admin panel (all 10 pages incl. hidden payments) | BROWSER-VERIFIED |
| i18n (uz/ru/en), dark mode, responsive (3 breakpoints) | BROWSER-VERIFIED |
| 404/503 error pages | BROWSER-VERIFIED |
| Rate limiting (login lockout at 10 attempts) | API curl VERIFIED |
| Deep linking (URL filter params) | BROWSER-VERIFIED |
| Role-based route guards (401/403) | API curl VERIFIED |
| Open redirect prevention (`safeReturnTo`) | BROWSER-VERIFIED + unit test |
| JSON-LD XSS prevention (`serializeJsonLd`) | Unit test VERIFIED + code review |
| WebSocket chat connection | API terminal VERIFIED (connection accepted) |
| File upload security (magic bytes, random names, SVG rejection, size limits) | CODE-REVIEWED |
| Resume access control (auth'd route, path traversal protection) | CODE-REVIEWED |
| Push notifications (VAPID, SSRF whitelist, graceful degradation) | CODE-REVIEWED |
| Telegram integration (link/unlink, deep link, password confirmation) | CODE-REVIEWED |
| Billing / payment flow (checkout, webhook, signature verification) | CODE-REVIEWED |
| Session invalidation (tokenVersion, revokeUserSessions) | CODE-REVIEWED + partial API test |
| CORS configuration (whitelist, preflight caching) | CODE-REVIEWED |
| Multipart limits (5MB, 1 file, field limits) | CODE-REVIEWED |
| Storage layer (local disk / S3 dual-mode) | CODE-REVIEWED |

---

#### 7. Deferred Items & Environmental Limitations

**No deferred bugs.** All 3 found bugs are VERIFIED fixed.

**Environmental limitations (not application defects):**

| Limitation | Impact | Recommendation |
|-----------|--------|----------------|
| Redis not running | Rate limits and quotas are per-process only; no cross-instance sync | Start Redis or remove `REDIS_URL` from `.env` for cleaner logs |
| Telegram bot unavailable | Phone verification and password recovery via Telegram cannot be exercised | Configure bot token for full integration test |
| Billing disabled | Pricing page 301s to /employer; checkout/payment flows inaccessible | Set `BILLING_ENABLED=true` + payment provider test keys |
| VAPID keys missing | Push notification subscription/delivery cannot be tested | Generate VAPID keypair |
| E2E_DATABASE_URL not set | E2E test suite does not run | Provide a test MongoDB URI |
| SMTP not configured | Email-based flows show "Email xizmati sozlanmagan" | Configure SMTP for email testing |
| Google/Apple OAuth not configured | Social login buttons show "Bu usul hozircha ulanmagan" | Set `GOOGLE_CLIENT_ID` for OAuth testing |

---

#### 8. Final QA Sign-Off Summary

**Scope tested:** 46 frontend page routes across 3 user roles (job_seeker, employer, admin), 100+ API endpoints, 3 locales (uz/ru/en), 3 viewport breakpoints (mobile/tablet/desktop), dark/light modes, auth flows, session management, file upload security, rate limiting, WebSocket chat, deep linking, error handling, SEO/JSON-LD, and accessibility.

**Results:** 3 bugs found (all MEDIUM severity Zod localization issues in auth), all 3 approved by user, fixed, and browser-verified. Zero regressions. Root `npm run build` (API Prisma generate + TypeScript compilation + web Vite build) passes with exit code 0. Typecheck passes. Unit tests: 18/18 PASS. E2E tests: SKIP (`E2E_DATABASE_URL` not configured — not an application defect).

**What this QA does NOT claim:**
- The application is bug-free (untested paths exist — see section 5)
- Data-mutating flows work correctly end-to-end (verified via UI + code, not submitted)
- Features behind disabled flags are production-ready (code-reviewed only)
- Cross-instance behavior under load is correct (single-instance dev)

**Confidence level:** HIGH for all browser-verified user journeys and auth flows. MODERATE for code-reviewed subsystems (file uploads, push notifications, billing, Telegram). LOW for infrastructure-blocked features that could not be exercised at all.

**Pending user action:** The 3 AUTH fix modifications are unstaged. Commit when ready. The API server was stopped for the final build and is no longer running on port 3000.
