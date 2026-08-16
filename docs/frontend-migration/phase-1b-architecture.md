# DevSage Frontend Migration - Phase 1B Local Architecture

**Updated:** 2026-08-16  
**Branch:** `frontend-migration-phase-1`  
**Status:** Architecture approved for implementation  
**Depends on:** `docs/frontend-migration/phase-1-api-audit.md`

---

## 1. Purpose

Phase 1 proved that the DevSage backend can be removed only if the product is
reframed as a local-first, single-browser demo and management experience.
Phase 1B defines the architecture for that local runtime.

The goal is not to rewrite every frontend feature at once. The goal is to
introduce one shared local data package that can eventually stand behind the
existing frontend API boundary.

Current backend path:

```text
apiRequest
   |
   v
HTTP
   |
   v
Cloudflare Worker
   |
   v
Hono routes
   |
   v
D1 / KV / Queues / Durable Objects / SMTP / Webhooks
```

Target local path:

```text
apiRequest
   |
   v
LocalDataAdapter
   |
   v
Repository
   |
   v
IndexedDB
```

The frontends should continue to think in terms of DevSage resources:
hackathons, workspaces, teams, submissions, rounds, judges, scores,
announcements, notifications, invites, and activity.

---

## 2. Current Workspace Findings

The monorepo already supports a new package under `packages/*`.

`pnpm-workspace.yaml` includes:

```yaml
packages:
  - apps/api
  - apps/admin
  - apps/judge
  - apps/platform
  - apps/web
  - packages/*
```

Existing local packages:

```text
packages/config
packages/db
packages/shared
```

`@devsage/shared` is a private ESM package that exports built `dist` files:

