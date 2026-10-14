# ISH BOR! — Project Map

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vike (SSR), TypeScript 5.9, Tailwind CSS |
| Backend | Fastify + Node.js, TypeScript 5.9 |
| Database | MongoDB (Prisma ORM), replica set rs0 on localhost:27018 |
| Monorepo | npm workspaces: `apps/api`, `apps/web` |
| i18n | 3 locales (uz, ru, en), URL prefix routing, lazy bundles |
| Auth | JWT access (localStorage) + httpOnly refresh cookie, 15-min expiry |
| Real-time | WebSocket (`/ws/chat`) via @fastify/websocket |

## Roles

`job_seeker` | `employer` | `admin` | `content_editor` | `content_author` | `moderator`

Guards: `requireAuth`, `requireRole(...)`, `requireStaff(...)`, `requirePhoneVerified`

## Dev Ports

| Service | Port | Command |
|---------|------|---------|
| Web (Vike) | 5173 | `npm run dev:web` |
| API (Fastify) | 3000 | `npm run dev:api` |
| MongoDB | 27018 | Manual `mongod --replSet rs0 --port 27018` |

## Frontend Pages (46 routes)

### Public
- `/` — Home (hero, stats, featured vacancies)
- `/vacancies` — Vacancy search with filters
- `/vacancies/:slug` — Vacancy detail + apply
- `/companies` — Company catalog
- `/companies/:slug` — Company detail + reviews
- `/articles` — Article listing
- `/articles/:slug` — Article detail
- `/employer` — Employer landing page
- `/pricing` — Pricing plans
- `/contact` — Contact form
- `/support` — Help center with FAQ
- `/candidates` — Candidate search (employer-gated)

### Auth
- `/login` — Login + password recovery modes
- `/signup` — Registration (role via ?role= param)

### Job Seeker Panel
- `/profile` — Profile editor
- `/resume` — Structured resume builder
- `/applications` — My applications
- `/favorites` — Saved vacancies
- `/messages` — Chat inbox
- `/notifications` — Notification center
- `/settings` — Account settings

### Employer Panel
- `/employer/dashboard` — Overview
- `/employer/vacancies` — Manage vacancies
- `/employer/vacancies/new` — Create vacancy
- `/employer/vacancies/:id/edit` — Edit vacancy
- `/employer/applications` — Received applications
- `/employer/company` — Company profile editor
- `/employer/messages` — Chat inbox
- `/employer/candidates` — Candidate search
- `/employer/billing` — Subscription & payments

### Admin Panel
- `/admin` — Dashboard overview
- `/admin/users` — User management
- `/admin/vacancies` — Vacancy moderation
- `/admin/companies` — Company verification
- `/admin/reviews` — Review moderation
- `/admin/articles` — CMS
- `/admin/support` — Support tickets
- `/admin/team` — Staff management
- `/admin/payments` — Payment management
- `/admin/broadcasts` — Broadcast notifications
- `/admin/moderation-log` — Moderation event log
- `/admin/settings` — Admin settings

### Legacy Redirects (via +guard.ts)
- `/search/vacancy` → `/vacancies`
- `/employer/:slug` → `/companies/:slug`
- `/article` → `/articles`
- `/pricing` → `/employer`

## API Routes (100+ endpoints)

### Auth (`/api/auth/*`) — 6 endpoints + recovery (6) + phone (3)
### Vacancies (`/api/vacancies/*`) — 11 endpoints
### Companies (`/api/companies/*`) — 9 endpoints
### Applications (`/api/applications/*`) — 6 endpoints
### Reviews (`/api/reviews/*`) — 2 endpoints
### Chat (`/api/conversations/*`) — 7 endpoints + WebSocket `/ws/chat`
### Notifications (`/api/notifications/*`) — 7 endpoints + push (3)
### Profile (`/api/profile/*`) — 4 endpoints
### Resume (`/api/resume`) — 2 endpoints
### Files (`/api/resume-files/*`) — 2 endpoints
### Favorites (`/api/favorites/*`) — 7 endpoints
### Saved Searches (`/api/saved-searches/*`) — 4 endpoints
### Articles (`/api/articles/*`) — 4 public + 8 admin
### Catalog (`/api/regions`, `/api/categories`) — 2 endpoints
### Stats (`/api/stats/*`) — 2 endpoints
### SEO — 6 endpoints (robots.txt, sitemaps)
### OG Images (`/api/og/*`) — 1 endpoint
### Telegram (`/api/telegram/*`) — 3 endpoints
### Support (`/api/support/*`) — 3 endpoints
### Billing (`/api/plans`, `/api/employer/subscription/*`) — 5 endpoints (conditional)
### Admin (`/api/admin/*`) — 20+ endpoints across users, content, ops, moderation, support, team

## Prisma Models (34)

User, Session, RecoveryRequest, JobSeekerProfile, Resume, ResumeEducation, ResumeExperience, ResumeLanguage, ResumeSkill, Company, CompanyPhoto, Vacancy, VacancyView, Application, Review, ReviewReport, Conversation, Message, PeerRating, Notification, PushSubscription, SavedSearch, Favorite, Article, ArticleView, ArticleFeedback, SupportTicket, VacancyReport, StaffInvite, ModerationLog, Plan, Subscription, Payment, BroadcastMessage

## Enums (26)

UserRole, ApplicationStatus, VacancyStatus, VacancyType, ExperienceLevel, CompanySize, ArticleStatus, ReviewStatus, ModerationAction, NotificationType, PaymentProvider, PaymentStatus, SubscriptionStatus, RecoveryStatus, RecoveryType, SupportTicketStatus, SupportTicketPriority, Gender, EducationLevel, LanguageProficiency, ConversationStatus, PeerRatingCategory, VacancyReportReason, VacancyLocationPolicy, BroadcastChannel, CompanyVerificationStatus

## Key Shared Components (35+)

Layout.tsx (root), Header.tsx, Footer.tsx, MobileBottomNav.tsx, ErrorBoundary.tsx, AuthContext.tsx, LocaleProvider, ThemeToggle, Modal.tsx, Drawer.tsx, VacancyCard.tsx, CompanyCard.tsx, ArticleCard.tsx, Pagination.tsx, SearchBar.tsx, FilterPanel.tsx, FileUpload.tsx, RichTextEditor.tsx, JsonLd.tsx, ShareButton.tsx, RegionSelect.tsx, CategorySelect.tsx, SalaryInput.tsx, StatusBadge.tsx, Avatar.tsx, EmptyState.tsx, LoadingSpinner.tsx, Toast/Notification system, ConfirmDialog.tsx, Tabs.tsx, Dropdown.tsx, Chip.tsx, MarkdownRenderer.tsx, PhoneInput.tsx, StarRating.tsx

## Existing Test Scripts

| Script | Location | Type |
|--------|----------|------|
| `test:unit` | `apps/web/scripts/unit-check.mjs` | esbuild bundle + Node assertions |
| `test:e2e` | `apps/api/scripts/e2e-check.mjs` | Real MongoDB HTTP integration |
| `test:auth` | `apps/api/scripts/auth-telegram-check.mjs` | Telegram auth flows |

No formal test framework (vitest/jest/playwright/cypress). No ESLint config.
