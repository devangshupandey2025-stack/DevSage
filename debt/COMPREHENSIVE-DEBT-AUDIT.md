# DevSage — Comprehensive Technical Debt Audit

**Generated:** 2026-02-25
**Scope:** Every file in the monorepo — apps/api, apps/web, apps/platform, apps/admin, apps/judge, packages/db, packages/shared, packages/config, root config, CI/CD, scripts, docs
**Total debt items:** 292

---

## Executive Summary

| Area | Critical | High | Medium | Low | Total |
|------|----------|------|--------|-----|-------|
| API (`apps/api`) | 1 | 10 | 22 | 20 | **53** |
| Web (`apps/web`) | 5 | 17 | 26 | 14 | **62** |
| Platform + Admin + Judge | 4 | 8 | 42 | 15 | **69** |
| Packages (db/shared/config) | 8 | 15 | 19 | 10 | **52** |
| Root Config / CI / Scripts / Docs | 3 | 8 | 15 | 18 | **56** (adjusted for overlap) |
| **TOTAL** | **21** | **58** | **124** | **77** | **292** |

---

## TOP 20 MOST CRITICAL ITEMS (Fix Immediately)

| # | Severity | Area | Description | File(s) |
|---|----------|------|-------------|---------|
| 1 | CRITICAL | CI/CD | **Deploy workflow has ZERO quality gates** — no test/lint/typecheck before production deploy | `.github/workflows/deploy.yml` |
| 2 | CRITICAL | CI/CD | **GitHub Actions script injection vulnerability** — user inputs interpolated directly in shell | `.github/workflows/deploy-hackathon-site.yml:43-52` |
| 3 | CRITICAL | API | **OTP generated with `Math.random()`** instead of CSPRNG | `apps/api/src/routes/auth.ts:716` |
| 4 | CRITICAL | Packages | **Seed SQL references nonexistent columns** — fresh deploy will fail | `packages/db/migrations/0001_seed.sql` |
| 5 | CRITICAL | Packages | **Migration `0002` not registered in journal** — `password_must_change` column never applied | `packages/db/migrations/0002_add_password_must_change.sql` |
| 6 | CRITICAL | Packages | **`@devsage/shared` is 100% dead code** — zero imports across entire monorepo | `packages/shared/src/` (all files) |
| 7 | CRITICAL | Packages | **`@devsage/db` Drizzle ORM unused** — API uses 268 raw SQL `prepare()` calls | `packages/db/src/client.ts` |
| 8 | CRITICAL | Packages | **Zod schema field names don't match DB columns** — `name` vs `title`, `start_date` vs `starts_at` | `packages/shared/src/schemas/hackathon.ts` |
| 9 | CRITICAL | Root | **Dual lock files** — both `package-lock.json` (npm) and `pnpm-lock.yaml` exist | Root directory |
| 10 | CRITICAL | Web | **Auth system documented but not implemented** — no AuthProvider, no credentials, no refresh | `apps/web/` (missing files) |
| 11 | CRITICAL | All FE | **Zero test files across all 4 frontend apps** | `apps/web/`, `platform/`, `admin/`, `judge/` |
| 12 | CRITICAL | Platform | **Analytics page shows entirely fabricated data** to production users | `apps/platform/src/pages/analytics.tsx` |
| 13 | CRITICAL | Web | **Custom cursor force-disables native cursor for ALL users** — major a11y violation | `apps/web/src/components/custom-cursor.tsx` |
| 14 | HIGH | API | **Queue handlers query nonexistent columns** — webhook pipeline completely broken | `apps/api/src/queue/push-handler.ts` et al. |
| 15 | HIGH | API | **No Zod validation on any API route** — all input uses unsafe `as string` casts | All `apps/api/src/routes/*.ts` |
| 16 | HIGH | API | **6 DB queries per authenticated request** in auth middleware | `apps/api/src/middleware/auth.ts:54-98` |
| 17 | HIGH | API | **Account deletion doesn't cascade** — orphaned data in 15+ tables, GDPR risk | `apps/api/src/routes/auth.ts:551` |
| 18 | HIGH | CI/CD | **Secret scan targets `master` branch**, not `main` | `.github/workflows/secret-scan.yml:8` |
| 19 | HIGH | Root | **Unpinned `turbo: "latest"`** — can break builds on any install | `package.json:55` |
| 20 | HIGH | Legal | **Privacy policy and Terms have `[Insert Contact Email]` placeholders** | `PRIVACY_POLICY.md`, `Terms_conditions.md` |

---

## PART 1: API (`apps/api/`) — 53 Items

### 1.1 TODO/FIXME Comments (2)

| ID | File | Line | Severity | Description |
|----|------|------|----------|-------------|
| API-001 | `services/github.ts` | 28-31 | HIGH | `getInstallationToken()` is a stub — always returns `null`. GitHub App JWT signing not implemented. |
| API-002 | `routes/hackathons.ts` | 187 | MEDIUM | `// TODO: Apply rounds, rubric from template` — template creation silently discards rounds/rubric. |

### 1.2 Stub/Placeholder Implementations (3)

| ID | File | Line | Severity | Description |
|----|------|------|----------|-------------|
| API-003 | `middleware/rate-limit.ts` | 9-11 | HIGH | Only `auth` tier has rate limits. All other routes have zero rate limiting. |
| API-004 | `middleware/rate-limit.ts` | 22-38 | MEDIUM | KV-based rate limiter has GET-then-PUT TOCTOU race condition. |
| API-005 | `middleware/cache.ts` | 12-16 | HIGH | Cache middleware doesn't check for auth cookies — would serve one user's data to another. |