```json
{
  "name": "@devsage/shared",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

`@devsage/shared` currently exports Zod schemas and inferred types from:

```text
packages/shared/src/schemas
```

This includes domain schemas for users, hackathons, workspaces, teams,
submissions, judging, rounds, audit, notifications, commits, and force-push
records.

Dexie is not currently installed anywhere in the repo.

---

## 3. Architectural Decision

Create a new package:

```text
packages/local-data
```

This package owns all frontend-only persistence and local API behavior.

It should:

- Use IndexedDB through Dexie.
- Reuse `@devsage/shared` schemas and inferred types wherever practical.
- Return DevSage-style response envelopes:
  - `{ ok: true, data, meta? }`
  - `{ ok: false, error: { code, message, details? } }`
- Preserve existing endpoint semantics where they are correct.
- Avoid blindly reproducing known route drift or backend bugs.
- Provide deterministic seeded demo data.
- Keep browser-only concerns out of `@devsage/shared`.

It should not:

- Touch `apps/api` in Phase 1B.
- Modify frontend `apps/*/src/lib/api.ts` files in Phase 1B.1.
- Store secrets in frontend code.
- Claim production-grade authentication or authorization.
- Attempt to preserve real OAuth, SMTP, webhooks, queues, or Durable Object
  behavior.

---

## 4. Package Shape

Final target shape:

```text
packages/local-data/
├── package.json
├── tsconfig.json
└── src/
    ├── db/
    │   ├── database.ts
    │   └── schema.ts
    │
    ├── repositories/
    │   ├── users.ts
    │   ├── workspaces.ts
    │   ├── hackathons.ts
    │   ├── teams.ts
    │   ├── submissions.ts
    │   ├── judging.ts
    │   ├── rounds.ts
    │   ├── announcements.ts
    │   └── notifications.ts
    │
    ├── session/
    │   └── session-store.ts
    │
    ├── seed/
    │   └── demo-data.ts
    │
    ├── adapter.ts
    └── index.ts
```

Phase 1B.1 should create only:

```text
packages/local-data/
├── package.json
├── tsconfig.json
└── src/
    ├── db/
    │   └── database.ts
    └── index.ts
```

Repositories, seed data, and route-compatible adapter code should come after
the package can build and a minimal IndexedDB write/read test is proven from a
frontend app.

---

## 5. Package Manifest

Recommended `packages/local-data/package.json`:

```json
{
  "name": "@devsage/local-data",
  "version": "0.1.0",
  "description": "Local IndexedDB data adapter for frontend-only DevSage runtime",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "@devsage/shared": "workspace:*",
    "dexie": "^4.0.0"
  },
  "devDependencies": {
    "@devsage/config": "workspace:*",
    "typescript": "^5.7.0",
    "vitest": "^3.2.4"
  }
}
```

Dexie should live in `@devsage/local-data`, not in every frontend app, unless a
specific frontend imports Dexie APIs directly. The frontends should import
DevSage local-data functions, not Dexie tables.

---

## 6. TypeScript Configuration

Recommended `packages/local-data/tsconfig.json`:

```json
{
  "extends": "@devsage/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

The DOM libs are needed because IndexedDB is a browser API.

---

## 7. Database Layer

`src/db/database.ts` should define one Dexie database class.

Initial Phase 1B.1 database:

```typescript
import Dexie, { type Table } from 'dexie';

export interface LocalMetaRecord {
  key: string;
  value: unknown;
  updated_at: string;
}

export class DevSageLocalDatabase extends Dexie {
  meta!: Table<LocalMetaRecord, string>;

  constructor() {
    super('devsage-local');

    this.version(1).stores({
      meta: 'key, updated_at',
    });
  }
}

export const db = new DevSageLocalDatabase();
```

The initial `meta` table gives Phase 1B.1 a safe proof point:

```text
Platform imports @devsage/local-data
   |
   v
writes a meta record
   |
   v
reads the same record
   |
   v
proves package + IndexedDB + frontend integration
```

No domain tables should be added until the basic package integration works.

---

## 8. Final IndexedDB Schema

The final schema should cover the data categories from the Phase 1 audit:

```text
meta
users
sessions
roles
workspaces
workspaceMembers
workspaceInvites
hackathonRequests
hackathons
organizerRoles
teams
teamMembers
teamInvites
teamRepos
submissions
rounds
roundResults
rubrics
judges
judgeAssignments
judgeTracks
scores
conflicts
announcements
notifications
activity
adminInvites
```

Suggested Dexie indexes:

```text
users: id, email
sessions: id, user_id, current
roles: id, user_id, scope, scope_id, role
workspaces: id, slug, created_at
workspaceMembers: id, workspace_id, user_id, role
workspaceInvites: id, token, workspace_id, email, status
hackathonRequests: id, workspace_id, requested_by, status, created_at
hackathons: id, slug, workspace_id, status, created_at
organizerRoles: id, hackathon_id, user_id, role
teams: id, hackathon_id, invite_code, status
teamMembers: id, team_id, user_id, role
teamInvites: id, token, team_id, email, status
teamRepos: id, team_id, repo_full_name
submissions: id, hackathon_id, team_id, round_id, is_current, submitted_at
rounds: id, hackathon_id, round_number, status
roundResults: id, round_id, team_id, rank, status
rubrics: id, hackathon_id, sort_order
judges: id, hackathon_id, user_id, status
judgeAssignments: id, judge_id, submission_id, status
judgeTracks: id, judge_id, track
scores: id, assignment_id, judge_id, submission_id, criterion_id
conflicts: id, assignment_id, judge_id, status
announcements: id, hackathon_id, created_at
notifications: id, user_id, is_read, created_at
activity: id, hackathon_id, actor_id, action, created_at
adminInvites: id, email, token, status
```

These tables intentionally mirror the product model, not the exact D1 schema.
Browser storage is the source of local demo behavior, not a production database.

---

## 9. Repository Layer

Repositories should be small modules with domain operations. They should not
know about URL paths.

Example responsibilities:

| Repository | Responsibilities |
|---|---|
| `users.ts` | Demo users, role lookup, profile updates, password-change flag |
| `workspaces.ts` | Workspace CRUD, members, transfers, workspace invites |
| `hackathons.ts` | Hackathon CRUD, list/detail, lifecycle transition simulation |
| `teams.ts` | Team list/detail, local team creation, members, invites, seed teams |
| `submissions.ts` | Submission list/detail/current, optional GitHub public metadata |
| `judging.ts` | Judges, rubrics, assignments, conflicts, scores, leaderboard |
| `rounds.ts` | Round CRUD, initialization, results, publish, advancement |
| `announcements.ts` | Announcement CRUD |
| `notifications.ts` | Notification list, unread count, mark read/all read |

Repositories should return plain data objects. The adapter layer should wrap
them in API-compatible response envelopes.

---

## 10. Session Store

`src/session/session-store.ts` should own local identity state.

Minimum state:

```typescript
export interface LocalSession {
  user_id: string;
  active_role?: 'platform_admin' | 'organizer' | 'judge' | 'participant';
  created_at: string;
  updated_at: string;
}
```

Recommended behavior:

- Store the current session in IndexedDB `sessions`.
- Optionally mirror the active session ID in `localStorage` for fast startup.
- `login` selects or creates a demo user.
- `logout` clears the active session.
- `me` resolves:
  - `user`
  - `isPlatformAdmin`
  - `isOrganizer`
  - `isJudge`
  - `hackathonRoles`
  - `workspaceRoles`
  - `password_must_change`

Security note: this is UI state only. It is not authentication.

---

## 11. Seed Data

`src/seed/demo-data.ts` should initialize a realistic demo world:

- One platform admin.
- One workspace owner.
- One co-organizer.
- Two judges.
- Several participant/team users.
- Two workspaces.
- Three hackathons across different lifecycle states.
- Teams, team members, repos, submissions, rounds, rubrics, assignments,
  scores, announcements, notifications, and activity records.

Seed data must be deterministic:

- Stable IDs.
- Stable slugs.
- Stable invite tokens.
- Stable timestamps relative to a fixed seed timestamp where possible.

This makes frontend screenshots, tests, and user walkthroughs predictable.

---

## 12. Adapter Layer

The eventual adapter should route known API paths to local repository calls.

Conceptual API:

```typescript
export async function localApiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  // Parse method + URL path.
  // Dispatch to repository.
  // Return DevSage response envelope.
}
```

The adapter should support:

- Method parsing: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.
- Query string parsing for `limit`, `offset`, and filters.
- JSON body parsing.
- Consistent `ApiError`-style failures.
- `204`-compatible empty responses where needed.
- DevSage response envelopes.

The adapter should not live in frontend components. Components should continue
to call their app-level `apiRequest` function until the compatibility boundary
is intentionally switched.

---

## 13. Compatibility Boundary

Do not modify these files during Phase 1B.1:

```text
apps/web/src/lib/api.ts
apps/platform/src/lib/api.ts
apps/admin/src/lib/api.ts
apps/judge/src/lib/api.ts
```

Those files are the future switch point.

The migration sequence should be:

1. Build `@devsage/local-data`.
2. Prove it can build independently.
3. Prove one frontend can import it.
4. Prove IndexedDB write/read works in that frontend.
5. Add repositories.
6. Add route-compatible local adapter.
7. Switch app `apiRequest` functions one app at a time.

This keeps frontend components stable while replacing the runtime beneath them.

---

## 14. Route Drift Policy

The local adapter should not blindly reproduce every current frontend/backend
inconsistency.

Known drift from Phase 1:

```text
apps/platform/src/pages/invite-accept.tsx
  calls:
    GET  /api/v1/invites/:code
    POST /api/v1/invites/:code/accept

apps/api/src/routes/invites.ts
  implements:
    POST /api/v1/invites/team/:token
    GET  /api/v1/invites/judge/:id/details
    POST /api/v1/invites/judge/:id
    POST /api/v1/invites/judge/:id/decline
    GET  /api/v1/invites/judge/token/:token
    POST /api/v1/invites/judge/token/:token/accept
    POST /api/v1/invites/judge/token/:token/decline
```

Policy:

- Prefer routes currently used by frontend screens when preserving UI behavior.
- Prefer canonical resource names for new local adapter code.
- Document any intentionally supported compatibility aliases.
- Do not treat route drift as backend truth.

---

## 15. Data Validation

`@devsage/local-data` should import schemas from `@devsage/shared` for:

- Input validation where existing schemas match the UI payload.
- Response shape validation in tests.
- Type inference for local records when practical.

Example shared types already available:

```typescript
import type {
  HackathonResponse,
  LoginRequest,
  UserResponse,
} from '@devsage/shared';
```

Where local-only records differ from API responses, define local record types in
`@devsage/local-data`, then map them to shared API response types at repository
or adapter boundaries.

---

## 16. Error Model

The local adapter should preserve the backend envelope shape:

```typescript
export interface LocalSuccess<T> {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface LocalFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

Recommended local error codes:

```text
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
CONFLICT
UNSUPPORTED_ROUTE
LOCAL_STORAGE_UNAVAILABLE
```

Frontend `apiRequest` wrappers currently throw `ApiError` for non-OK HTTP
responses. When the local adapter is wired in, it should either throw equivalent
errors or provide a small compatibility helper that preserves current caller
behavior.

---

## 17. Persistence and Versioning

IndexedDB schema changes must be versioned through Dexie:

```typescript
this.version(1).stores({
  meta: 'key, updated_at',
});

this.version(2).stores({
  users: 'id, email',
  workspaces: 'id, slug, created_at',
});
```

Rules:

- Never delete user/demo data during ordinary app startup.
- Provide an explicit reset helper for demo resets.
- Store the seed version in `meta`.
- Run seed migrations only when the stored seed version is older.
- Keep migration steps deterministic.

Recommended meta keys:

```text
schema_version
seed_version
last_seeded_at
active_session_id
```

---

## 18. Testing Strategy

Phase 1B testing should scale in layers.

Package-level tests:

- Database opens successfully.
- Meta write/read works.
- Seed is idempotent.
- Repository CRUD works per domain.
- Leaderboard calculation is deterministic.
- Route adapter maps endpoint/method combinations correctly.

Frontend integration tests:

- One app can import `@devsage/local-data`.
- One page can perform write/read through the package.
- Existing login/dashboard flows work after the adapter switch.

Manual verification:

- Browser IndexedDB contains expected tables.
- Reload preserves local data.
- Demo reset clears and reseeds state.
- Multi-app usage shares the same IndexedDB database name.

---

## 19. Rollout Plan

### Phase 1B.1 - Foundation

Create:

```text
packages/local-data/package.json
packages/local-data/tsconfig.json
packages/local-data/src/db/database.ts
packages/local-data/src/index.ts
```

Install Dexie in `@devsage/local-data`.

Verify:

```powershell
pnpm --filter @devsage/local-data build
```

Then import it from Platform in a small temporary proof point and verify:

```text
write meta record -> read same meta record
```

### Phase 1B.2 - Seed and Session

Add:

```text
src/seed/demo-data.ts
src/session/session-store.ts
```

Verify local login/logout/me without touching the backend.

### Phase 1B.3 - Public Read Models

Add repositories for:

```text
hackathons
teams
submissions
rounds
rubrics
announcements
leaderboard
```

These unblock `apps/web` and read-only parts of Platform/Judge.

### Phase 1B.4 - Mutation Workflows

Add repositories for:

```text
workspaces
hackathonRequests
judging
notifications
invites
activity
```

These unblock Platform, Admin, and Judge workflows.

### Phase 1B.5 - API Compatibility Switch

Switch app `apiRequest` functions one at a time:

```text
web -> platform -> judge -> admin
```

Each switch should be independently buildable and reversible.

---

## 20. Success Criteria

Phase 1B is complete when:

- `@devsage/local-data` exists as a workspace package.
- The package builds with TypeScript.
- Dexie-backed IndexedDB opens in a frontend app.
- A frontend app can write and read through the package.
- Seed/session architecture is documented and ready.
- No backend files are required for local data operation.
- No secrets are introduced into frontend code.
- The compatibility-boundary files remain untouched until the adapter is ready.

---

## 21. Non-Goals

Phase 1B does not attempt to:

- Delete `apps/api`.
- Rebuild every repository.
- Switch every frontend route to local data.
- Preserve real authentication security.
- Preserve real email, OAuth, webhooks, queues, or Durable Objects.
- Solve multi-user synchronization.
- Reconcile every route drift immediately.

Those are later migration decisions.

---

## 22. Recommended Next Action

Implement Phase 1B.1 only:

1. Add `packages/local-data`.
2. Add Dexie as the package dependency.
3. Create the minimal `meta` table.
4. Export `db` and small proof helpers.
5. Build the package.
6. Prove one frontend can write/read the same value from IndexedDB.

After that proof passes, add repositories deliberately.
