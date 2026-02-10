# DevSage Backend v2 — Full Architecture Implementation

## TL;DR

> **Quick Summary**: Full backend rewrite to match `docs/architecture.md` v2. Replace existing DB schema, state machine, authorization model, and routes to implement the complete v2 domain: 7-state lifecycle, 7-level per-hackathon roles, tag-based submissions with exactly-once locking, judging + rubric + scoring + leaderboard, webhook pipeline expansion (tag/force-push/commit-log), notification system (SMTP), AI-assisted review layer, append-only audit log, slug-based versioned API, response envelope, and separate queue consumer Worker.
> 
> **Deliverables**:
> - Fresh Drizzle schema with ~15 tables matching v2 spec
> - Rewritten Durable Object (`HackathonStateMachine`) with 7-state lifecycle + submission locking
> - All API routes under `/api/v1/` prefix with slug-based hackathon addressing
> - Per-hackathon role resolution (7 roles: anonymous → owner)
> - Queue consumer handlers organized under `apps/api/src/queue/` (same Worker, code-separated)
> - GitHub webhook pipeline: push, tag_create, tag_delete, installation events
> - Judge invite/assign, rubric, scoring, leaderboard aggregation
> - Notification system via SMTP env vars + notification queue + cron deadline reminders
> - AI-assisted review layer (provider-agnostic, fail-open)
> - Append-only audit event system
> - ETag + Cache API caching middleware
> - R2 upload routes for logos/banners
> - Full TDD test coverage
> 
> **Estimated Effort**: XL (4 phases, ~40+ tasks)
> **Parallel Execution**: YES — within phases, independent tasks can run in parallel waves
> **Critical Path**: Shared schemas → DB schema → Auth/Role refactor → DO rewrite → Routes → Queue consumer → Judging → Notifications → AI

---

## Context

### Original Request
User wants to implement the full v2 backend architecture as described in `docs/architecture.md` (1809-line spec document). All work on a `dev` branch. Replace existing code to match the doc exactly. Separate queue consumer Worker. Fresh DB schema. TDD.

### Interview Summary
**Key Discussions**:
- **Scope**: Full v2 — all 4 phases from the architecture doc's roadmap
- **Migration**: Replace existing code to match doc exactly (not incremental evolution)
- **Queue**: Code-separated under `apps/api/src/queue/` (same Worker deployment, cleaner organization)
- **DB**: Fresh Drizzle schema matching v2 exactly, drop/recreate tables (dev env, no data preservation)
- **Test strategy**: TDD (RED-GREEN-REFACTOR) using existing @cloudflare/vitest-pool-workers
- **Task ordering**: Follow doc Phase 1→2→3→4
- **Email/SMTP**: Env vars: `SMTP_URL`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_EMAIL_ADDR` (email addr ≠ username)
- **Dev branch**: Create `dev` branch from `main` HEAD
- **Worker isolation**: All dev work deploys to separate `-dev` Workers (`api-dev`, `web-dev`) with separate D1 (`devsage-db-dev`), KV, Queues (`github-webhooks-dev`, `github-webhooks-dlq-dev`), and DO namespaces. Existing production Workers (`api`, `web`) must NEVER be overwritten. Achieved via wrangler `[env.dev]` environment config.

### Metis Review
**Identified Gaps** (addressed):
- **organiser vs organizer spelling**: Standardized to American `organizer` matching v2 doc. All existing British spellings will be replaced.
- **User model incompatibility**: v2 makes `github_id` NOT NULL (GitHub mandatory, Google supplementary). Applied as specified in doc.
- **JWT payload change**: Removes `email`/`role`, adds `ghid`/`ghu`. Role resolved per-request. Plan accounts for cascading changes.
- **Status case convention**: Standardized to `lowercase` matching v2 doc SQL schema.
- **Slug generation**: Auto-generated from title via slugify. User can override. Uniqueness enforced at DB level.
- **DO migration**: Fresh `v2` migration tag with `deleted_classes` for old DOs + `new_sqlite_classes` for new one.
- **AGENTS.md conflicts**: Updated as first task before implementation begins.
- **Shared package breaking web**: Web app excluded from typecheck during backend work (add `--filter` to commands). Vite proxy updated.
- **console.log ban vs structured logging**: Use `console.warn`/`console.error` for structured logs (respects existing ESLint). No `console.log`.
- **Drizzle ORM vs raw SQL**: Keep Drizzle ORM. Doc's raw SQL is pseudocode — implementation uses Drizzle typed queries.
- **Queue consumer DO access**: Same Worker deployment with code split (see queue consumer section). Queue consumer declared in API Worker's wrangler.jsonc but code organized in separate `src/queue/` directory. If truly separate Worker needed later, extract via Service Bindings.
- **NOTIFICATION_QUEUE**: Created alongside WEBHOOK_QUEUE in wrangler.jsonc. Both consumed by same Worker.
- **R2 binding**: Added to Env as optional in Phase 1. Required in Phase 3 when upload routes built.
- **Cron triggers**: In API Worker (needs D1 + NOTIFICATION_QUEUE bindings).
- **Open Questions resolution**: Go with doc defaults (see Section 21). Question 7 modified: keep queue consumer in same Worker with code separation. Question 9: GitHub-only in fresh schema (Google `google_id` column exists but nullable).

---

## Work Objectives

### Core Objective
Rewrite the entire DevSage backend to match the v2 architecture document, implementing all 4 phases: Core, Submissions & Judging, Polish & Notifications, AI & Post-launch.

### Concrete Deliverables
- `packages/shared/`: Updated Zod schemas for all v2 entities (15+ schemas)
- `packages/db/`: Fresh Drizzle schema with ~15 tables + migration
- `apps/api/src/durable-objects/hackathon-state-machine.ts`: Single DO for lifecycle + submission locking
- `apps/api/src/routes/`: All v2 routes (auth, hackathons, teams, submissions, judging, uploads, webhooks, activity)
- `apps/api/src/middleware/`: Auth (JWT v2), role resolution, cache (ETag), validate
- `apps/api/src/services/`: GitHub client, SMTP email, AI client, scoring
- `apps/api/src/queue/`: Queue consumer handlers (push, tag-create, tag-delete, installation, notifications)
- `apps/api/src/lib/`: JWT v2, HMAC, audit helper, errors, response envelope
- Full TDD test suite

### Definition of Done
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm --filter @devsage/api test` passes all tests
- [ ] `pnpm --filter @devsage/db drizzle-kit generate` produces valid migration
- [ ] All 15 DB tables exist with correct schema
- [ ] All v2 API routes respond with correct envelope format
- [ ] 7-state lifecycle transitions work correctly in DO
- [ ] Per-hackathon role resolution works for all 7 roles
- [ ] Webhook signature verification + queue pipeline works end-to-end
- [ ] Judge scoring + leaderboard aggregation returns correct weighted results
- [ ] Notification queue processes email tasks
- [ ] AI review layer generates and caches reviews (fail-open)
- [ ] Audit events written for all state-changing operations

### Must Have
- Fresh Drizzle schema matching v2 doc exactly
- `HackathonStateMachine` DO with 7-state lifecycle + submission locking + alarms
- Per-hackathon role resolution (7 roles)
- Slug-based routes under `/api/v1/` prefix
- Response envelope `{ ok, data, meta }` / `{ ok, error }`
- Idempotent webhook handlers keyed by `webhook_delivery_id`
- Append-only audit event logging
- TDD for all features
- Dev branch
- **Isolated dev Workers**: `[env.dev]` in wrangler.jsonc for both API and Web — separate `-dev` Worker names, D1, KV, Queues, R2. Production Workers untouched.

### Must NOT Have (Guardrails)
- **No `@ts-expect-error`, `@ts-ignore`, or `as any`** — fix types properly
- **No `console.log`** — use `console.warn`/`console.error` for structured logs
- **No mixed status casing** — ALL statuses lowercase (`draft`, `registration_open`, etc.)
- **No mixed spelling** — ALL references use American `organizer` (not British `organiser`)
- **No HTML email templates** — plain text only for Phase 3 emails
- **No frontend source code changes** — backend plan only (Vite proxy config update is allowed)
- **No `@hono/oauth-providers`** — manual OAuth (existing pattern)
- **No external JWT library** — `crypto.subtle` only
- **No Prisma** — Drizzle ORM only
- **No direct D1 access from inside DO classes** — DOs use their own SQLite storage
- **No Phase N+1 env vars added before Phase N is complete** (e.g., no `AI_API_KEY` before Phase 4)
- **No unbounded loops or recursive GitHub API pagination** — explicit depth limits everywhere
- **No manual/browser-based acceptance criteria** — all verification via commands and agent tools

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> This is NOT conditional — it applies to EVERY task, regardless of test strategy.
>
> **FORBIDDEN** — acceptance criteria that require:
> - "User manually tests..." / "User visually confirms..."
> - "User interacts with..." / "Ask user to verify..."
> - ANY step where a human must perform an action
>
> **ALL verification is executed by the agent** using tools (Playwright, interactive_bash, curl, etc.). No exceptions.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: TDD (RED-GREEN-REFACTOR)
- **Framework**: Vitest with `@cloudflare/vitest-pool-workers`

### TDD Task Structure
Each TODO follows RED-GREEN-REFACTOR:

