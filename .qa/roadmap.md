# QA Roadmap

## Phase Order (risk-weighted, user-facing impact first)

### Phase 1 — Public Pages & Navigation
**Risk: MEDIUM | Impact: HIGH (first impression, SEO)**

Scope:
- Home page renders correctly (hero, stats counter, featured vacancies)
- `/vacancies` — search, filters, pagination, empty states
- `/vacancies/:slug` — detail page, JSON-LD, OG tags, similar vacancies
- `/companies` — catalog, search, pagination
- `/companies/:slug` — detail, reviews display, similar companies
- `/articles` — listing, `/articles/:slug` — detail, feedback widget
- `/employer` landing page (both CTAs link correctly — prior bug area)
- Static pages: `/about`, `/contact`, `/privacy`, `/terms`
- Legacy redirects: `/search/vacancy`, `/employer/:slug`, `/article`, `/pricing`
- Header, footer, mobile bottom nav across all pages
- 404 page behavior for invalid routes

Browser checks: rendering, links, responsive layout (mobile/tablet/desktop), i18n switching (uz/ru/en), dark mode.

---

### Phase 2 — Auth & Signup Flows
**Risk: HIGH | Impact: HIGH (conversion gate)**

Scope:
- `/signup` — form validation, role param (?role=employer), success flow
- `/login` — email/password, error messages, lockout behavior
- Password recovery modes: phone, manual, status, reset token
- Google OAuth button presence and flow
- Token refresh cycle (15-min expiry, 12-min background refresh)
- Multi-tab session sync (storage events)
- Logout flow (token cleanup)
- Protected route redirects (unauthenticated → login with returnTo)
- Role guards: seeker-only pages block employers, employer-only block seekers
- Session persistence across page reload

Browser checks: form interactions, error states, redirects, cookie behavior, console errors.

---

### Phase 3 — Job Seeker Flows
**Risk: HIGH | Impact: HIGH (core user journey)**

Scope:
- `/profile` — edit profile, form validation
- `/resume` — structured resume builder (education, experience, skills, languages)
- `/applications` — application list, status display
- Apply to vacancy flow (requirePhoneVerified gate)
- `/favorites` — save/unsave vacancies and companies
- `/messages` — chat inbox, message history, real-time updates
- `/notifications` — notification list, mark read, i18n templates
- `/settings` — account settings
- Saved searches / alerts management

Browser checks: CRUD operations, real-time updates (if WS available), empty states, loading states.

---

### Phase 4 — Employer Flows
**Risk: HIGH | Impact: HIGH (revenue path)**

Scope:
- `/employer/dashboard` — overview metrics
- `/employer/company` — company profile CRUD, logo upload, verification request
- `/employer/vacancies` — vacancy list, status management
- `/employer/vacancies/new` — create vacancy form (category, location, salary, description)
- `/employer/vacancies/:id/edit` — edit vacancy
- `/employer/applications` — received applications, server-side pagination, filters, status changes
- `/employer/candidates` — candidate search (phone gate)
- `/employer/messages` — chat with applicants
- `/employer/billing` — subscription, plans, payment history (if billing enabled)

Browser checks: complex forms, file uploads, pagination, filter state in URL, status transitions.

---

### Phase 5 — Admin Panel
**Risk: MEDIUM | Impact: MEDIUM (internal tool)**

Scope:
- `/admin` — dashboard overview counters
- `/admin/users` — user list, block/unblock, role changes, security events
- `/admin/vacancies` — moderation queue, approve/reject, bulk operations
- `/admin/companies` — verification queue
- `/admin/reviews` — review moderation, privacy (hidden reviewer identity)
- `/admin/articles` — CMS workflow (draft → submit → review → publish)
- `/admin/support` — support tickets, replies
- `/admin/team` — staff management, invites
- `/admin/payments` — payment overview, manual confirmation
- `/admin/broadcasts` — notification broadcasts
- `/admin/moderation-log` — audit trail
- Admin-only route protection (non-admin redirect)

