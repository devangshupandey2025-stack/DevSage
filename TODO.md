# DevSage — Remaining Work

> Last updated: 2026-02-13
> Branch: `main` (backend v2 on `main`, frontend still v1-aligned)

## Legend

- **[BE]** = Backend (`apps/api`)
- **[FE]** = Frontend (`apps/web`)
- **[DB]** = Database (`packages/db`)
- **[SH]** = Shared (`packages/shared`)

---

## 1. Frontend ↔ Backend Alignment (CRITICAL)

The frontend was built against the v1 API. The backend has been rewritten to v2. These mismatches must be fixed before any new frontend features work.

### 1.1 Status Enum Mismatch

The frontend uses 5-state SCREAMING_CASE (`DRAFT`, `REGISTRATION_OPEN`, `HACKING`, `SUBMISSION_CLOSED`, `COMPLETED`). The API returns 7-state lowercase (`draft`, `registration_open`, `registration_closed`, `active`, `judging`, `completed`, `archived`).

- [ ] **[FE] Update `dashboard.tsx` status enum to match v2 API** — Replace `'DRAFT' | 'REGISTRATION_OPEN' | 'HACKING' | 'SUBMISSION_CLOSED' | 'COMPLETED'` with the 7 lowercase statuses. Update the tab filtering logic (upcoming = `draft`/`registration_open`/`registration_closed`, ongoing = `active`/`judging`, past = `completed`/`archived`). Update the `statusConfig` map with all 7 states.

- [ ] **[FE] Update `hackathon-detail.tsx` status enum to match v2 API** — Replace the 5-state type with 7 lowercase statuses. Update all status comparisons and badge rendering.

- [ ] **[FE] Update `organiser-dashboard.tsx` to use v2 7-state lifecycle** — Replace `HACKING`/`SUBMISSION_CLOSED` references with `active`/`judging`/etc. Update `statusLabels`, `nextPhaseAction`, and `nextPhaseLabel` maps to cover all 7 states. Update the transition button logic.

### 1.2 Route Parameter Mismatch

The frontend routes use `:id` (UUID) but the v2 API uses `:slug` for hackathon addressing.

- [ ] **[FE] Change `App.tsx` routes from `/hackathons/:id` to `/hackathons/:slug`** — Update all three hackathon routes: detail, teams, leaderboard. Update the `useParams()` calls in each page to destructure `slug` instead of `id`.

- [ ] **[FE] Update `hackathon-detail.tsx` to use slug-based API calls** — Replace all `apiRequest('/hackathons/${id}/...')` with `apiRequest('/api/v1/hackathons/${slug}/...')`. Update `useParams()` from `id` to `slug`. Update navigation links.

- [ ] **[FE] Update `team-management.tsx` to use slug-based API calls** — Replace `id` param with `slug`. Update all API calls to use `/api/v1/hackathons/${slug}/teams/...` pattern.

- [ ] **[FE] Update `leaderboard.tsx` to use slug-based API calls** — Replace `id` param with `slug`. Update API calls to `/api/v1/hackathons/${slug}/...` pattern.

- [ ] **[FE] Update `dashboard.tsx` navigation links to use hackathon slug** — Change `navigate('/hackathons/${h.id}')` to `navigate('/hackathons/${h.slug}')`. The API list response includes `slug` field.

- [ ] **[FE] Update `organiser-dashboard.tsx` navigation and API calls to use slug** — Change lifecycle/transition API calls from `/hackathons/${id}/...` to `/api/v1/hackathons/${slug}/...`.

### 1.3 API Prefix Mismatch

The v2 API routes are under `/api/v1/` prefix. Some frontend calls may use old paths without this prefix.

- [ ] **[FE] Audit all `apiRequest()` calls and ensure `/api/v1/` prefix** — Check every page file for API calls. Routes like `/hackathons`, `/hackathons/:slug/teams`, etc. must use `/api/v1/hackathons/...`. Auth routes (`/auth/*`) and webhook routes (`/webhooks/*`) do NOT use the prefix.

### 1.4 Role System Mismatch

The frontend uses v1 roles (`organiser`/`participant`). The API uses v2 7-role per-hackathon system.

