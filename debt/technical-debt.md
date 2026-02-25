# Technical Debt

Code quality issues, incomplete implementations, and architectural concerns.

---

## 🔴 CRITICAL

### DEBT-1: GitHub App JWT Signing Not Implemented
- **File:** `apps/api/src/services/github.ts` (lines ~28-31)
- **Issue:** `getInstallationToken()` is a stub. It needs JWT signing using the GitHub App private key to authenticate as the app and get installation access tokens.
- **Impact:** Any feature relying on GitHub App authentication (reading private repos, posting commit statuses) will fail in production.
- **Fix:** Implement RS256 JWT signing via `crypto.subtle` using the GitHub App private key, then exchange for installation token via GitHub API.

### DEBT-2: Hackathon Template Application Incomplete
- **File:** `apps/api/src/routes/hackathons.ts`
- **Issue:** Comment says `// TODO: Apply rounds, rubric from template` — when creating a hackathon from a template, the template's rounds and rubric criteria are not auto-copied.
- **Impact:** Templates exist in DB (`hackathonTemplates` table) but are non-functional. Event Leads must manually recreate rounds/rubric even when using a template.
- **Fix:** After hackathon INSERT, copy template's `rounds` and `rubric` JSON arrays into `hackathonRounds` and `rubricCriteria` tables.

---

## 🟡 MEDIUM

### DEBT-3: Debug Console.log in Production Code
- **File:** `apps/platform/src/pages/announcements.tsx` (lines 53, 72)
- **Issue:** Two `console.log` statements left from debugging: `[announcements] Fetch result:` and `[announcements] Create result:`
- **Impact:** Violates project convention (console.log is banned via lint). Leaks data to browser console.
- **Fix:** Remove both console.log statements.

### DEBT-4: Stale Root-Level File `homw.tsx`
- **File:** `/homw.tsx` (project root)
- **Issue:** Misplaced/typo'd file at repository root. Contains a generic React component stub (`Welcome to DevSage!`). Not imported anywhere.
- **Impact:** Clutter. Could confuse new contributors.
- **Fix:** Delete the file.

### DEBT-5: Web App Has Zero Tests
- **File:** `apps/web/` — no test files exist
- **Issue:** `vitest.config.ts` exists but no test files. Zero test coverage for the public website.
- **Impact:** Regressions in the public-facing site go undetected.
- **Fix:** Add component tests using jsdom + @testing-library/react at minimum for critical pages (home, hackathon-detail, browse-hackathons).

### DEBT-6: Platform & Judge & Admin Apps Have Zero Tests
- **Files:** `apps/platform/`, `apps/judge/`, `apps/admin/` — no test files
- **Issue:** None of the 3 internal frontend apps have any tests.
- **Impact:** UI regressions undetected across organizer, judge, and admin workflows.
- **Fix:** Prioritize testing for critical flows: login, hackathon management, scoring interface.

### DEBT-7: Better Auth Schema Tables Unused
- **Files:** `packages/db/src/schema/` — `account`, `session`, `verification`, `passkey`, `user` (auth.user)
- **Issue:** These tables are Better Auth ORM tables (from early architecture). The actual auth system uses custom JWT + refresh tokens, NOT Better Auth. These tables appear unused.
- **Impact:** Schema bloat. ~5 unused tables in migrations. Could confuse developers.
- **Fix:** Verify no code references these tables, then remove from schema and generate a cleanup migration.

---

## 🟢 LOW

### DEBT-8: GitHub Private Repo Validation Missing
- **Issue:** When teams link a GitHub repo, there's no server-side validation that the repo is private (plan requires private repos for hackathon submissions).
- **Impact:** Teams could accidentally link public repos, exposing their code to competitors.
- **Fix:** Add GitHub API check in team-repos route to verify repo visibility.

### DEBT-9: Late Submission Flagging UI Missing
- **Issue:** Submissions after deadline are accepted but only flagged in DB (`status`). No visual indicator in organizer or judge UI.
- **Impact:** Organizers/judges can't easily identify late submissions.
- **Fix:** Add badge/indicator in submissions list and scoring interface.

### DEBT-10: Settings Page Sparse
- **File:** `apps/platform/src/pages/settings.tsx`
- **Issue:** TODO.md notes the settings page needs more hackathon configuration options (email restrictions, timezone, registration mode toggles).
- **Impact:** Some hackathon settings can only be set via API, not UI.
- **Fix:** Add form fields for all `hackathons` table settings columns.

### DEBT-11: Announcements CRUD Verification
- **Issue:** TODO.md flags that announcements edit/delete flows need verification.
- **Impact:** Potential bugs in announcement management.
- **Fix:** Manual QA or add integration tests for announcement PATCH/DELETE.

### DEBT-12: No E2E Tests
- **Issue:** No Playwright or Cypress E2E tests exist. All testing is unit/integration.
- **Impact:** Cross-app flows (OAuth → hackathon creation → team join → submission → judging) are untested end-to-end.
- **Fix:** Add Playwright E2E tests for critical user journeys. Low priority per project conventions (noted as intentional in docs).