Browser checks: data tables, moderation actions, role-based access, bulk operations.

---

### Phase 6 — Cross-Cutting Concerns
**Risk: HIGH | Impact: HIGH (affects everything)**

Scope:
- i18n: all 3 locales render correctly, URL prefix switching, no missing keys
- Responsive design: mobile (375px), tablet (768px), desktop — all pages
- Dark mode: theme toggle, all pages
- Error handling: API errors surface user-friendly messages, ErrorBoundary catches
- Loading states: skeleton/spinner on data fetches
- SEO: JSON-LD on vacancy pages, proper meta tags, sitemaps
- Performance: no console errors, no network failures, reasonable load times
- Accessibility: keyboard navigation, focus management on modals/drawers
- Security: XSS vectors (JsonLd sanitization), open redirect prevention (returnTo/safeInternalUrl)

Browser checks: viewport resizing, locale switching, theme toggling, console monitoring, network monitoring.

---

### Phase 7 — Integration & Edge Cases
**Risk: MEDIUM | Impact: MEDIUM**

Scope:
- WebSocket chat: real-time message delivery, reconnection, token refresh
- Push notifications: VAPID key, subscription flow
- File operations: resume PDF upload/download, company logo upload
- Telegram integration: link/unlink status (if bot available)
- Payment flow: checkout → callback (if billing enabled)
- Rate limiting: login lockout, form submissions
- Concurrent sessions: multi-tab behavior, session invalidation
- Deep linking: share URLs with filters/pagination state
- Browser back/forward navigation state preservation

Browser checks: requires running API + MongoDB for full coverage.

---

### Phase 8 — Final QA & Closure
**Risk: LOW | Impact: HIGH (sign-off confidence)**

Scope:
- Cross-phase results review: summarize findings across all 7 phases
- AUTH fix integrity check: confirm AUTH-001/002/003 diffs remain intact and unstaged
- Build & typecheck verification: `npm run typecheck`, `npm run build`, `npm run test:unit` — collect pass/fail evidence
- Critical user journey walkthrough (read-only, no data mutation):
  - Seeker: home → vacancies → detail → profile → messages → notifications
  - Employer: login → company profile → vacancies → applications → candidates → messages
  - Admin: dashboard → users → moderation queues → articles CMS → team
- Cross-feature dependency audit: auth ↔ chat, auth ↔ file access, role guards ↔ all routes
- Untested / partially tested / blocked inventory: compile every item across phases that was code-reviewed only, skipped due to missing infrastructure, or not exercised in the browser
- Browser-verified vs code-reviewed distinction: tag each major feature area
- Deferred items & environmental limitations: Redis not running, Telegram bot unavailable, billing disabled, VAPID keys missing, E2E_DATABASE_URL not set
- Final backlog review: confirm all bugs are VERIFIED, no regressions
- QA sign-off summary document (does NOT claim bug-free — states tested scope and known gaps)

Safety constraints (same as all phases):
- No application source code modifications
- No database mutations, no real payments, no external communications
- No new dependencies, no commits, no pushes
- Do not label untested functionality as PASS

## Environment Requirements

| Phase | Web Dev Server | API Server | MongoDB | Browser |
|-------|---------------|------------|---------|---------|
| 1 | Required | Optional | No | Yes |
| 2 | Required | Required | Required | Yes |
| 3 | Required | Required | Required | Yes |
| 4 | Required | Required | Required | Yes |
| 5 | Required | Required | Required | Yes |
| 6 | Required | Optional | No | Yes |
| 7 | Required | Required | Required | Yes |
| 8 | Required | Required | Required | Yes |

Phase 1 and Phase 6 can partially run with just the web dev server (SSR pages may need API for data, but static rendering and layout can be verified).
Phase 8 requires the full stack to run build/typecheck and verify critical user journeys.