- [ ] **[FE] Update `protected-route.tsx` to use v2 role names** — Replace `allowedRoles={['organiser']}` with v2 organizer role names. The `/auth/me` endpoint returns `organizerRoles` array per hackathon — use this to determine if user has organizer access to any hackathon.

- [ ] **[FE] Update `auth-context.tsx` user type for v2 user model** — The v2 user has `github_id`, `github_username`, `display_name` instead of `name`, `role`, `provider`. Update the User interface and any fields accessed from `user` object across all pages.

- [ ] **[FE] Update `dashboard-layout.tsx` and nav to use v2 user fields** — Replace `user.name` with `user.display_name`, remove global role checks, use `organizerRoles` from `/auth/me` response for organizer nav visibility.

### 1.5 Spelling Alignment

- [ ] **[FE] Rename `organiser-dashboard.tsx` to `organizer-dashboard.tsx`** — Rename file, update import in `App.tsx`, update route. The v2 API uses American spelling `organizer` everywhere.

- [ ] **[FE] Replace all `organiser` references with `organizer` in frontend code** — Search-and-replace across all `.tsx` files: component names, route paths, comments, type fields.

---

## 2. Backend — Phase 3 Remaining (Polish)

These are the uncompleted tasks from the v2 backend plan.

### 2.1 R2 Upload & Branding

- [ ] **[BE] Create `apps/api/src/routes/uploads.ts` — R2 file upload route** — `POST /api/v1/upload` for admin+ users. Accept multipart form data, validate file type (images only: jpg/png/webp/svg), enforce 5MB size limit, store in R2 with key `hackathons/{hackathonId}/{type}/{filename}`, return the R2 key. Add route to `index.ts`.

- [ ] **[BE] Add custom branding fields to hackathon update route** — Ensure `PUT /api/v1/hackathons/:slug` accepts and stores `primary_color`, `logo_r2_key`, `banner_r2_key`, `custom_subdomain`. Validate `primary_color` is valid hex (`/^#[0-9a-fA-F]{6}$/`). Return branding fields in hackathon detail response.

### 2.2 Activity & Monitoring Endpoints

- [ ] **[BE] Add `GET /api/v1/hackathons/:slug/activity` — commit activity feed** — Query `commit_log` table for the hackathon's teams' repos. Paginated (limit/offset), sorted by `pushed_at` DESC. Requires moderator+ role. Return with response envelope.

- [ ] **[BE] Add `GET /api/v1/hackathons/:slug/force-pushes` — force push log** — Query `force_push_events` table for the hackathon's teams. Paginated, sorted by `detected_at` DESC. Requires moderator+ role. Return with response envelope.

### 2.3 Caching Middleware

- [ ] **[BE] Create `apps/api/src/middleware/cache.ts` — ETag + Cache API middleware** — Generate weak ETags for GET responses using `crypto.subtle` SHA-256. Check `If-None-Match` header and return 304 if match. Integrate Cloudflare Cache API with TTLs: hackathon list 60s, detail 300s, teams 30s, submissions 15s, leaderboard 60s. Apply middleware to relevant GET routes in `index.ts`.

### 2.4 Submission Validation Enhancement

- [ ] **[BE] Add submission validation step to tag-create handler** — After receiving a submission in `tag-create-handler.ts`, validate: (1) tag matches `submission_tag_pattern` from hackathon config, (2) enforce deadline (reject if past unless `allowLateSubmissions`), (3) populate `validation_errors` JSON array on the submission record. Transition submission status from `received` → `validated` or `received` → `invalid` based on validation result.

---

## 3. Backend — Phase 4 (AI-Assisted Reviews)

### 3.1 AI Client

- [ ] **[BE] Add AI env vars to `apps/api/src/types/env.ts`** — Add `AI_API_KEY: string`, `AI_ENDPOINT: string`, `AI_MODEL: string` as optional fields in the Env type. Add placeholder values to `.dev.vars` template. Add to `wrangler.jsonc` vars section.

- [ ] **[BE] Create `apps/api/src/services/ai.ts` — provider-agnostic AI client** — OpenAI-compatible HTTP client. Bounded: 25s timeout via AbortController, 4000 token prompt cap, 1000 token response max. Fail-open: return `null` on any failure (timeout, API error, parse error). Log warnings via `console.warn`. Use env vars `AI_ENDPOINT`, `AI_API_KEY`, `AI_MODEL`.