1. **RED**: Write failing test first
   - Test file: `apps/api/src/__tests__/{feature}.test.ts`
   - Test command: `pnpm --filter @devsage/api test -- --grep "{pattern}"`
   - Expected: FAIL (test exists, implementation doesn't)
2. **GREEN**: Implement minimum code to pass
   - Command: `pnpm --filter @devsage/api test -- --grep "{pattern}"`
   - Expected: PASS
3. **REFACTOR**: Clean up while keeping green
   - Command: `pnpm --filter @devsage/api test`
   - Expected: ALL PASS

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

**Verification Tool by Deliverable Type:**

| Type | Tool | How Agent Verifies |
|------|------|-------------------|
| **API routes** | Bash (curl) | Send requests, parse responses, assert fields and status codes |
| **DB schema** | Bash (wrangler d1 execute) | Run SQL queries, verify table structure |
| **Durable Objects** | Vitest (integration test) | SELF.fetch() to DO endpoints, assert state transitions |
| **Queue consumer** | Vitest (integration test) | Enqueue message, verify processing |
| **Type safety** | Bash (pnpm typecheck) | Zero TypeScript errors |

---

## Execution Strategy

### Phase-Based Execution with Parallel Waves

```
═══ PHASE 1: CORE (Tasks 0-12) ═══

Wave 0 (Setup):
└── Task 0: Branch + AGENTS.md + conventions update

Wave 1 (Schemas — start immediately after Wave 0):
├── Task 1: Shared package schemas (Zod)
└── Task 2: DB schema (Drizzle) + migration

Wave 2 (Auth + Infrastructure — after Wave 1):
├── Task 3: Response envelope utility
├── Task 4: JWT v2 + auth middleware rewrite
├── Task 5: Per-hackathon role resolution middleware
└── Task 6: Audit event helper

Wave 3 (Core Routes + DO — after Wave 2):
├── Task 7: HackathonStateMachine DO (lifecycle + submission locking)
├── Task 8: Hackathon CRUD routes (slug-based, /api/v1/)
└── Task 9: Webhook ingestion route (verify → normalize → enqueue)

Wave 4 (Teams + Queue — after Wave 3):
├── Task 10: Team routes (create, join, leave, list, detail)
├── Task 11: Queue consumer handlers (push, tag_create, tag_delete, installation)
└── Task 12: Wrangler config update (DO migration, queue bindings, env types)

═══ PHASE 2: SUBMISSIONS & JUDGING (Tasks 13-21) ═══

Wave 5 (Submission — after Phase 1):
├── Task 13: Repo connection flow (team → repo linking)
├── Task 14: Tag-based submission handling via DO (exactly-once locking)
└── Task 15: Force push detection + commit logging

Wave 6 (Judging — after Wave 5):
├── Task 16: Commit status posting to GitHub
├── Task 17: Judge invite + accept/decline
├── Task 18: Rubric criteria CRUD

Wave 7 (Scoring — after Wave 6):
├── Task 19: Judge assignment (auto round-robin)
├── Task 20: Score submission (write-once per judge/submission/criteria)
└── Task 21: Leaderboard aggregation

═══ PHASE 3: POLISH & NOTIFICATIONS (Tasks 22-29) ═══

Wave 8 (Notifications — after Phase 2):
├── Task 22: SMTP email service (env var based)
├── Task 23: Notification queue consumer
└── Task 24: Cron deadline reminders

Wave 9 (Polish — after Wave 8):
├── Task 25: R2 upload routes (logos, banners)
├── Task 26: Custom branding fields
├── Task 27: Activity feed + force push log endpoints
├── Task 28: ETag + Cache API middleware
└── Task 29: Submission validation (README check, deadline enforcement)

═══ PHASE 4: AI & SCALE (Tasks 30-33) ═══

Wave 10 (AI — after Phase 3):
├── Task 30: AI env vars + provider-agnostic client
├── Task 31: AI review generation (fail-open, cached, prompt-hashed)
└── Task 32: AI review API endpoints

Wave 11 (Finalization):
└── Task 33: Final integration test suite + typecheck + cleanup
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 0 | None | 1-33 | None (must be first) |
| 1 | 0 | 2-33 | None (shared schemas first) |
| 2 | 1 | 3-33 | None (DB schema second) |
| 3 | 2 | 8-33 | 4, 5, 6 |
| 4 | 2 | 8-33 | 3, 5, 6 |
| 5 | 4 | 8-33 | 3, 6 |
| 6 | 2 | 7-33 | 3, 4, 5 |
| 7 | 5, 6 | 9, 11, 14 | 8 |
| 8 | 3, 5 | 10, 13 | 7, 9 |
| 9 | 3 | 11 | 7, 8, 10 |
| 10 | 8 | 13 | 9, 11 |
| 11 | 7, 9 | 14 | 10, 12 |
| 12 | 7 | Phase 2 | 10, 11 |
| 13 | 10, 11 | 14 | None |
| 14 | 7, 13 | 15, 16 | None |
| 15 | 11 | 27 | 14, 16 |
| 16 | 14 | None | 15, 17 |
| 17 | 5, 8 | 19 | 16, 18 |
| 18 | 8 | 19, 20 | 17 |
| 19 | 17, 18 | 20 | None |
| 20 | 18, 19 | 21 | None |
| 21 | 20 | None | None |
| 22 | Phase 2 | 23 | None |
| 23 | 22 | 24 | None |
| 24 | 23 | None | 25, 26 |
| 25 | Phase 2 | 26 | 24, 27 |
| 26 | 25 | None | 27, 28 |
| 27 | 15 | None | 25, 26, 28 |
| 28 | Phase 2 | None | 25, 26, 27, 29 |
| 29 | 14 | None | 28 |
| 30 | Phase 3 | 31 | None |
| 31 | 30 | 32 | None |
| 32 | 31 | 33 | None |
| 33 | 32 | None | None |

---

## TODOs

---

### ═══ PHASE 1: CORE ═══

---

- [ ] 0. Setup: Create dev branch, configure dev Worker environments, update AGENTS.md + conventions

  **What to do**:
  - Create `dev` branch from `main` HEAD: `git checkout -b dev`
  - **Configure isolated dev Worker environments** (CRITICAL — production must NOT be overwritten):
    - In `apps/api/wrangler.jsonc`, add an `[env.dev]` section (JSON: `"env": { "dev": { ... } }`):
      - `"name": "api-dev"` (deploys to `api-dev.{account}.workers.dev`)
      - Separate D1: `"database_name": "devsage-db-dev"` (new database ID — will be created via `wrangler d1 create devsage-db-dev`)
      - Separate KV: new namespace ID (created via `wrangler kv namespace create KV --env dev`)
      - Separate Queues: `"queue": "github-webhooks-dev"`, dead letter: `"github-webhooks-dlq-dev"`
      - Same DO classes but isolated namespace (wrangler handles this per-environment)
      - `"vars": { "FRONTEND_URL": "https://web-dev.{account}.workers.dev" }` (or localhost for now)
    - In `apps/web/wrangler.jsonc`, add `[env.dev]`:
      - `"name": "web-dev"` (deploys to `web-dev.{account}.workers.dev`)
    - Add root package.json dev deploy scripts:
      - `"deploy:api:dev": "pnpm --filter @devsage/api run deploy:dev"`
      - `"deploy:web:dev": "pnpm --filter @devsage/web run deploy:dev"`
    - Add to `apps/api/package.json` scripts:
      - `"dev": "wrangler dev --env dev --local"` (update existing)
      - `"deploy:dev": "wrangler deploy --env dev"`
    - Add to `apps/web/package.json` scripts:
      - `"deploy:dev": "pnpm build && wrangler deploy --env dev"`
    - All `wrangler dev --local` commands use `--env dev` by default so local dev uses dev config
  - Update root `AGENTS.md`:
    - Change roles from `organiser | participant` to `anonymous | participant | team_leader | judge | moderator | admin | owner`
    - Change state machine from 5 SCREAMING_CASE states to 7 lowercase states: `draft → registration_open → registration_closed → active → judging → completed → archived`
    - Remove "No WebSocket / email / R2 / full-text search" — v2 adds email + R2
    - Add anti-pattern: "No `console.log` — use `console.warn`/`console.error`"
    - Update route convention: `/api/v1/` prefix, slug-based hackathon addressing
    - Note response envelope pattern: `{ ok, data, meta }` / `{ ok, error }`
  - Update `packages/shared/AGENTS.md`:
    - Update roles reference
    - Note new status enum values
  - Update `packages/db/AGENTS.md`:
    - List all ~15 v2 tables
    - Note `organizer_roles` table (American spelling)
  - Update `apps/api/AGENTS.md`:
    - Update route list to match v2 API surface
    - Update DO list (single `HackathonStateMachine` replaces `HackathonLifecycleDO` + `SubmissionDO`)
    - Note separate queue handler code at `src/queue/`
    - Update env bindings list (add NOTIFICATION_QUEUE, R2 ASSETS)
  - Update `packages/shared/src/schemas/constants.ts`: Change `ROLES` to include all 7 v2 roles, change status transitions to 7-state lowercase
  - Rename all `organiser` references to `organizer` across the codebase using `ast_grep_replace` or `lsp_rename`
  - Update Vite proxy config in `apps/web/vite.config.ts`: add `/api/v1/*` proxy rule

  **Must NOT do**:
  - Write any implementation code (routes, handlers, DB queries)
  - Change any business logic
  - Touch test files (they'll be rewritten per-feature)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: File updates, config changes, no complex logic
  - **Skills**: [`git-master`]
    - `git-master`: Branch creation and initial commit

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 0 (solo)
  - **Blocks**: All subsequent tasks
  - **Blocked By**: None

  **References**:
  - `AGENTS.md` (root) — Current conventions to update
  - `packages/shared/AGENTS.md` — Shared package conventions
  - `packages/db/AGENTS.md` — DB package conventions
  - `apps/api/AGENTS.md` — API package conventions
  - `packages/shared/src/schemas/constants.ts` — Current ROLES and status transitions to rewrite
  - `docs/architecture.md:196-216` — v2 state machine definition
  - `docs/architecture.md:700-728` — v2 role permission matrix
  - `docs/architecture.md:1032-1080` — v2 route table
  - `apps/web/vite.config.ts` — Vite proxy config to update

  **Acceptance Criteria**:
  - [ ] `git branch --show-current` → `dev`
  - [ ] `git log --oneline -1` → shows setup commit
  - [ ] Root AGENTS.md mentions 7 roles, 7 lowercase statuses, `/api/v1/` prefix
  - [ ] No remaining `organiser` references: `grep -r "organiser" packages/ apps/ --include="*.ts" | wc -l` → `0`
  - [ ] `pnpm typecheck` → passes (or passes with expected web-only errors)
  - [ ] `apps/api/wrangler.jsonc` has `env.dev` section with `"name": "api-dev"`, separate D1/KV/Queue bindings
  - [ ] `apps/web/wrangler.jsonc` has `env.dev` section with `"name": "web-dev"`
  - [ ] `apps/api/package.json` has `deploy:dev` script using `--env dev`
  - [ ] `apps/web/package.json` has `deploy:dev` script using `--env dev`

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: Dev branch exists and is checked out
    Tool: Bash
    Steps:
      1. git branch --show-current
      2. Assert: output is "dev"
      3. git log main..dev --oneline
      4. Assert: at least 1 commit on dev
    Expected Result: Dev branch created with setup commit
    Evidence: Terminal output captured

  Scenario: No British spelling remains
    Tool: Bash
    Steps:
      1. grep -rn "organiser" packages/ apps/ --include="*.ts" --include="*.md"
      2. Assert: exit code 1 (no matches)
    Expected Result: All references updated to American spelling
    Evidence: grep output captured

  Scenario: Dev Worker isolation configured
    Tool: Bash
    Steps:
      1. grep -c "api-dev" apps/api/wrangler.jsonc
      2. Assert: count >= 1
      3. grep -c "web-dev" apps/web/wrangler.jsonc
      4. Assert: count >= 1
      5. grep "deploy:dev" apps/api/package.json
      6. Assert: contains "--env dev"
    Expected Result: Dev environment fully isolated from production
    Evidence: grep output captured
  ```

  **Commit**: YES
  - Message: `chore: setup dev branch and update conventions for v2 architecture`
  - Files: `AGENTS.md`, `packages/*/AGENTS.md`, `apps/*/AGENTS.md`, `packages/shared/src/schemas/constants.ts`, `apps/web/vite.config.ts`
  - Pre-commit: `pnpm typecheck`

---

- [ ] 1. Shared package: Rewrite all Zod schemas for v2 entities

  **What to do**:
  - Rewrite `packages/shared/src/schemas/hackathon.ts`:
    - 7 lowercase statuses: `draft`, `registration_open`, `registration_closed`, `active`, `judging`, `completed`, `archived`
    - All v2 hackathon fields: slug, rules_md, registration_opens/closes, submission_deadline, judging_starts/ends, min/max_team_size, max_teams, submission_tag_pattern, max_submissions_per_team, allow_late_submissions, branding fields (primary_color, logo_r2_key, banner_r2_key, custom_subdomain), created_by
    - `CreateHackathonRequestSchema` and `UpdateHackathonRequestSchema`
  - Rewrite `packages/shared/src/schemas/user.ts`:
    - Fields: id, github_id (number), google_id (optional string), github_username, display_name, email (optional), avatar_url (optional)
    - Remove global `role` from user schema
  - Rewrite `packages/shared/src/schemas/team.ts`:
    - Add fields: repo_full_name, repo_url, github_installation_id, bot_active, invite_code
    - Team member roles: `leader`, `member`
  - Rewrite `packages/shared/src/schemas/submission.ts`:
    - Tag-based model: tag_name, commit_sha, commit_message, commit_author, branch, submitted_at, is_late, is_final, version, status (7 statuses: received, validated, invalid, locked, under_review, scored, invalidated), validation_errors, webhook_delivery_id
  - Create NEW schema files:
    - `packages/shared/src/schemas/organizer-role.ts`: OrganizerRoleSchema (owner, admin, moderator)
    - `packages/shared/src/schemas/judge.ts`: JudgeSchema, JudgeInviteStatus (pending, accepted, declined)
    - `packages/shared/src/schemas/rubric.ts`: RubricCriteriaSchema (name, description, max_score, weight, sort_order)
    - `packages/shared/src/schemas/score.ts`: ScoreSchema, CreateScoreRequestSchema
    - `packages/shared/src/schemas/judge-assignment.ts`: JudgeAssignmentSchema
    - `packages/shared/src/schemas/ai-review.ts`: AIReviewSchema
    - `packages/shared/src/schemas/audit-event.ts`: AuditEventSchema (actor_type: user, system, bot, cron)
    - `packages/shared/src/schemas/commit-log.ts`: CommitLogSchema
    - `packages/shared/src/schemas/force-push.ts`: ForcePushEventSchema
  - Update `packages/shared/src/schemas/constants.ts`:
    - `HACKATHON_STATUS_TRANSITIONS` for 7-state machine
    - `ORGANIZER_ROLES = ['owner', 'admin', 'moderator'] as const`
    - `TEAM_MEMBER_ROLES = ['leader', 'member'] as const`
    - `SUBMISSION_STATUSES` for 7 submission statuses
    - `ACTOR_TYPES = ['user', 'system', 'bot', 'cron'] as const`
  - Update `packages/shared/src/index.ts` barrel: re-export all new schemas with `.js` extension
  - Remove `packages/shared/src/schemas/registration.ts` (v2 removes standalone registrations table — team membership IS registration)

  **Must NOT do**:
  - Add runtime dependencies beyond `zod`
  - Define types separately from Zod schemas (derive with `z.infer`)
  - Forget `.js` extension in barrel re-exports

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Many schema files, needs careful alignment with architecture doc's SQL schema
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (solo — all downstream tasks depend on shared schemas)
  - **Blocks**: Task 2 and all subsequent tasks
  - **Blocked By**: Task 0

  **References**:
  - `docs/architecture.md:226-523` — Full v2 SQL schema (source of truth for all fields)
  - `docs/architecture.md:1086-1106` — Response envelope schema
  - `docs/architecture.md:1148-1159` — Zod schema example from doc
  - `packages/shared/src/schemas/hackathon.ts` — Current schema to rewrite
  - `packages/shared/src/schemas/constants.ts` — Current constants to rewrite
  - `packages/shared/src/index.ts` — Barrel to update
  - `packages/shared/AGENTS.md` — Naming conventions to follow

  **Acceptance Criteria**:
  - [ ] `pnpm --filter @devsage/shared typecheck` → 0 errors
  - [ ] All 15+ schema files exist in `packages/shared/src/schemas/`
  - [ ] `packages/shared/src/index.ts` re-exports all schemas
  - [ ] `HackathonStatusEnum` has 7 lowercase values
  - [ ] `HACKATHON_STATUS_TRANSITIONS` maps all 7 states with correct forward-only transitions
  - [ ] No `registration.ts` schema file exists

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: All shared schemas typecheck
    Tool: Bash
    Steps:
      1. pnpm --filter @devsage/shared typecheck
      2. Assert: exit code 0
    Expected Result: Zero type errors
    Evidence: Terminal output captured

  Scenario: Status transitions are forward-only
    Tool: Bash
    Steps:
      1. node -e "const c = require('@devsage/shared'); console.log(JSON.stringify(c.HACKATHON_STATUS_TRANSITIONS))"
      2. Assert: 'completed' maps to ['archived']
      3. Assert: 'archived' maps to []
      4. Assert: 'draft' maps to ['registration_open']
    Expected Result: All transitions are forward-only, 7 states present
    Evidence: JSON output captured
  ```

  **Commit**: YES
  - Message: `feat(shared): rewrite all Zod schemas for v2 architecture`
  - Files: `packages/shared/src/schemas/*.ts`, `packages/shared/src/index.ts`
  - Pre-commit: `pnpm --filter @devsage/shared typecheck`

---

- [ ] 2. DB package: Fresh Drizzle schema with ~15 tables + migration

  **What to do**:
  - Delete all existing schema files in `packages/db/src/schema/` (users.ts, hackathons.ts, registrations.ts, teams.ts, team_members.ts, submissions.ts)
  - Create new schema files matching v2 doc's SQL (Section 6.1, lines 226-523):
    - `users.ts` — v2 user model (github_id INTEGER, google_id TEXT nullable, github_username, display_name, email nullable, avatar_url)
    - `hackathons.ts` — v2 hackathon model (slug, all dates, team constraints, branding, status CHECK with 7 values)
    - `organizer-roles.ts` — id, hackathon_id FK, user_id FK, role CHECK(owner, admin, moderator), UNIQUE(hackathon_id, user_id)
    - `teams.ts` — v2 team model (repo_full_name, repo_url, github_installation_id, bot_active, invite_code)
    - `team-members.ts` — v2 (role CHECK leader/member, UNIQUE team_id+user_id)
    - `submissions.ts` — v2 tag-based model (tag_name, commit_sha, commit_message, commit_author, branch, is_late, is_final, version, status 7-way CHECK, validation_errors JSON, webhook_delivery_id UNIQUE)
    - `commit-log.ts` — append-only (commit_sha, message, author_username, branch, pushed_at, is_force_push, commits_in_push, webhook_delivery_id)
    - `force-push-events.ts` — (before_sha, after_sha, branch, commits_lost_shas JSON, action_taken CHECK, submissions_invalidated JSON)
    - `judges.ts` — (hackathon_id FK, user_id FK, invite_status CHECK pending/accepted/declined, UNIQUE hackathon_id+user_id)
    - `rubric-criteria.ts` — (hackathon_id FK, name, description, max_score, weight, sort_order, UNIQUE hackathon_id+name)
    - `judge-assignments.ts` — (judge_id FK, team_id FK, hackathon_id FK, submission_id FK nullable, status CHECK, UNIQUE judge_id+team_id)
    - `scores.ts` — (submission_id FK, judge_id FK, criteria_id FK, score INTEGER CHECK >=0, comment, UNIQUE submission_id+judge_id+criteria_id)
    - `ai-reviews.ts` — (submission_id FK, commit_sha, provider, model, prompt_hash, summary, strengths JSON, concerns JSON, raw_response, tokens_used)
    - `audit-events.ts` — append-only (hackathon_id FK nullable, actor_id FK nullable, actor_type CHECK, action, entity_type, entity_id, details JSON, ip_address)
  - Update `packages/db/src/schema/index.ts`: re-export all new tables
  - Create all indexes from doc lines 506-522 (as Drizzle index definitions)
  - Delete old migration files in `packages/db/migrations/`
  - Run `pnpm --filter @devsage/db drizzle-kit generate` to create fresh migration
  - Update `packages/db/src/client.ts` if needed (schema import changes)

  **Must NOT do**:
  - Use raw SQL migrations (let Drizzle generate them)
  - Skip re-exporting from `schema/index.ts`
  - Use `registrations` table (v2 removes it — team membership IS registration)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Many schema files with precise column definitions and constraints
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (after Task 1)
  - **Blocks**: All API route tasks
  - **Blocked By**: Task 1 (shared schemas define types used by Drizzle enums)

  **References**:
  - `docs/architecture.md:226-523` — Complete v2 SQL schema (PRIMARY source)
  - `docs/architecture.md:506-522` — All index definitions
  - `packages/db/src/schema/hackathons.ts` — Current Drizzle pattern to follow (sqliteTable, text, integer)
  - `packages/db/src/schema/index.ts` — Barrel export pattern
  - `packages/db/src/client.ts` — Client factory pattern
  - `packages/db/drizzle.config.ts` — Drizzle config
  - `packages/db/AGENTS.md` — Conventions (snake_case columns, TEXT ids, TEXT timestamps)

  **Acceptance Criteria**:
  - [ ] `pnpm --filter @devsage/db typecheck` → 0 errors
  - [ ] `packages/db/src/schema/index.ts` re-exports all ~15 tables
  - [ ] `pnpm --filter @devsage/db drizzle-kit generate` → produces valid migration SQL
  - [ ] Migration SQL contains CREATE TABLE for all 14 tables + CREATE INDEX for all indexes
  - [ ] No `registrations.ts` schema file exists
  - [ ] All FK references are valid (no circular deps, all referenced tables exist)

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: Drizzle generates valid migration
    Tool: Bash
    Steps:
      1. pnpm --filter @devsage/db drizzle-kit generate
      2. Assert: exit code 0
      3. ls packages/db/migrations/*.sql
      4. Assert: at least 1 migration file exists
      5. cat packages/db/migrations/*.sql | grep "CREATE TABLE"
      6. Assert: 14 CREATE TABLE statements present
    Expected Result: Valid migration with all tables
    Evidence: Migration SQL captured

  Scenario: Schema barrel exports all tables
    Tool: Bash
    Steps:
      1. grep "export" packages/db/src/schema/index.ts | wc -l
      2. Assert: count >= 14
    Expected Result: All tables re-exported
    Evidence: grep output captured
  ```

  **Commit**: YES
  - Message: `feat(db): fresh Drizzle schema with 14 tables matching v2 architecture`
  - Files: `packages/db/src/schema/*.ts`, `packages/db/migrations/*`
  - Pre-commit: `pnpm --filter @devsage/db typecheck`

---

- [ ] 3. Response envelope utility

  **What to do**:
  - Create `apps/api/src/lib/response.ts`:
    - `successResponse(c, data, meta?)` → `{ ok: true, data, meta: { etag?, cached? } }`
    - `errorResponse(c, status, code, message, details?)` → `{ ok: false, error: { code, message, details } }`
    - `paginatedResponse(c, data, total, limit, offset)` → success response with pagination meta
  - Create `apps/api/src/lib/etag.ts`:
    - `generateETag(data)` → weak ETag string (`W/"hash"`)
    - `checkConditionalRequest(c, etag)` → returns 304 if `If-None-Match` matches
  - Write TDD tests first:
    - Test envelope shape for success/error/paginated responses
    - Test ETag generation determinism
    - Test conditional 304 responses

  **Must NOT do**:
  - Add caching middleware here (that's Task 28)
  - Use external hashing libraries (use `crypto.subtle`)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small utility module with clear contract
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 6)
  - **Blocks**: Tasks 8, 9 (routes need envelope)
  - **Blocked By**: Task 2

  **References**:
  - `docs/architecture.md:1086-1106` — Response envelope format specification
  - `docs/architecture.md:1110-1118` — Caching strategy (ETag patterns)
  - `apps/api/src/lib/jwt.ts` — Existing lib pattern to follow (crypto.subtle usage)

  **Acceptance Criteria**:
  - [ ] TDD: Test file exists and passes: `apps/api/src/__tests__/response.test.ts`
  - [ ] `successResponse` returns `{ ok: true, data: {...}, meta: {} }`
  - [ ] `errorResponse` returns `{ ok: false, error: { code, message } }`
  - [ ] ETag generation is deterministic (same input → same hash)

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: Response envelope tests pass
    Tool: Bash
    Steps:
      1. pnpm --filter @devsage/api test -- --grep "response envelope"
      2. Assert: all tests pass
    Expected Result: Envelope utility works correctly
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(api): add response envelope and ETag utilities`
  - Files: `apps/api/src/lib/response.ts`, `apps/api/src/lib/etag.ts`, `apps/api/src/__tests__/response.test.ts`
  - Pre-commit: `pnpm --filter @devsage/api test`

---

- [ ] 4. JWT v2 + auth middleware rewrite

  **What to do**:
  - Rewrite `apps/api/src/lib/jwt.ts`:
    - New payload shape: `{ sub: string, ghid: number, ghu: string, iat: number, exp: number }`
    - Remove `email` and `role` from JWT payload
    - Keep HMAC-SHA256 via `crypto.subtle`
  - Rewrite `apps/api/src/middleware/auth.ts`:
    - Extract JWT from HttpOnly cookie
    - Verify signature and expiry
    - Set `c.set('user', { sub, ghid, ghu })` — NO role in user context
    - Differentiate authenticated vs unauthenticated (some routes allow anonymous)
  - Rewrite `apps/api/src/routes/auth.ts`:
    - GitHub OAuth: fetch user profile → upsert into v2 users table (github_id, github_username, display_name, email, avatar_url)
    - Google OAuth: fetch profile → link google_id to existing user (requires github_id already exists)
    - `/auth/me` → return user profile + aggregated roles across hackathons
    - Generate v2 JWT on successful auth
  - Rewrite `apps/api/src/lib/oauth.ts` if needed for v2 user field mapping
  - Update `apps/api/src/types/auth.ts` for v2 JWT payload type
  - Delete existing auth tests, write new TDD tests:
    - JWT sign/verify with v2 payload
    - Auth middleware extracts user correctly
    - GitHub callback creates/updates user with correct fields
    - Google callback links google_id
    - `/auth/me` returns profile

  **Must NOT do**:
  - Use `@hono/oauth-providers` (broken on Workers)
  - Use external JWT library
  - Put role in JWT (v2 resolves per-request)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Auth rewrite touches JWT, middleware, OAuth, and user model — security-critical
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5, 6)
  - **Blocks**: Task 5 (role resolution depends on auth), Tasks 8+ (all routes need auth)
  - **Blocked By**: Task 2 (needs v2 users table schema)

  **References**:
  - `docs/architecture.md:656-696` — OAuth flow + JWT payload spec
  - `docs/architecture.md:684-691` — v2 JWT payload interface
  - `apps/api/src/lib/jwt.ts` — Current JWT implementation to rewrite
  - `apps/api/src/lib/oauth.ts` — Current OAuth implementation
  - `apps/api/src/middleware/auth.ts` — Current auth middleware
  - `apps/api/src/routes/auth.ts` — Current auth routes
  - `apps/api/src/types/auth.ts` — Current types to update
  - `apps/api/src/__tests__/auth.test.ts` — Current test patterns

  **Acceptance Criteria**:
  - [ ] TDD: `apps/api/src/__tests__/auth.test.ts` passes all tests
  - [ ] JWT payload contains `{ sub, ghid, ghu, iat, exp }` — no `email` or `role`
  - [ ] GitHub OAuth creates user with `github_id`, `github_username`, `display_name`
  - [ ] `/auth/me` returns user profile
  - [ ] Auth middleware sets `c.get('user')` with correct v2 shape

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: JWT v2 sign and verify
    Tool: Bash
    Steps:
      1. pnpm --filter @devsage/api test -- --grep "JWT"
      2. Assert: all tests pass
    Expected Result: JWT v2 payload works correctly
    Evidence: Test output captured

  Scenario: Auth flow integration test
    Tool: Bash
    Steps:
      1. pnpm --filter @devsage/api test -- --grep "auth"
      2. Assert: all tests pass
    Expected Result: Full auth flow works with v2 user model
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(api): rewrite auth system for v2 (JWT payload, OAuth, user model)`
  - Files: `apps/api/src/lib/jwt.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/lib/oauth.ts`, `apps/api/src/types/auth.ts`, `apps/api/src/__tests__/auth.test.ts`
  - Pre-commit: `pnpm --filter @devsage/api test`

---

- [ ] 5. Per-hackathon role resolution middleware

  **What to do**:
  - Rewrite `apps/api/src/middleware/role.ts`:
    - Implement `resolveRole(userId, hackathonId, db)` → returns one of 7 roles
    - Resolution order: check `organizer_roles` (owner > admin > moderator) → check `judges` → check `team_members` (leader > member = participant) → else anonymous
    - Single D1 query approach (LEFT JOIN across all role tables)
    - Optional: KV cache with 60s TTL for resolved roles
  - Create `requireRole(minRole)` middleware that:
    - Extracts hackathonId from route params (`:slug` → lookup hackathon → get id)
    - Calls `resolveRole()` 
    - Sets `c.set('role', resolvedRole)` and `c.set('hackathon', hackathonRecord)`
    - Returns 403 if role insufficient
  - Create role hierarchy utility: `isRoleAtLeast(actual, minimum)` → boolean
  - Role hierarchy: `owner > admin > moderator > judge > team_leader > participant > anonymous`
  - Write TDD tests:
    - Test role resolution for each of the 7 roles
    - Test hierarchy comparisons
    - Test middleware blocks insufficient roles
    - Test anonymous access to public routes

  **Must NOT do**:
  - Cache roles in JWT (resolved per-request)
  - Use global roles (everything is per-hackathon)
  - Mix British/American spelling

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex authorization logic with 7 roles, hierarchy, multi-table resolution
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 6)
  - **Blocks**: All route tasks (8+)
  - **Blocked By**: Task 4 (auth middleware provides user identity)

  **References**:
  - `docs/architecture.md:700-728` — Permission matrix (7 roles × actions)
  - `docs/architecture.md:702-712` — `resolveRole()` pseudocode
  - `apps/api/src/middleware/role.ts` — Current (v1) role middleware pattern
  - `packages/db/src/schema/organizer-roles.ts` — Organizer roles table (from Task 2)
  - `packages/db/src/schema/judges.ts` — Judges table (from Task 2)
  - `packages/db/src/schema/team-members.ts` — Team members table (from Task 2)

  **Acceptance Criteria**:
  - [ ] TDD: `apps/api/src/__tests__/role.test.ts` passes all tests
  - [ ] `resolveRole()` correctly returns all 7 roles
  - [ ] `isRoleAtLeast('moderator', 'participant')` → true
  - [ ] `isRoleAtLeast('participant', 'admin')` → false
  - [ ] Middleware blocks anonymous from protected routes (403)

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: Role resolution tests pass for all 7 roles
    Tool: Bash
    Steps:
      1. pnpm --filter @devsage/api test -- --grep "role"
      2. Assert: all tests pass, covers owner/admin/moderator/judge/team_leader/participant/anonymous
    Expected Result: All role resolutions correct
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(api): implement per-hackathon role resolution with 7-level hierarchy`
  - Files: `apps/api/src/middleware/role.ts`, `apps/api/src/__tests__/role.test.ts`
  - Pre-commit: `pnpm --filter @devsage/api test`

---

- [ ] 6. Audit event helper

  **What to do**:
  - Create `apps/api/src/lib/audit.ts`:
    - `insertAuditEvent(db, { hackathonId?, actorId?, actorType, action, entityType, entityId, details?, ipAddress? })` → inserts into `audit_events` table
    - `actorType` must be one of: `user`, `system`, `bot`, `cron`
    - `details` is JSON-serialized object
    - All audit events are append-only — NEVER update or delete
  - Write TDD tests:
    - Test audit event insertion with all field types
    - Test JSON serialization of details
    - Test actor types

  **Must NOT do**:
  - Make audit helper async-deferred (it's a simple DB insert, keep synchronous within request)
  - Add update/delete methods for audit events

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple utility — one function, one table insert
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 5)
  - **Blocks**: Task 7 (DO uses audit events on transitions)
  - **Blocked By**: Task 2 (needs audit_events table schema)

  **References**:
  - `docs/architecture.md:490-501` — audit_events table schema
  - `docs/architecture.md:1468-1484` — Audit event action catalog
  - `docs/architecture.md:929-936` — Audit event usage in force push handler
  - `packages/db/src/schema/audit-events.ts` — Drizzle schema (from Task 2)

  **Acceptance Criteria**:
  - [ ] TDD: `apps/api/src/__tests__/audit.test.ts` passes
  - [ ] `insertAuditEvent()` writes correctly to DB
  - [ ] `details` field is JSON-serialized

  **Commit**: YES
  - Message: `feat(api): add audit event helper for append-only event logging`
  - Files: `apps/api/src/lib/audit.ts`, `apps/api/src/__tests__/audit.test.ts`
  - Pre-commit: `pnpm --filter @devsage/api test`

---

- [ ] 7. HackathonStateMachine Durable Object (lifecycle + submission locking)

  **What to do**:
  - Delete `apps/api/src/durable-objects/hackathon-lifecycle.ts` and `apps/api/src/durable-objects/submission.ts`
  - Create `apps/api/src/durable-objects/hackathon-state-machine.ts`:
    - Single DO class `HackathonStateMachine` extending `DurableObject<Env>`
    - SQLite-backed with tables: `lifecycle_state`, `submission_locks`, `team_submissions`
    - **Lifecycle**: 7-state machine with forward-only transitions, version-based optimistic concurrency
    - **Submission locking**: Exactly-once acceptance keyed by (teamId + tagName + webhookDeliveryId)
    - **Alarms**: Schedule for registration_closes, submission_deadline, judging_ends — auto-transition on fire
    - Implements all methods from doc Section 7.2: `transitionTo()`, `acceptSubmission()`, `canAcceptSubmissions()`
    - Config includes: registrationOpens, registrationCloses, submissionDeadline, judgingStarts, judgingEnds, maxTeams, maxSubmissionsPerTeam, allowLateSubmissions, submissionTagPattern
  - Update `apps/api/src/index.ts`: re-export `HackathonStateMachine` (remove old DO exports)
  - Write TDD tests:
    - All 7 state transitions (forward-only, rejection of backward)
    - Optimistic concurrency (version mismatch → 409)
    - Submission acceptance (happy path)
    - Duplicate submission (idempotent no-op)
    - Submission after deadline (rejected)
    - Late submission (accepted if allowLateSubmissions)
    - Alarm-triggered transitions
    - Max submissions per team enforcement

  **Must NOT do**:
  - Access D1 from inside the DO class (DOs use their own SQLite storage)
  - Skip `blockConcurrencyWhile` for table creation
  - Allow backward state transitions

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex state machine with concurrency, alarms, exactly-once semantics — requires careful logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9)
  - **Blocks**: Tasks 11, 14 (queue consumer + submission flow depend on DO)
  - **Blocked By**: Tasks 5, 6 (role middleware, audit helper)

  **References**:
  - `docs/architecture.md:546-648` — Full DO spec (interface, operations, locking flow, alarm schedule)
  - `docs/architecture.md:557-573` — HackathonState interface
  - `docs/architecture.md:579-606` — DO class operations
  - `docs/architecture.md:610-628` — Exactly-once submission locking flowchart
  - `docs/architecture.md:634-648` — Alarm schedule pseudocode
  - `apps/api/src/durable-objects/hackathon-lifecycle.ts` — Current DO pattern (SQLite-backed, blockConcurrencyWhile, isRecord guards)
  - `apps/api/src/__tests__/lifecycle-do.test.ts` — Current DO test pattern

  **Acceptance Criteria**:
  - [ ] TDD: `apps/api/src/__tests__/hackathon-state-machine.test.ts` passes all tests
  - [ ] All 7 forward transitions work: draft→registration_open→registration_closed→active→judging→completed→archived
  - [ ] Backward transitions rejected with correct error
  - [ ] Version mismatch returns 409
  - [ ] Duplicate webhook_delivery_id → idempotent no-op
  - [ ] Submission after deadline → rejected (unless allowLateSubmissions)
  - [ ] `pnpm --filter @devsage/api typecheck` → 0 errors

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: State machine transitions
    Tool: Bash
    Steps:
      1. pnpm --filter @devsage/api test -- --grep "HackathonStateMachine"
      2. Assert: all tests pass
    Expected Result: All lifecycle + submission locking logic correct
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(api): implement HackathonStateMachine DO with 7-state lifecycle and submission locking`
  - Files: `apps/api/src/durable-objects/hackathon-state-machine.ts`, `apps/api/src/__tests__/hackathon-state-machine.test.ts`, `apps/api/src/index.ts`
  - Pre-commit: `pnpm --filter @devsage/api test`

---

- [ ] 8. Hackathon CRUD routes (slug-based, /api/v1/)

  **What to do**:
  - Rewrite `apps/api/src/routes/hackathons.ts`:
    - All routes under `/api/v1/hackathons` prefix
    - Slug-based addressing: `:slug` not `:id`
    - `POST /api/v1/hackathons` → create hackathon [admin+] — auto-generate slug from title, create organizer_role entry (owner), initialize DO
    - `GET /api/v1/hackathons` → list public hackathons (paginated, response envelope)
    - `GET /api/v1/hackathons/:slug` → hackathon details (public, with ETag support)
    - `PUT /api/v1/hackathons/:slug` → update config [admin+] (draft only)
    - `PATCH /api/v1/hackathons/:slug/status` → transition phase [admin+] via DO
    - `DELETE /api/v1/hackathons/:slug` → delete (draft only) [owner]
  - Use response envelope for all responses
  - Use v2 role middleware (`requireRole`)
  - Insert audit events for create, update, transition, delete
  - Auto-generate slug: `title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')` with uniqueness retry
  - Update `apps/api/src/index.ts` route mounting to use `/api/v1/` prefix
  - Write TDD tests for all routes

  **Must NOT do**:
  - Use ID-based routes (always slug)
  - Return raw objects without envelope
  - Skip audit events on mutations

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Core CRUD with slug generation, role checks, DO integration, audit events — many concerns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 9)
  - **Blocks**: Task 10 (team routes need hackathon lookup by slug)
  - **Blocked By**: Tasks 3, 5 (response envelope, role middleware)

  **References**:
  - `docs/architecture.md:1032-1048` — Hackathon route table
  - `docs/architecture.md:244-285` — v2 hackathons table schema (all fields)
  - `docs/architecture.md:1086-1106` — Response envelope format
  - `apps/api/src/routes/hackathons.ts` — Current route patterns (to be replaced)

  **Acceptance Criteria**:
  - [ ] TDD: `apps/api/src/__tests__/hackathons.test.ts` passes all tests
  - [ ] All routes use slug, not ID
  - [ ] All responses use `{ ok: true, data }` envelope
  - [ ] Create hackathon generates slug automatically
  - [ ] Slug uniqueness enforced
  - [ ] Organizer_role created on hackathon create (owner role)
  - [ ] Audit events emitted for all mutations

  **Commit**: YES
  - Message: `feat(api): rewrite hackathon CRUD with slug-based routes and v2 envelope`
  - Files: `apps/api/src/routes/hackathons.ts`, `apps/api/src/index.ts`, `apps/api/src/__tests__/hackathons.test.ts`
  - Pre-commit: `pnpm --filter @devsage/api test`

---

- [ ] 9. Webhook ingestion route (verify → normalize → enqueue)

  **What to do**:
  - Rewrite `apps/api/src/routes/webhooks.ts`:
    - Verify HMAC-SHA256 signature (keep existing pattern, it's correct)
    - Extract delivery ID + event type from headers
    - Handle ALL v2 event types: `push`, `create` (tag), `delete` (tag), `installation`, `installation_repositories`
    - Normalize into internal event envelope: `{ type, deliveryId, timestamp, repoFullName, ...eventSpecificFields }`
    - Enqueue to `WEBHOOK_QUEUE`
    - Return 202 Accepted immediately (wall-clock < 50ms)
    - Unknown/irrelevant events → acknowledge 200, don't enqueue
  - Create `apps/api/src/lib/webhook-normalize.ts`:
    - `normalizeGitHubEvent(eventType, payload, deliveryId)` → typed internal event or null
    - Event types: `PushEvent`, `TagCreateEvent`, `TagDeleteEvent`, `InstallationEvent`
  - Write TDD tests:
    - Signature verification (valid/invalid)
    - Each event type normalization
    - Unknown event → 200 acknowledged, not enqueued
    - Missing headers → 400

  **Must NOT do**:
  - Do any D1 writes in the webhook handler (that's the queue consumer's job)
  - Make GitHub API calls in the webhook handler
  - Process business logic (just verify → normalize → enqueue)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Mostly data normalization + existing signature verification pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 8)
  - **Blocks**: Task 11 (queue consumer needs normalized events)
  - **Blocked By**: Task 3 (response envelope)

  **References**:
  - `docs/architecture.md:751-783` — Webhook ingestion pseudocode
  - `docs/architecture.md:736-744` — GitHub App permissions + subscribed events
  - `apps/api/src/routes/webhooks.ts` — Current implementation (keep signature verification, expand events)
  - `apps/api/src/__tests__/webhooks.test.ts` — Current test patterns

  **Acceptance Criteria**:
  - [ ] TDD: `apps/api/src/__tests__/webhooks.test.ts` passes all tests
  - [ ] Handles push, create, delete, installation events
  - [ ] Invalid signature → 401
  - [ ] Missing headers → 400
  - [ ] Unknown event → 200 (acknowledged, not enqueued)
  - [ ] Valid event → 202 + message enqueued

  **Commit**: YES
  - Message: `feat(api): expand webhook ingestion for all v2 event types`
  - Files: `apps/api/src/routes/webhooks.ts`, `apps/api/src/lib/webhook-normalize.ts`, `apps/api/src/__tests__/webhooks.test.ts`
  - Pre-commit: `pnpm --filter @devsage/api test`

---

- [ ] 10. Team routes (create, join, leave, list, detail, repo connection)

  **What to do**:
  - Rewrite `apps/api/src/routes/teams.ts`:
    - `POST /api/v1/hackathons/:slug/teams` → create team [participant] (generates invite_code)
    - `GET /api/v1/hackathons/:slug/teams` → list teams
    - `GET /api/v1/hackathons/:slug/teams/:id` → team detail with members
    - `POST /api/v1/hackathons/:slug/teams/:id/join` → join via invite code
    - `POST /api/v1/hackathons/:slug/teams/:id/repo` → connect GitHub repo [leader]
    - `DELETE /api/v1/hackathons/:slug/teams/:id/members/:uid` → remove member [leader/admin]
  - Response envelope on all endpoints
  - Role-based visibility (participants see own team details, organizers see all)
  - Audit events for team mutations
  - Write TDD tests

  **Must NOT do**:
  - Allow non-registered users to create teams (v2 removes standalone registrations — being on a team IS registration)
  - Skip team size enforcement

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple routes with role-scoped visibility, team size enforcement, invite codes
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 11, 12)
  - **Blocks**: Task 13 (repo connection flow)
  - **Blocked By**: Task 8 (hackathon slug lookup)

  **References**:
  - `docs/architecture.md:1049-1056` — Team route table
  - `docs/architecture.md:304-331` — v2 teams + team_members schema
  - `apps/api/src/routes/teams.ts` — Current implementation patterns

  **Acceptance Criteria**:
  - [ ] TDD: `apps/api/src/__tests__/teams.test.ts` passes all tests
  - [ ] All routes slug-based with response envelope
  - [ ] Team size enforcement works
  - [ ] Invite code generated and unique
  - [ ] Role-scoped visibility

  **Commit**: YES
  - Message: `feat(api): rewrite team routes with v2 schema, slug routing, and role scoping`
  - Files: `apps/api/src/routes/teams.ts`, `apps/api/src/__tests__/teams.test.ts`
  - Pre-commit: `pnpm --filter @devsage/api test`

---

- [ ] 11. Queue consumer handlers (push, tag_create, tag_delete, installation)

  **What to do**:
  - Create `apps/api/src/queue/` directory with handler files:
    - `apps/api/src/queue/index.ts` — queue consumer entry (MessageBatch processing, routing by event type)
    - `apps/api/src/queue/push-handler.ts` — commit logging to D1 (bounded at 20 commits per push), force push detection
    - `apps/api/src/queue/tag-create-handler.ts` — submission acceptance via HackathonStateMachine DO, D1 write, commit status posting
    - `apps/api/src/queue/tag-delete-handler.ts` — log deletion, don't invalidate (tag deletion ≠ submission withdrawal)
    - `apps/api/src/queue/installation-handler.ts` — GitHub App installation events, update team.bot_active
  - Update `apps/api/src/index.ts` queue handler to use new `queue/index.ts`
  - Implement retry with exponential backoff: `30s, 60s, 120s, 240s, 300s` (max 5 retries)
  - All handlers are idempotent (check webhook_delivery_id before processing)
  - Write TDD tests for each handler

  **Must NOT do**:
  - Process unbounded commit lists (slice to 20 max)
  - Skip idempotency checks
  - Swallow errors silently (log via console.error, then retry)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple handlers with idempotency, DO interaction, D1 writes, retry logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 10, 12)
  - **Blocks**: Tasks 14, 15 (submission flow, force push detection)
  - **Blocked By**: Tasks 7, 9 (DO for submission locking, webhook normalization)

  **References**:
  - `docs/architecture.md:787-820` — Queue consumer pseudocode
  - `docs/architecture.md:827-869` — Push handler pseudocode
  - `docs/architecture.md:875-937` — Force push handler pseudocode
  - `docs/architecture.md:943-1019` — Tag create handler pseudocode
  - `apps/api/src/index.ts:120-188` — Current queue handler (to be replaced)

  **Acceptance Criteria**:
  - [ ] TDD: `apps/api/src/__tests__/queue-handlers.test.ts` passes all tests
  - [ ] Push handler logs commits to commit_log (bounded at 20)
  - [ ] Tag create handler calls DO for submission acceptance
  - [ ] Idempotent: duplicate delivery_id → no-op
  - [ ] Retry with backoff on failure

  **Commit**: YES
  - Message: `feat(api): implement queue consumer handlers for push, tag, and installation events`
  - Files: `apps/api/src/queue/*.ts`, `apps/api/src/index.ts`, `apps/api/src/__tests__/queue-handlers.test.ts`
  - Pre-commit: `pnpm --filter @devsage/api test`

---

- [ ] 12. Wrangler config update (DO migration, queue bindings, env types, dev environment)

  **What to do**:
  - Update `apps/api/wrangler.jsonc` **top-level** (shared/production config):
    - Add DO migration: new tag `v2`, `deleted_classes: ["HackathonLifecycleDO", "SubmissionDO"]`, `new_sqlite_classes: ["HackathonStateMachine"]`
    - Update DO binding: `HACKATHON_SM` → class `HackathonStateMachine`
    - Add `NOTIFICATION_QUEUE` producer binding (queue: `devsage-notifications`)
    - Add `NOTIFICATION_QUEUE` consumer binding
    - Add R2 bucket binding: `ASSETS` → `devsage-assets`
    - Add cron trigger: `"0 * * * *"`
  - Update `apps/api/wrangler.jsonc` **`env.dev`** section (dev-isolated resources):
    - Ensure `env.dev` inherits top-level config but overrides resource names:
      - D1: `"database_name": "devsage-db-dev"` with its own `database_id`
      - KV: separate namespace ID
      - Queues: `"github-webhooks-dev"`, `"devsage-notifications-dev"`, DLQ: `"github-webhooks-dlq-dev"`
      - R2: `"bucket_name": "devsage-assets-dev"`
    - SMTP/AI env vars as `vars` in dev section (placeholder values for local dev)
    - `"vars": { "FRONTEND_URL": "http://localhost:5173" }` for dev
  - Update `apps/api/src/types/env.ts`:
    - Rename `HACKATHON_LIFECYCLE` → `HACKATHON_SM: DurableObjectNamespace`
    - Remove `SUBMISSION: DurableObjectNamespace`
    - Add `NOTIFICATION_QUEUE: Queue`
    - Add `ASSETS: R2Bucket` (optional for now)
    - Add SMTP env vars: `SMTP_URL`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_EMAIL_ADDR`
  - Update `.dev.vars` example (don't commit actual secrets)
  - Write typecheck verification

  **Must NOT do**:
  - Commit actual secrets
  - Add AI env vars to required Env type (Phase 4)
  - Modify the production/top-level `name` field (must stay `"api"`)
  - Remove or modify existing production D1 database_id, KV namespace id

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Config file updates
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 10, 11)
  - **Blocks**: Phase 2 (needs correct bindings)
  - **Blocked By**: Task 7 (DO class name must match)

  **References**:
  - `docs/architecture.md:1660-1722` — wrangler.toml spec
  - `apps/api/wrangler.jsonc` — Current config (has production D1 id `dddf6034-...`, KV id `716fbff3...`)
  - `apps/web/wrangler.jsonc` — Current web config
  - `apps/api/src/types/env.ts` — Current Env type
  - Wrangler environments docs: https://developers.cloudflare.com/workers/wrangler/environments/

  **Acceptance Criteria**:
  - [ ] `pnpm --filter @devsage/api typecheck` → 0 errors
  - [ ] wrangler.jsonc has v2 DO migration tag
  - [ ] wrangler.jsonc `env.dev` section has `"name": "api-dev"` with separate D1/KV/Queue/R2 names
  - [ ] Production top-level `name` is still `"api"` with original D1 database_id unchanged
  - [ ] Env type has HACKATHON_SM, NOTIFICATION_QUEUE, ASSETS, SMTP vars

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: Dev environment is isolated from production
    Tool: Bash
    Steps:
      1. node -e "const c=JSON.parse(require('fs').readFileSync('apps/api/wrangler.jsonc','utf8').replace(/\/\/.*/g,'')); console.log(c.name, c.env?.dev?.name)"
      2. Assert: output is "api api-dev"
      3. Assert: c.env.dev D1 database_name !== c.d1_databases[0].database_name
    Expected Result: Production and dev Workers have different names and resources
    Evidence: JSON parse output captured
  ```

  **Commit**: YES (groups with 10, 11)
  - Message: `chore(api): update wrangler config with v2 bindings and isolated dev environment`
  - Files: `apps/api/wrangler.jsonc`, `apps/web/wrangler.jsonc`, `apps/api/src/types/env.ts`
  - Pre-commit: `pnpm --filter @devsage/api typecheck`

---

### ═══ PHASE 2: SUBMISSIONS & JUDGING ═══

---

- [ ] 13. Repo connection flow

  **What to do**:
  - Implement team → repo linking in `apps/api/src/routes/teams.ts` (or `submissions.ts`):
    - `POST /api/v1/hackathons/:slug/teams/:id/repo` — leader connects GitHub repo
    - Store repo_full_name on team record in D1
    - Store KV mapping: `repo:{repoFullName}` → `{ hackathonId, teamId }`
    - Verify uniqueness: one repo per hackathon
    - Notify DO of repo linkage
  - Write TDD tests

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  **Parallelization**: Wave 5 (with 14, 15). Blocked By: 10, 11.

  **References**:
  - `docs/architecture.md:1054` — Connect repo route
  - `docs/architecture.md:316` — teams table repo_full_name field
  - `apps/api/src/routes/submissions.ts:78-157` — Current repo linking pattern

  **Acceptance Criteria**:
  - [ ] TDD tests pass
  - [ ] Repo linked in D1 teams table + KV mapping
  - [ ] Duplicate repo in same hackathon → 409
  - [ ] Only team leader can link

  **Commit**: YES
  - Message: `feat(api): implement repo connection flow for teams`

---

- [ ] 14. Tag-based submission handling via DO (exactly-once locking)

  **What to do**:
  - Implement full tag-create submission flow:
    - Queue consumer receives tag_create event
    - Check tag matches `submission_tag_pattern` (configurable per hackathon)
    - Idempotency check via webhook_delivery_id
    - Call `HackathonStateMachine.acceptSubmission()` for exactly-once locking
    - Write to D1 submissions table (v2 schema: tag_name, version, status, etc.)
    - Post GitHub commit status (Task 16)
    - Enqueue notification (Task 23)
  - Implement `matchSubmissionTag(tagName, pattern)` utility
  - Write TDD tests for exact-once semantics, pattern matching, late submissions

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
  - **Skills**: []
  **Parallelization**: Wave 5. Blocked By: 7, 13.

  **References**:
  - `docs/architecture.md:943-1019` — Tag create handler pseudocode (PRIMARY)
  - `docs/architecture.md:610-628` — Exactly-once locking flowchart

  **Acceptance Criteria**:
  - [ ] TDD tests pass
  - [ ] Tag matching works with configurable pattern
  - [ ] Exactly-once: 3 concurrent deliveries → only 1 accepted
  - [ ] Late submission handling respects allowLateSubmissions config

  **Commit**: YES
  - Message: `feat(api): implement tag-based submission handling with exactly-once DO locking`

---

- [ ] 15. Force push detection + commit logging

  **What to do**:
  - Implement force push detection in push handler (queue consumer):
    - Detect via `event.forced` flag
    - Record in `force_push_events` table (before_sha, after_sha, estimated lost commits)
    - Flag affected submissions for organizer review
    - Enqueue notification to organizer
    - Write audit event
  - Commit logging already partially in push handler (Task 11) — this task adds force push specifics
  - Write TDD tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []
  **Parallelization**: Wave 5. Can parallel with 14, 16.

  **References**:
  - `docs/architecture.md:875-937` — Force push handler pseudocode (PRIMARY)
  - `docs/architecture.md:388-403` — force_push_events table schema

  **Acceptance Criteria**:
  - [ ] TDD tests pass
  - [ ] Force push recorded with before/after SHAs
  - [ ] Affected submissions flagged
  - [ ] Audit event emitted

  **Commit**: YES
  - Message: `feat(api): implement force push detection and commit logging`

---

- [ ] 16. Commit status posting to GitHub

  **What to do**:
  - Create `apps/api/src/services/github.ts`:
    - `postCommitStatus(env, { repoFullName, sha, state, description, context })` → POST to GitHub API
    - Bounded: single API call, 10s timeout
    - Fail-open: if GitHub is down, submission still accepted
  - Use in tag-create handler after submission acceptance
  - Write TDD tests (mock GitHub API response)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  **Parallelization**: Wave 6. Can parallel with 17, 18.

  **References**:
  - `docs/architecture.md:998-1007` — Commit status posting pseudocode
  - `docs/architecture.md:60` — Bounded interface principle

  **Acceptance Criteria**:
  - [ ] TDD tests pass
  - [ ] Commit status posted for accepted/rejected submissions
  - [ ] Timeout at 10s, fail-open

  **Commit**: YES
  - Message: `feat(api): add GitHub commit status posting service`

---

- [ ] 17. Judge invite + accept/decline

  **What to do**:
  - Create `apps/api/src/routes/judging.ts`:
    - `POST /api/v1/hackathons/:slug/judges` → invite judge by user ID [admin+]
    - `GET /api/v1/hackathons/:slug/judges` → list judges [admin+]
    - `POST /api/v1/hackathons/:slug/judges/:id/respond` → accept/decline invitation [judge]
  - Insert into judges table with invite_status = 'pending'
  - Audit events for invite/accept/decline
  - Write TDD tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []
  **Parallelization**: Wave 6. Can parallel with 16, 18.

  **References**:
  - `docs/architecture.md:1067-1068` — Judge routes
  - `docs/architecture.md:408-418` — judges table schema

  **Acceptance Criteria**:
  - [ ] TDD tests pass
  - [ ] Judge invited with pending status
  - [ ] Accept/decline updates status
  - [ ] Only admin+ can invite
  - [ ] Duplicate invite → 409

  **Commit**: YES
  - Message: `feat(api): implement judge invite and response flow`

---

- [ ] 18. Rubric criteria CRUD

  **What to do**:
  - Add to `apps/api/src/routes/judging.ts`:
    - `GET /api/v1/hackathons/:slug/rubric` → get criteria
    - `POST /api/v1/hackathons/:slug/rubric` → set criteria [admin+] (bulk upsert)
  - Criteria: name, description, max_score, weight, sort_order
  - Only editable when hackathon is in draft/registration_open
  - Write TDD tests

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  **Parallelization**: Wave 6. Can parallel with 17.

  **References**:
  - `docs/architecture.md:1070-1071` — Rubric routes
  - `docs/architecture.md:422-433` — rubric_criteria table schema

  **Acceptance Criteria**:
  - [ ] TDD tests pass
  - [ ] CRUD works, ordered by sort_order
  - [ ] Blocked when hackathon is active/judging/completed

  **Commit**: YES
  - Message: `feat(api): implement rubric criteria CRUD`

---

- [ ] 19. Judge assignment (auto round-robin)

  **What to do**:
  - Add `POST /api/v1/hackathons/:slug/judges/assign` → auto-assign [admin+]
  - Implement round-robin: each team reviewed by min(3, judges.length) judges
  - Only assign to accepted judges
  - Pin assignment to team's final submission
  - Write TDD tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []
  **Parallelization**: Wave 7 (after 17, 18). Sequential.

  **References**:
  - `docs/architecture.md:1282-1321` — Assignment algorithm pseudocode
  - `docs/architecture.md:438-449` — judge_assignments table

  **Acceptance Criteria**:
  - [ ] TDD tests pass
  - [ ] Round-robin distributes evenly
  - [ ] Only accepted judges assigned
  - [ ] Assignment pinned to final submission

  **Commit**: YES
  - Message: `feat(api): implement round-robin judge assignment`

---

- [ ] 20. Score submission (write-once per judge/submission/criteria)

  **What to do**:
  - Add `POST /api/v1/hackathons/:slug/scores` → submit score [judge]
  - Write-once: UNIQUE(submission_id, judge_id, criteria_id)
  - Validate: score >= 0 AND score <= criteria.max_score
  - Only assigned judges can score their assigned teams
  - Audit event per score
  - Write TDD tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []
  **Parallelization**: Wave 7 (after 18, 19). Sequential.

  **References**:
  - `docs/architecture.md:1072` — Score route
  - `docs/architecture.md:455-465` — scores table schema
  - `docs/architecture.md:1275-1278` — Scoring principles

  **Acceptance Criteria**:
  - [ ] TDD tests pass
  - [ ] Write-once enforced (duplicate → 409)
  - [ ] Score validated against max_score
  - [ ] Only assigned judge can score
  - [ ] Audit event emitted

  **Commit**: YES
  - Message: `feat(api): implement write-once score submission`

---

- [ ] 21. Leaderboard aggregation

  **What to do**:
  - Add `GET /api/v1/hackathons/:slug/leaderboard` → aggregated results [scoped by role]
  - Implement weighted average: `SUM(score * weight) / SUM(max_score * weight) * 100`
  - Visibility: participants see leaderboard only after judging complete, organizers see anytime
  - Cache via Cache API with 60s TTL, invalidated on score insert
  - Write TDD tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []
  **Parallelization**: Wave 7 (after 20). Sequential.

  **References**:
  - `docs/architecture.md:1326-1346` — Leaderboard SQL query
  - `docs/architecture.md:1073` — Leaderboard route
  - `docs/architecture.md:1117` — Cache strategy (60s TTL)

  **Acceptance Criteria**:
  - [ ] TDD tests pass
  - [ ] Weighted scoring calculates correctly
  - [ ] Role-scoped visibility

  **Commit**: YES
  - Message: `feat(api): implement leaderboard aggregation with weighted scoring`

---

### ═══ PHASE 3: POLISH & NOTIFICATIONS ═══

---

- [ ] 22. SMTP email service (env var based)

  **What to do**:
  - Create `apps/api/src/services/smtp.ts`:
    - Uses env vars: `SMTP_URL`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_EMAIL_ADDR`
    - `sendEmail({ to, subject, body })` — plain text email via SMTP
    - Bounded: 10s timeout per send
    - Returns success/failure status for audit logging
  - Write TDD tests (mock SMTP connection)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  **Parallelization**: Wave 8 (start of Phase 3). Blocks 23.

  **References**:
  - `docs/architecture.md:1176-1207` — Notification system architecture
  - `docs/architecture.md:153-158` — SMTP service spec

  **Acceptance Criteria**:
  - [ ] TDD tests pass
  - [ ] Env vars used correctly (SMTP_URL, SMTP_USERNAME, SMTP_PASSWORD, SMTP_EMAIL_ADDR)
  - [ ] 10s timeout enforced
  - [ ] Plain text emails only (no HTML)

  **Commit**: YES
  - Message: `feat(api): add SMTP email service with env-based configuration`

