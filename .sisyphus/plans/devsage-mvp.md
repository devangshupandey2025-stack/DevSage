# DevSage MVP — Hackathon Platform on Cloudflare Workers

## TL;DR

> **Quick Summary**: Build "DevSage", an edge-native hackathon management platform running entirely on Cloudflare Workers. MVP delivers OAuth authentication, hackathon lifecycle management via Durable Objects, GitHub webhook-driven submissions, and role-aware React dashboards for organisers and participants.
>
> **Deliverables**:
> - Turborepo monorepo with 5 packages (apps/web, apps/api, packages/shared, packages/db, packages/config)
> - Cloudflare Worker API with Hono router, D1 database, KV caching, 2 Durable Objects
> - OAuth 2.0 login (Google + GitHub) with JWT sessions in HttpOnly cookies
> - Hackathon CRUD with deterministic lifecycle state machine (HackathonLifecycleDO)
> - Team management (create, join via code, leave)
> - GitHub App webhook pipeline with Cloudflare Queue + SubmissionDO
> - React SPA with Vite + React Router + Tailwind + shadcn/ui
> - Participant and Organiser dashboards with submission visibility
> - Vitest test suite for critical paths
>
> **Estimated Effort**: XL (11 vertical slices, ~40-50 tasks)
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 8 → Task 9 → Task 10 → Task 11

---

## Context

### Original Request
Build a complete hackathon platform ("DevSage") running edge-native on Cloudflare Workers. The platform uses Durable Objects for strong consistency, GitHub App webhooks for submission ingestion, and provides role-aware dashboards for organisers, participants, and judges. MVP scope: Auth + Hackathon CRUD + Basic Submissions (no judging, no AI).

### Interview Summary
**Key Discussions**:
- **Monorepo**: Turborepo + pnpm workspaces, 5 packages (web, api, shared, db, config)
- **Frontend**: Vite + React Router + Tailwind CSS + shadcn/ui
- **Backend**: Single Cloudflare Worker with Hono router
- **Storage**: D1 (SQL) + KV (caching) + R2 (deferred)
- **Durable Objects**: 3 scoped DOs (Lifecycle, Submission, Score — Score deferred)
- **Auth**: OAuth 2.0 (Google + GitHub), JWT in HttpOnly cookies
- **Build strategy**: Schema-first, vertical slices
- **Test strategy**: Vitest, tests after implementation
- **AI**: Provider-agnostic interface only, deferred to post-MVP
- **Deployment**: Wrangler CLI (wrangler.jsonc)

### Metis Review
**Identified Gaps** (addressed):
- **OAuth middleware broken on Workers**: Use manual OAuth (direct HTTP + hono/jwt), NOT `@hono/oauth-providers`
- **DO storage backend**: Use SQLite-backed DOs (`new_sqlite_classes`), not legacy KV storage
- **D1 query limits**: Use `db.batch()` for multi-statement operations (1000 queries/invocation cap)
- **DO ↔ D1 boundary**: DOs MUST NOT access D1 directly; Worker mediates all D1 writes
- **wrangler.jsonc over .toml**: JSON config recommended for new projects
- **Same Worker = Queue producer + consumer**: No separate consumer Worker needed
- **DO Alarm API**: Use for deadline-driven state transitions
- **Drizzle ORM**: Lightweight, D1-compatible ORM (NOT Prisma)
- **DO class re-export**: All DO classes must be re-exported from Worker entry point
- **Role model**: Exactly 2 hardcoded roles: `organiser` and `participant`
- **Submission model**: 1 repo = 1 submission per team per hackathon, latest push wins
- **Timezone**: All timestamps UTC ISO-8601, frontend converts at display time

**Identified Risks**:
- DO ↔ D1 eventual consistency (mitigated by clear ownership boundaries)
- Worker bundle size (mitigated by tree-shaking, monitoring early)
- GitHub webhook duplicates (mitigated by `X-GitHub-Delivery` dedup key + idempotent SubmissionDO)

---

## Work Objectives

### Core Objective
Deliver a working MVP where organisers create hackathons with lifecycle phases, participants register and form teams, and submissions are captured via GitHub webhooks — all running edge-native on Cloudflare Workers with strong consistency guarantees.

### Concrete Deliverables
- Monorepo structure with shared TypeScript config, ESLint, and Zod schemas
- D1 database with migrations for users, hackathons, teams, team_members, submissions, registrations
- Cloudflare Worker serving Hono API + static React SPA
- HackathonLifecycleDO managing phase transitions with alarm-driven deadlines
- SubmissionDO managing submission locking and deduplication
- OAuth 2.0 flows for Google and GitHub with JWT session management
- Role-based authorization middleware
- GitHub webhook ingestion with cryptographic signature verification
- Cloudflare Queue for async webhook processing
- React SPA with auth pages, participant dashboard, organiser dashboard
- Vitest test suite using `@cloudflare/vitest-pool-workers`

### Definition of Done
- [ ] `pnpm turbo build` succeeds with zero errors across all 5 packages
- [ ] `pnpm turbo test` passes all test suites
- [ ] `wrangler dev` starts the Worker locally with D1, KV, DO, and Queue bindings
- [ ] OAuth login with Google redirects and returns a valid JWT cookie
- [ ] OAuth login with GitHub redirects and returns a valid JWT cookie
- [ ] Organiser can create a hackathon and transition it through phases
- [ ] Participant can register for a hackathon and join a team
- [ ] GitHub webhook with valid signature is accepted and queued
- [ ] Queued webhook is processed and submission is recorded in SubmissionDO
- [ ] React SPA loads at root URL with working client-side routing
- [ ] Unauthenticated users are redirected to login
- [ ] All timestamps are UTC ISO-8601

### Must Have
- OAuth 2.0 with Google and GitHub (manual implementation, not middleware)
- JWT in HttpOnly cookies with `SameSite=Lax` (dev) / `SameSite=Strict; Secure` (prod)
- Role-based auth: exactly 2 roles — `organiser` and `participant`
- Hackathon CRUD with Zod validation
- HackathonLifecycleDO with state machine: DRAFT → REGISTRATION_OPEN → HACKING → SUBMISSION_CLOSED → COMPLETED
- DO Alarm API for deadline-driven phase transitions
- Team management: create, join by code, leave, list members
- GitHub webhook signature verification via `crypto.subtle`
- Cloudflare Queue producer/consumer in same Worker
- SubmissionDO with idempotent submission locking (latest push wins)
- SQLite-backed Durable Objects (`new_sqlite_classes`)
- Drizzle ORM for D1
- Shared Zod schemas in `packages/shared`
- D1 `db.batch()` for multi-statement operations
- All DO classes re-exported from Worker entry point
- wrangler.jsonc (not .toml)

### Must NOT Have (Guardrails)
- ❌ `@hono/oauth-providers` middleware (broken on CF Workers)
- ❌ Prisma ORM (incompatible with Workers/D1)
- ❌ Direct D1 access from inside DO classes
- ❌ Separate Workers for queue consumer
- ❌ WebSocket connections
- ❌ Email notifications
- ❌ File uploads / R2 storage
- ❌ Analytics, charts, or leaderboards
- ❌ Super-admin panel
- ❌ More than 2 roles
- ❌ Code rendering/preview for submissions
- ❌ Full-text search
- ❌ wrangler.toml (use .jsonc)
- ❌ Legacy KV-backed DOs (use SQLite-backed)
- ❌ `node:` imports without Workers compatibility check
- ❌ Heavyweight middleware that bloats bundle
- ❌ Custom error pages beyond generic error component
- ❌ Team chat, notifications, or social features

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> Every criterion is verified by running a command or using a tool.

### Test Decision
- **Infrastructure exists**: NO (greenfield — setting up Vitest)
- **Automated tests**: YES (tests after implementation)
- **Framework**: Vitest with `@cloudflare/vitest-pool-workers`

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

> Every task includes Agent-Executed QA Scenarios as the PRIMARY verification method.
> These describe how the executing agent DIRECTLY verifies the deliverable.

**Verification Tool by Deliverable Type:**

| Type | Tool | How Agent Verifies |
|------|------|-------------------|
| **Monorepo/Config** | Bash | Run build commands, verify file existence, check outputs |
| **API Endpoints** | Bash (curl) | Send requests, assert status codes, parse JSON responses |
| **Durable Objects** | Bash (curl) | Sequential API calls testing state transitions |
| **Frontend/UI** | Playwright (playwright skill) | Navigate, interact, assert DOM, screenshot |
| **Auth Flow** | Playwright + Bash | Mock OAuth, verify cookies, test protected routes |
| **Queue Processing** | Bash (curl + wrangler tail) | Send webhook, verify queue processing via logs |
| **Database** | Bash (wrangler d1 execute) | Run SQL queries, verify schema and data |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Monorepo scaffolding (Turborepo + pnpm + 5 packages)
└── (no other tasks — everything depends on the monorepo)

Wave 2 (After Wave 1):
├── Task 2: Shared package — Zod schemas, types, constants
├── Task 3: Config package — shared tsconfig, ESLint
└── (Task 2 and 3 are independent of each other)

Wave 3 (After Wave 2):
├── Task 4: DB package — Drizzle schema, D1 migrations
├── Task 5: API skeleton — Hono router, wrangler.jsonc, env types, DO stubs
└── (Task 4 and 5 can run in parallel — they share types from Task 2)

Wave 4 (After Wave 3 — Sequential vertical slices):
├── Task 6: Auth vertical slice — OAuth flows, JWT, middleware, protected routes
├── Task 7: Hackathon CRUD vertical slice — API routes, D1 queries, Zod validation
├── Task 8: HackathonLifecycleDO — state machine, alarm-driven transitions
├── Task 9: Teams vertical slice — create, join, leave, list
├── Task 10: GitHub webhook + Queue + SubmissionDO
├── Task 11: React SPA shell — Vite + React Router + Tailwind + shadcn/ui + auth pages
├── Task 12: Frontend dashboards — participant + organiser views
└── Task 13: Vitest integration — test harness + critical path tests

Note: Within Wave 4, Tasks 6-10 are backend and mostly sequential
(each builds on auth middleware from Task 6). Tasks 11-12 are frontend
and can run in parallel with backend tasks after Task 6 (auth) is done.
Task 13 runs last as it tests everything.
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1. Monorepo scaffolding | None | 2, 3 | None (first task) |
| 2. Shared schemas | 1 | 4, 5, 6, 7, 8, 9, 10, 11 | 3 |
| 3. Config package | 1 | 4, 5 | 2 |
| 4. DB package | 2, 3 | 6, 7, 8, 9, 10 | 5 |
| 5. API skeleton | 2, 3 | 6, 7, 8, 9, 10 | 4 |
| 6. Auth slice | 4, 5 | 7, 8, 9, 10, 11, 12 | None (critical path) |
| 7. Hackathon CRUD | 6 | 8, 9, 12 | None |
| 8. Lifecycle DO | 7 | 10, 12 | None |
| 9. Teams | 7 | 12 | 8 (after 7 completes) |
| 10. Webhooks + Queue + Submission | 8 | 12 | None |
| 11. React SPA shell | 2, 6 | 12 | 7, 8, 9, 10 |
| 12. Frontend dashboards | 7, 8, 9, 10, 11 | 13 | None |
| 13. Vitest integration | All above | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1 | `category="quick"` — scaffolding only |
| 2 | 2, 3 | `category="quick"` — schema/config definitions |
| 3 | 4, 5 | `category="unspecified-low"` — DB + API skeleton |
| 4a | 6 | `category="deep"` — OAuth is tricky on Workers |
| 4b | 7, 8, 9, 10 | `category="unspecified-high"` — core business logic |
| 4c | 11, 12 | `category="visual-engineering"` — frontend |
| 5 | 13 | `category="unspecified-low"` — test setup |