### 3.2 AI Review Generation

- [ ] **[BE] Implement `generateAIReview()` in `apps/api/src/services/ai.ts`** — Build review prompt from submission metadata (commit history, tag, repo). Hash prompt via SHA-256 for cache key. Check `ai_reviews` table for existing review with same `submission_id` + `prompt_hash` — return cached if found. Call AI client. Parse structured response into `{ summary, strengths, concerns }`. Store in `ai_reviews` table. Return parsed result or null (fail-open).

### 3.3 AI Review Endpoints

- [ ] **[BE] Add `GET /api/v1/hackathons/:slug/submissions/:id/ai-review` route** — Returns AI review for a submission. Accessible by judge+ and admin+ roles. Returns `null` (204) if no review available. Optionally triggers review generation on demand if `?generate=true` query param is passed. Add to `judging.ts` or create new `ai-reviews.ts` route file.

---

## 4. Backend — Final Cleanup

- [ ] **[BE] Run full test suite and fix any failures** — `pnpm test` must pass with zero failures. Fix any broken tests from recent changes. Ensure all test files are up to date.

- [ ] **[BE] Run typecheck across all packages and fix errors** — `pnpm typecheck` must return zero errors. Fix any type mismatches between packages.

- [ ] **[BE] Run linter and fix all issues** — `pnpm lint` must return zero errors and zero warnings. Remove unused imports, fix naming conventions.

- [ ] **[BE] Clean up dead code and verify barrel exports** — Remove any unused functions, types, or imports. Verify all `index.ts` barrel exports are correct in `packages/shared`, `packages/db`, `apps/api/src/routes`, `apps/api/src/queue`.

---

## 5. Frontend — Organizer Features

These features have API support but no frontend UI.

### 5.1 Organizer Dashboard Improvements

- [ ] **[FE] Fetch and display team count per hackathon on organizer dashboard** — Currently shows `-` for teams. Call `GET /api/v1/hackathons/:slug/teams` for each hackathon and display the count. Consider batching or lazy-loading.

- [ ] **[FE] Add hackathon edit form to organizer dashboard** — Add an "Edit" button on each hackathon card (draft status only). Open dialog with pre-filled form fields (title, description, dates, team size constraints). Submit via `PUT /api/v1/hackathons/:slug`.

- [ ] **[FE] Add hackathon delete button to organizer dashboard** — Add "Delete" button on draft hackathons only. Confirm via dialog. Call `DELETE /api/v1/hackathons/:slug`. Remove from list on success.

### 5.2 Judge Management UI

- [ ] **[FE] Create judge management section on organizer hackathon detail** — Add a "Judges" tab/section showing: list of invited judges with status (pending/accepted/declined), invite form (search users by GitHub username), accept/decline status badges. API: `GET /api/v1/hackathons/:slug/judges`, `POST /api/v1/hackathons/:slug/judges`.

- [ ] **[FE] Add rubric configuration UI for organizers** — Create a rubric editor: list of criteria with name, description, max_score, weight, sort_order. Add/remove/reorder criteria. Save as bulk operation. Only editable when hackathon is in draft/registration_open. API: `GET /api/v1/hackathons/:slug/rubric`, `POST /api/v1/hackathons/:slug/rubric`.

- [ ] **[FE] Add judge assignment trigger button** — Button for admin+ to trigger round-robin judge assignment (only when hackathon is in `judging` phase). Shows confirmation dialog with judge count and team count. API: `POST /api/v1/hackathons/:slug/judges/assign`.

### 5.3 Organizer Submission Review

- [ ] **[FE] Add submission list view for organizers** — Show all submissions for a hackathon with: team name, tag, commit SHA, status, timestamp, is_late flag, validation errors. Sortable/filterable table. API: `GET /api/v1/hackathons/:slug/submissions` (DO-backed).

---

## 6. Frontend — Judge Features

No judge-facing UI exists. The API fully supports judging.

- [ ] **[FE] Create judge dashboard page at `/hackathons/:slug/judge`** — New page for judges to see their assignments. Shows list of teams assigned to them with submission details (repo, tag, commit). Links to scoring form. API: `GET /api/v1/hackathons/:slug/judges` (filter by current user).