---

- [ ] 23. Notification queue consumer

  **What to do**:
  - Create `apps/api/src/queue/notification-handler.ts`:
    - Consumes from `NOTIFICATION_QUEUE`
    - Resolves recipients based on notification type (team members, organizers, judges)
    - Renders plain text email from template
    - Sends via SMTP service
    - Logs send status to audit_events
  - Handle all notification types from doc:
    - submission_received, submission_invalid, force_push_alert, phase_transition, judge_invited, judge_assignment, scores_finalized, deadline_reminder
  - Priority: force_push_alert sent first
  - Serialized SMTP calls (no concurrent connections)
  - Write TDD tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  **Parallelization**: Wave 8 (after 22). Blocks 24.

  **References**:
  - `docs/architecture.md:1176-1207` — Notification architecture
  - `docs/architecture.md:1189-1199` — Email types table

  **Acceptance Criteria**:
  - [ ] TDD tests pass
  - [ ] All notification types handled
  - [ ] Recipients resolved correctly per type
  - [ ] Audit events logged for sends

  **Commit**: YES
  - Message: `feat(api): implement notification queue consumer with all email types`

---

- [ ] 24. Cron deadline reminders

  **What to do**:
  - Add `scheduled` handler to API Worker:
    - Runs hourly (`0 * * * *`)
    - Finds hackathons with deadlines in next 1h and 24h
    - Checks audit_events to avoid duplicate reminders
    - Enqueues deadline_reminder to NOTIFICATION_QUEUE
    - Writes audit event
  - Write TDD tests

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  **Parallelization**: Wave 9 (after 23). Can parallel with 25-29.

  **References**:
  - `docs/architecture.md:1209-1266` — Cron handler pseudocode (PRIMARY)

  **Acceptance Criteria**:
  - [ ] TDD tests pass
  - [ ] T-24h and T-1h reminders sent
  - [ ] Duplicate reminders prevented via audit check
  - [ ] Audit event recorded

  **Commit**: YES
  - Message: `feat(api): implement cron-based deadline reminders`

