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