### 1.3 Missing Input Validation (5)

| ID | File | Line | Severity | Description |
|----|------|------|----------|-------------|
| API-006 | `routes/hackathons.ts` | 15-104 | HIGH | Hackathon creation uses `raw.title as string` — no Zod, no runtime validation. |
| API-007 | `routes/hackathons.ts` | 58-59 | HIGH | Slug format not validated — accepts path traversal, SQL, spaces. |
| API-008 | Multiple routes | — | MEDIUM | `parseInt` without NaN/negative checks on pagination params. |
| API-009 | `routes/hackathons.ts` | 239 | LOW | Status filter not validated against known enum values. |
| API-010 | `routes/auth.ts` | 138+ | MEDIUM | All auth routes use `c.req.json<T>()` with zero runtime validation. |

### 1.4 Security Gaps (8)

| ID | File | Line | Severity | Description |
|----|------|------|----------|-------------|
| API-011 | `routes/auth.ts` | 716 | CRITICAL | **OTP uses `Math.random()`** — not cryptographically secure. |
| API-012 | `routes/auth.ts` | 709-788 | MEDIUM | Email verification stored in KV only, not DB — eventually consistent, un-queryable. |
| API-013 | `routes/auth.ts` | 551 | HIGH | **Delete account only deletes `users` row** — no cascade to 15+ related tables. |
| API-014 | `routes/auth.ts` | 512-563 | MEDIUM | Delete account confirmation token has no expiry and no limit on pending requests. |
| API-015 | `routes/invites.ts` | 171-259 | HIGH | Judge invite accept has NO auth middleware — token is sole authentication factor. |
| API-016 | `routes/webhooks.ts` | 65 | LOW | Webhook route under CORS middleware unnecessarily. |
| API-017 | Multiple | — | MEDIUM | `SELECT *` returns all columns including potentially sensitive data. |
| API-018 | `routes/auth.ts` | 149+ | MEDIUM | Password has no max length check — PBKDF2 DoS vector with 1MB+ passwords. |

### 1.5 Missing Error Handling (3)

| ID | File | Line | Severity | Description |
|----|------|------|----------|-------------|
| API-019 | All routes | — | MEDIUM | Audit event insert in `waitUntil` silently swallowed on failure — breaks hash chain. |
| API-020 | `lib/audit.ts` | 62-95 | MEDIUM | `backfillAuditHashes` — one corrupt event blocks entire backfill batch. |
| API-021 | `cron/index.ts` | 11-23 | MEDIUM | Cron handler: if first task throws, remaining tasks never run. |

### 1.6 Dead/Unused Code (5)

| ID | File | Line | Severity | Description |
|----|------|------|----------|-------------|
| API-022 | `routes/hackathons.ts` | 10 | LOW | Unused import `VALID_TRANSITIONS`. |
| API-023 | `lib/constants.ts` + DO | — | MEDIUM | Duplicate `VALID_TRANSITIONS` in two locations — divergence risk. |
| API-024 | `routes/announcements.ts` | 32-33 | LOW | Unused `role` variable. |
| API-025 | Multiple | — | LOW | `Context` type imported but unused in several files. |
| API-026 | `routes/workspaces.ts` | 3 | LOW | `paginatedResponse` imported but unused. |

### 1.7 Hardcoded Values (3)

| ID | File | Line | Severity | Description |
|----|------|------|----------|-------------|
| API-027 | `hackathons.ts` + `submission-tag.ts` | 98, 2 | LOW | Two different default tag patterns: `submission_v%` vs `submission-v*`. |
| API-028 | Multiple auth/workspace | — | LOW | Email HTML templates hardcoded inline with inconsistent brand colors. |
| API-029 | Multiple | — | LOW | 15+ magic numbers (batch sizes, invite expiry durations, max limits). |

### 1.8 Inconsistencies (5)

| ID | File | Line | Severity | Description |
|----|------|------|----------|-------------|
| API-030 | `routes/hackathons.ts` | 15-233 | HIGH | **Massive code duplication** between two hackathon creation routes (~120 identical lines). |
| API-031 | `routes/webhooks.ts` | 32,48 | LOW | Webhook bypasses `{ ok, data }` response envelope. |
| API-032 | `routes/audit.ts` | 11 | LOW | `hackathonContext` placed BEFORE `authMiddleware` — inconsistent ordering. |
| API-033 | Multiple | — | LOW | Inconsistent error response patterns (envelope vs raw JSON). |
| API-034 | Queue handlers | — | HIGH | **Query `github_owner`/`github_repo` columns that don't exist** — webhook pipeline broken. |

### 1.9 Missing Features (3)

| ID | File | Line | Severity | Description |
|----|------|------|----------|-------------|
| API-035 | `routes/announcements.ts` | 30 | MEDIUM | No notification dispatch on announcement creation. |
| API-036 | `routes/announcements.ts`, `rounds.ts` | — | MEDIUM | No audit trail for announcements, rounds, or rubric changes. |
| API-037 | `routes/invites.ts` | 49 | LOW | Missing `joined_at` on team member insert (inconsistent with teams.ts). |

### 1.10 Performance (5)