---

- [ ] 25. R2 upload routes (logos, banners)

  **What to do**:
  - Create `apps/api/src/routes/uploads.ts`:
    - `POST /api/v1/upload` → upload file to R2 [admin+]
    - Accept multipart form data
    - Validate file type (image only), size limit (5MB)
    - Store in R2 with key: `hackathons/{hackathonId}/{type}/{filename}`
    - Return R2 key for storage in hackathon record
  - Add R2 binding to Env (make required now)
  - Write TDD tests

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  **Parallelization**: Wave 9. Can parallel with 24, 26-29.

  **References**:
  - `docs/architecture.md:1075-1076` — Upload route
  - `docs/architecture.md:269-272` — Hackathon branding fields (logo_r2_key, banner_r2_key)

  **Acceptance Criteria**:
  - [ ] TDD tests pass
  - [ ] File uploaded to R2 with correct key
  - [ ] File type validation (images only)
  - [ ] Size limit enforced (5MB)

  **Commit**: YES
  - Message: `feat(api): implement R2 upload routes for logos and banners`

---

- [ ] 26. Custom branding fields

  **What to do**:
  - Ensure hackathon update route accepts branding fields: primary_color, logo_r2_key, banner_r2_key, custom_subdomain
  - Add to hackathon detail response
  - Validate primary_color is valid hex
  - Write TDD tests

  **Recommended Agent Profile**: `quick`. **Parallelization**: Wave 9. Can parallel with 25, 27-29.

  **References**: `docs/architecture.md:269-272`

  **Acceptance Criteria**: TDD tests pass. Branding fields stored and returned.
  **Commit**: YES — `feat(api): add custom branding fields to hackathon routes`