---

## TODOs

---

- [x] 1. Monorepo Scaffolding — Turborepo + pnpm Workspaces + 5 Packages

  **What to do**:
  - Initialize git repository in `/home/srijan/DevSage`
  - Initialize pnpm workspace with `pnpm init`
  - Create `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`
  - Install Turborepo: `pnpm add -D turbo`
  - Create `turbo.json` with task pipeline: `build`, `dev`, `test`, `lint`, `typecheck`
  - Create 5 package directories:
    - `apps/web/` — React SPA (Vite)
    - `apps/api/` — Cloudflare Worker (Hono)
    - `packages/shared/` — Zod schemas, types, constants
    - `packages/db/` — Drizzle schema, D1 migrations
    - `packages/config/` — Shared tsconfig, ESLint configs
  - Each package gets its own `package.json` with correct `name` field:
    - `@devsage/web`, `@devsage/api`, `@devsage/shared`, `@devsage/db`, `@devsage/config`
  - Create root `.gitignore` (node_modules, dist, .wrangler, .dev.vars, .turbo)
  - Create root `.nvmrc` with Node.js 20 LTS
  - Verify: `pnpm install` succeeds, `pnpm turbo build` runs (empty builds OK)

  **Must NOT do**:
  - Do NOT install application dependencies yet (Hono, React, etc.) — just monorepo infrastructure
  - Do NOT create source files yet — just package.json stubs
  - Do NOT create wrangler config yet (that's Task 5)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure scaffolding, no complex logic, just file creation and config
  - **Skills**: [`git-master`]
    - `git-master`: Initial git init and first commit

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (solo)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None (first task)

  **References**:

  **External References**:
  - Turborepo getting started: https://turbo.build/repo/docs/getting-started/installation
  - pnpm workspaces: https://pnpm.io/workspaces
  - Turborepo task config: https://turbo.build/repo/docs/reference/configuration

  **Acceptance Criteria**:

  ```
  Scenario: Monorepo structure is valid
    Tool: Bash
    Steps:
      1. ls apps/web/package.json apps/api/package.json packages/shared/package.json packages/db/package.json packages/config/package.json
      2. Assert: All 5 files exist (exit code 0)
      3. cat pnpm-workspace.yaml
      4. Assert: Contains "apps/*" and "packages/*"
      5. cat turbo.json | jq '.tasks'
      6. Assert: Contains "build", "dev", "test", "lint", "typecheck" keys
      7. pnpm install
      8. Assert: Exit code 0, no errors
      9. pnpm turbo build
      10. Assert: Exit code 0 (empty builds succeed)
    Expected Result: All 5 packages recognized by pnpm, Turborepo pipeline configured
    Evidence: Terminal output captured

  Scenario: Git repository initialized
    Tool: Bash
    Steps:
      1. git status
      2. Assert: "On branch main" (or master)
      3. cat .gitignore
      4. Assert: Contains "node_modules", "dist", ".wrangler", ".turbo"
    Expected Result: Clean git repo with proper .gitignore
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `chore: initialize turborepo monorepo with 5 packages`
  - Files: All scaffolding files
  - Pre-commit: `pnpm install && pnpm turbo build`

---

- [x] 2. Shared Package — Zod Schemas, Types, and Constants

  **What to do**:
  - Install dependencies in `packages/shared`: `zod`, `typescript`
  - Create `packages/shared/tsconfig.json` extending from `@devsage/config`
  - Create `packages/shared/src/index.ts` as barrel export
  - Define Zod schemas and inferred TypeScript types for all MVP entities:
    - **User**: `{ id: string (UUID), email: string, name: string, avatarUrl: string | null, provider: 'google' | 'github', providerId: string, role: 'organiser' | 'participant', createdAt: string (ISO-8601), updatedAt: string (ISO-8601) }`
    - **Hackathon**: `{ id: string (UUID), title: string (3-100 chars), description: string (10-5000 chars), organiserId: string, status: HackathonStatus, maxTeamSize: number (1-10), registrationStartDate: string, hackingStartDate: string, submissionDeadline: string, createdAt, updatedAt }`
    - **HackathonStatus**: enum `DRAFT | REGISTRATION_OPEN | HACKING | SUBMISSION_CLOSED | COMPLETED`
    - **Team**: `{ id: string, hackathonId: string, name: string (2-50 chars), joinCode: string (8 chars), captainId: string, createdAt }`
    - **TeamMember**: `{ teamId: string, userId: string, joinedAt: string }`
    - **Registration**: `{ id: string, hackathonId: string, userId: string, registeredAt: string }`
    - **Submission**: `{ id: string, hackathonId: string, teamId: string, repoFullName: string, commitSha: string (40 hex chars), submittedAt: string, status: 'pending' | 'accepted' | 'locked' }`
  - Define API request/response schemas:
    - `CreateHackathonRequest`, `UpdateHackathonRequest`, `HackathonResponse`, `HackathonListResponse`
    - `CreateTeamRequest`, `JoinTeamRequest`, `TeamResponse`, `TeamListResponse`
    - `RegisterForHackathonRequest`
    - `SubmissionResponse`, `SubmissionListResponse`
  - Define API error response schema: `{ error: string, code: string, details?: unknown }`
  - Define constants:
    - `HACKATHON_STATUS_TRANSITIONS`: valid transition map (which states can go to which)
    - `ROLES`: `['organiser', 'participant'] as const`
    - `MAX_TEAM_NAME_LENGTH`: 50
    - `JOIN_CODE_LENGTH`: 8
  - Configure `package.json` with `"exports"` field for proper ESM module resolution
  - Build script: `tsc --build`

  **Must NOT do**:
  - Do NOT add runtime dependencies beyond `zod`
  - Do NOT add database-specific types (that's `packages/db`)
  - Do NOT add API client code
  - Do NOT define more than 2 roles

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Schema definitions are straightforward, well-specified above
  - **Skills**: []
    - No special skills needed — pure TypeScript + Zod

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Tasks 4, 5, 6, 7, 8, 9, 10, 11
  - **Blocked By**: Task 1

  **References**:

  **External References**:
  - Zod documentation: https://zod.dev
  - TypeScript project references: https://www.typescriptlang.org/docs/handbook/project-references.html

  **WHY Each Reference Matters**:
  - Zod docs: Exact API for `z.object()`, `z.enum()`, `z.infer<>` to define type-safe schemas
  - TS project references: How to set up `tsconfig.json` with `composite: true` for monorepo builds

  **Acceptance Criteria**:

  ```
  Scenario: Shared package builds and exports types
    Tool: Bash
    Preconditions: Task 1 complete, pnpm install done
    Steps:
      1. cd packages/shared && pnpm build
      2. Assert: Exit code 0, dist/ directory created
      3. node -e "const s = require('@devsage/shared'); console.log(Object.keys(s))"
      4. Assert: Output contains "UserSchema", "HackathonSchema", "TeamSchema", "SubmissionSchema", "HACKATHON_STATUS_TRANSITIONS", "ROLES"
    Expected Result: All schemas and constants are exported and importable
    Evidence: Terminal output captured

  Scenario: Zod schemas validate correctly
    Tool: Bash
    Steps:
      1. node -e "
         const { CreateHackathonRequestSchema } = require('@devsage/shared');
         const result = CreateHackathonRequestSchema.safeParse({
           title: 'Test Hack',
           description: 'A test hackathon for validation',
           registrationStartDate: '2026-03-01T00:00:00Z',
           hackingStartDate: '2026-03-02T00:00:00Z',
           submissionDeadline: '2026-03-03T00:00:00Z',
           maxTeamSize: 4
         });
         console.log(result.success);
         "
      2. Assert: Output is "true"
      3. node -e "
         const { CreateHackathonRequestSchema } = require('@devsage/shared');
         const result = CreateHackathonRequestSchema.safeParse({ title: 'AB' });
         console.log(result.success, result.error?.issues[0]?.message);
         "
      4. Assert: Output starts with "false" (validation fails for short title)
    Expected Result: Schemas accept valid input and reject invalid input
    Evidence: Terminal output captured
  ```

  **Commit**: YES (groups with Task 3)
  - Message: `feat(shared): add Zod schemas, types, and constants for MVP entities`
  - Files: `packages/shared/**`
  - Pre-commit: `pnpm turbo build --filter=@devsage/shared`

---

- [x] 3. Config Package — Shared TypeScript and ESLint Configuration

  **What to do**:
  - Create `packages/config/package.json` with name `@devsage/config`
  - Create shared TypeScript configs:
    - `packages/config/tsconfig.base.json` — Base config (strict mode, ES2022 target, module NodeNext, composite: true, declaration: true)
    - `packages/config/tsconfig.worker.json` — Extends base, adds Workers-specific types (`@cloudflare/workers-types`)
    - `packages/config/tsconfig.react.json` — Extends base, adds JSX config (react-jsx), DOM lib
  - Create shared ESLint config:
    - `packages/config/eslint.config.mjs` — Flat config (ESLint 9+) with TypeScript plugin, import plugin
  - Install shared dev dependencies at root: `@cloudflare/workers-types`, `typescript`, `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`
  - Each package's `tsconfig.json` extends from `@devsage/config`

  **Must NOT do**:
  - Do NOT add Prettier (keep it simple, ESLint handles formatting rules)
  - Do NOT add complex lint rules — basics only (no-unused-vars, no-explicit-any)
  - Do NOT configure Husky or pre-commit hooks

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Config file creation, no business logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: Task 1

  **References**:

  **External References**:
  - TypeScript tsconfig reference: https://www.typescriptlang.org/tsconfig
  - Cloudflare Workers types: https://www.npmjs.com/package/@cloudflare/workers-types
  - ESLint flat config: https://eslint.org/docs/latest/use/configure/configuration-files

  **Acceptance Criteria**:

  ```
  Scenario: TypeScript configs are valid and extend correctly
    Tool: Bash
    Steps:
      1. cat packages/config/tsconfig.base.json | jq '.compilerOptions.strict'
      2. Assert: true
      3. cat packages/config/tsconfig.worker.json | jq '.extends'
      4. Assert: Contains reference to base config
      5. pnpm turbo typecheck
      6. Assert: Exit code 0 (no type errors in any package)
    Expected Result: All TypeScript configs resolve and type-checking passes
    Evidence: Terminal output captured
  ```

  **Commit**: YES (groups with Task 2)
  - Message: `chore(config): add shared TypeScript and ESLint configuration`
  - Files: `packages/config/**`
  - Pre-commit: `pnpm turbo typecheck`

---

- [x] 4. DB Package — Drizzle Schema and D1 Migrations

  **What to do**:
  - Install in `packages/db`: `drizzle-orm`, `drizzle-kit`, `better-sqlite3` (dev, for local type generation)
  - Create `packages/db/drizzle.config.ts` configured for D1 (dialect: sqlite, driver: d1-http)
  - Create Drizzle schema files in `packages/db/src/schema/`:
    - `users.ts` — users table: id (TEXT PK, UUID), email (TEXT UNIQUE NOT NULL), name (TEXT NOT NULL), avatar_url (TEXT), provider (TEXT NOT NULL — 'google'|'github'), provider_id (TEXT NOT NULL), role (TEXT NOT NULL DEFAULT 'participant'), created_at (TEXT NOT NULL, ISO-8601), updated_at (TEXT NOT NULL)
    - `hackathons.ts` — hackathons table: id (TEXT PK, UUID), title (TEXT NOT NULL), description (TEXT NOT NULL), organiser_id (TEXT NOT NULL FK→users.id), status (TEXT NOT NULL DEFAULT 'DRAFT'), max_team_size (INTEGER NOT NULL DEFAULT 4), registration_start_date (TEXT NOT NULL), hacking_start_date (TEXT NOT NULL), submission_deadline (TEXT NOT NULL), created_at (TEXT NOT NULL), updated_at (TEXT NOT NULL)
    - `registrations.ts` — registrations table: id (TEXT PK), hackathon_id (TEXT FK→hackathons.id NOT NULL), user_id (TEXT FK→users.id NOT NULL), registered_at (TEXT NOT NULL), UNIQUE(hackathon_id, user_id)
    - `teams.ts` — teams table: id (TEXT PK), hackathon_id (TEXT FK→hackathons.id NOT NULL), name (TEXT NOT NULL), join_code (TEXT NOT NULL UNIQUE), captain_id (TEXT FK→users.id NOT NULL), created_at (TEXT NOT NULL)
    - `team_members.ts` — team_members table: team_id (TEXT FK→teams.id NOT NULL), user_id (TEXT FK→users.id NOT NULL), joined_at (TEXT NOT NULL), PRIMARY KEY(team_id, user_id)
    - `submissions.ts` — submissions table: id (TEXT PK), hackathon_id (TEXT FK→hackathons.id NOT NULL), team_id (TEXT FK→teams.id NOT NULL), repo_full_name (TEXT NOT NULL), commit_sha (TEXT NOT NULL), submitted_at (TEXT NOT NULL), status (TEXT NOT NULL DEFAULT 'pending'), UNIQUE(hackathon_id, team_id)
  - Create `packages/db/src/index.ts` barrel export of all schemas
  - Generate initial D1 migration: `pnpm drizzle-kit generate` → creates SQL in `packages/db/migrations/`
  - Create helper `packages/db/src/client.ts` exporting a typed `drizzle(d1)` client factory
  - Add `"exports"` field to package.json for ESM resolution

  **Must NOT do**:
  - Do NOT use Prisma
  - Do NOT add seed data or fixtures
  - Do NOT create indexes beyond what foreign keys provide (optimize later)
  - Do NOT add audit_logs table (post-MVP)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Schema definition is well-specified but requires Drizzle ORM knowledge
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 5)
  - **Blocks**: Tasks 6, 7, 8, 9, 10
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `packages/shared/src/schemas/` — Entity schemas to align column types with Zod schemas

  **External References**:
  - Drizzle ORM with D1: https://orm.drizzle.team/docs/get-started/d1-new
  - Drizzle SQLite schema: https://orm.drizzle.team/docs/column-types/sqlite
  - D1 migrations with wrangler: https://developers.cloudflare.com/d1/build-with-d1/d1-and-drizzle-orm/

  **WHY Each Reference Matters**:
  - Drizzle D1 guide: How to configure `drizzle.config.ts` for D1 dialect and generate migrations
  - Drizzle SQLite columns: Exact API for `text()`, `integer()`, `primaryKey()`, `unique()` on SQLite
  - Shared schemas: Ensures database columns match the Zod schemas (same field names, same types)

  **Acceptance Criteria**:

  ```
  Scenario: Drizzle schema generates valid SQL migration
    Tool: Bash
    Preconditions: Tasks 2, 3 complete
    Steps:
      1. cd packages/db && pnpm drizzle-kit generate
      2. Assert: Exit code 0
      3. ls packages/db/migrations/
      4. Assert: At least one .sql file exists
      5. cat packages/db/migrations/*.sql
      6. Assert: Contains "CREATE TABLE users", "CREATE TABLE hackathons", "CREATE TABLE teams", "CREATE TABLE submissions", "CREATE TABLE registrations", "CREATE TABLE team_members"
      7. Assert: users table has UNIQUE constraint on email
      8. Assert: submissions table has UNIQUE constraint on (hackathon_id, team_id)
      9. Assert: registrations table has UNIQUE constraint on (hackathon_id, user_id)
    Expected Result: Valid D1-compatible SQL migration with all 6 tables
    Evidence: Migration SQL file captured

  Scenario: DB package builds and exports schema
    Tool: Bash
    Steps:
      1. cd packages/db && pnpm build
      2. Assert: Exit code 0
      3. pnpm turbo typecheck --filter=@devsage/db
      4. Assert: Exit code 0 (no type errors)
    Expected Result: Schema compiles without errors
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat(db): add Drizzle schema and D1 migrations for MVP entities`
  - Files: `packages/db/**`
  - Pre-commit: `pnpm turbo build --filter=@devsage/db`

---

- [x] 5. API Skeleton — Hono Router, wrangler.jsonc, Env Types, DO Stubs

  **What to do**:
  - Install in `apps/api`: `hono`, `@hono/zod-validator`
  - Install dev: `wrangler`, `@cloudflare/workers-types`, `@cloudflare/vitest-pool-workers`
  - Create `apps/api/wrangler.jsonc` with:
    - `name`: "devsage-api"
    - `main`: "src/index.ts"
    - `compatibility_date`: "2025-12-01"
    - `compatibility_flags`: ["nodejs_compat"]
    - `d1_databases`: [{ binding: "DB", database_name: "devsage-db", database_id: "placeholder" }]
    - `kv_namespaces`: [{ binding: "KV", id: "placeholder" }]
    - `durable_objects`: { bindings: [{ name: "HACKATHON_LIFECYCLE", class_name: "HackathonLifecycleDO" }, { name: "SUBMISSION", class_name: "SubmissionDO" }] }
    - `migrations`: [{ tag: "v1", new_sqlite_classes: ["HackathonLifecycleDO", "SubmissionDO"] }]
    - `queues`: { producers: [{ queue: "github-webhooks", binding: "WEBHOOK_QUEUE" }], consumers: [{ queue: "github-webhooks", max_batch_size: 10, max_retries: 3, dead_letter_queue: "github-webhooks-dlq" }] }
    - Environment-specific vars for dev vs production
  - Create `apps/api/src/types/env.ts`:
    ```
    Env = { DB: D1Database, KV: KVNamespace, HACKATHON_LIFECYCLE: DurableObjectNamespace, SUBMISSION: DurableObjectNamespace, WEBHOOK_QUEUE: Queue, JWT_SECRET: string, GOOGLE_CLIENT_ID: string, GOOGLE_CLIENT_SECRET: string, GITHUB_CLIENT_ID: string, GITHUB_CLIENT_SECRET: string, GITHUB_WEBHOOK_SECRET: string, FRONTEND_URL: string }
    ```
  - Create `apps/api/src/index.ts`:
    - Export default Hono app as Worker `fetch` handler
    - Export `HackathonLifecycleDO` class (stub — just constructor + empty alarm handler)
    - Export `SubmissionDO` class (stub — just constructor)
    - Export Queue consumer handler (stub — logs and acknowledges)
    - Mount route groups: `/api/auth/*`, `/api/hackathons/*`, `/api/teams/*`, `/api/webhooks/*`, `/api/submissions/*`
  - Create route stub files (empty handlers returning 501):
    - `apps/api/src/routes/auth.ts`
    - `apps/api/src/routes/hackathons.ts`
    - `apps/api/src/routes/teams.ts`
    - `apps/api/src/routes/webhooks.ts`
    - `apps/api/src/routes/submissions.ts`
  - Create DO stub files:
    - `apps/api/src/durable-objects/hackathon-lifecycle.ts`
    - `apps/api/src/durable-objects/submission.ts`
  - Create `apps/api/src/middleware/` directory with stub files:
    - `auth.ts` (stub — passes through)
    - `error-handler.ts` (global error handler returning structured JSON errors)
  - Verify: `wrangler dev` starts without errors (may have placeholder binding warnings)

  **Must NOT do**:
  - Do NOT implement any business logic yet — stubs only
  - Do NOT use `wrangler.toml` — use `wrangler.jsonc`
  - Do NOT create separate Workers for queue consumer
  - Do NOT add production secrets (use `.dev.vars` for local dev)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Configuration and stub creation, needs Cloudflare Workers knowledge
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 4)
  - **Blocks**: Tasks 6, 7, 8, 9, 10
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `packages/shared/src/` — Import Zod schemas for route validation
  - `packages/db/src/` — Import Drizzle schema for query types

  **External References**:
  - Hono Cloudflare Workers: https://hono.dev/docs/getting-started/cloudflare-workers
  - wrangler.jsonc configuration: https://developers.cloudflare.com/workers/wrangler/configuration/
  - Durable Objects with SQLite: https://developers.cloudflare.com/durable-objects/get-started/tutorial-with-sql-api/
  - Cloudflare Queues: https://developers.cloudflare.com/queues/get-started/

  **WHY Each Reference Matters**:
  - Hono CF Workers: How to structure `export default app` as Worker fetch handler alongside DO exports
  - wrangler.jsonc: Exact JSON structure for bindings (d1, kv, durable_objects, queues)
  - DO with SQLite: How `new_sqlite_classes` works in migrations config
  - Queues: Producer/consumer config in same Worker

  **Acceptance Criteria**:

  ```
  Scenario: Wrangler dev starts successfully
    Tool: Bash
    Preconditions: Tasks 2, 3 complete
    Steps:
      1. Create apps/api/.dev.vars with placeholder secrets:
         JWT_SECRET=dev-secret-key-min-32-chars-long!!
         GOOGLE_CLIENT_ID=placeholder
         GOOGLE_CLIENT_SECRET=placeholder
         GITHUB_CLIENT_ID=placeholder
         GITHUB_CLIENT_SECRET=placeholder
         GITHUB_WEBHOOK_SECRET=placeholder
         FRONTEND_URL=http://localhost:5173
      2. cd apps/api && npx wrangler dev --local (run in background, capture PID)
      3. Wait 5 seconds for startup
      4. curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/api/auth/login
      5. Assert: Returns 501 (stub) — NOT 404 or connection error
      6. Kill wrangler process
    Expected Result: Worker starts, routes are mounted, stubs respond
    Evidence: Terminal output + curl response captured

  Scenario: DO classes exported from entry point
    Tool: Bash
    Steps:
      1. grep -n "export.*HackathonLifecycleDO" apps/api/src/index.ts
      2. Assert: Match found (class is re-exported)
      3. grep -n "export.*SubmissionDO" apps/api/src/index.ts
      4. Assert: Match found
    Expected Result: Both DO classes exported from main entry point
    Evidence: Grep output captured

  Scenario: wrangler.jsonc has correct bindings
    Tool: Bash
    Steps:
      1. cat apps/api/wrangler.jsonc | jq '.d1_databases[0].binding'
      2. Assert: "DB"
      3. cat apps/api/wrangler.jsonc | jq '.durable_objects.bindings | length'
      4. Assert: 2
      5. cat apps/api/wrangler.jsonc | jq '.queues.producers[0].binding'
      6. Assert: "WEBHOOK_QUEUE"
      7. cat apps/api/wrangler.jsonc | jq '.migrations[0].new_sqlite_classes'
      8. Assert: Contains "HackathonLifecycleDO" and "SubmissionDO"
    Expected Result: All bindings correctly configured in wrangler.jsonc
    Evidence: JSON output captured
  ```

  **Commit**: YES
  - Message: `feat(api): scaffold Hono Worker with wrangler.jsonc, DO stubs, and route stubs`
  - Files: `apps/api/**`
  - Pre-commit: `pnpm turbo build --filter=@devsage/api`

---

- [x] 6. Auth Vertical Slice — OAuth Flows, JWT, Middleware, Protected Routes

  **What to do**:
  - Implement manual OAuth 2.0 flow for **Google**:
    - `GET /api/auth/google` — Generate state param (random string), store in KV with TTL 10min, redirect to `https://accounts.google.com/o/oauth2/v2/auth` with `client_id`, `redirect_uri`, `response_type=code`, `scope=openid email profile`, `state`
    - `GET /api/auth/callback/google` — Validate state from KV (delete after use), exchange code for tokens via `https://oauth2.googleapis.com/token`, fetch user info from `https://www.googleapis.com/oauth2/v2/userinfo`, upsert user in D1, generate JWT, set HttpOnly cookie, redirect to frontend
  - Implement manual OAuth 2.0 flow for **GitHub**:
    - `GET /api/auth/github` — Same pattern, redirect to `https://github.com/login/oauth/authorize` with `client_id`, `redirect_uri`, `scope=user:email`, `state`
    - `GET /api/auth/callback/github` — Exchange code at `https://github.com/login/oauth/access_token`, fetch user from `https://api.github.com/user` and `https://api.github.com/user/emails`, upsert user in D1, generate JWT, set cookie, redirect
  - Implement JWT utilities in `apps/api/src/lib/jwt.ts`:
    - `signJWT(payload, secret)` — Sign using `crypto.subtle.importKey` + `crypto.subtle.sign` (HMAC SHA-256)
    - `verifyJWT(token, secret)` — Verify using `crypto.subtle.verify`
    - JWT payload: `{ sub: userId, email: string, role: 'organiser' | 'participant', iat: number, exp: number }`
    - Token expiry: 7 days
  - Implement cookie utilities in `apps/api/src/lib/cookies.ts`:
    - `setSessionCookie(c, token)` — Set `session` cookie: HttpOnly, SameSite=Lax, Path=/, Secure (prod only), Max-Age=7 days
    - `clearSessionCookie(c)` — Clear cookie
    - `getSessionCookie(c)` — Read cookie value
  - Implement auth middleware in `apps/api/src/middleware/auth.ts`:
    - Extract JWT from `session` cookie
    - Verify signature and expiry
    - Attach user payload to Hono context: `c.set('user', payload)`
    - Return 401 JSON error if invalid/missing
  - Implement role middleware in `apps/api/src/middleware/role.ts`:
    - `requireRole('organiser')` — Returns 403 if user.role doesn't match
  - Implement `GET /api/auth/me` — Return current user from JWT payload
  - Implement `POST /api/auth/logout` — Clear session cookie, return 200
  - User upsert logic: If user with same email+provider exists → update. If new → insert with default role `participant`.
  - Handle edge case: same email, different provider → create separate accounts (no merge in MVP)
  - Create `.dev.vars` template with instructions for setting up OAuth apps

  **Must NOT do**:
  - Do NOT use `@hono/oauth-providers` (known broken on CF Workers)
  - Do NOT use external JWT libraries — use `crypto.subtle` only
  - Do NOT implement token refresh (MVP: user re-logs after 7 days)
  - Do NOT merge accounts across providers
  - Do NOT add email verification

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: OAuth on Workers is tricky — manual implementation, crypto.subtle for JWT, cookie management across origins. High risk of subtle bugs.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (critical path — sequential)
  - **Blocks**: Tasks 7, 8, 9, 10, 11, 12
  - **Blocked By**: Tasks 4, 5

  **References**:

  **Pattern References**:
  - `apps/api/src/types/env.ts` — Env type with OAuth secrets (GOOGLE_CLIENT_ID, etc.)
  - `apps/api/src/routes/auth.ts` — Stub file to implement
  - `apps/api/src/middleware/auth.ts` — Stub middleware to implement
  - `packages/shared/src/schemas/user.ts` — User schema for DB insert shape
  - `packages/db/src/schema/users.ts` — Users table schema for Drizzle queries

  **External References**:
  - Google OAuth 2.0: https://developers.google.com/identity/protocols/oauth2/web-server
  - GitHub OAuth: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
  - Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
  - Hono cookie helper: https://hono.dev/docs/helpers/cookie
  - Hono JWT helper: https://hono.dev/docs/helpers/jwt

  **WHY Each Reference Matters**:
  - Google/GitHub OAuth docs: Exact endpoint URLs, required parameters, token exchange flow
  - Web Crypto API: How to use `crypto.subtle.importKey` and `crypto.subtle.sign` for HMAC SHA-256 JWT signing on Workers
  - Hono cookie/jwt: Built-in helpers that work on Workers — check if they can replace manual implementation

  **Acceptance Criteria**:

  ```
  Scenario: Google OAuth initiation redirects correctly
    Tool: Bash
    Preconditions: wrangler dev running with .dev.vars containing valid GOOGLE_CLIENT_ID
    Steps:
      1. curl -s -o /dev/null -w "%{http_code} %{redirect_url}" -L --max-redirs 0 http://localhost:8787/api/auth/google
      2. Assert: HTTP 302
      3. Assert: redirect_url contains "accounts.google.com"
      4. Assert: redirect_url contains "response_type=code"
      5. Assert: redirect_url contains "scope=openid"
    Expected Result: Redirects to Google with correct OAuth params
    Evidence: curl output captured

  Scenario: GitHub OAuth initiation redirects correctly
    Tool: Bash
    Steps:
      1. curl -s -o /dev/null -w "%{http_code} %{redirect_url}" -L --max-redirs 0 http://localhost:8787/api/auth/github
      2. Assert: HTTP 302
      3. Assert: redirect_url contains "github.com/login/oauth/authorize"
    Expected Result: Redirects to GitHub OAuth
    Evidence: curl output captured

  Scenario: Protected route rejects unauthenticated requests
    Tool: Bash
    Steps:
      1. curl -s -w "\n%{http_code}" http://localhost:8787/api/auth/me
      2. Assert: HTTP 401
      3. Assert: Response body contains "error" field
    Expected Result: 401 with structured error JSON
    Evidence: Response captured

  Scenario: Auth middleware accepts valid JWT cookie
    Tool: Bash
    Steps:
      1. Generate a test JWT manually using the dev JWT_SECRET:
         node -e "... (use crypto to sign a JWT with sub, email, role, exp)"
      2. curl -s -w "\n%{http_code}" -b "session=GENERATED_JWT" http://localhost:8787/api/auth/me
      3. Assert: HTTP 200
      4. Assert: Response body contains "email" and "role" fields
    Expected Result: Valid JWT cookie grants access to protected route
    Evidence: Response JSON captured

  Scenario: Logout clears session cookie
    Tool: Bash
    Steps:
      1. curl -s -D- -X POST http://localhost:8787/api/auth/logout -b "session=any-token"
      2. Assert: HTTP 200
      3. Assert: Set-Cookie header clears the session cookie (Max-Age=0 or expires in past)
    Expected Result: Session cookie cleared on logout
    Evidence: Response headers captured
  ```

  **Commit**: YES
  - Message: `feat(auth): implement OAuth 2.0 (Google + GitHub), JWT sessions, and auth middleware`
  - Files: `apps/api/src/routes/auth.ts`, `apps/api/src/lib/jwt.ts`, `apps/api/src/lib/cookies.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/middleware/role.ts`
  - Pre-commit: `pnpm turbo build --filter=@devsage/api`

---

- [ ] 7. Hackathon CRUD Vertical Slice — API Routes, D1 Queries, Validation

  **What to do**:
  - Implement Hackathon API routes in `apps/api/src/routes/hackathons.ts`:
    - `POST /api/hackathons` — Create hackathon (organiser only)
      - Validate body with `CreateHackathonRequestSchema` from `@devsage/shared`
      - Generate UUID, set status to DRAFT, insert into D1
      - Return 201 with hackathon data
    - `GET /api/hackathons` — List hackathons (authenticated)
      - Query D1 for all hackathons (paginated: limit/offset query params)
      - For organisers: show only their hackathons
      - For participants: show all non-DRAFT hackathons
      - Return 200 with `{ data: Hackathon[], total: number }`
    - `GET /api/hackathons/:id` — Get single hackathon (authenticated)
      - Query D1 by ID
      - Return 404 if not found
      - Return 200 with hackathon data
    - `PATCH /api/hackathons/:id` — Update hackathon (organiser owner only)
      - Validate body with `UpdateHackathonRequestSchema`
      - Only allow updates when status is DRAFT
      - Verify requesting user is the organiser
      - Return 200 with updated data
    - `DELETE /api/hackathons/:id` — Delete hackathon (organiser owner only, DRAFT only)
      - Soft delete or hard delete? → Hard delete in MVP (DRAFT status only)
      - Return 204
  - Implement `POST /api/hackathons/:id/register` — Participant registers for hackathon
    - Must be `participant` role
    - Hackathon must be in REGISTRATION_OPEN status
    - Check not already registered (UNIQUE constraint handles this, return 409)
    - Insert into registrations table
    - Return 201
  - Implement `GET /api/hackathons/:id/registrations` — List registrations (organiser of this hackathon)
    - Return list of registered users
  - Use `db.batch()` for any multi-statement operations
  - Use `@hono/zod-validator` middleware for request body validation
  - Generate UUIDs using `crypto.randomUUID()` (available on Workers)
  - All timestamps: `new Date().toISOString()` (UTC)

  **Must NOT do**:
  - Do NOT implement lifecycle state transitions here (that's Task 8 — HackathonLifecycleDO)
  - Do NOT add search or filtering beyond basic organiser/participant visibility
  - Do NOT add pagination beyond simple limit/offset
  - Do NOT add hackathon images or branding

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Core business logic with role-based access, D1 queries, Zod validation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (sequential after Task 6)
  - **Blocks**: Tasks 8, 9, 12
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - `apps/api/src/middleware/auth.ts` — Auth middleware from Task 6 (accessing `c.get('user')`)
  - `apps/api/src/middleware/role.ts` — Role middleware from Task 6
  - `packages/shared/src/schemas/hackathon.ts` — CreateHackathonRequestSchema, UpdateHackathonRequestSchema
  - `packages/db/src/schema/hackathons.ts` — Drizzle hackathons table definition
  - `packages/db/src/schema/registrations.ts` — Drizzle registrations table definition
  - `packages/db/src/client.ts` — Drizzle D1 client factory

  **External References**:
  - Drizzle D1 queries: https://orm.drizzle.team/docs/select
  - Hono Zod validator: https://hono.dev/docs/guides/validation
  - D1 batch: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch

  **WHY Each Reference Matters**:
  - Drizzle select/insert: Exact API for `db.select().from(hackathons).where(eq(...))` patterns
  - Hono Zod validator: How to use `zValidator('json', schema)` middleware for type-safe request validation
  - D1 batch: How to use `db.batch([stmt1, stmt2])` to stay within query limits

  **Acceptance Criteria**:

  ```
  Scenario: Create hackathon (organiser)
    Tool: Bash
    Preconditions: wrangler dev running, valid organiser JWT
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:8787/api/hackathons \
           -H "Content-Type: application/json" \
           -b "session=ORGANISER_JWT" \
           -d '{"title":"Test Hackathon","description":"A test hackathon for QA verification","registrationStartDate":"2026-03-01T00:00:00Z","hackingStartDate":"2026-03-02T00:00:00Z","submissionDeadline":"2026-03-03T00:00:00Z","maxTeamSize":4}'
      2. Assert: HTTP 201
      3. Assert: Response contains "id" (UUID format)
      4. Assert: Response contains "status": "DRAFT"
      5. Save returned ID as HACKATHON_ID
    Expected Result: Hackathon created with DRAFT status
    Evidence: Response JSON captured

  Scenario: Participant cannot create hackathon
    Tool: Bash
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:8787/api/hackathons \
           -H "Content-Type: application/json" \
           -b "session=PARTICIPANT_JWT" \
           -d '{"title":"Unauthorized","description":"Should fail because participant role"}'
      2. Assert: HTTP 403
    Expected Result: Role enforcement blocks participant from creating hackathons
    Evidence: Response captured

  Scenario: List hackathons returns correct data
    Tool: Bash
    Steps:
      1. curl -s http://localhost:8787/api/hackathons -b "session=ORGANISER_JWT" | jq '.data | length'
      2. Assert: >= 1
      3. curl -s http://localhost:8787/api/hackathons -b "session=ORGANISER_JWT" | jq '.data[0].title'
      4. Assert: "Test Hackathon"
    Expected Result: Hackathon list includes created hackathon
    Evidence: Response JSON captured

  Scenario: Get single hackathon by ID
    Tool: Bash
    Steps:
      1. curl -s -w "\n%{http_code}" http://localhost:8787/api/hackathons/{HACKATHON_ID} -b "session=ORGANISER_JWT"
      2. Assert: HTTP 200
      3. Assert: Response title equals "Test Hackathon"
    Expected Result: Single hackathon retrieved by ID
    Evidence: Response JSON captured

  Scenario: Delete hackathon (DRAFT only)
    Tool: Bash
    Steps:
      1. curl -s -w "\n%{http_code}" -X DELETE http://localhost:8787/api/hackathons/{HACKATHON_ID} -b "session=ORGANISER_JWT"
      2. Assert: HTTP 204
      3. curl -s -w "\n%{http_code}" http://localhost:8787/api/hackathons/{HACKATHON_ID} -b "session=ORGANISER_JWT"
      4. Assert: HTTP 404
    Expected Result: Hackathon deleted and no longer retrievable
    Evidence: Response captured

  Scenario: Validation rejects invalid input
    Tool: Bash
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:8787/api/hackathons \
           -H "Content-Type: application/json" \
           -b "session=ORGANISER_JWT" \
           -d '{"title":"AB"}'
      2. Assert: HTTP 400 (validation error)
      3. Assert: Response contains "error" with validation details
    Expected Result: Zod validation rejects short title
    Evidence: Response captured
  ```

  **Commit**: YES
  - Message: `feat(api): implement hackathon CRUD with role-based access and registration`
  - Files: `apps/api/src/routes/hackathons.ts`
  - Pre-commit: `pnpm turbo build --filter=@devsage/api`

---

- [ ] 8. HackathonLifecycleDO — State Machine with Alarm-Driven Transitions

  **What to do**:
  - Implement `HackathonLifecycleDO` in `apps/api/src/durable-objects/hackathon-lifecycle.ts`:
    - Uses SQLite storage (DO's built-in SQL API via `this.ctx.storage.sql`)
    - State machine with transitions:
      ```
      DRAFT → REGISTRATION_OPEN (organiser triggers)
      REGISTRATION_OPEN → HACKING (alarm at hackingStartDate OR organiser triggers)
      HACKING → SUBMISSION_CLOSED (alarm at submissionDeadline OR organiser triggers)
      SUBMISSION_CLOSED → COMPLETED (organiser triggers)
      ```
    - Invalid transitions return error with current state and allowed transitions
    - **DO SQLite schema** (internal to DO, NOT D1):
      - Table `lifecycle_state`: hackathon_id TEXT PK, current_status TEXT, registration_start TEXT, hacking_start TEXT, submission_deadline TEXT, transitioned_at TEXT, version INTEGER
    - **Compare-and-set**: All transitions check `version` — if version doesn't match expected, reject (409 Conflict)
    - **Alarm scheduling**: When transitioning to REGISTRATION_OPEN, schedule alarm for `hackingStartDate`. When transitioning to HACKING, schedule alarm for `submissionDeadline`. Use `this.ctx.storage.setAlarm(timestamp)`.
    - **Alarm handler** (`alarm()` method): Reads current state, auto-transitions if deadline has passed (REGISTRATION_OPEN→HACKING or HACKING→SUBMISSION_CLOSED)
  - Implement DO fetch handler (HTTP RPC from Worker):
    - `POST /transition` — Body: `{ action: string, expectedVersion: number }`. Returns new state + version.
    - `GET /state` — Returns current lifecycle state
    - `POST /initialize` — Body: `{ hackathonId, registrationStart, hackingStart, submissionDeadline }`. Sets initial state to DRAFT. Called when hackathon is created.
  - Wire up Worker routes to DO:
    - `POST /api/hackathons/:id/transition` — Gets DO stub by hackathon ID, forwards transition request
    - `GET /api/hackathons/:id/lifecycle` — Gets DO stub, returns lifecycle state
    - On hackathon creation (Task 7 route), also initialize the DO
  - Worker mediates D1 updates: After successful DO transition, Worker updates hackathon status in D1 (eventual consistency is OK — DO is authoritative)
  - DO ID strategy: Use hackathon ID as the DO ID name (`env.HACKATHON_LIFECYCLE.idFromName(hackathonId)`)

  **Must NOT do**:
  - Do NOT access D1 from inside the DO class
  - Do NOT allow backward transitions (no reverting to previous states)
  - Do NOT allow skipping states
  - Do NOT implement WebSocket notifications for state changes
  - Do NOT add Cron Trigger integration (alarms handle deadlines)

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: State machine design with compare-and-set concurrency, DO alarm scheduling, eventual consistency with D1 — this is genuinely complex distributed systems logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (sequential after Task 7)
  - **Blocks**: Tasks 10, 12
  - **Blocked By**: Task 7

  **References**:

  **Pattern References**:
  - `apps/api/src/durable-objects/hackathon-lifecycle.ts` — Stub from Task 5 to implement
  - `apps/api/src/routes/hackathons.ts` — Hackathon routes from Task 7 (add transition endpoints)
  - `packages/shared/src/constants.ts` — `HACKATHON_STATUS_TRANSITIONS` map
  - `packages/shared/src/schemas/hackathon.ts` — HackathonStatus enum
  - `apps/api/src/types/env.ts` — HACKATHON_LIFECYCLE binding type

  **External References**:
  - DO Alarms: https://developers.cloudflare.com/durable-objects/api/alarms/
  - DO SQLite API: https://developers.cloudflare.com/durable-objects/api/sql-api/
  - DO lifecycle: https://developers.cloudflare.com/durable-objects/reference/in-memory-state/

  **WHY Each Reference Matters**:
  - DO Alarms: How `setAlarm()` works, alarm handler signature, alarm persistence across hibernation
  - DO SQLite API: How to use `this.ctx.storage.sql.exec()` for internal DO state persistence
  - DO lifecycle: Understanding hibernation, wake-up behavior, and state persistence guarantees

  **Acceptance Criteria**:

  ```
  Scenario: Initialize and transition hackathon lifecycle
    Tool: Bash
    Preconditions: wrangler dev running, hackathon created (Task 7)
    Steps:
      1. curl -s http://localhost:8787/api/hackathons/{ID}/lifecycle -b "session=ORGANISER_JWT" | jq '.status'
      2. Assert: "DRAFT"
      3. curl -s -X POST http://localhost:8787/api/hackathons/{ID}/transition \
           -H "Content-Type: application/json" \
           -b "session=ORGANISER_JWT" \
           -d '{"action":"openRegistration","expectedVersion":1}'
      4. Assert: HTTP 200
      5. Assert: Response status is "REGISTRATION_OPEN"
      6. Assert: Response version is 2
    Expected Result: State transitions from DRAFT to REGISTRATION_OPEN
    Evidence: Response JSON captured

  Scenario: Invalid transition rejected with 409
    Tool: Bash
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:8787/api/hackathons/{ID}/transition \
           -b "session=ORGANISER_JWT" \
           -d '{"action":"closeSubmissions","expectedVersion":2}'
      2. Assert: HTTP 409 (cannot skip from REGISTRATION_OPEN to SUBMISSION_CLOSED)
      3. Assert: Response contains current state and allowed transitions
    Expected Result: Invalid state transition rejected
    Evidence: Response captured

  Scenario: Compare-and-set prevents stale updates
    Tool: Bash
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:8787/api/hackathons/{ID}/transition \
           -b "session=ORGANISER_JWT" \
           -d '{"action":"startHacking","expectedVersion":1}'
      2. Assert: HTTP 409 (version mismatch — current version is 2)
    Expected Result: Stale version rejected
    Evidence: Response captured

  Scenario: Full lifecycle forward progression
    Tool: Bash
    Steps:
      1. Transition REGISTRATION_OPEN → HACKING: POST /transition {"action":"startHacking","expectedVersion":2}
      2. Assert: HTTP 200, status "HACKING", version 3
      3. Transition HACKING → SUBMISSION_CLOSED: POST /transition {"action":"closeSubmissions","expectedVersion":3}
      4. Assert: HTTP 200, status "SUBMISSION_CLOSED", version 4
      5. Transition SUBMISSION_CLOSED → COMPLETED: POST /transition {"action":"complete","expectedVersion":4}
      6. Assert: HTTP 200, status "COMPLETED", version 5
    Expected Result: Full lifecycle progression completes
    Evidence: All responses captured

  Scenario: D1 status synced after transition
    Tool: Bash
    Steps:
      1. After transition, GET /api/hackathons/{ID}
      2. Assert: D1 record's status matches DO's current status
    Expected Result: D1 eventually consistent with DO state
    Evidence: Response captured
  ```

  **Commit**: YES
  - Message: `feat(api): implement HackathonLifecycleDO with state machine and alarm-driven transitions`
  - Files: `apps/api/src/durable-objects/hackathon-lifecycle.ts`, `apps/api/src/routes/hackathons.ts` (add transition routes)
  - Pre-commit: `pnpm turbo build --filter=@devsage/api`

---

- [ ] 9. Teams Vertical Slice — Create, Join, Leave, List

  **What to do**:
  - Implement Team API routes in `apps/api/src/routes/teams.ts`:
    - `POST /api/hackathons/:hackathonId/teams` — Create team
      - Must be registered participant for this hackathon
      - Hackathon must be in REGISTRATION_OPEN or HACKING status
      - Validate body with `CreateTeamRequestSchema` (name required)
      - Generate UUID for team ID
      - Generate random 8-char alphanumeric join code (using `crypto.getRandomValues`)
      - Set creator as captain
      - Insert team + team_member in `db.batch()`
      - Enforce max teams constraint: participant can only be on 1 team per hackathon
      - Return 201 with team data including join code
    - `POST /api/hackathons/:hackathonId/teams/join` — Join team by code
      - Body: `{ joinCode: string }`
      - Must be registered participant
      - Validate team exists and belongs to this hackathon
      - Check team size < hackathon.maxTeamSize
      - Check user not already on a team for this hackathon
      - Insert team_member
      - Return 200 with team data
    - `POST /api/hackathons/:hackathonId/teams/:teamId/leave` — Leave team
      - Must be a member of this team
      - If captain leaves and team has other members → assign next member as captain
      - If last member leaves → delete team
      - Remove team_member record
      - Return 200
    - `GET /api/hackathons/:hackathonId/teams` — List teams for hackathon
      - Organiser: sees all teams with member counts
      - Participant: sees all teams (names only) + their own team details
      - Return team list with member counts
    - `GET /api/hackathons/:hackathonId/teams/:teamId` — Get team details
      - Return team with all member info (name, avatar)
      - Only accessible to team members or the hackathon organiser

  **Must NOT do**:
  - Do NOT add team chat or messaging
  - Do NOT add team invites via email
  - Do NOT add team role assignment beyond captain
  - Do NOT allow team name changes after creation
  - Do NOT implement team transfer (changing captain explicitly)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multi-table operations with constraint validation, edge cases (last member leaves, max team size)
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (partially)
  - **Parallel Group**: Wave 4 (can run alongside Task 8 after Task 7 completes)
  - **Blocks**: Task 12
  - **Blocked By**: Task 7

  **References**:

  **Pattern References**:
  - `apps/api/src/routes/hackathons.ts` — Route pattern, auth middleware usage, D1 query style from Task 7
  - `apps/api/src/middleware/auth.ts` — Auth middleware for `c.get('user')`
  - `packages/shared/src/schemas/team.ts` — CreateTeamRequestSchema, JoinTeamRequestSchema
  - `packages/db/src/schema/teams.ts` — Teams table schema
  - `packages/db/src/schema/team_members.ts` — Team members table schema
  - `packages/db/src/schema/registrations.ts` — To verify user is registered for hackathon

  **External References**:
  - Drizzle joins: https://orm.drizzle.team/docs/joins
  - D1 batch operations: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch

  **Acceptance Criteria**:

  ```
  Scenario: Create team and get join code
    Tool: Bash
    Preconditions: Hackathon in REGISTRATION_OPEN, user registered as participant
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:8787/api/hackathons/{HACK_ID}/teams \
           -H "Content-Type: application/json" \
           -b "session=PARTICIPANT_JWT" \
           -d '{"name":"Team Alpha"}'
      2. Assert: HTTP 201
      3. Assert: Response contains "joinCode" (8 characters)
      4. Assert: Response contains "name": "Team Alpha"
      5. Save joinCode and teamId
    Expected Result: Team created with unique join code
    Evidence: Response JSON captured

  Scenario: Join team by code
    Tool: Bash
    Preconditions: Team created, second participant registered
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:8787/api/hackathons/{HACK_ID}/teams/join \
           -b "session=PARTICIPANT2_JWT" \
           -d '{"joinCode":"SAVED_CODE"}'
      2. Assert: HTTP 200
      3. GET /api/hackathons/{HACK_ID}/teams/{TEAM_ID}
      4. Assert: Members array has length 2
    Expected Result: Second participant joined the team
    Evidence: Response captured

  Scenario: Cannot join when team is full
    Tool: Bash
    Preconditions: Team at maxTeamSize
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:8787/api/hackathons/{HACK_ID}/teams/join \
           -b "session=PARTICIPANT_EXTRA_JWT" \
           -d '{"joinCode":"SAVED_CODE"}'
      2. Assert: HTTP 409 (team full)
    Expected Result: Team size limit enforced
    Evidence: Response captured

  Scenario: Cannot be on multiple teams
    Tool: Bash
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:8787/api/hackathons/{HACK_ID}/teams \
           -b "session=PARTICIPANT_JWT" \
           -d '{"name":"Second Team"}'
      2. Assert: HTTP 409 (already on a team)
    Expected Result: One team per participant per hackathon enforced
    Evidence: Response captured

  Scenario: Leave team — last member deletes team
    Tool: Bash
    Steps:
      1. Create a solo team with PARTICIPANT3
      2. POST /api/hackathons/{HACK_ID}/teams/{SOLO_TEAM_ID}/leave with PARTICIPANT3_JWT
      3. Assert: HTTP 200
      4. GET /api/hackathons/{HACK_ID}/teams/{SOLO_TEAM_ID}
      5. Assert: HTTP 404 (team deleted)
    Expected Result: Empty team auto-deleted
    Evidence: Response captured
  ```

  **Commit**: YES
  - Message: `feat(api): implement team management — create, join by code, leave, list`
  - Files: `apps/api/src/routes/teams.ts`
  - Pre-commit: `pnpm turbo build --filter=@devsage/api`

---

- [ ] 10. GitHub Webhook + Queue + SubmissionDO — Submission Pipeline

  **What to do**:
  - Implement GitHub webhook handler in `apps/api/src/routes/webhooks.ts`:
    - `POST /api/webhooks/github` — Receives GitHub push events
    - **Signature verification**: Verify `X-Hub-Signature-256` header using `crypto.subtle.verify()` with HMAC SHA-256 against `GITHUB_WEBHOOK_SECRET`
    - **Event filtering**: Only process `push` events (check `X-GitHub-Event` header). Ignore all other event types with 200 OK.
    - **Deduplication key**: Extract `X-GitHub-Delivery` header (unique per webhook delivery)
    - **Payload extraction**: Extract `repository.full_name`, `head_commit.id` (SHA), `ref` (branch), `pusher.name`
    - **Enqueue**: Send message to `WEBHOOK_QUEUE` with extracted data + delivery ID
    - Return 202 Accepted immediately (processing is async)
  - Implement Queue consumer in `apps/api/src/queue/webhook-consumer.ts`:
    - Process batched messages from the queue
    - For each message:
      - Look up which hackathon + team this repo belongs to (query D1: submissions table by repo_full_name, or a repo_registrations lookup)
      - If no matching hackathon/team → log and skip (repo not linked to any hackathon)
      - Get HackathonLifecycleDO state → If not in HACKING phase → skip (submissions not accepted)
      - Forward to SubmissionDO for the hackathon
    - Acknowledge messages after processing
    - Failed messages auto-retry (up to 3 per wrangler.jsonc config)
  - Implement `SubmissionDO` in `apps/api/src/durable-objects/submission.ts`:
    - Uses SQLite storage (DO's built-in SQL API)
    - **DO SQLite schema** (internal):
      - Table `submissions`: hackathon_id TEXT, team_id TEXT, repo_full_name TEXT, commit_sha TEXT, submitted_at TEXT, delivery_id TEXT UNIQUE, PRIMARY KEY(hackathon_id, team_id)
    - **Idempotent submission**: INSERT OR REPLACE — latest push always wins (overwrites previous commit SHA)
    - **Deduplication**: Check `delivery_id` before processing (skip if already seen)
    - **Locking**: After SUBMISSION_CLOSED phase, reject all new submissions
    - DO fetch handler:
      - `POST /submit` — Body: `{ hackathonId, teamId, repoFullName, commitSha, deliveryId }`. Processes submission.
      - `GET /submission/:hackathonId/:teamId` — Returns current submission state
      - `GET /submissions/:hackathonId` — Returns all submissions for a hackathon
  - Wire up Worker routes:
    - `GET /api/hackathons/:id/submissions` — Worker queries SubmissionDO, returns submission list
    - `GET /api/hackathons/:id/submissions/:teamId` — Worker queries SubmissionDO, returns team's submission
  - Implement repo linking: `POST /api/hackathons/:hackathonId/teams/:teamId/repo`
    - Links a GitHub repo to a team for a hackathon
    - Body: `{ repoFullName: string }` (e.g., "user/repo")
    - Store in D1: team_repos table or add repo_full_name to teams table
    - Only team captain can link repo
    - Only one repo per team per hackathon
  - Update `apps/api/src/index.ts` to export the Queue consumer handler:
    ```typescript
    export default { fetch: app.fetch, queue: async (batch, env) => { ... } }
    ```

  **Must NOT do**:
  - Do NOT clone repositories
  - Do NOT execute code from repositories
  - Do NOT analyze code content (metadata only)
  - Do NOT handle events other than `push`
  - Do NOT process webhooks synchronously (must use Queue)
  - Do NOT access D1 from inside SubmissionDO

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Webhook signature verification with crypto.subtle, Queue producer/consumer pattern, DO idempotency logic, multi-system coordination (webhook → queue → DO → D1 sync)
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (sequential after Task 8)
  - **Blocks**: Task 12
  - **Blocked By**: Task 8

  **References**:

  **Pattern References**:
  - `apps/api/src/durable-objects/hackathon-lifecycle.ts` — DO pattern from Task 8 (SQLite storage, fetch handler)
  - `apps/api/src/routes/hackathons.ts` — Route patterns, auth middleware
  - `packages/shared/src/schemas/submission.ts` — Submission schemas
  - `packages/db/src/schema/submissions.ts` — Submissions D1 table (for read queries)
  - `apps/api/wrangler.jsonc` — Queue and DO binding config

  **External References**:
  - GitHub Webhook Events: https://docs.github.com/en/webhooks/webhook-events-and-payloads#push
  - GitHub Webhook Signature Verification: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
  - Cloudflare Queues Consumer: https://developers.cloudflare.com/queues/configuration/javascript-apis/#consumer
  - DO SQLite API: https://developers.cloudflare.com/durable-objects/api/sql-api/

  **WHY Each Reference Matters**:
  - GitHub push payload: Exact JSON shape of push event, where to find `head_commit.id`, `repository.full_name`
  - Webhook signature: How to compute HMAC SHA-256 and compare with `X-Hub-Signature-256` header
  - Queue consumer: How to export `queue` handler, batch processing, message acknowledgment, retry behavior
  - DO SQLite: How to use `INSERT OR REPLACE` for idempotent submissions

  **Acceptance Criteria**:

  ```
  Scenario: Webhook with valid signature accepted
    Tool: Bash
    Preconditions: wrangler dev running, GITHUB_WEBHOOK_SECRET set in .dev.vars
    Steps:
      1. Compute HMAC SHA-256 of payload body using the webhook secret
      2. curl -s -w "\n%{http_code}" -X POST http://localhost:8787/api/webhooks/github \
           -H "Content-Type: application/json" \
           -H "X-Hub-Signature-256: sha256=COMPUTED_HMAC" \
           -H "X-GitHub-Event: push" \
           -H "X-GitHub-Delivery: test-delivery-001" \
           -d '{"repository":{"full_name":"testuser/testrepo"},"head_commit":{"id":"abc123def456"},"ref":"refs/heads/main","pusher":{"name":"testuser"}}'
      3. Assert: HTTP 202
    Expected Result: Valid webhook accepted for async processing
    Evidence: Response captured

  Scenario: Webhook with invalid signature rejected
    Tool: Bash
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:8787/api/webhooks/github \
           -H "X-Hub-Signature-256: sha256=invalid_signature" \
           -H "X-GitHub-Event: push" \
           -d '{}'
      2. Assert: HTTP 401
    Expected Result: Invalid signature rejected
    Evidence: Response captured

  Scenario: Non-push events ignored gracefully
    Tool: Bash
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:8787/api/webhooks/github \
           -H "X-Hub-Signature-256: sha256=VALID_HMAC" \
           -H "X-GitHub-Event: issues" \
           -H "X-GitHub-Delivery: test-delivery-002" \
           -d '{"action":"opened"}'
      2. Assert: HTTP 200 (acknowledged but not processed)
    Expected Result: Non-push events acknowledged but skipped
    Evidence: Response captured

  Scenario: Submission visible after webhook processing
    Tool: Bash
    Preconditions: Hackathon in HACKING phase, team with linked repo, webhook processed
    Steps:
      1. GET /api/hackathons/{ID}/submissions/{TEAM_ID} -b "session=PARTICIPANT_JWT"
      2. Assert: HTTP 200
      3. Assert: Response contains "commitSha" matching the pushed SHA
      4. Assert: Response contains "repoFullName"
      5. Assert: Response contains "status": "accepted"
    Expected Result: Submission recorded with correct commit SHA
    Evidence: Response JSON captured

  Scenario: Duplicate webhook delivery is idempotent
    Tool: Bash
    Steps:
      1. Send same webhook with same X-GitHub-Delivery header twice
      2. GET /api/hackathons/{ID}/submissions/{TEAM_ID}
      3. Assert: Only one submission record (not duplicated)
    Expected Result: Duplicate delivery handled idempotently
    Evidence: Response captured

  Scenario: Link repo to team
    Tool: Bash
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:8787/api/hackathons/{ID}/teams/{TEAM_ID}/repo \
           -b "session=CAPTAIN_JWT" \
           -d '{"repoFullName":"testuser/testrepo"}'
      2. Assert: HTTP 200
      3. GET /api/hackathons/{ID}/teams/{TEAM_ID}
      4. Assert: Response contains "repoFullName": "testuser/testrepo"
    Expected Result: Repo linked to team
    Evidence: Response captured
  ```

  **Commit**: YES
  - Message: `feat(api): implement GitHub webhook pipeline with Queue and SubmissionDO`
  - Files: `apps/api/src/routes/webhooks.ts`, `apps/api/src/queue/webhook-consumer.ts`, `apps/api/src/durable-objects/submission.ts`, `apps/api/src/routes/submissions.ts`
  - Pre-commit: `pnpm turbo build --filter=@devsage/api`

---

- [ ] 11. React SPA Shell — Vite + React Router + Tailwind + shadcn/ui + Auth Pages

  **What to do**:
  - Scaffold React app in `apps/web/`:
    - `pnpm create vite apps/web --template react-ts`
    - Install: `react-router-dom`, `tailwindcss`, `@tailwindcss/vite`, `clsx`, `tailwind-merge`
    - Initialize shadcn/ui: `pnpm dlx shadcn@latest init`
    - Configure shadcn/ui with New York style, slate color palette
  - Set up Tailwind CSS:
    - `tailwind.config.ts` with content paths for `apps/web/src/**`
    - Import Tailwind directives in `src/index.css`
  - Set up React Router in `apps/web/src/main.tsx`:
    - Define routes:
      - `/` — Landing/home page (public)
      - `/login` — Login page with Google + GitHub buttons
      - `/auth/callback` — OAuth callback handler (redirect from API)
      - `/dashboard` — Protected: Participant dashboard
      - `/organiser` — Protected: Organiser dashboard
      - `/hackathons/:id` — Protected: Hackathon detail page
      - `/hackathons/:id/teams` — Protected: Team management page
      - `*` — 404 page
    - Route-based code splitting using `React.lazy()` + `Suspense`
  - Implement auth context (`apps/web/src/contexts/auth-context.tsx`):
    - `AuthProvider` wraps app
    - On mount: `GET /api/auth/me` to check if user is logged in
    - Stores `{ user, isAuthenticated, isLoading }` in context
    - `useAuth()` hook for consuming auth state
    - `ProtectedRoute` component: redirects to `/login` if not authenticated
  - Implement API client (`apps/web/src/lib/api.ts`):
    - Wrapper around `fetch` that:
      - Prepends API base URL (from env var `VITE_API_URL`)
      - Includes `credentials: 'include'` for cookies
      - Parses JSON responses
      - Handles 401 → redirect to login
      - Handles errors → returns structured error
  - Implement pages:
    - `LoginPage` — Two buttons: "Continue with Google" and "Continue with GitHub"
      - Each links to `/api/auth/google` or `/api/auth/github`
    - `AuthCallbackPage` — Receives redirect after OAuth, calls `/api/auth/me`, redirects to dashboard
    - `NotFoundPage` — Simple 404 page
    - `DashboardLayout` — Shared layout with nav bar, user info, logout button
  - Configure Vite proxy for development:
    - `vite.config.ts`: proxy `/api/*` to `http://localhost:8787`
  - Add shadcn/ui components needed for MVP:
    - Button, Card, Input, Badge, Skeleton, Toast/Sonner, Dialog, DropdownMenu
  - Configure `apps/web/package.json` scripts: `dev`, `build`, `preview`
  - Set up env vars: `VITE_API_URL` in `.env.development` and `.env.production`

  **Must NOT do**:
  - Do NOT implement dashboard content yet (that's Task 12)
  - Do NOT add complex animations or transitions
  - Do NOT add a landing page marketing content
  - Do NOT add dark mode toggle (defer)
  - Do NOT install state management library (React context is sufficient for MVP)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Frontend scaffolding with Vite, React Router, Tailwind, and shadcn/ui. Requires clean UI/UX decisions.
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Ensures clean, professional UI from the start with shadcn/ui component setup

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (can run alongside Tasks 7-10 after Task 6 is done)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 2, 6

  **References**:

  **Pattern References**:
  - `packages/shared/src/schemas/` — Shared types for API response shapes
  - `packages/shared/src/constants.ts` — Role constants, status enums

  **External References**:
  - Vite React: https://vite.dev/guide/
  - React Router v6: https://reactrouter.com/start/library
  - shadcn/ui: https://ui.shadcn.com/docs/installation/vite
  - Tailwind CSS v4: https://tailwindcss.com/docs/installation/vite

  **WHY Each Reference Matters**:
  - Vite guide: Correct template setup and config for React + TypeScript
  - React Router: `createBrowserRouter`, `RouterProvider`, `lazy()` for code splitting
  - shadcn/ui installation: Exact init commands and component installation for Vite projects
  - Tailwind: CSS setup with `@tailwindcss/vite` plugin

  **Acceptance Criteria**:

  ```
  Scenario: React SPA loads and renders
    Tool: Playwright (playwright skill)
    Preconditions: apps/web dev server running (pnpm dev)
    Steps:
      1. Navigate to: http://localhost:5173/
      2. Wait for: page load (timeout: 10s)
      3. Assert: Page renders without JavaScript errors (check console)
      4. Screenshot: .sisyphus/evidence/task-11-spa-loads.png
    Expected Result: SPA renders the landing/login page
    Evidence: .sisyphus/evidence/task-11-spa-loads.png

  Scenario: Login page shows OAuth buttons
    Tool: Playwright
    Steps:
      1. Navigate to: http://localhost:5173/login
      2. Wait for: button visible (timeout: 5s)
      3. Assert: Button with text "Continue with Google" exists
      4. Assert: Button with text "Continue with GitHub" exists
      5. Screenshot: .sisyphus/evidence/task-11-login-page.png
    Expected Result: Login page with two OAuth buttons
    Evidence: .sisyphus/evidence/task-11-login-page.png

  Scenario: Protected route redirects to login
    Tool: Playwright
    Preconditions: User NOT logged in (no session cookie)
    Steps:
      1. Navigate to: http://localhost:5173/dashboard
      2. Wait for: URL change (timeout: 5s)
      3. Assert: URL is now /login
    Expected Result: Unauthenticated user redirected to login
    Evidence: URL assertion

  Scenario: Vite proxy forwards API calls
    Tool: Bash
    Preconditions: Both vite dev and wrangler dev running
    Steps:
      1. curl -s -w "\n%{http_code}" http://localhost:5173/api/auth/me
      2. Assert: HTTP 401 (proxied to Worker, which rejects unauthenticated)
    Expected Result: Vite dev proxy correctly forwards /api/* to Worker
    Evidence: Response captured

  Scenario: Production build succeeds
    Tool: Bash
    Steps:
      1. cd apps/web && pnpm build
      2. Assert: Exit code 0
      3. ls apps/web/dist/index.html
      4. Assert: File exists
      5. ls apps/web/dist/assets/
      6. Assert: JS and CSS bundles exist
    Expected Result: Vite build produces deployable static assets
    Evidence: File listing captured
  ```

  **Commit**: YES
  - Message: `feat(web): scaffold React SPA with Vite, React Router, Tailwind, shadcn/ui, and auth flow`
  - Files: `apps/web/**`
  - Pre-commit: `pnpm turbo build --filter=@devsage/web`

---

- [ ] 12. Frontend Dashboards — Participant + Organiser Views + Submission Visibility

  **What to do**:
  - Implement **Participant Dashboard** (`apps/web/src/pages/dashboard.tsx`):
    - Fetch `GET /api/hackathons` and display hackathon list
    - Card-based layout for each hackathon:
      - Title, description (truncated), status badge (color-coded)
      - Dates: registration start, hacking start, submission deadline
      - Action buttons based on status:
        - REGISTRATION_OPEN → "Register" button
        - HACKING (if registered) → "View My Team" / "Create Team" button
      - Show registration status (registered/not registered)
    - My Teams section: List teams the participant belongs to across hackathons
    - Loading skeleton states using shadcn Skeleton component
    - Error state: Toast notification on API failure, show last-known-good data
  - Implement **Organiser Dashboard** (`apps/web/src/pages/organiser.tsx`):
    - Fetch `GET /api/hackathons` (organiser-filtered)
    - "Create Hackathon" button → opens Dialog/form
    - Create Hackathon form:
      - Fields: title, description, dates (registration start, hacking start, submission deadline), max team size
      - Validation using Zod schemas from `@devsage/shared` (client-side)
      - Submit → `POST /api/hackathons`
    - Hackathon management card:
      - Current phase badge
      - "Advance Phase" button with confirmation dialog → `POST /api/hackathons/:id/transition`
      - Participant count, team count
      - View registrations link
  - Implement **Hackathon Detail Page** (`apps/web/src/pages/hackathon-detail.tsx`):
    - Full hackathon info
    - If participant: show own team, own submission status
    - If organiser: show all teams, all submissions, registration list
    - Submission display: repo URL, commit SHA (truncated), timestamp, status badge
    - Team management panel (for participants):
      - Create team form (name)
      - Join team form (join code input)
      - Team member list
      - Leave team button
  - Implement **Team Management Page** (`apps/web/src/pages/team-management.tsx`):
    - Team details: name, join code (copyable), members list
    - Link repo form: input for "owner/repo" format
    - Show linked repo and latest submission
  - Use shared types from `@devsage/shared` for type-safe API consumption
  - Use shadcn/ui components: Card, Button, Input, Badge, Dialog, Skeleton, Toast (Sonner)
  - Implement responsive layout (mobile-friendly)
  - Add navigation: sidebar or top nav with role-based menu items

  **Must NOT do**:
  - Do NOT add charts or analytics
  - Do NOT add search or filtering beyond basic list
  - Do NOT render code from repositories
  - Do NOT add real-time updates (no WebSocket)
  - Do NOT add pagination UI (simple list, paginate later)
  - Do NOT over-design — functional > beautiful for MVP

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Multiple dashboard pages with data fetching, forms, role-based UI, responsive layout
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Clean dashboard layout, form UX, responsive design decisions

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (sequential after Tasks 7-11)
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 7, 8, 9, 10, 11

  **References**:

  **Pattern References**:
  - `apps/web/src/contexts/auth-context.tsx` — Auth context from Task 11 for role checking
  - `apps/web/src/lib/api.ts` — API client from Task 11 for data fetching
  - `packages/shared/src/schemas/` — All entity schemas for type-safe responses
  - `packages/shared/src/constants.ts` — HackathonStatus enum for badge colors, HACKATHON_STATUS_TRANSITIONS for valid actions
  - `apps/api/src/routes/hackathons.ts` — API response shapes to match
  - `apps/api/src/routes/teams.ts` — Team API response shapes
  - `apps/api/src/routes/submissions.ts` — Submission API response shapes

  **External References**:
  - shadcn/ui components: https://ui.shadcn.com/docs/components
  - React Router data loading: https://reactrouter.com/start/library/data-loading

  **WHY Each Reference Matters**:
  - shadcn/ui docs: Exact import paths and usage for Card, Dialog, Badge, Skeleton, Toast
  - React Router loading: How to use `loader` functions for route-level data fetching
  - Shared schemas: Ensures frontend type annotations match actual API responses

  **Acceptance Criteria**:

  ```
  Scenario: Participant dashboard shows hackathon list
    Tool: Playwright (playwright skill)
    Preconditions: Dev server + wrangler dev running, participant logged in, at least 1 hackathon exists
    Steps:
      1. Navigate to: http://localhost:5173/dashboard
      2. Wait for: .hackathon-card visible (timeout: 10s)
      3. Assert: At least one hackathon card is rendered
      4. Assert: Card contains hackathon title text
      5. Assert: Card contains status badge
      6. Screenshot: .sisyphus/evidence/task-12-participant-dashboard.png
    Expected Result: Participant sees hackathon cards with status
    Evidence: .sisyphus/evidence/task-12-participant-dashboard.png

  Scenario: Organiser can create hackathon via form
    Tool: Playwright
    Preconditions: Organiser logged in
    Steps:
      1. Navigate to: http://localhost:5173/organiser
      2. Click: button with text "Create Hackathon"
      3. Wait for: dialog/form visible (timeout: 5s)
      4. Fill: input[name="title"] → "Playwright Test Hackathon"
      5. Fill: input[name="description"] → "Created via Playwright QA scenario for testing"
      6. Fill: date inputs for registration, hacking, submission dates
      7. Fill: input[name="maxTeamSize"] → "4"
      8. Click: submit button
      9. Wait for: success toast or new card appears (timeout: 10s)
      10. Assert: New hackathon card visible with title "Playwright Test Hackathon"
      11. Screenshot: .sisyphus/evidence/task-12-organiser-create.png
    Expected Result: Hackathon created and visible in organiser dashboard
    Evidence: .sisyphus/evidence/task-12-organiser-create.png

  Scenario: Team creation and join code display
    Tool: Playwright
    Preconditions: Participant registered for a hackathon in REGISTRATION_OPEN phase
    Steps:
      1. Navigate to hackathon detail page
      2. Click: "Create Team" button
      3. Fill: team name input → "QA Test Team"
      4. Submit form
      5. Wait for: join code display (timeout: 5s)
      6. Assert: Join code is visible (8 characters)
      7. Assert: "Copy" button exists next to join code
      8. Screenshot: .sisyphus/evidence/task-12-team-created.png
    Expected Result: Team created with visible, copyable join code
    Evidence: .sisyphus/evidence/task-12-team-created.png

  Scenario: Submission visibility shows commit SHA
    Tool: Playwright
    Preconditions: Team has a submission (from webhook processing)
    Steps:
      1. Navigate to hackathon detail page
      2. Assert: Submission section visible
      3. Assert: Commit SHA displayed (truncated)
      4. Assert: Repository name displayed
      5. Assert: Submission timestamp displayed
      6. Screenshot: .sisyphus/evidence/task-12-submission-visible.png
    Expected Result: Submission details rendered correctly
    Evidence: .sisyphus/evidence/task-12-submission-visible.png

  Scenario: Production build succeeds with all pages
    Tool: Bash
    Steps:
      1. cd apps/web && pnpm build
      2. Assert: Exit code 0
      3. Assert: No TypeScript errors
    Expected Result: All dashboard pages compile into production bundle
    Evidence: Build output captured
  ```

  **Commit**: YES
  - Message: `feat(web): implement participant and organiser dashboards with team management and submission views`
  - Files: `apps/web/src/pages/**`, `apps/web/src/components/**`
  - Pre-commit: `pnpm turbo build --filter=@devsage/web`

---

- [ ] 13. Vitest Integration — Test Harness + Critical Path Tests

  **What to do**:
  - Set up Vitest in `apps/api/`:
    - Install: `vitest`, `@cloudflare/vitest-pool-workers`
    - Create `apps/api/vitest.config.ts` configured with Workers pool:
      ```
      defineWorkersConfig({
        test: {
          pool: "@cloudflare/vitest-pool-workers",
          poolOptions: { workers: { wrangler: { configPath: "./wrangler.jsonc" } } }
        }
      })
      ```
  - Set up Vitest in `apps/web/`:
    - Install: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
    - Create `apps/web/vitest.config.ts` with jsdom environment
  - Set up Vitest in `packages/shared/`:
    - Basic vitest config for schema validation tests
  - Write critical path tests for `apps/api/`:
    - **Auth tests** (`src/__tests__/auth.test.ts`):
      - JWT sign/verify utility tests
      - Auth middleware: rejects missing cookie, accepts valid JWT, rejects expired JWT
    - **Hackathon CRUD tests** (`src/__tests__/hackathons.test.ts`):
      - Create hackathon: valid input → 201, invalid input → 400, wrong role → 403
      - List hackathons: returns array, respects role visibility
      - Get hackathon: valid ID → 200, missing ID → 404
    - **Lifecycle DO tests** (`src/__tests__/lifecycle-do.test.ts`):
      - State transitions: DRAFT → REGISTRATION_OPEN → HACKING → SUBMISSION_CLOSED → COMPLETED
      - Invalid transition → error
      - Version mismatch → 409
    - **Webhook tests** (`src/__tests__/webhooks.test.ts`):
      - Valid signature → 202
      - Invalid signature → 401
      - Non-push event → 200 (ignored)
    - **Team tests** (`src/__tests__/teams.test.ts`):
      - Create team → 201 with join code
      - Join by code → 200
      - Already on team → 409
  - Write shared schema tests for `packages/shared/`:
    - Validate Zod schemas accept valid data and reject invalid data
  - Write basic frontend tests for `apps/web/`:
    - Login page renders OAuth buttons
    - Auth context handles unauthenticated state
  - Add `test` script to each package.json
  - Add `test` task to `turbo.json` pipeline
  - Verify: `pnpm turbo test` runs all test suites across all packages

  **Must NOT do**:
  - Do NOT write E2E tests (Playwright QA scenarios cover that)
  - Do NOT aim for 100% coverage — critical paths only
  - Do NOT add test fixtures or seed data scripts
  - Do NOT add snapshot tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Test setup and writing tests for already-implemented code. Well-defined scope.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (final task)
  - **Blocks**: None
  - **Blocked By**: All previous tasks (1-12)

  **References**:

  **Pattern References**:
  - `apps/api/src/lib/jwt.ts` — JWT utilities to test
  - `apps/api/src/middleware/auth.ts` — Auth middleware to test
  - `apps/api/src/routes/hackathons.ts` — Hackathon routes to test
  - `apps/api/src/routes/teams.ts` — Team routes to test
  - `apps/api/src/routes/webhooks.ts` — Webhook handler to test
  - `apps/api/src/durable-objects/hackathon-lifecycle.ts` — Lifecycle DO to test
  - `packages/shared/src/` — Schemas to test
  - `apps/api/wrangler.jsonc` — Wrangler config for Workers test pool

  **External References**:
  - @cloudflare/vitest-pool-workers: https://developers.cloudflare.com/workers/testing/vitest-integration/
  - Vitest configuration: https://vitest.dev/config/
  - Testing Library React: https://testing-library.com/docs/react-testing-library/intro/

  **WHY Each Reference Matters**:
  - Workers vitest pool: How to configure Vitest to run tests inside Workers runtime (D1, KV, DO bindings available in tests)
  - Vitest config: Configuration options for monorepo test setup
  - Testing Library: How to render React components and assert DOM in tests

  **Acceptance Criteria**:

  ```
  Scenario: All test suites pass
    Tool: Bash
    Steps:
      1. pnpm turbo test
      2. Assert: Exit code 0
      3. Assert: Output shows test counts for apps/api, apps/web, packages/shared
      4. Assert: Zero failures across all suites
    Expected Result: All tests pass across all packages
    Evidence: Test output captured

  Scenario: API tests cover critical paths
    Tool: Bash
    Steps:
      1. cd apps/api && pnpm test -- --reporter=verbose
      2. Assert: "auth" describe block present
      3. Assert: "hackathons" describe block present
      4. Assert: "lifecycle" describe block present
      5. Assert: "webhooks" describe block present
      6. Assert: "teams" describe block present
      7. Assert: All tests pass
    Expected Result: Critical path tests present and passing
    Evidence: Verbose test output captured

  Scenario: Shared schema tests validate correctly
    Tool: Bash
    Steps:
      1. cd packages/shared && pnpm test
      2. Assert: Exit code 0
      3. Assert: Schema validation tests pass
    Expected Result: Shared schema tests pass
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `test: add Vitest test suite for critical paths across API, web, and shared packages`
  - Files: `apps/api/vitest.config.ts`, `apps/api/src/__tests__/**`, `apps/web/vitest.config.ts`, `apps/web/src/__tests__/**`, `packages/shared/vitest.config.ts`, `packages/shared/src/__tests__/**`
  - Pre-commit: `pnpm turbo test`

---

## Commit Strategy

| After Task | Message | Key Files | Verification |
|------------|---------|-----------|--------------|
| 1 | `chore: initialize turborepo monorepo with 5 packages` | turbo.json, pnpm-workspace.yaml, 5× package.json | `pnpm turbo build` |
| 2+3 | `feat(shared): add Zod schemas and types` + `chore(config): add shared TS/ESLint config` | packages/shared/**, packages/config/** | `pnpm turbo build typecheck` |
| 4 | `feat(db): add Drizzle schema and D1 migrations` | packages/db/** | `pnpm turbo build --filter=@devsage/db` |
| 5 | `feat(api): scaffold Hono Worker with wrangler.jsonc and stubs` | apps/api/** | `wrangler dev` starts |
| 6 | `feat(auth): implement OAuth 2.0, JWT sessions, auth middleware` | apps/api/src/routes/auth.ts, lib/jwt.ts, middleware/auth.ts | Auth endpoints respond |
| 7 | `feat(api): implement hackathon CRUD with role-based access` | apps/api/src/routes/hackathons.ts | CRUD endpoints work |
| 8 | `feat(api): implement HackathonLifecycleDO state machine` | apps/api/src/durable-objects/hackathon-lifecycle.ts | State transitions work |
| 9 | `feat(api): implement team management` | apps/api/src/routes/teams.ts | Team CRUD works |
| 10 | `feat(api): implement GitHub webhook pipeline with SubmissionDO` | apps/api/src/routes/webhooks.ts, durable-objects/submission.ts, queue/ | Webhook → Queue → DO |
| 11 | `feat(web): scaffold React SPA with auth flow` | apps/web/** | SPA loads, auth redirects |
| 12 | `feat(web): implement participant and organiser dashboards` | apps/web/src/pages/** | Dashboards render data |
| 13 | `test: add Vitest suite for critical paths` | **/__tests__/** | `pnpm turbo test` passes |

---

## Success Criteria

### Verification Commands
```bash
pnpm turbo build          # Expected: All 5 packages build successfully
pnpm turbo typecheck      # Expected: Zero type errors
pnpm turbo test           # Expected: All test suites pass
pnpm turbo lint           # Expected: Zero lint errors
wrangler dev --local      # Expected: Worker starts, all bindings available
```

### Final Checklist
- [ ] All "Must Have" features present and working
- [ ] All "Must NOT Have" exclusions verified absent
- [ ] All 13 tasks completed with passing acceptance criteria
- [ ] `pnpm turbo build` succeeds across all packages
- [ ] `pnpm turbo test` passes all suites
- [ ] OAuth login works with both Google and GitHub
- [ ] Hackathon lifecycle transitions work end-to-end
- [ ] Team management works (create, join, leave)
- [ ] GitHub webhooks accepted and processed
- [ ] React SPA loads with role-aware dashboards
- [ ] All timestamps are UTC ISO-8601
- [ ] No direct D1 access from inside DO classes
- [ ] wrangler.jsonc used (not .toml)
- [ ] SQLite-backed DOs configured
- [ ] Evidence screenshots saved in `.sisyphus/evidence/`