| ID | File | Line | Severity | Description |
|----|------|------|----------|-------------|
| API-038 | `middleware/auth.ts` | 54-98 | HIGH | **6 DB queries on every authenticated request** for role hydration. |
| API-039 | `lib/audit.ts` | 22-25 | MEDIUM | Global `MAX(sequence)` query on every audit insert — lock contention. |
| API-040 | `queue/notification-logic.ts` | 51-59 | MEDIUM | Unbounded query fetches ALL participants for notification. |
| API-041 | `routes/teams.ts` | 490-603 | MEDIUM | Seed endpoint does 600+ sequential DB inserts instead of batching. |
| API-042 | `routes/judging.ts` | 211-222 | LOW | No pagination on judge listing (same for organizers, rubric, workspaces). |

### 1.11 Type Safety (4)

| ID | File | Line | Severity | Description |
|----|------|------|----------|-------------|
| API-043 | `middleware/error-handler.ts` | 12 | LOW | Explicit `any` type on error response body. |
| API-044 | `lib/webhook-normalize.ts` | Multiple | MEDIUM | Unsafe `as` casts on webhook payloads without runtime validation. |
| API-045 | `lib/jwt.ts`, `lib/password.ts` | Multiple | LOW | Unsafe `as ArrayBuffer` casts. |
| API-046 | `queue/index.ts` | 32,56 | MEDIUM | Queue message bodies cast with `as` — no runtime validation. |

### 1.12 Additional (7)

| ID | File | Line | Severity | Description |
|----|------|------|----------|-------------|
| API-047 | `routes/auth.ts` | 583 | LOW | `expiresAt` variable declared but unused in forgot-password. |
| API-048 | `routes/judge-portal.ts` | 33-35 | MEDIUM | Queries nonexistent columns (`start_date`, `end_date`, `judging_deadline`). |
| API-049 | `routes/judge-portal.ts` | 43-45 | MEDIUM | `completed_assignments` count uses wrong status value (`completed` vs `scored`). |
| API-050 | `cron/index.ts` + DO | — | MEDIUM | DO alarm and cron both handle deadline transitions — double-fire risk. |
| API-051 | `wrangler.jsonc` vs `types/env.ts` | — | LOW | `WORKERS_ORIGIN_PATTERN` not in `AppEnv` type. |
| API-052 | `lib/utils.ts` | 5 | LOW | Invite code generation has modulo bias. |
| API-053 | `wrangler.jsonc` | 73-79 | LOW | R2 bucket commented out (Phase 2). |

---

## PART 2: Web App (`apps/web/`) — 62 Items

### 2.1 Critical Issues (5)

| ID | Severity | Description | File |
|----|----------|-------------|------|
| WEB-001 | CRITICAL | Registration button uses `alert('Coming soon')` — production placeholder | `pages/hackathon-detail.tsx:50-67` |
| WEB-004 | CRITICAL | **Zero test files** — vitest exits with code 1 | Entire `src/` |
| WEB-014 | CRITICAL | **Custom cursor force-hides native cursor** for all users via `cursor:none !important` | `components/custom-cursor.tsx:53-66` |
| WEB-032 | CRITICAL | **Auth system documented but not implemented** — no AuthProvider, no cookies, no refresh | Missing: `contexts/`, `auth-context.tsx` |
| WEB-016 | HIGH→CRIT | Preloader blocks content 2.5s every page load, no skip, no `prefers-reduced-motion` | `components/preloader.tsx` |

### 2.2 Hardcoded/Mock Data (9)

| ID | Severity | Description |
|----|----------|-------------|
| WEB-005 | HIGH | 10+ external Unsplash/Dreamstime/Broadcom image URLs (can break, copyright issues) |
| WEB-006 | MEDIUM | Base64 images embedded in JS bundle (~4KB+ each) |
| WEB-007 | HIGH | Hardcoded hackathon events (specific dates, prizes, participants) |
| WEB-008 | MEDIUM | Hardcoded pricing tiers (INR 3999/6999/9999) |
| WEB-011 | MEDIUM | Contact emails hardcoded in 10+ places |
| WEB-012 | HIGH | Fabricated statistics ("12,000+ teams active", "4.9/5 satisfaction") |
| WEB-013 | MEDIUM | "View all" hackathons links to external VIT university EventHub URL |
| WEB-009 | LOW | Team member data hardcoded |
| WEB-010 | LOW | Partner/sponsor data hardcoded |

### 2.3 Missing Features (7)