---

- [ ] 27. Activity feed + force push log endpoints

  **What to do**:
  - Add routes to `apps/api/src/routes/hackathons.ts` (or new `activity.ts`):
    - `GET /api/v1/hackathons/:slug/activity` → commit feed [mod+]
    - `GET /api/v1/hackathons/:slug/force-pushes` → force push log [mod+]
  - Paginated, sorted by timestamp descending
  - Write TDD tests

  **Recommended Agent Profile**: `quick`. **Parallelization**: Wave 9. Can parallel with 25-26, 28-29.

  **References**: `docs/architecture.md:1062-1064` — Activity routes

  **Acceptance Criteria**: TDD tests pass. Only mod+ can access. Paginated.
  **Commit**: YES — `feat(api): add activity feed and force push log endpoints`

---

- [ ] 28. ETag + Cache API middleware

  **What to do**:
  - Create `apps/api/src/middleware/cache.ts`:
    - Generate ETag for GET responses
    - Check `If-None-Match` → return 304 if match
    - Cache API integration for specific route patterns (from doc Section 10.3)
    - TTLs: hackathon list 60s, detail 300s, teams 30s, submissions 15s, leaderboard 60s
  - Apply to relevant GET routes
  - Write TDD tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []
  **Parallelization**: Wave 9. Can parallel with 25-27, 29.

  **References**: `docs/architecture.md:1110-1118` — Caching strategy table

  **Acceptance Criteria**: TDD tests pass. ETag returned. 304 on match. Cache API TTLs correct.
  **Commit**: YES — `feat(api): implement ETag and Cache API middleware`

