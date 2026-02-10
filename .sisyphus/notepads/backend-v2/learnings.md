# Backend v2 — Learnings

## 2026-02-10 Session Start
- Starting from scratch: 0/34 tasks completed
- On `main` branch, no `dev` branch exists yet
- No prior sessions produced any work (5 sessions, 0 completed tasks)
- Existing branches: main, main-old, claude/fix-dev-pnpm-config-7j0cu

## Task 1 — Shared Zod Schemas v2
- 17 files changed: 6 rewritten, 9 new, 1 deleted, 1 barrel updated
- registration.ts deleted — downstream imports exist in `apps/api/src/routes/hackathons.ts`, `apps/api/src/routes/teams.ts`, and test files. These will break until later tasks update the API routes.
- SQLite integer booleans: used `z.number().int()` not `z.boolean()` for columns like `allowLateSubmissions`, `botActive`, `isForcePush`, `isLate`, `isFinal`, `notifiedOrganizer`
- JSON text columns (validationErrors, commitsLostShas, strengths, concerns, rawResponse, submissionsInvalidated, details): kept as `z.string().nullable().optional()` since stored as serialized JSON strings
- Hackathon request schemas (Create/Update) moved from api.ts → hackathon.ts; api.ts now holds team requests + ApiError/ApiSuccess envelope types
- JoinTeamRequestSchema changed from `joinCode` to `inviteCode` to match v2 column naming
- All `.js` extensions in barrel re-exports confirmed working with ESM strict

## Task 4: JWT v2 + Auth Middleware Rewrite

- Auth tests now use v2 JWT payload: `{ sub, ghid, ghu }` — no `email` or `role`
- Auth middleware returns `{ ok: false, error: { code, message } }` envelope — tests must check `body.error.code` not `body.code`
- `routes/auth.ts` v2 changes:
  - `upsertGitHubUser()` upserts by `github_id` (INTEGER UNIQUE), not email+provider
  - `linkGoogleToUser()` finds existing user by email, links `google_id` — returns null if no GitHub account exists first
  - `/auth/me` does full DB lookup: user profile + organizer roles across hackathons
  - Uses `successResponse`/`errorResponse` from `lib/response.ts` for envelope format
  - JWT signed with `{ sub: user.id, ghid: user.github_id, ghu: user.github_username }`
- The `organizerRoles` table uses `{ hackathon_id, user_id, role }` for per-hackathon roles
- hackathons.test.ts (6 fails) and teams.test.ts (4 fails) are pre-existing v1 test failures — they still use v1 JWT payload with `email`/`role` fields

## Task 9 — Hackathons v2 integration tests
- Hackathon CRUD tests now exercise v2 routes with SELF.fetch + D1 setup, but create/transition endpoints return 500 in tests because Workerd reports `src/index.ts` does not export a `HackathonLifecycleDO` durable object (binding mismatch).
- Running `pnpm --filter @devsage/api test -- --grep "hackathon"` also surfaced unrelated JSON parse failures in `auth.test.ts` and `teams.test.ts` due to non-JSON responses during the same run.

## Task 9 — Webhook Ingestion v2

- Created `/apps/api/src/lib/webhook-normalize.ts` with typed normalizer for all v2 events:
  - `NormalizedPushEvent`: handles push events, limits commits array to 20 entries, extracts branch from ref, includes forced flag
  - `NormalizedTagCreateEvent` / `NormalizedTagDeleteEvent`: handle create/delete events but ONLY when `ref_type === 'tag'` (branch create/delete return null, resulting in 200 acknowledged but not enqueued)
  - `NormalizedInstallationEvent`: handles both `installation` and `installation_repositories` events (both map to same normalized type with action field)
- Webhook route rewritten to use v2 response envelope (`successResponse`/`errorResponse` from `lib/response.ts`)
- Unknown/irrelevant events (e.g., pull_request, branch create/delete) → 200 OK with "acknowledged but not processed" message (not enqueued)
- Known events (push, tag create/delete, installation, installation_repositories) → 202 Accepted + enqueued to `WEBHOOK_QUEUE`
- All 13 webhook tests pass (signature verification, push events with commit slicing, tag events with ref_type filtering, installation events, unknown events)
- Tests confirm error responses use `{ ok: false, error: { code, message } }` envelope format
- Kept existing HMAC-SHA256 signature verification logic (battle-tested, working correctly)
- TDD approach: wrote comprehensive failing tests first, then implemented normalizer + route rewrite