- [ ] **[FE] Create scoring form component** — Form for a judge to score one submission against all rubric criteria. For each criterion: show name, description, max_score, and a score input (0 to max_score) plus optional comment. Submit all scores at once. API: `POST /api/v1/hackathons/:slug/scores` (one call per criterion).

- [ ] **[FE] Add judge invite response UI** — When a user is invited to judge, show a banner/notification on their dashboard with accept/decline buttons. API: `POST /api/v1/hackathons/:slug/judges/:id/respond` with `{ status: 'accepted' | 'declined' }`.

- [ ] **[FE] Add route and navigation for judge dashboard** — Add `/hackathons/:slug/judge` route to `App.tsx`. Add "Judge" nav link when user is a judge for the hackathon (check via `/auth/me` roles or hackathon detail).

---

## 7. Frontend — Leaderboard Upgrade

The current leaderboard sorts by submission time. The API supports weighted score-based leaderboard.

- [ ] **[FE] Rewrite `leaderboard.tsx` to use score-based ranking** — Replace current submission-time sorting with the API's scored leaderboard. Call `GET /api/v1/hackathons/:slug/leaderboard` which returns teams ranked by weighted score percentage. Show: rank, team name, weighted score %, judges completed count. Only show scores when hackathon status is `completed` (or `judging` for organizers).

---

## 8. Frontend — Missing Pages & Polish

### 8.1 New Pages

- [ ] **[FE] Create hackathon creation page for organizers** — Currently creation is a dialog in the organizer dashboard. Consider a dedicated `/organizer/create` page with a full-width multi-step form: basic info → dates → team constraints → rules (markdown). Better UX for the many required fields.

- [ ] **[FE] Wire `about.tsx` page into `App.tsx` router** — The about page exists at `pages/about.tsx` but has no route. Add `<Route path="/about" element={<AboutPage />} />` as a public route. Add link in footer/nav.

- [ ] **[FE] Wire `link-required.tsx` into the auth flow** — The page exists but isn't routed. Add route. When `auth-callback.tsx` detects a Google-only user without linked GitHub, redirect to `/link-required` instead of dashboard.

### 8.2 UX Improvements

- [ ] **[FE] Add pagination to hackathon list on dashboard** — Currently loads all hackathons. Add limit/offset pagination with "Load more" button or page numbers. API supports `?limit=N&offset=N`.

- [ ] **[FE] Add pagination to team list on team management page** — Same pattern as above for the team list endpoint.

- [ ] **[FE] Add search/filter on participant dashboard** — Add a search input to filter hackathons by title. Client-side filtering is fine for MVP.

- [ ] **[FE] Add real-time status indicators to hackathon cards** — Show countdown timers for upcoming deadlines (registration close, submission deadline). Calculate from date fields already in the API response.

---

## 9. Frontend — AI Review UI (After Backend Phase 4)

These depend on backend AI endpoints being implemented first (Section 3).

- [ ] **[FE] Add AI review panel to judge scoring view** — Show AI-generated review alongside the scoring form. Display summary, strengths (green), concerns (red). Collapsible panel. API: `GET /api/v1/hackathons/:slug/submissions/:id/ai-review`.

- [ ] **[FE] Add "Request AI Review" button for organizers** — On submission detail, allow organizers to trigger AI review generation. API: `GET /api/v1/hackathons/:slug/submissions/:id/ai-review?generate=true`. Show loading state while generating.

---

## 10. Testing & Quality

- [ ] **[FE] Add tests for dashboard page** — Test hackathon list rendering, tab filtering, empty states. Use `@testing-library/react` + vitest.

- [ ] **[FE] Add tests for auth flow** — Test `AuthProvider` context, `ProtectedRoute` redirects, login/logout flow.

- [ ] **[FE] Add tests for hackathon detail page** — Test team creation, joining, status display, role-based visibility.

- [ ] **[BE] Write integration tests for R2 upload route** — Test file upload, type validation, size limit, R2 storage.

- [ ] **[BE] Write integration tests for activity feed and force push endpoints** — Test pagination, role-based access, sorting.

- [ ] **[BE] Write integration tests for ETag/Cache middleware** — Test ETag generation, 304 responses, Cache API TTLs.

- [ ] **[BE] Write integration tests for AI review endpoints** — Test review retrieval, on-demand generation, fail-open behavior, caching.