---

- [ ] 29. Submission validation (README check, deadline enforcement)

  **What to do**:
  - Add validation step to submission acceptance:
    - Verify tag matches pattern
    - Enforce deadline (unless allowLateSubmissions)
    - Mark validation_errors JSON array
    - Transition submission status: received → validated or received → invalid
  - Write TDD tests

  **Recommended Agent Profile**: `quick`. **Parallelization**: Wave 9. Can parallel with 28.

  **References**: `docs/architecture.md:610-628` — Submission validation flow

  **Acceptance Criteria**: TDD tests pass. Invalid submissions marked with validation_errors.
  **Commit**: YES — `feat(api): add submission validation with deadline and pattern enforcement`

---

### ═══ PHASE 4: AI & SCALE ═══

---

- [ ] 30. AI env vars + provider-agnostic client

  **What to do**:
  - Add to Env type: `AI_API_KEY`, `AI_ENDPOINT`, `AI_MODEL`
  - Create `apps/api/src/services/ai.ts`:
    - OpenAI-compatible API client
    - Bounded: 25s timeout, 4000 token prompt cap, 1000 token response max
    - Fail-open: returns null on any failure
  - Write TDD tests

  **Recommended Agent Profile**: `unspecified-low`. **Parallelization**: Wave 10. Sequential.

  **References**: `docs/architecture.md:1352-1439` — AI review implementation (PRIMARY)

  **Acceptance Criteria**: TDD tests pass. Client calls API with correct format. Timeout enforced. Fail-open.
  **Commit**: YES — `feat(api): add provider-agnostic AI client service`

