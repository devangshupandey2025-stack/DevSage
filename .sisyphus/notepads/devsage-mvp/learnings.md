# Learnings — devsage-mvp

This file captures conventions, patterns, and discoveries from implementation.

---

## [Session ses_3cf457002ffeNSxmPxux56k9hN] Started: 2026-02-06T06:19:58.380Z


## Task 1: Turborepo Monorepo Initialization - COMPLETED

### Structure Created
- Root: `/home/srijan/DevSage`
- Apps: `apps/web`, `apps/api`
- Packages: `packages/shared`, `packages/db`, `packages/config`

### Key Files
1. **Root `package.json`**
   - Contains Turborepo as devDependency
   - Scripts: build, dev, test, lint, typecheck (all via turbo)
   - packageManager: pnpm@10.28.2 (must be specific version, not "latest")

2. **`pnpm-workspace.yaml`**
   - Declares workspaces: `apps/*` and `packages/*`
   - Enables pnpm to manage all 5 packages

3. **`turbo.json`**
   - Uses `tasks` field (NOT `pipeline` - changed in turbo 2.0)
   - Tasks defined: build, dev, test, lint, typecheck
   - build depends on ^build (workspace dependencies)
   - dev has cache=false and persistent=true

4. **Package Structure**
   - All use @devsage/* scope
   - All have "private": true
   - All have "type": "module" for ESM support

### Critical Lessons
- pnpm must be installed globally before running monorepo commands
- Turborepo 2.0+ changed "pipeline" to "tasks"
- packageManager field must use exact version (e.g., "pnpm@10.28.2"), not "latest"
- Empty workspaces don't need build scripts - turbo build succeeds with 0 tasks executed
- pnpm creates pnpm-lock.yaml automatically (should be committed)

### Verification
- All 5 package.json files exist with correct @devsage/* names
- pnpm-workspace.yaml correctly declares apps/* and packages/*
- turbo.json has all 5 required tasks: build, dev, test, lint, typecheck
- `pnpm install` succeeds
- `pnpm turbo build` runs successfully (exit code 0)
- Git commit created: ae678ad "chore: initialize turborepo monorepo with 5 packages"

### Next Tasks Depend On
- Task 2: Web app with React/Vite
- Task 3: API with Hono
- Task 4: Shared utilities package
- Task 5: Database layer setup
- Task 6: Config package setup
All tasks rely on this monorepo foundation.

## Task 6: Config Package with TypeScript & ESLint Setup - COMPLETED

### Files Created in `packages/config`

1. **`tsconfig.base.json`**
   - Strict mode enabled (`"strict": true`)
   - Target: ES2022
   - Module: NodeNext (tree-shakeable ES modules)
   - Composite and declaration files enabled for monorepo use
   - Shared across all packages in monorepo

2. **`tsconfig.worker.json`**
   - Extends `tsconfig.base.json`
   - Adds Cloudflare Workers types via `"types": ["@cloudflare/workers-types"]`
   - Used by API package (built on Hono/Cloudflare Workers)

3. **`tsconfig.react.json`**
   - Extends `tsconfig.base.json`
   - JSX config: `"jsx": "react-jsx"` (modern JSX transform, no React import needed)
   - Libs: ES2022 + DOM (for browser APIs)
   - Used by web app package

4. **`eslint.config.mjs`**
   - ESLint 9+ flat config format (not .eslintrc.json)
   - CommonJS imports/exports → ESM format (.mjs extension)
   - TypeScript plugin with rules:
     - `@typescript-eslint/no-unused-vars` (with `_` prefix ignored)
     - `@typescript-eslint/no-explicit-any` (warn)
     - `no-console` (warn, except console.warn/error)

### Root Dependencies Installed

Via `pnpm add -D -w`:
- `@cloudflare/workers-types@^4.20260206.0`
- `typescript@^5.9.3`
- `eslint@^9.39.2`
- `@typescript-eslint/eslint-plugin@^8.54.0`
- `@typescript-eslint/parser@^8.54.0`

**KEY POINT**: Dependencies installed at ROOT (with `-w` flag), NOT in packages/config. Config package only contains configuration files, not dependencies.

### Critical Patterns

1. **Monorepo Config Package Pattern**
   - config package = centralized shared configs only
   - No source code, no dist builds
   - Other packages import via `@devsage/config/tsconfig.react.json` etc.
   - Can be referenced directly in tsconfig extends: `"extends": "@devsage/config/tsconfig.base.json"`

2. **ESLint 9 Flat Config**
   - Uses `export default [{ ... }]` instead of nested objects
   - Plugin object: `{ '@typescript-eslint': typescriptPlugin }`
   - Rule prefix in rules: `'@typescript-eslint/no-unused-vars'`
   - Single ignores config at top of array

3. **TypeScript Composite & Declaration**
   - `"composite": true` enables incremental builds in monorepos
   - `"declaration": true` generates .d.ts files
   - Allows packages to reference each other's types via exports

### Verification Results
- ✅ tsconfig.base.json has strict: true
- ✅ tsconfig.worker.json extends base correctly
- ✅ tsconfig.react.json has jsx: "react-jsx" and lib: ["ES2022", "DOM"]
- ✅ eslint.config.mjs is flat format with proper imports
- ✅ All dev dependencies installed at root
- ✅ `pnpm turbo typecheck` runs without errors (0 tasks executed is expected - packages will define typecheck tasks later)

### Next Steps for Other Packages
- Add to package.json: `"@devsage/config": "workspace:*"` in devDependencies
- Create tsconfig.json in each package that extends the appropriate base config
- Define typecheck script in each package.json: `"typecheck": "tsc --noEmit"`

## Task 2: Shared Package with Zod Schemas - COMPLETED

### Package Structure
- Created `packages/shared/` with TypeScript + Zod
- Dependencies: `zod` (runtime), `typescript` + `@devsage/config` (dev)
- Exports configured via `"exports"` field in package.json for ESM module resolution
- Build: `tsc --build` compiles to `dist/`

### Zod Schemas Implemented

**Entity Schemas (inferred types)**:
1. **UserSchema** - id (UUID), email, name, avatarUrl (nullable), provider (google|github), providerId, role (organiser|participant), createdAt/updatedAt
2. **HackathonSchema** - id, title (3-100 chars), description (10-5000 chars), organiserId, status (enum), maxTeamSize (1-10), dates (registration/hacking/submission), createdAt/updatedAt
3. **TeamSchema** - id, hackathonId, name (2-50 chars), joinCode (8 chars), captainId, createdAt
4. **TeamMemberSchema** - teamId, userId, joinedAt
5. **RegistrationSchema** - id, hackathonId, userId, registeredAt
6. **SubmissionSchema** - id, hackathonId, teamId, repoFullName, commitSha (40 hex chars regex), submittedAt, status (pending|accepted|locked)

**API Request Schemas**:
- CreateHackathonRequestSchema
- UpdateHackathonRequestSchema  
- CreateTeamRequestSchema
- JoinTeamRequestSchema
- RegisterForHackathonRequestSchema

**API Response Schemas**:
- HackathonResponse, HackathonListResponse
- TeamResponse, TeamListResponse
- SubmissionResponse, SubmissionListResponse
- ApiErrorSchema (error, code, details?)

**Constants**:
- `ROLES` = ['organiser', 'participant'] as const
- `MAX_TEAM_NAME_LENGTH` = 50
- `JOIN_CODE_LENGTH` = 8
- `HACKATHON_STATUS_TRANSITIONS` - valid state transition map (DRAFT → REGISTRATION_OPEN → HACKING → SUBMISSION_CLOSED → COMPLETED)

### Critical Implementation Details

1. **ESM Module Imports**
   - TypeScript with `moduleResolution: "NodeNext"` requires `.js` extensions on relative imports
   - All imports: `import x from './file.js'`
   - Zod methods: `nonnegative()` not `non_negative()`

2. **Zod Validation Constraints**
   - String lengths: `.min()`, `.max()`
   - Regex patterns: `.regex(pattern)` for 40-char hex SHA validation
   - Datetime: `.datetime()` for ISO-8601 validation
   - Enums: `.enum([...])` for status, provider, role

3. **Barrel Export Pattern**
   - All schemas exported from `src/index.ts`
   - Enables: `import { UserSchema } from '@devsage/shared'`

### Verification Tests Passed
✅ Valid hackathon creation accepted
✅ Invalid title (too short) rejected with validation message
✅ Constants correctly exported (ROLES, MAX_TEAM_NAME_LENGTH, JOIN_CODE_LENGTH, HACKATHON_STATUS_TRANSITIONS)
✅ Submission with 40-char hex SHA accepted
✅ Submission with invalid SHA rejected
✅ Build output: 23 exported symbols total
✅ `pnpm turbo build --filter=@devsage/shared` succeeds

### Files Created
- `packages/shared/package.json` - ESM module with Zod dependency
- `packages/shared/tsconfig.json` - extends @devsage/config
- `packages/shared/src/schemas/user.ts`
- `packages/shared/src/schemas/hackathon.ts`
- `packages/shared/src/schemas/team.ts`
- `packages/shared/src/schemas/team-member.ts`
- `packages/shared/src/schemas/registration.ts`
- `packages/shared/src/schemas/submission.ts`
- `packages/shared/src/schemas/api.ts` - request/response schemas
- `packages/shared/src/schemas/constants.ts`
- `packages/shared/src/index.ts` - barrel export

### Key Patterns for Future Tasks
- Import UserSchema, HackathonSchema etc. from `@devsage/shared` in API routes
- Use CreateHackathonRequestSchema with `zValidator('json', schema)` in Hono middleware
- Reference HACKATHON_STATUS_TRANSITIONS when implementing state machine in Task 8
- User role validated against ROLES constant in auth middleware

## Task 5: API Package Skeleton with Hono Router - COMPLETED (2026-02-06T06:45)

### Package Structure
- Created `apps/api/` with Hono + Cloudflare Workers setup
- Dependencies: `hono`, `@hono/zod-validator`, `@devsage/shared` (runtime)
- Dev Dependencies: `wrangler`, `@cloudflare/workers-types`, `@cloudflare/vitest-pool-workers`, `@devsage/config`
- Build: `tsc --noEmit` for type checking (no dist - wrangler compiles directly from src)

### Cloudflare Workers Configuration

**wrangler.jsonc** (NOT .toml - JSON format preferred):
- name: `devsage-api`
- main: `src/index.ts`
- compatibility_date: `2025-12-01`
- compatibility_flags: `["nodejs_compat"]` for Node.js APIs
- Bindings:
  - D1: `DB` → `devsage-db` database
  - KV: `KV` → placeholder namespace
  - Durable Objects: `HACKATHON_LIFECYCLE` (HackathonLifecycleDO), `SUBMISSION` (SubmissionDO)
  - Queue Producer: `WEBHOOK_QUEUE` → `github-webhooks` queue
  - Queue Consumer: `github-webhooks` queue (max_batch_size: 10, max_retries: 3)
- **CRITICAL**: `migrations[0].new_sqlite_classes` MUST list DO class names for SQLite-backed DOs

### Durable Objects Pattern

**RE-EXPORT REQUIREMENT** (CRITICAL for wrangler):
- DO classes MUST be re-exported from Worker entry point (`src/index.ts`)
- Correct:
  ```typescript
  export { HackathonLifecycleDO } from './durable-objects/hackathon-lifecycle.js';
  export { SubmissionDO } from './durable-objects/submission.js';
  ```
- Wrangler fails to find DO classes if not re-exported

**DO Class Structure**:
- Extend `DurableObject<Env>` from `cloudflare:workers`
- Constructor: `constructor(ctx: DurableObjectState, env: Env)`
- Initialize with `ctx.blockConcurrencyWhile(async () => { ... })`
- HackathonLifecycleDO has `async alarm()` handler for lifecycle transitions
- SubmissionDO tracks submission state and webhook events

### Hono App Structure

**Worker Entry Point** (`src/index.ts`):
- Export Hono app as `default { fetch: app.fetch, async queue(...) {...} }`
- Combines HTTP fetch handler AND queue consumer in same Worker
- App type: `Hono<{ Bindings: Env }>`

**Route Mounting**:
- `app.route('/api/auth', auth)` - OAuth login/logout (Google, GitHub)
- `app.route('/api/hackathons', hackathons)` - CRUD operations
- `app.route('/api/teams', teams)` - Team management + member ops
- `app.route('/api/webhooks', webhooks)` - GitHub webhook ingestion
- `app.route('/api/submissions', submissions)` - Submission CRUD + repo linking
- All routes return HTTP 501 (Not Implemented) as stubs

**Middleware**:
- `errorHandler` - Global error handler returning `{ error, code }` JSON
- `authMiddleware` - Stub (passes through, no JWT verification yet)

### Env Type Definition

**Critical Bindings Interface** (`src/types/env.ts`):
```typescript
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  HACKATHON_LIFECYCLE: DurableObjectNamespace;
  SUBMISSION: DurableObjectNamespace;
  WEBHOOK_QUEUE: Queue;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_WEBHOOK_SECRET: string;
  FRONTEND_URL: string;
}
```

### Secrets Management

**.dev.vars** (local development ONLY):
- Contains placeholder secrets (JWT_SECRET, OAuth client IDs/secrets, webhook secret)
- NOT committed to git (should be .gitignore'd)
- Automatically loaded by `wrangler dev --local`
- Production secrets: Use `wrangler secret put <KEY>` (NOT in wrangler.jsonc)

### Queue Consumer Pattern

**Same Worker as Producer**:
```typescript
export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    for (const msg of batch.messages) {
      console.log('Queue message:', msg.body);
      msg.ack(); // Acknowledge message
    }
  }
}
```
- No separate Worker needed for queue consumer
- Process messages in batch, acknowledge individually

### Verification Tests Passed

✅ wrangler dev starts successfully with all bindings recognized
✅ HTTP 501 returned on `/api/auth/login`, `/api/auth/login/google`
✅ Root `/` returns `{"status":"ok","message":"DevSage API"}`
✅ DO exports verified: `grep "export.*HackathonLifecycleDO" apps/api/src/index.ts` → found
✅ DO exports verified: `grep "export.*SubmissionDO" apps/api/src/index.ts` → found
✅ wrangler.jsonc D1 binding: `jq '.d1_databases[0].binding'` → "DB"
✅ wrangler.jsonc migrations: `jq '.migrations[0].new_sqlite_classes'` → ["HackathonLifecycleDO", "SubmissionDO"]
✅ `pnpm turbo build --filter=@devsage/api` succeeds (tsc --noEmit passes)

### Files Created

- `apps/api/package.json` - Hono + wrangler dependencies
- `apps/api/wrangler.jsonc` - Complete Cloudflare Workers config
- `apps/api/tsconfig.json` - extends @devsage/config/tsconfig.worker.json
- `apps/api/.dev.vars` - placeholder secrets template
- `apps/api/src/types/env.ts` - Env interface with all bindings
- `apps/api/src/durable-objects/hackathon-lifecycle.ts` - DO stub with alarm
- `apps/api/src/durable-objects/submission.ts` - DO stub
- `apps/api/src/middleware/auth.ts` - auth middleware stub
- `apps/api/src/middleware/error-handler.ts` - global error handler
- `apps/api/src/routes/auth.ts` - OAuth route stubs
- `apps/api/src/routes/hackathons.ts` - CRUD route stubs
- `apps/api/src/routes/teams.ts` - team management stubs
- `apps/api/src/routes/webhooks.ts` - GitHub webhook stub
- `apps/api/src/routes/submissions.ts` - submission route stubs
- `apps/api/src/index.ts` - Worker entry point with DO re-exports

### Critical Lessons Learned

1. **wrangler.jsonc vs wrangler.toml**
   - JSON format allows schema validation via `"$schema": "node_modules/wrangler/config-schema.json"`
   - Easier to parse/manipulate programmatically
   - Comments supported via JSONC

2. **Durable Objects MUST be re-exported**
   - Wrangler scans Worker entry point for DO class exports
   - Not re-exporting = "Durable Object class not found" error at runtime

3. **SQLite-backed DOs require migrations**
   - `new_sqlite_classes` array in migrations enables SQL API in DOs
   - Without this, DOs can only use KV storage API

4. **Queue Producer + Consumer in Same Worker**
   - Single Worker handles both HTTP and queue messages
   - Export object with `fetch` and `queue` properties
   - Simplifies deployment (no separate queue worker needed)

5. **ESM Imports with .js Extensions**
   - All relative imports use `.js` even in `.ts` files
   - `moduleResolution: "NodeNext"` requirement from tsconfig.base.json

6. **Hono Bindings Type**
   - `Hono<{ Bindings: Env }>` provides type-safe `c.env` access
   - Each route file also uses `Hono<{ Bindings: Env }>` for consistency

### Next Tasks Unlocked

- **Task 6**: Auth vertical slice (implement OAuth in route stubs, JWT generation)
- **Task 7**: Hackathon CRUD (implement D1 queries in hackathons routes)
- **Task 8**: Lifecycle DO (implement HackathonLifecycleDO alarm logic for state transitions)
- **Task 9**: GitHub webhook processing (implement webhooks route + queue consumer)

### Known Issues / Technical Debt

- Wrangler version 3.114.17 is outdated (latest 4.63.0)
  - Compatibility date fallback warning: 2025-12-01 → 2025-07-18
  - Action: Update to wrangler@4 in future sprint
- No JWT verification middleware yet (auth passes through)
- No D1 database schema created (needed for Task 7)
- Route stubs return 501 - no business logic implemented


## Task 4: DB Package with Drizzle ORM and D1 Migrations - COMPLETED (2026-02-06T07:30)

### Package Structure
- Created `packages/db/` with Drizzle ORM for Cloudflare D1
- Dependencies: `drizzle-orm@^0.36.4` (runtime)
- Dev Dependencies: `drizzle-kit@^0.30.1`, `better-sqlite3@^11.8.1`, `@cloudflare/workers-types@^4.20241127.0`, `@devsage/config`, `typescript`
- Build: `tsc` compiles to `dist/`
- Migration generation: `pnpm generate` (runs tsc + drizzle-kit generate)

### Database Schema Design

**6 Tables Implemented** (snake_case columns, camelCase exports):

1. **users**
   - id (text PK), email (unique), name, avatar_url (nullable)
   - provider (google|github), provider_id, role (organiser|participant, default 'participant')
   - created_at, updated_at

2. **hackathons**
   - id (text PK), title, description, organiser_id (FK → users.id)
   - status (enum: DRAFT|REGISTRATION_OPEN|HACKING|SUBMISSION_CLOSED|COMPLETED, default 'DRAFT')
   - max_team_size (integer, default 4)
   - registration_start_date, hacking_start_date, submission_deadline
   - created_at, updated_at

3. **registrations**
   - id (text PK), hackathon_id (FK → hackathons.id), user_id (FK → users.id)
   - registered_at
   - UNIQUE (hackathon_id, user_id) - one registration per user per hackathon

4. **teams**
   - id (text PK), hackathon_id (FK → hackathons.id), name
   - join_code (unique 8-char code), captain_id (FK → users.id)
   - created_at

5. **team_members**
   - team_id (FK → teams.id), user_id (FK → users.id), joined_at
   - PRIMARY KEY (team_id, user_id) - composite PK

6. **submissions**
   - id (text PK), hackathon_id (FK → hackathons.id), team_id (FK → teams.id)
   - repo_full_name, commit_sha, submitted_at
   - status (pending|accepted|locked, default 'pending')
   - UNIQUE (hackathon_id, team_id) - one submission per team per hackathon

### Critical Implementation Details

1. **Drizzle-Kit vs TypeScript Import Extensions**
   - **PROBLEM**: TypeScript ESM requires `.js` extensions (`import x from './y.js'`), but drizzle-kit (running in CJS mode) fails to resolve `.js` extensions for `.ts` files
   - **SOLUTION**: Configure `drizzle.config.ts` to use `schema: './dist/schema/*.js'` (compiled output) instead of `./src/schema/*.ts`
   - **WORKFLOW**: `pnpm generate` script runs `tsc && drizzle-kit generate` (build first, then generate migrations from dist)
   - **KEY LESSON**: Drizzle-kit expects executable JS files with resolved imports, NOT raw TS source files

2. **Snake_Case vs CamelCase Convention**
   - DB columns: snake_case (e.g., `created_at`, `organiser_id`, `avatar_url`)
   - Zod schemas: camelCase (e.g., `createdAt`, `organiserId`, `avatarUrl`)
   - Drizzle exports: camelCase (e.g., `export const teamMembers = sqliteTable('team_members', {...})`)
   - Alignment required when mapping Drizzle results to Zod schemas

3. **Drizzle SQLite Column Types**
   - All IDs: `text('id')` (UUIDs stored as text)
   - Timestamps: `text('created_at')` (ISO-8601 datetime strings)
   - Integers: `integer('max_team_size')`
   - Enums: `text('status', { enum: ['DRAFT', ...] })`
   - Foreign keys: `.references(() => users.id)`
   - Unique constraints: `unique().on(table.col1, table.col2)` (composite) OR `.unique()` (single column)
   - Composite PKs: `primaryKey({ columns: [table.col1, table.col2] })`

4. **D1 Client Factory Pattern**
   - `createDbClient(d1: D1Database)` function wraps Drizzle's `drizzle(d1, { schema })`
   - Returns typed DbClient for use in Worker routes
   - Schema passed to enable relational queries (future feature)
   - Usage: `const db = createDbClient(c.env.DB)` in Hono context

### Files Created

- `packages/db/package.json` - Drizzle dependencies + ESM exports
- `packages/db/tsconfig.json` - extends @devsage/config, adds `types: ["@cloudflare/workers-types"]`
- `packages/db/drizzle.config.ts` - D1 dialect config pointing to dist/ folder
- `packages/db/src/schema/users.ts` - users table
- `packages/db/src/schema/hackathons.ts` - hackathons table
- `packages/db/src/schema/registrations.ts` - registrations table
- `packages/db/src/schema/teams.ts` - teams table
- `packages/db/src/schema/team_members.ts` - team_members table
- `packages/db/src/schema/submissions.ts` - submissions table
- `packages/db/src/schema/index.ts` - barrel export of all schemas
- `packages/db/src/client.ts` - createDbClient factory + DbClient type
- `packages/db/src/index.ts` - main package entry point
- `packages/db/migrations/0000_familiar_tyrannus.sql` - D1 migration SQL

### Migration SQL Generated

**Verified Constraints**:
✅ CREATE TABLE for all 6 tables (users, hackathons, registrations, teams, team_members, submissions)
✅ UNIQUE INDEX users_email_unique
✅ UNIQUE INDEX teams_join_code_unique
✅ UNIQUE INDEX registrations_hackathon_id_user_id_unique (composite)
✅ UNIQUE INDEX submissions_hackathon_id_team_id_unique (composite)
✅ PRIMARY KEY (team_id, user_id) in team_members
✅ FOREIGN KEY constraints on all FK columns
✅ DEFAULT 'DRAFT' for hackathons.status
✅ DEFAULT 4 for hackathons.max_team_size
✅ DEFAULT 'participant' for users.role
✅ DEFAULT 'pending' for submissions.status

### Drizzle Config Pattern

**drizzle.config.ts**:
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',
  schema: './dist/schema/*.js', // ← CRITICAL: use compiled output
  out: './migrations',
});
```

**package.json scripts**:
```json
{
  "build": "tsc",
  "typecheck": "tsc --noEmit",
  "generate": "tsc && drizzle-kit generate" // ← Build first
}
```

### Package Exports

**package.json exports field**:
```json
{
  "exports": {
    ".": "./dist/index.js",           // Main entry: all schemas + client
    "./client": "./dist/client.js",   // Client factory only
    "./schema": "./dist/schema/index.js" // All table schemas
  }
}
```

**Usage in API**:
```typescript
import { createDbClient, users, hackathons } from '@devsage/db';
const db = createDbClient(c.env.DB);
await db.select().from(users);
```

### Verification Tests Passed

✅ `pnpm drizzle-kit generate` succeeds (exit code 0)
✅ Migration file created: `packages/db/migrations/0000_familiar_tyrannus.sql`
✅ Migration SQL contains all 6 tables with correct constraints
✅ `pnpm build` succeeds (TypeScript compilation clean)
✅ `pnpm turbo typecheck --filter=@devsage/db` passes
✅ Dist output verified: client.js, index.js, schema/ folder with 6 table exports

### Critical Lessons Learned

1. **Drizzle-Kit Runs Against Compiled Output**
   - Cannot use raw TS files with .js import extensions
   - Must compile to dist/ first, then generate from .js files
   - `pnpm generate` script chains tsc && drizzle-kit

2. **D1Database Type from @cloudflare/workers-types**
   - Added to tsconfig.json: `"types": ["@cloudflare/workers-types"]`
   - Enables type-safe client factory: `createDbClient(d1: D1Database)`

3. **Composite Unique Constraints in Drizzle**
   - Use table callback function: `(table) => ({ uniqueName: unique().on(table.col1, table.col2) })`
   - Example: registrations table ensures one registration per user per hackathon

4. **Composite Primary Keys in Drizzle**
   - Use table callback function: `(table) => ({ pk: primaryKey({ columns: [table.col1, table.col2] }) })`
   - Example: team_members uses (team_id, user_id) as composite PK

5. **Foreign Key References Syntax**
   - `.references(() => tableName.columnName)`
   - Arrow function defers evaluation (handles circular dependencies)

### Next Tasks Unlocked

- **Task 7**: Hackathon CRUD - can now use `createDbClient(c.env.DB)` in API routes
- **Task 8**: Lifecycle DO - can use D1 schema in Worker-mediated updates
- **Task 6**: Auth vertical slice - can query users table for OAuth user creation/lookup

### Migration Application (To Do Manually)

1. Create D1 database: `wrangler d1 create devsage-db`
2. Apply migration: `wrangler d1 migrations apply devsage-db --local` (for dev)
3. Production: `wrangler d1 migrations apply devsage-db` (after deploy)


## Task 6: Auth Vertical Slice - OAuth + JWT + Middleware (2026-02-06)

### crypto.subtle JWT signing/verification pattern
- Cloudflare Workers supports HS256 JWT via `crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])`.
- JWT generation is manual: JSON header/payload -> UTF-8 bytes -> base64url encode -> sign `header.payload` -> base64url signature.
- JWT verification must validate all pieces: token shape (3 parts), header (`alg=HS256`, `typ=JWT`), HMAC signature, payload fields (`sub`, `email`, `role`, `iat`, `exp`), and expiration (`exp > now`).

### OAuth state CSRF protection pattern
- Generate state with `crypto.randomUUID()` and store in KV as `oauth:state:{uuid}` with TTL 600 seconds.
- Persist metadata in state value: `{ provider, redirectUri, createdAt }`.
- On callback: require both `code` and `state`, fetch state entry, validate provider, and delete KV key immediately (one-time use).
- Provider flow is manual fetch-based (no middleware): exchange code for access token, fetch provider profile, map to internal user shape.

### Cookie settings (dev vs prod)
- Session cookie is `session`, `HttpOnly`, `Path=/`, `Max-Age=7d`.
- Dev mode uses `SameSite=Lax` and `Secure=false` for localhost HTTP.
- Production mode uses `SameSite=Strict` and `Secure=true` (inferred from `FRONTEND_URL` using `https:` protocol).
- Logout uses cookie deletion helper, returning `Set-Cookie` with `Max-Age=0`.

### User upsert with Drizzle
- DB client pattern: `const db = createDbClient(c.env.DB)` from `@devsage/db`.
- OAuth upsert query uses provider isolation: `where(and(eq(users.email, email), eq(users.provider, provider)))`.
- Existing user path updates identity fields (`name`, `avatar_url`, `provider_id`, `updated_at`); new user inserts UUID with default role `participant`.
- JWT payload is sourced from upserted user (`sub`, `email`, `role`) and attached to request context in auth middleware.

## Task 7: Hackathon CRUD Vertical Slice - API Routes, D1 Queries, Validation (2026-02-06)

### Drizzle D1 query patterns
- `.get()` returns single row or undefined; `.all()` returns array of rows
- Conditional where: use ternary for type-safe condition assignment instead of `let` + `if/else`
- Pagination: `limit(n).offset(n)` chainable on select queries
- Total count: separate query without limit/offset (D1 doesn't have COUNT aggregation in Drizzle yet)
- Join syntax: `.innerJoin(table, eq(table.col, otherTable.col))` with select shape: `{ user: users }`

### Hono route patterns with AuthAppEnv
- Route files must use `Hono<AuthAppEnv>` type (not `{ Bindings: Env }`) to access `c.get('user')`
- `c.get('user')` returns `AuthenticatedUser` (JWT payload: `sub`, `email`, `role`)
- Apply middleware: `hackathons.use('*', authMiddleware)` at top of route file
- Combine middleware: `hackathons.post('/', requireRole('organiser'), zValidator(...), async (c) => ...)`

### zValidator integration
- Import: `import { zValidator } from '@hono/zod-validator'`
- Usage: `zValidator('json', CreateHackathonRequestSchema)` as middleware before handler
- Access validated data: `c.req.valid('json')` (fully typed from schema)
- Validation errors return 400 with Zod error shape automatically

### D1 database migrations with wrangler
- Migrations path must be in `d1_databases[].migrations_dir` (not top-level)
- Apply local migrations: `wrangler d1 migrations apply <db-name> --local` from API directory
- Local D1 storage: `.wrangler/state/v3/d1/` (sqlite3 file)
- Manual SQL: `wrangler d1 execute <db-name> --local --command "INSERT ..."`

### Role-aware visibility pattern
- Organisers: `where(eq(hackathons.organiser_id, user.sub))` (see only their own)
- Participants: `where(ne(hackathons.status, 'DRAFT'))` (see all non-DRAFT)
- Ternary assignment: `const whereCondition = role === 'organiser' ? eq(...) : ne(...)`

### Update/Delete authorization pattern
- Fetch hackathon first to check existence
- Check ownership: `hackathon.organiser_id !== user.sub` → 403 Forbidden
- Check status: `hackathon.status !== 'DRAFT'` → 400 Invalid Status
- Only perform operation if both checks pass

### Drizzle update with partial fields
- Build update object conditionally: `if (body.title !== undefined) updateData.title = body.title`
- Always include timestamp: `updateData.updated_at = new Date().toISOString()`
- Type: `const updateData: Record<string, unknown> = {}`
- Apply: `db.update(table).set(updateData).where(eq(table.id, id))`

### Registration unique constraint handling
- Drizzle throws `Error` with message containing "UNIQUE constraint failed" on duplicate insert
- Catch error: `try { await insert } catch (error) { if (error instanceof Error && error.message.includes('UNIQUE')) ... }`
- Return 409 Conflict with code `DUPLICATE_REGISTRATION`

### HTTP status codes for CRUD
- 201 Created: POST create operations (return created entity)
- 200 OK: GET single/list, PATCH update (return data)
- 204 No Content: DELETE operations (return `c.body(null, 204)`)
- 404 Not Found: Entity doesn't exist
- 403 Forbidden: Auth passed but insufficient permissions (wrong role, not owner)
- 400 Bad Request: Invalid state (e.g., trying to modify non-DRAFT hackathon)
- 409 Conflict: Duplicate resource (e.g., already registered)

### Join queries with Drizzle
- Select with join: `db.select({ user: users }).from(registrations).innerJoin(users, eq(registrations.user_id, users.id))`
- Result shape: `[{ user: { id, email, name, ... } }]`
- Extract nested data: `registrationList.map((r) => r.user)`

### Testing workflow
- Create D1 database: `wrangler d1 create <name>`
- Apply migrations: `wrangler d1 migrations apply <name> --local`
- Insert test users: `wrangler d1 execute <db> --local --command "INSERT INTO users ..."`
- Generate JWT tokens: Node.js script using `crypto.subtle` + HS256 manual signing
- Start dev server: `wrangler dev --local &`
- Test with curl: `curl -H "Cookie: session=<JWT>" http://localhost:8787/api/...`

### Critical fixes applied
- Changed Hono type from `{ Bindings: Env }` to `AuthAppEnv` to enable `c.get('user')` type safety
- Replaced `let` + `if/else` with ternary for `whereCondition` to avoid implicit `any` type error
- Added `migrations_dir` to `d1_databases[]` in wrangler.jsonc (not top-level field)

### Verification results
- ✅ Build passes: `pnpm turbo build --filter=@devsage/api` (exit 0)
- ✅ POST /hackathons as organiser → 201 with id and status='DRAFT'
- ✅ POST /hackathons as participant → 403 Forbidden
- ✅ GET /hackathons as organiser → only their hackathons
- ✅ GET /hackathons as participant → only non-DRAFT hackathons
- ✅ GET /hackathons/:id → 200 with hackathon
- ✅ GET /hackathons/nonexistent → 404 Not Found
- ✅ PATCH /hackathons/:id as owner in DRAFT → 200 with updated data
- ✅ PATCH /hackathons/:id when status != DRAFT → 400 Invalid Status
- ✅ DELETE /hackathons/:id as owner in DRAFT → 204, then 404 on GET
- ✅ DELETE /hackathons/:id when status != DRAFT → 400 Invalid Status
- ✅ POST /hackathons with title.length < 3 → 400 with Zod validation error
- ✅ POST /hackathons/:id/register as participant → 201
- ✅ POST /hackathons/:id/register duplicate → 409 Duplicate Registration
- ✅ GET /hackathons/:id/registrations as organiser owner → 200 with user list
- ✅ GET /hackathons/:id/registrations as non-owner → 403 Forbidden


## Task 8: HackathonLifecycleDO — State Machine with Alarm-Driven Transitions (2026-02-06)

### Durable Object SQLite + RPC pattern
- Use `this.ctx.blockConcurrencyWhile()` in constructor to run `CREATE TABLE IF NOT EXISTS lifecycle_state (...)` before handling requests.
- Keep DO state internal to SQLite (`this.ctx.storage.sql`) and expose only RPC endpoints: `POST /initialize`, `GET /state`, `POST /transition`.
- For SQL cursor typing under strict TypeScript, parse `toArray()` rows as unknown records and validate shape at runtime.

### Compare-and-set transition pattern
- Transition request shape: `{ action, expectedVersion }`, where `expectedVersion` must equal current `version`.
- CAS update uses SQL guard: `UPDATE ... WHERE hackathon_id = ? AND version = ?` then verifies `version === expectedVersion + 1` and target status.
- Conflict responses should include `currentState`, `allowedTransitions`, and `allowedActions` to make retries deterministic.

### Alarm scheduling pattern
- On transition to `REGISTRATION_OPEN`, schedule alarm at `hackingStart`; on transition to `HACKING`, schedule at `submissionDeadline`.
- Alarm handler checks current status and deadline before auto-transitioning (`REGISTRATION_OPEN -> HACKING`, `HACKING -> SUBMISSION_CLOSED`).
- After reaching terminal/non-alarm states (`SUBMISSION_CLOSED`, `COMPLETED`, `DRAFT`), clear alarms with `deleteAlarm()`.

### Worker <-> DO consistency pattern
- Use DO ID strategy: `env.HACKATHON_LIFECYCLE.idFromName(hackathonId)` so one logical lifecycle object per hackathon.
- Worker remains the only component touching D1: after successful DO transition, update `hackathons.status` and `updated_at`.
- `GET /api/hackathons/:id/lifecycle` also reconciles D1 status with DO status to handle alarm-driven transitions (eventual consistency repair).

### Verification executed
- ✅ `pnpm turbo build --filter=@devsage/api` passes.
- ✅ Lifecycle initialization returns `DRAFT` with `version: 1`.
- ✅ `DRAFT -> REGISTRATION_OPEN` succeeds with `version: 2`.
- ✅ Invalid transition and stale version both return `409` with conflict details.
- ✅ Full manual progression reaches `COMPLETED` at `version: 5`.
- ✅ Alarm-driven progression auto-advanced `REGISTRATION_OPEN -> HACKING -> SUBMISSION_CLOSED` using near-term deadlines.
- ✅ D1 status matched DO status after transitions (`GET /api/hackathons/:id` returned `COMPLETED`).


## Task 10: GitHub Webhook + Queue + SubmissionDO (2026-02-06)

### Webhook authenticity pattern for GitHub push ingestion
- GitHub webhook route should read the raw request body (`await c.req.text()`) before parsing JSON so HMAC verification uses exact payload bytes.
- Signature check uses `crypto.subtle.importKey(..., { name: 'HMAC', hash: 'SHA-256' })` + `crypto.subtle.sign`, then compare against `X-Hub-Signature-256` using a constant-time string comparison helper.
- Webhook endpoint should acknowledge non-`push` events with 200 (`acknowledged` but not processed) and only enqueue `push` payloads to `WEBHOOK_QUEUE`.

### SubmissionDO design for idempotent queue processing
- Submission Durable Object should initialize SQLite tables inside `this.ctx.blockConcurrencyWhile()` and include:
  - `submissions` (unique per `hackathon_id + team_id`)
  - `deliveries` (dedup by `delivery_id`)
  - `linked_repos` (repo mapping per hackathon/team)
- Queue-driven submit path should first verify repo linkage, then short-circuit duplicate delivery IDs (200 already processed), then `INSERT OR REPLACE` submission rows for idempotent updates.
- A locked submission status can be enforced by rejecting `/submit` when existing row has `status = 'locked'`.

### Worker route + queue integration pattern
- Authed submission routes should use `Hono<AuthAppEnv>` + `authMiddleware` and call SubmissionDO via `env.SUBMISSION.idFromName(hackathonId)`.
- Repo linking endpoint should enforce captain-only authorization from D1 (`teams.captain_id === user.sub`), then update both SubmissionDO (`/link-repo`) and KV (`repo:{full_name}` -> `{ hackathonId, teamId }`).
- Queue consumer flow: parse message -> KV repo mapping lookup -> LifecycleDO `/state` gate (`HACKING` only) -> forward to SubmissionDO `/submit` -> ack/retry per outcome.

### Routing consistency
- Hackathon-scoped submission endpoints are best mounted under `/api/hackathons` so route definitions like `/:id/submissions` resolve to `/api/hackathons/:id/submissions`.

## Task 12: Frontend Dashboards & Team Management (2026-02-06)

### Shadcn/UI Patterns
- **Manual Component Creation**: Components like Tabs must be created manually in `components/ui/` using standard shadcn/ui patterns (wrapping Radix primitives, using `cn()`, `forwardRef`).
- **Dependencies**: Primitives (e.g., `@radix-ui/react-tabs`) must be installed in `apps/web`, not root.

### Frontend Data Patterns
- **User Team Lookup**: API lacks a direct "my-team" endpoint. Pattern used: Fetch full team list for hackathon (`GET /hackathons/:id/teams`) -> filter client-side by `captain_id === user.id || members.includes(user.id)`.
  - *Tech Debt*: This scales poorly. Future enhancement should add `GET /hackathons/:id/my-team`.
- **Repo Linking**: "owner/repo" string format validation done client-side before POST.
- **State Management**: Local state (`useState`) + `useEffect` fetcher + `useCallback` wrapper used for simple page data. No global store needed for this scale.

### Build Verification
- **Turbo Build**: `pnpm turbo build --filter=@devsage/web` ensures all components and pages compile correctly. This catches missing imports or type errors across the project.
