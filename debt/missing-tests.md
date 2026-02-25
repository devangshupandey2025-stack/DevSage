# Missing Test Coverage

## API Routes Without Tests (4 of 17 route files)

| Route File | Endpoints | Priority | Notes |
|------------|-----------|----------|-------|
| `auth.ts` | 19 endpoints (register, login, OAuth, refresh, logout, sessions, password reset, email verify) | 🔴 **High** | Auth is security-critical. Most complex route file. |
| `announcements.ts` | 4 endpoints (CRUD) | 🟡 Medium | Simple CRUD, lower risk |
| `hackathon-requests.ts` | 7 endpoints (create, list, admin review, resubmit) | 🟡 Medium | Important for workspace provisioning flow |
| `judge-portal.ts` | 1 endpoint (list judge's hackathons) | 🟢 Low | Simple read-only endpoint |

## API Routes WITH Tests (13 of 17) ✅

`admin`, `audit`, `hackathons`, `invites`, `judging`, `notifications`, `organizers`, `rounds`, `submissions`, `teams`, `team-repos`, `webhooks`, `workspaces`

## Frontend Apps Without Tests

| App | Pages | Components | Priority |
|-----|-------|------------|----------|
| `apps/web` | 7 pages | 8+ components | 🟡 Medium — Public-facing, highest traffic |
| `apps/platform` | 19 pages | 10+ components | 🟡 Medium — Core organizer workflows |
| `apps/admin` | 11 pages | 5+ components | 🟢 Low — Internal tool, fewer users |
| `apps/judge` | 8 pages | 5+ components | 🟡 Medium — Scoring accuracy matters |

## Packages Without Tests

| Package | Has Config | Has Files | Notes |
|---------|-----------|-----------|-------|
| `packages/shared` | ✅ | ✅ 1 file | `schemas.test.ts` exists — adequate |
| `packages/db` | ❌ | ❌ | No tests. Schema-only package, low priority. |
| `packages/config` | ❌ | ❌ | Config package, tests not needed. |

## Recommended Test Priority Order

1. **`auth.ts` route tests** — 19 endpoints, security-critical, complex OAuth + token rotation logic
2. **`hackathon-requests.ts` route tests** — Workspace provisioning pipeline, admin approval flow
3. **`apps/web` component tests** — Public site, at minimum: home page, hackathon listing, hackathon detail
4. **`apps/judge` component tests** — Scoring interface correctness matters for fairness
5. **`announcements.ts` route tests** — Simple CRUD, quick win
6. **`apps/platform` component tests** — Many pages but internal tool