---

- [ ] 31. AI review generation (fail-open, cached, prompt-hashed)

  **What to do**:
  - Implement `generateAIReview(submission, commitHistory, env)`:
    - Build review prompt from commit metadata + diff stats
    - Hash prompt via SHA-256 for reproducibility
    - Check cache: same submission_id + prompt_hash → return cached
    - Call AI client
    - Parse structured response (summary, strengths, concerns)
    - Store in ai_reviews table
    - Return parsed result or null (fail-open)
  - Write TDD tests

  **Recommended Agent Profile**: `unspecified-high`. **Parallelization**: Wave 10 (after 30).

  **References**: `docs/architecture.md:1371-1439` — generateAIReview pseudocode (PRIMARY)

  **Acceptance Criteria**: TDD tests pass. Reviews cached by prompt hash. Fail-open on error.
  **Commit**: YES — `feat(api): implement AI review generation with caching and fail-open`

---

- [ ] 32. AI review API endpoints

  **What to do**:
  - Add route to view AI reviews for a submission:
    - `GET /api/v1/hackathons/:slug/submissions/:id/ai-review` → AI review [judge/admin+]
  - Optionally trigger review generation on demand
  - Write TDD tests

  **Recommended Agent Profile**: `quick`. **Parallelization**: Wave 10 (after 31).

  **References**: `docs/architecture.md:1352-1361` — AI design constraints

  **Acceptance Criteria**: TDD tests pass. Only judges and admin+ can view. Returns null if not available.
  **Commit**: YES — `feat(api): add AI review API endpoints`