## Task 18 — Rubric Criteria CRUD

- Implemented GET + POST routes for rubric criteria in `/apps/api/src/routes/judging.ts`
- GET `/:slug/rubric`: returns all criteria for a hackathon, ordered by `sort_order`. Open to all (requireRole 'anonymous').
- POST `/:slug/rubric`: bulk upsert criteria (delete all existing + insert new). Admin+ only. Status check: only allows draft or registration_open.
- Schema: `name` (required, min 1 char), `description` (optional), `max_score` (positive int), `weight` (0-1 float), `sort_order` (nonnegative int)
- Validation: required fields, max_score > 0, weight in [0, 1] via Zod schemas in @devsage/shared
- Audit events: recorded on POST via `insertAuditEvent(db, { ...hackatohnId, entity_type: 'rubric_criteria', action: 'update', ... })`
- TDD: 14 comprehensive tests covering empty rubric, role checks, status validation, bulk upsert, sorting, validation errors, 404 on missing hackathon
- All 160 tests passing (12 test files, 1 skipped)
- Commit: `feat(api): implement rubric criteria CRUD` (a7e4b9b)

## Task 17 — Judge Invite + Accept/Decline Routes

- Routes already implemented in `/apps/api/src/routes/judging.ts` as a Hono sub-app with authMiddleware
- Tests already updated in `/apps/api/src/__tests__/judging.test.ts` following v2 pattern (SELF.fetch, inline schema setup, JWT v2 payload)
- Route already mounted in `apps/api/src/index.ts` at line 56: `app.route('/api/v1/hackathons', judging)`
- POST `/:slug/judges`: admin+ invites judge by userId, checks UNIQUE(hackathon_id, user_id) → 409 on duplicate, inserts with invite_status='pending', returns 201
- GET `/:slug/judges`: admin+ lists all judges with JOIN to users table for display_name/email/avatar
- POST `/:slug/judges/:id/respond`: authenticated user responds to own invite (checks judges.user_id === user.sub), accepts/declines, updates invite_status + accepted_at, returns 200
- Audit events: 'judge.invite', 'judge.accept', 'judge.decline' recorded via insertAuditEvent
- Error codes: 409 DUPLICATE_INVITE (not ALREADY_INVITED), 403 FORBIDDEN (non-invited user), 404 NOT_FOUND (missing judge record)
- All 10 judge tests passing (invite success, duplicate 409, non-admin 403, no auth 401, list with user details, accept, decline, wrong user 403, 404)
- Total test count: 145 passing, 1 skipped (11 test files)
- No type errors from LSP diagnostics

## Task 15 — Force Push Detection Enhancement

- Enhanced force push handler in `apps/api/src/queue/push-handler.ts`:
  - Added `size` field (optional) to `NormalizedPushEvent` type to capture GitHub's `event.size` (total commits in push)
  - Estimated lost commits: `Math.max(0, (event.size ?? 0) - event.commits.length)`
  - Query affected submissions: `status IN ('received', 'validated', 'locked', 'under_review')` for the team
  - When affected submissions exist: update `force_push_events` with `action_taken='flagged'` + `submissions_invalidated` JSON array of submission IDs
  - Send to `NOTIFICATION_QUEUE`: `{ type: 'force_push_alert', hackathonId, teamId, forcePushId, affectedSubmissionCount }`
  - Audit event: `force_push.detected` (existing, unchanged)
- TDD approach: wrote 3 comprehensive failing tests first (flagged with submissions, logged without submissions, notification enqueued), then implemented
- Test mocking: `NOTIFICATION_QUEUE` mock needs both `send()` and `sendBatch()` methods to satisfy `Queue<unknown>` interface type
- Drizzle ORM pattern for conditional update: insert first, query affected rows, conditionally update the inserted row if needed
- All 145 tests passing (1 skipped) — no regressions
- Files modified: `webhook-normalize.ts` (added size field), `push-handler.ts` (enhanced force push section), `queue-handlers.test.ts` (+3 tests)
- Commit: `feat(api): implement force push detection and commit logging`
