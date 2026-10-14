# QA Bug Backlog

## Format

Each bug entry follows this structure:

```
### [ID] Short title
- **Phase:** N
- **Severity:** CRITICAL / HIGH / MEDIUM / LOW
- **Status:** FOUND | APPROVED | FIXED | VERIFIED | WONTFIX
- **Page/Route:** affected URL
- **Evidence:** screenshot, console error, or description
- **Root cause:** file:line — description
- **Fix:** description of change (filled after approval)
```

## Known Issues (from prior audit)

### [PRE-001] Employer CTA signup link missing role param
- **Phase:** 1
- **Severity:** MEDIUM
- **Status:** VERIFIED (fixed in commit c4adca4)
- **Page/Route:** `/employer`
- **Evidence:** Bottom CTA linked to `/signup` instead of `/signup?role=employer`
- **Root cause:** `apps/web/src/pages/employer/+Page.tsx:110` — href missing `?role=employer`
- **Fix:** Changed `href={l("/signup")}` to `href={l("/signup?role=employer")}`

---

## Active Bugs

### [AUTH-001] Signup password validation error not localized
- **Phase:** 2
- **Severity:** MEDIUM (P2)
- **Status:** VERIFIED
- **Page/Route:** `/signup`
- **Evidence:** Submitting signup with password "short" (< 8 chars) showed raw English Zod error: `password: String must contain at least 8 character(s)` instead of localized Uzbek text.
- **Root cause:** `apps/api/src/modules/auth/password.ts:44` — `passwordField` Zod schema used default English messages for min/max.
- **Fix:** Added custom Uzbek error messages to `passwordField` in `password.ts`: min → `"Parol kamida 8 belgidan iborat bo'lishi kerak"`, max → `"Parol 128 belgidan oshmasligi kerak"`.
- **Verification:** API `POST /api/auth/register` with `{"password":"short"}` returns `"password: Parol kamida 8 belgidan iborat bo'lishi kerak"`. Browser signup form shows same. Typecheck passes. Unit tests pass.

### [AUTH-002] Signup validation messages for email, role, names not localized
- **Phase:** 2
- **Severity:** MEDIUM (P2)
- **Status:** VERIFIED
- **Page/Route:** `/signup`
- **Evidence:** Zod default English messages for registerSchema fields (email → "Invalid email", role → "Invalid enum value...", firstName/lastName/companyName → "String must contain at most N character(s)").
- **Root cause:** `apps/api/src/modules/auth/auth.routes.ts:14-21` — `registerSchema` Zod fields used default English messages.
- **Fix:** Added custom Uzbek error messages: email → `"Email manzil noto'g'ri"` / `"Email juda uzun"`, role → `"Rol noto'g'ri"`, firstName → `"Ism juda uzun"`, lastName → `"Familiya juda uzun"`, companyName → `"Kompaniya nomi juda uzun"`.
- **Verification:** API tests: invalid email → `"email: Email manzil noto'g'ri"`, invalid role → `"role: Rol noto'g'ri"`, long firstName → `"firstName: Ism juda uzun"`, long lastName → `"lastName: Familiya juda uzun"`. All localized. Typecheck passes.

### [AUTH-003] Login validation messages not localized
- **Phase:** 2
- **Severity:** MEDIUM (P2)
- **Status:** VERIFIED
- **Page/Route:** `/login`
- **Evidence:** Zod default English messages for loginSchema (email → "Invalid email", password → "String must contain at least 1 character(s)").
- **Root cause:** `apps/api/src/modules/auth/auth.routes.ts:23-26` — `loginSchema` Zod fields used default English messages.
- **Fix:** Added custom Uzbek error messages: email → `"Email manzil noto'g'ri"`, password → `"Parol kiritilishi shart"`.
- **Verification:** API tests: invalid email → `"email: Email manzil noto'g'ri"`, empty password → `"password: Parol kiritilishi shart"`. All localized. Typecheck passes.