---

- [ ] 33. Final integration test suite + typecheck + cleanup

  **What to do**:
  - Run full test suite: `pnpm test`
  - Run full typecheck: `pnpm typecheck`
  - Fix any remaining type errors or test failures
  - Clean up any dead code, unused imports
  - Verify all AGENTS.md files are up to date
  - Verify all barrel exports are correct
  - Run `pnpm lint` and fix any issues
  - Final commit

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  **Parallelization**: Wave 11 (final, solo).

  **References**: All previous tasks

  **Acceptance Criteria**:
  - [ ] `pnpm typecheck` → 0 errors
  - [ ] `pnpm test` → all pass
  - [ ] `pnpm lint` → 0 errors/warnings
  - [ ] No dead imports or unused code

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: Full build passes
    Tool: Bash
    Steps:
      1. pnpm typecheck
      2. Assert: exit code 0
      3. pnpm test
      4. Assert: exit code 0
      5. pnpm lint
      6. Assert: exit code 0
    Expected Result: Clean codebase, all checks pass
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `chore: final cleanup and integration verification for v2 backend`

---

## Commit Strategy

| After Task | Message | Verification |
|------------|---------|--------------|
| 0 | `chore: setup dev branch and update conventions for v2 architecture` | `pnpm typecheck` |
| 1 | `feat(shared): rewrite all Zod schemas for v2 architecture` | `pnpm --filter @devsage/shared typecheck` |
| 2 | `feat(db): fresh Drizzle schema with 14 tables matching v2 architecture` | `pnpm --filter @devsage/db typecheck` |
| 3 | `feat(api): add response envelope and ETag utilities` | `pnpm --filter @devsage/api test` |
| 4 | `feat(api): rewrite auth system for v2` | `pnpm --filter @devsage/api test` |
| 5 | `feat(api): implement per-hackathon role resolution` | `pnpm --filter @devsage/api test` |
| 6 | `feat(api): add audit event helper` | `pnpm --filter @devsage/api test` |
| 7 | `feat(api): implement HackathonStateMachine DO` | `pnpm --filter @devsage/api test` |
| 8 | `feat(api): rewrite hackathon CRUD with slug routing` | `pnpm --filter @devsage/api test` |
| 9 | `feat(api): expand webhook ingestion for v2 events` | `pnpm --filter @devsage/api test` |
| 10 | `feat(api): rewrite team routes with v2 schema` | `pnpm --filter @devsage/api test` |
| 11 | `feat(api): implement queue consumer handlers` | `pnpm --filter @devsage/api test` |
| 12 | `chore(api): update wrangler config for v2 bindings` | `pnpm --filter @devsage/api typecheck` |
| 13-33 | See individual tasks above | `pnpm --filter @devsage/api test` |

---

## Success Criteria

### Verification Commands
```bash
pnpm typecheck                           # Expected: 0 errors
pnpm test                                # Expected: all pass
pnpm lint                                # Expected: 0 errors
pnpm --filter @devsage/db drizzle-kit generate  # Expected: valid migration
```

### Final Checklist
- [ ] All 34 tasks completed
- [ ] All "Must Have" items present
- [ ] All "Must NOT Have" items absent
- [ ] All tests pass (TDD)
- [ ] `dev` branch has clean commit history
- [ ] All AGENTS.md files updated for v2 conventions
- [ ] No `organiser` (British) spelling anywhere
- [ ] All statuses lowercase
- [ ] All routes under `/api/v1/` with slug addressing
- [ ] Response envelope on all endpoints
- [ ] Audit events for all mutations