| ID | Severity | Description |
|----|----------|-------------|
| WEB-033 | HIGH | API client missing `credentials: 'include'` — auth cookies never sent |
| WEB-034 | HIGH | API client missing 401 auto-refresh retry |
| WEB-035 | HIGH | Vite proxy missing `/auth` route |
| WEB-037 | HIGH | Browse hackathons page: cards not clickable (no links to detail page) |
| WEB-038 | HIGH | Participant dashboard completely missing (documented but doesn't exist) |
| WEB-036 | MEDIUM | Hackathon detail "Location" always shows "Online / Global" |
| WEB-002 | HIGH | "View Rules" button has no onClick handler |

### 2.4 Accessibility (7)

| ID | Severity | Description |
|----|----------|-------------|
| WEB-017 | HIGH | Mobile menu lacks focus trap, ARIA attributes, Escape key handler |
| WEB-018 | MEDIUM | Missing aria-labels on icon-only buttons |
| WEB-019 | MEDIUM | FAQ accordion lacks ARIA accordion pattern |
| WEB-020 | MEDIUM | Low contrast text (text-white/20-40% fails WCAG AA) |
| WEB-015 | MEDIUM | Missing `rel="noopener noreferrer"` on external links |
| WEB-058 | MEDIUM | CTA buttons use `window.open` to Gmail — assumes all users use Gmail |
| WEB-059 | MEDIUM | onClick handler on 16x16 SVG icon instead of 36x36 parent button |

### 2.5 Dead Code (11)

| ID | Severity | Description |
|----|----------|-------------|
| WEB-027 | HIGH | `ErrorBoundary` component exists but never used — app crashes on errors |
| WEB-022 | MEDIUM | Node.js `fileURLToPath` imported in browser code |
| WEB-023 | MEDIUM | 4 unused lucide-react icon imports |
| WEB-030 | MEDIUM | Duplicate `/about` and `/about-us` routes (different designs, same purpose) |
| WEB-031 | MEDIUM | `AboutPage` eagerly imported (not lazy-loaded) |
| WEB-021 | LOW | Unused `href` import from react-router-dom |
| WEB-024 | LOW | Unused `navigate` in CTASection |
| WEB-025 | LOW | Unused `navigate` in HackathonGallery |
| WEB-026 | LOW | 4 unused shadcn/ui component files |
| WEB-028 | LOW | Sonner Toaster mounted but `toast()` never called |
| WEB-029 | LOW | Unused `@radix-ui/react-label` dependency |

### 2.6 Performance (8)

| ID | Severity | Description |
|----|----------|-------------|
| WEB-039 | HIGH | **home.tsx is 1978 lines** — 11 components in one file |
| WEB-040 | MEDIUM | 175-line HTML email template embedded in JS bundle |
| WEB-041 | MEDIUM | 25+ lucide-react icons in single chunk |
| WEB-042 | MEDIUM | GSAP (~30KB) loaded on every page via Preloader |
| WEB-043 | MEDIUM | Custom cursor: 6 spring-animated motion values updating continuously |
| WEB-044 | MEDIUM | browse-hackathons uses raw `useEffect` instead of React Query |
| WEB-045 | MEDIUM | hackathon-detail uses raw `useEffect` instead of React Query |
| WEB-046 | MEDIUM | Suspense fallback is an empty div — no loading indicator |

### 2.7 Type Safety, CSS, UX, Config (15)

| ID | Severity | Description |
|----|----------|-------------|
| WEB-048 | MEDIUM | `prizes: any[]` in Hackathon interface |
| WEB-050 | MEDIUM | Unsafe `{} as T` cast for 204 responses |
| WEB-051 | MEDIUM | Hackathon interface duplicated across files with different shapes |
| WEB-052 | MEDIUM | Invalid Tailwind class `opacity-150` |
| WEB-053 | MEDIUM | 34 inline `style={{}}` instances alongside Tailwind |
| WEB-056 | HIGH | No global error boundary — unhandled errors show blank screen |
| WEB-057 | MEDIUM | API errors silently swallowed — empty `catch {}` |
| WEB-060 | HIGH | Vitest config but tests always fail (code 1) — CI fails |
| WEB-061 | HIGH | Non-source files (.docx, .html, .md strategy docs) committed in `src/pages/` |
| WEB-062 | MEDIUM | Orphaned nested `apps/web/apps/web/` directory |
| WEB-047 | LOW | `plugins: any[]` in vite config |
| WEB-049 | LOW | `error: any, info: any` in ErrorBoundary |
| WEB-054 | LOW | ProfileCard uses 560-line standalone CSS file (not Tailwind) |
| WEB-055 | LOW | `.dark` theme variant defined in CSS but never toggled |
| WEB-003 | MEDIUM | Description rendered as plain text, not markdown |

---

## PART 3: Platform + Admin + Judge — 69 Items

### 3.1 Missing Tests (4)

| ID | App | Severity | Description |
|----|-----|----------|-------------|
| FE-001 | Platform | CRITICAL | Zero test files despite having vitest + testing-library installed |
| FE-002 | Admin | CRITICAL | Zero test files |
| FE-003 | Judge | CRITICAL | Zero test files |
| FE-004 | All | MEDIUM | Missing vitest.config.ts in all three apps |

### 3.2 Hardcoded/Mock Data (4)

| ID | App | Severity | Description |
|----|-----|----------|-------------|
| FE-005 | Platform | CRITICAL | **Entire analytics page is mock data** — fabricated stats, charts, regions |
| FE-006 | Platform | MEDIUM | Base64 image embedded in analytics.tsx |
| FE-007 | Platform | HIGH | Dashboard metrics: `hackathons.length * 8` for teams, "+12%" hardcoded |
| FE-008 | Platform | MEDIUM | `version: -1` hardcoded in state transition — bypasses concurrency control |

### 3.3 Dead/Unused Code (13)

| ID | App | Severity | Description |
|----|-----|----------|-------------|
| FE-009 | Platform | MEDIUM | Unused `dashboard-layout.tsx` (replaced by `app-layout.tsx`) |
| FE-010 | Platform | LOW | Unused `token` state in auth-context.tsx (always null) |
| FE-011 | Admin | LOW | Same unused `token` state |
| FE-012 | Judge | LOW | Same unused `token` state |
| FE-013 | Platform | LOW | Unused import `Underline` in login.tsx |
| FE-014 | Platform | LOW | Unused imports `useMotionValue, useTransform` in settings.tsx |
| FE-015 | Platform | LOW | Unused import `Mail` in workspace-detail.tsx |
| FE-016 | Platform | MEDIUM | Privacy + Terms pages imported but not routed (unreachable) |
| FE-017 | Platform | LOW | Local `StatusBadge` shadows shared component |
| FE-018 | Platform | MEDIUM | Local components in dashboard.tsx duplicate shared ones |
| FE-019 | Judge | LOW | `sidebarCollapsed` hardcoded to `false` in TopBar |
| FE-020 | Platform | LOW | Same `sidebarCollapsed` issue |
| FE-021 | Judge | LOW | Unused `useState` import in sidebar.tsx |

### 3.4 Missing Features (7)

| ID | App | Severity | Description |
|----|-----|----------|-------------|
| FE-022 | Platform | MEDIUM | Profile page is read-only (no edit) |
| FE-023 | Admin | MEDIUM | Profile page is read-only |
| FE-024 | Judge | MEDIUM | Profile page is read-only |
| FE-025 | All | MEDIUM | No route-level code splitting / lazy loading |
| FE-026 | Judge | LOW | No announcement viewing page |
| FE-027 | Platform | MEDIUM | hackathon-overview.tsx silently swallows metrics errors |
| FE-028 | Platform | MEDIUM | Judge invite accept navigates to nonexistent platform route |

### 3.5 Duplicate Code Across Apps (8)

| ID | Apps | Severity | Description |
|----|------|----------|-------------|
| FE-029 | All 3 | HIGH | **`lib/api.ts` identical across all 3 apps** (~63 lines each) |
| FE-030 | All 3 | LOW | `lib/utils.ts` identical (7 lines each) |
| FE-031 | All 3 | HIGH | **`auth-context.tsx` nearly identical** (~100 lines each) |
| FE-032 | All 3 | MEDIUM | `protected-route.tsx` nearly identical |
| FE-033 | All 3 | MEDIUM | shadcn/ui components duplicated (8 files per app) |
| FE-034 | All 3 | MEDIUM | `index.css` theme variables duplicated |
| FE-035 | P+J | MEDIUM | TopBar notification logic duplicated (~150 lines each) |
| FE-036 | P+J | MEDIUM | Scoring logic duplicated in judging pages |

### 3.6 Accessibility (8)

| ID | App | Severity | Description |
|----|-----|----------|-------------|
| FE-037 | Platform | HIGH | `<a>` tags without `href` in login.tsx — inaccessible to keyboard/screen reader |
| FE-038 | Judge | HIGH | Same `<a>` without `href` in login.tsx |
| FE-039 | Platform | MEDIUM | Browser `confirm()` for delete actions (not customizable, breaks theme) |
| FE-040 | Admin | MEDIUM | Same `confirm()` issue |
| FE-041 | Judge | MEDIUM | COI dialog is raw `<div>` overlay — no focus trap, no ARIA |
| FE-042 | Platform | HIGH | **5 custom modal dialogs in dashboard.tsx** — no focus trapping, no Escape, no ARIA |
| FE-043 | All | MEDIUM | Missing form labels on many inputs (placeholder-only) |
| FE-044 | Admin | MEDIUM | `<a href>` used instead of React Router `<Link>` — full page reloads |

### 3.7 Type Safety (6)

| ID | App | Severity | Description |
|----|-----|----------|-------------|
| FE-045 | All 3 | HIGH | Unsafe `{} as T` cast for 204 responses in api.ts |
| FE-046 | All 3 | MEDIUM | `Content-Type: application/json` set for all requests including GET |
| FE-047 | Platform | MEDIUM | `PromiseSettledResult<any>` in judging.tsx |
| FE-048 | Multiple | MEDIUM | Non-null assertions `!` on route params without guards |
| FE-049 | Multiple | MEDIUM | Local type definitions duplicate `queries.ts` types |
| FE-050 | Platform | LOW | `notificationQueries.all()` uses `unknown[]` |

### 3.8 API Integration (6)

| ID | App | Severity | Description |
|----|-----|----------|-------------|
| FE-051 | Platform | MEDIUM | TopBar notifications use raw `useEffect` instead of TanStack Query |
| FE-052 | Platform | MEDIUM | 7 pages use raw `apiRequest` instead of TanStack Query |
| FE-053 | Judge | MEDIUM | 3 pages use raw `apiRequest` instead of TanStack Query |
| FE-054 | Multiple | MEDIUM | Empty catch blocks suppress API errors silently |
| FE-055 | Judge | LOW | `judge-invite-accept.tsx` navigates to wrong platform route after accept |
| FE-056 | Admin | MEDIUM | `<a href>` causes full-page reloads losing React state |

### 3.9 State Management (5)

| ID | App | Severity | Description |
|----|-----|----------|-------------|
| FE-057 | Platform | HIGH | **Dashboard is a 1522-line god component** with 18 `useState` calls |
| FE-058 | Platform | MEDIUM | `fetchHackathons` references `user` but `user` not in useEffect deps |
| FE-059 | Platform | LOW | `fetchAnnouncements` should be in useCallback or inside effect |
| FE-060 | Judge | MEDIUM | `border-white/` incomplete Tailwind opacity (missing number) — 3 occurrences |
| FE-061 | Judge | MEDIUM | Same `border-white/` in topbar.tsx — 4 occurrences |

### 3.10 Config (4)

| ID | App | Severity | Description |
|----|-----|----------|-------------|
| FE-062 | Admin+Judge | MEDIUM | **Port conflict**: both set port 5175 in package.json |
| FE-063 | All 3 | MEDIUM | Hardcoded Cloudflare account_id in wrangler.jsonc |
| FE-064 | All 3 | MEDIUM | No React Error Boundary components |
| FE-065 | All 3 | LOW | No `<meta>` viewport verification in index.html |

---

## PART 4: Packages (db/shared/config) — 52 Items

### 4.1 Unused/Orphaned Schema Tables (4)

| ID | Package | Severity | Description |
|----|---------|----------|-------------|
| PKG-001 | db | HIGH | 6 Better Auth schema files exist but NOT exported from barrel |
| PKG-002 | db | HIGH | `otp_sessions`, `email_verification_tokens`, `password_reset_tokens` not exported |
| PKG-003 | db | CRITICAL | `ai_reviews` table in migration but NO Drizzle schema source file |
| PKG-004 | db | HIGH | `jwks` table in migration but NO Drizzle schema source file |

### 4.2 Schema Inconsistencies (13)

| ID | Package | Severity | Description |
|----|---------|----------|-------------|
| PKG-005 | db | MEDIUM | `hackathons.created_at/updated_at` have NO default values (only table missing defaults) |
| PKG-006 | db | MEDIUM | `rubric_criteria.created_at` missing default |
| PKG-007 | db | MEDIUM | `round_results.created_at` missing default |
| PKG-008 | db | MEDIUM | `announcements` table uses camelCase properties (every other table uses snake_case) |
| PKG-009 | db | MEDIUM | `announcements` table has NO indexes |
| PKG-010 | db | MEDIUM | `announcements.createdAt/updatedAt` missing defaults |
| PKG-011 | db | HIGH | Better Auth `email_verified` column name mismatches migration |
| PKG-012 | db | MEDIUM | Auth tables use `integer` timestamps vs business tables using `text` — undocumented |
| PKG-013 | db | MEDIUM | `workspaces.created_by` FK has NO cascade behavior |
| PKG-014 | db | MEDIUM | `hackathons.workspace_id/created_by` FKs have NO cascade behavior |
| PKG-015 | db | HIGH | `scores` table: 4 FK references with NO cascade behavior |
| PKG-016 | db | MEDIUM | `team_repos.hackathon_id` FK missing cascade |
| PKG-017 | db | HIGH | `hackathon_requests.hackathon_id` missing FK reference entirely |

### 4.3 Missing Zod Validations (6)

| ID | Package | Severity | Description |
|----|---------|----------|-------------|
| PKG-018 | shared | CRITICAL | **API routes do NOT use `@devsage/shared` Zod schemas** — all dead code |
| PKG-019 | shared | MEDIUM | No Zod schema for `hackathon_requests` CRUD |
| PKG-020 | shared | MEDIUM | No Zod schema for announcements CRUD |
| PKG-021 | shared | LOW | No Zod schema for webhook deliveries |
| PKG-022 | shared | LOW | No Zod schema for deletion requests |
| PKG-023 | shared | LOW | No Zod schema for notification config |

### 4.4 Type Mismatches (9)

| ID | Package | Severity | Description |
|----|---------|----------|-------------|
| PKG-024 | shared | CRITICAL | Zod `hackathonResponseSchema` uses `name` but DB uses `title` |
| PKG-025 | shared | CRITICAL | Zod has `start_date/end_date` but DB has `starts_at/judging_starts/judging_ends` |
| PKG-026 | shared | HIGH | `createHackathonSchema` field names don't map to any DB column |
| PKG-027 | shared | HIGH | `createHackathonSchema` missing ~17 of 27 hackathon columns |
| PKG-028 | shared | MEDIUM | `submissionResponseSchema.is_current` is `z.boolean()` but DB stores `integer(0/1)` |
| PKG-029 | shared | MEDIUM | `roundResultResponseSchema` has `advanced` field that doesn't exist in DB |
| PKG-030 | shared | MEDIUM | `roundResultResponseSchema` missing `hackathon_id`, `status`, `decided_by` |
| PKG-031 | shared | HIGH | `workspaceRoleSchema` uses `owner/admin/member` but seed uses `workspace_owner/workspace_member` |
| PKG-032 | shared | HIGH | `teamMemberRoleSchema` uses `team_lead/team_member` but seed uses `leader/member` |

### 4.5 Dead Exports (2)

| ID | Package | Severity | Description |
|----|---------|----------|-------------|
| PKG-033 | shared | CRITICAL | **ALL exports from `@devsage/shared` are dead code** — zero imports in monorepo |
| PKG-034 | db | CRITICAL | **`@devsage/db` Drizzle ORM is unused** — API uses 268 raw SQL queries |

### 4.6 Missing/Broken Migrations (4)

| ID | Package | Severity | Description |
|----|---------|----------|-------------|
| PKG-035 | db | CRITICAL | `0002_add_password_must_change.sql` not registered in migration journal |
| PKG-036 | db | CRITICAL | Seed SQL references columns that don't exist in schema |
| PKG-037 | db | HIGH | 16+ migration indexes reference columns that don't match Drizzle schema |
| PKG-038 | db | HIGH | `hackathon_notification_config` unique index is wrong (single vs composite) |

### 4.7 ESLint Config Gaps (4)

| ID | Package | Severity | Description |
|----|---------|----------|-------------|
| PKG-039 | config | LOW | No import ordering/sorting rule |
| PKG-040 | config | LOW | `console.log` ban is `warn` not `error` — doesn't fail CI |
| PKG-041 | config | LOW | Missing `eqeqeq`, `prefer-const`, `no-return-await` rules |
| PKG-042 | config | LOW | No React-specific ESLint rules for .tsx files |

### 4.8 tsconfig Issues (4)

| ID | Package | Severity | Description |
|----|---------|----------|-------------|
| PKG-043 | config | LOW | `allowJs: true` + `checkJs: false` — backdoor for untyped JS |
| PKG-044 | config | LOW | Missing `noUncheckedIndexedAccess` |
| PKG-045 | config | LOW | Missing `noPropertyAccessFromIndexSignature` |
| PKG-046 | config | LOW | `tsconfig.react.json` missing `DOM.Iterable` in lib |

### 4.9 Documentation Gaps (6)

| ID | Package | Severity | Description |
|----|---------|----------|-------------|
| PKG-047 | db | MEDIUM | Dual user tables (`users` vs `user`) undocumented |
| PKG-048 | db | MEDIUM | 13 JSON text columns with no documented schema shape |
| PKG-049 | shared | LOW | `rubric_criteria.weight` range (0-1) undocumented in DB |
| PKG-050 | db | LOW | `hackathon_requests.hackathon_id` lifecycle undocumented |
| PKG-051 | db | MEDIUM | `team_repos.access_token_encrypted` — encryption method undocumented |
| PKG-052 | shared | MEDIUM | Test file only covers 4 of 40+ schemas |

---

## PART 5: Root Config / CI / Scripts / Docs — 56 Items

### 5.1 Critical CI/CD (3)

| ID | Severity | Description | File |
|----|----------|-------------|------|
| ROOT-001 | CRITICAL | **Dual lock files** — `package-lock.json` + `pnpm-lock.yaml` | Root |
| ROOT-006 | CRITICAL | **Deploy workflow has ZERO quality gates** — no test/lint/typecheck | `deploy.yml` |
| ROOT-009 | CRITICAL | **Script injection** in hackathon site deploy — user inputs in shell | `deploy-hackathon-site.yml:43-52` |

### 5.2 High Priority (8)

| ID | Severity | Description | File |
|----|----------|-------------|------|
| ROOT-002 | HIGH | **Unpinned `turbo: "latest"`** | `package.json:55` |
| ROOT-003 | HIGH | **gsap in root deps** (belongs in `apps/web`) + pnpm as runtime dep | `package.json:59` |
| ROOT-005 | HIGH | **Secret scan targets `master`** branch (repo uses `main`) | `secret-scan.yml:8` |
| ROOT-007 | HIGH | Deploy workflow missing D1 migration step | `deploy.yml` |
| ROOT-008 | HIGH | No staging environment — deploys directly to production | `deploy.yml` |
| ROOT-010 | HIGH | Hardcoded Cloudflare account ID in script | `scripts/generate-hackathon-site.js:25` |
| ROOT-019 | HIGH | **Privacy policy has `[Insert Contact Email]` placeholder** | `PRIVACY_POLICY.md:71` |
| ROOT-020 | HIGH | **Terms has `[Insert Your Country/State]` and `[Insert Contact Email]`** | `Terms_conditions.md:48,55` |

### 5.3 Medium Priority (15)

| ID | Severity | Description |
|----|----------|-------------|
| ROOT-004 | MEDIUM | pnpm engine constraint (`>=8.0.0`) contradicts `packageManager: pnpm@10.28.2` |
| ROOT-011 | MEDIUM | Test account passwords and personal email exposed in seed scripts |
| ROOT-016 | MEDIUM | Missing CODEOWNERS file |
| ROOT-017 | MEDIUM | Missing PR template |
| ROOT-023 | MEDIUM | `ABOUT_US.md` has invalid email domain `devsage.platform` |
| ROOT-024 | MEDIUM | FAQ claims GitHub account is required (actually supports 3 auth methods) |
| ROOT-025 | MEDIUM | `source-tree-analysis.md` references nonexistent `templates/` directory |
| ROOT-029 | MEDIUM | `project-overview.md` missing Judge app from structure |
| ROOT-034 | MEDIUM | `deployment.md` config JSON uses different field names than actual script |
| ROOT-035 | MEDIUM | gitleaks.toml missing `.env` file scanning |
| ROOT-037 | MEDIUM | `turbo.json` missing `globalEnv` entries — stale build cache risk |
| ROOT-041 | MEDIUM | `generate-hackathon-site.js` missing slug input validation |
| ROOT-042 | MEDIUM | Same script does `git push --force` to main without confirmation |
| ROOT-044 | MEDIUM | `generate-hackathon-site.js` sends unauthenticated POST (will always 401) |
| ROOT-047 | MEDIUM | `architecture-frontends.md` says "Three Frontend Apps" — there are four |
| ROOT-050 | MEDIUM | No E2E tests in CI despite README claiming "full E2E flows tested" |
| ROOT-051 | MEDIUM | No concurrency controls on deploy workflow |
| ROOT-052 | MEDIUM | Deploy workflow pnpm version mismatch |
| ROOT-053 | MEDIUM | TODO.md is 65KB of untracked debt (should be in issue tracker) |
| ROOT-056 | MEDIUM | @typescript-eslint packages v6 incompatible with ESLint 10 |

### 5.4 Low Priority (18)

| ID | Severity | Description |
|----|----------|-------------|
| ROOT-012 | LOW | `console.log` used in scripts (banned by convention) |
| ROOT-013 | LOW | `generate-hackathon-pages.js` uses CommonJS in ESM monorepo |
| ROOT-014 | LOW | `generate-hackathon-site.js` uses CommonJS |
| ROOT-015 | LOW | Generated pages use `hackathon: any` type |
| ROOT-018 | LOW | No auto-versioning (version stuck at 0.1.0) |
| ROOT-021 | LOW | `Terms_conditions.md` inconsistent filename casing |
| ROOT-022 | LOW | `PRIVACY_POLICY.md` typo: "specificy" |
| ROOT-026 | LOW | Docs reference `.github/prompts/` and `.github/agents/` (don't exist) |
| ROOT-027 | LOW | `project-overview.md` link to `deployment-guide.md` (actual: `deployment.md`) |
| ROOT-028 | LOW | `project-overview.md` lists nonexistent `templates/` in structure |
| ROOT-030 | LOW | AGENTS.md says "~35 tables", CLAUDE.md says "~38", docs say "49" |
| ROOT-031 | LOW | `development-guide.md` missing Judge app port |
| ROOT-032 | LOW | `development-guide.md` CI/CD table only lists 1 of 3 workflows |
| ROOT-033 | LOW | `deployment.md` references unused `CLOUDFLARE_ACCOUNT_ID` secret |
| ROOT-036 | LOW | `.codex` in `.gitignore` but directory may be tracked |
| ROOT-038 | LOW | turbo.json lint task missing `outputs: []` |
| ROOT-039 | LOW | turbo.json test task missing `outputs: []` |
| ROOT-040 | LOW | Duplicate `dev-reset-db` scripts (`.sh` + `.mjs`) |
| ROOT-043 | LOW | Script uses `curl` for API seeding instead of Node.js `fetch()` |
| ROOT-045 | LOW | `frontend_feature.md` contains AI assistant response artifact |
| ROOT-046 | LOW | `frontend_feature.md` at root instead of `docs/` |
| ROOT-048 | LOW | `.gitignore` has duplicate `*.tsbuildinfo` entry |
| ROOT-049 | LOW | `pnpm-workspace.yaml` lists apps individually instead of `apps/*` glob |
| ROOT-054 | LOW | `skills-lock.json` committed (unclear if needed) |
| ROOT-055 | LOW | ESLint version mismatch across docs (9 vs 10) |

---

## PART 6: Plan vs Implementation Gaps (from plan/ docs)

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| GAP-001 | CRITICAL | **Billing & Subscription System** — completely absent (no DB, no API, no UI, no payment gateway) | Not started |
| GAP-002 | CRITICAL | **TOTP 2FA** — DB schema exists but no API endpoints for setup/verify | Not started |
| GAP-003 | CRITICAL | **Hackathon Registration on Branded Sites** — shows "coming soon" placeholder | Not started |
| GAP-004 | MEDIUM | **Judging Window Time Enforcement** — no `scoring_opens_at`/`scoring_closes_at` | Not started |
| GAP-005 | MEDIUM | **Judge Guidelines/Instructions** — no endpoint or UI for guidelines | Not started |
| GAP-006 | MEDIUM | **Analytics Backend API** — platform page uses mock data, no API | Not started |
| GAP-007 | LOW | **Eliminated Team Notifications & Disbanding** | Partial |
| GAP-008 | LOW | **Per-Round Submission Tag Patterns** | Not started |

---

## Remediation Priority Guide

### Phase 1: Security & Stability (Do This Week)
1. Fix CI script injection vulnerability (ROOT-009)
2. Add quality gates to deploy workflow (ROOT-006)
3. Fix secret scan branch (ROOT-005)
4. Replace `Math.random()` OTP with CSPRNG (API-011)
5. Fix queue handler column queries (API-034)
6. Register migration 0002 in journal (PKG-035)
7. Fix seed SQL column references (PKG-036)
8. Delete `package-lock.json` (ROOT-001)
9. Pin turbo version (ROOT-002)
10. Fill legal document placeholders (ROOT-019, ROOT-020)

### Phase 2: Data Integrity (This Sprint)
1. Fix Zod schema field names to match DB columns (PKG-024, PKG-025, PKG-026)
2. Fix role enum mismatches (PKG-031, PKG-032)
3. Add cascade behaviors to FK references (PKG-015, PKG-017)
4. Fix migration/schema index drift (PKG-037, PKG-038)
5. Create missing schema files for `ai_reviews` and `jwks` (PKG-003, PKG-004)
6. Add max password length (API-018)
7. Implement account deletion cascade (API-013)

### Phase 3: Code Quality (This Milestone)
1. Begin adopting Zod validation in API routes (API-006, PKG-018)
2. Begin adopting Drizzle ORM in API (PKG-034)
3. Extract duplicated code across frontend apps (FE-029, FE-031)
4. Add `passWithNoTests` or write initial tests (FE-001, FE-002, FE-003, WEB-004)
5. Fix web app auth system (WEB-032, WEB-033, WEB-034)
6. Replace mock analytics data (FE-005)
7. Fix accessibility violations (WEB-014, FE-042)

### Phase 4: Polish (Backlog)
1. Extract magic numbers to constants (API-029)
2. Add lazy loading to frontend apps (FE-025)
3. Break up god components (WEB-039, FE-057)
4. Consolidate email templates (API-028)
5. Add proper error boundaries (WEB-056, FE-064)
6. Documentation drift fixes (ROOT-025 through ROOT-034)
7. ESLint and tsconfig strictness improvements (PKG-039 through PKG-046)
