# DevSage Frontend Migration - Phase 1 API Audit

**Updated:** 2026-08-16  
**Codebase audited:** `apps/web`, `apps/platform`, `apps/admin`, `apps/judge`, `apps/api`  
**Goal:** Remove the runtime dependency on the DevSage backend while preserving
frontend functionality wherever technically possible.

---

# 1. Frontend Applications

## Web

API client: `apps/web/src/lib/api.ts`

- Uses `VITE_API_ORIGIN` when present.
- Does not send cookies.
- Does not refresh sessions.
- Current API usage is public-only:
  - `GET /api/v1/hackathons`
  - `GET /api/v1/hackathons/:slug`
- A team registration call is present only as commented code in
  `apps/web/src/pages/hackathon-detail.tsx`.

Migration impact: low. This app can become static/data-file backed with the
least behavioral loss.

## Platform

API client: `apps/platform/src/lib/api.ts`

- Uses `VITE_API_URL` or `VITE_API_ORIGIN`.
- Sends `credentials: 'include'`.
- On non-auth `401`, calls `POST /auth/refresh`, retries once, and redirects
  to `/login` on refresh failure.
- Auth context reads `GET /auth/me` and writes `POST /auth/logout`.

Current API usage includes workspaces, hackathon requests, hackathon CRUD,
lifecycle transitions, judging, rounds, teams, submissions, organizers,
announcements, audit, notifications, and invite acceptance.

Migration impact: high. This app is an organizer/admin workflow surface and
depends on authenticated mutation-heavy state.

## Admin

API client: `apps/admin/src/lib/api.ts`

- Same cookie/refresh behavior as Platform.
- Auth context reads `GET /auth/me` and writes `POST /auth/logout`.
- Current API usage is platform-admin only:
  - users
  - admins
  - invites
  - workspaces
  - hackathons
  - hackathon requests
  - audit backfill
  - system stats

Migration impact: very high. Most features are server-administration features
and do not have a meaningful static equivalent beyond mock/demo state.

## Judge

API client: `apps/judge/src/lib/api.ts`

- Same cookie/refresh behavior as Platform.
- Auth context reads `GET /auth/me`, writes `POST /auth/logout`, and redirects
  judges with `password_must_change` to `/change-password`.
- Current API usage includes judge login, forced password change, judge
  hackathon list, invite acceptance, scoring assignments, conflict of interest
  declarations, score submission, leaderboard, notifications, and personal
  scores.

Migration impact: high. It can be made usable as a local scoring/demo portal,
but real judging requires server-side identity, assignments, and persistence.

---

# 2. API Dependency Matrix

| App | Feature | Endpoint(s) | Method(s) | Data | Replacement | Priority |
|---|---|---|---|---|---|---|
| web | Browse hackathons | `/api/v1/hackathons` | GET | Public hackathon list | Static JSON seed or IndexedDB cache | P0 |
| web | Hackathon detail | `/api/v1/hackathons/:slug` | GET | Public hackathon detail | Static JSON by slug | P0 |
| platform | Session bootstrap | `/auth/me`, `/auth/refresh`, `/auth/logout` | GET, POST | User, roles, workspace roles, hackathon roles | Local demo identity store | P0 |
| platform | Login | `/auth/login` | POST | Email/password auth cookies | Local demo login or remove auth gate | P0 |
| platform | Workspaces | `/api/v1/workspaces`, `/api/v1/workspaces/:id`, `/api/v1/workspaces/:id/transfer`, `/api/v1/workspaces/:id/invites`, `/api/v1/workspaces/invites/token/:token/*` | GET, POST, DELETE | Workspace records, membership, invites | IndexedDB CRUD; token invites simulated | P0 |
| platform | Hackathon requests | `/api/v1/hackathon-requests`, `/api/v1/hackathon-requests/:id/resubmit` | GET, POST, PUT | Organizer request queue | IndexedDB workflow | P0 |
| platform | Hackathons | `/api/v1/hackathons`, `/api/v1/hackathons/:slug`, `/api/v1/hackathons/:slug/transition` | GET, POST, PATCH, DELETE | Hackathon settings and lifecycle | IndexedDB CRUD plus client state machine | P0 |
| platform | Teams | `/api/v1/hackathons/:slug/teams`, `/api/v1/hackathons/:slug/teams/:teamId`, `/api/v1/hackathons/:slug/teams/seed` | GET, POST | Team roster and generated teams | IndexedDB CRUD; seed locally | P1 |
| platform | Submissions | `/api/v1/hackathons/:slug/submissions`, `/api/v1/hackathons/:slug/submissions/:id` | GET | Submission list/detail | Static seed plus IndexedDB edits | P1 |
| platform | Rounds | `/api/v1/hackathons/:slug/rounds`, `/api/v1/hackathons/:slug/rounds/:roundId`, `/initialize`, `/publish`, `/results`, `/advance` | GET, POST, PATCH, DELETE | Round definitions, results, advancement | IndexedDB plus deterministic scoring simulation | P0 |
| platform | Judging setup | `/api/v1/hackathons/:slug/judging/judges`, `/judges/create-account`, `/judges/:id/accept`, `/judges/:id/assignments`, `/assign`, `/coi`, `/assignments/:id/reassign` | GET, POST | Judges, assignments, conflicts | IndexedDB workflow; email/invite delivery simulated | P0 |
| platform | Rubric | `/api/v1/hackathons/:slug/judging/rubric`, `/rubric/:criterionId` | GET, POST, DELETE | Criteria, max score, weights | IndexedDB CRUD | P0 |
| platform | Scoring | `/api/v1/hackathons/:slug/judging/submissions/:submissionId/scores`, `/my-assignments`, `/leaderboard` | GET, POST | Score entries and leaderboard | IndexedDB scoring; leaderboard computed client-side | P0 |
| platform | Organizers | `/api/v1/hackathons/:slug/organizers` | GET | Organizer role list | Local role table | P1 |
| platform | Announcements | `/api/v1/hackathons/:slug/announcements`, `/announcements/:id` | GET, POST, PATCH, DELETE | Public announcements | IndexedDB CRUD | P1 |
| platform | Audit | `/api/v1/hackathons/:slug/audit` | GET | Mutation history/hash-chain metadata | Client-generated activity log without cryptographic guarantees | P2 |
| platform | Notifications | `/api/v1/notifications`, `/unread-count`, `/:id/read`, `/read-all` | GET, PATCH | In-app notifications | IndexedDB notifications | P1 |
| platform | Invites | Frontend calls `/api/v1/invites/:code`, `/api/v1/invites/:code/accept`, `/api/v1/invites/judge/:token/details`, `/api/v1/invites/judge/:token`; backend implements team token and judge invite routes, but not the generic `/:code` routes | GET, POST | Team/judge invite data | Simulated token lookup in IndexedDB | P1 |
| admin | Session/login | `/auth/me`, `/auth/login`, `/auth/refresh`, `/auth/logout` | GET, POST | Admin identity and cookies | Local demo admin identity | P0 |
| admin | Dashboard stats | `/api/v1/admin/stats`, `/api/v1/hackathon-requests/admin/stats` | GET | Aggregate counts | Compute from IndexedDB seed | P0 |
| admin | Audit backfill | `/api/v1/admin/audit/backfill` | POST | Server-side processed count | Remove or simulate no-op | P2 |
| admin | Platform admins | `/api/v1/admin/admins`, `/api/v1/admin/admins/:userId` | GET, POST, DELETE | Admin users | IndexedDB admin list | P1 |
| admin | Users | `/api/v1/admin/users` | GET | Paginated users | Static/IndexedDB users | P1 |
| admin | Admin invites | `/api/v1/admin/invites`, `/api/v1/admin/invites/:id` | GET, POST, DELETE | Platform admin invites | IndexedDB invite table | P1 |
| admin | Hackathon requests | `/api/v1/hackathon-requests/admin/stats`, `/api/v1/hackathon-requests/admin/all`, `/api/v1/hackathon-requests/admin/:id` | GET, PATCH | Review queue/status updates | IndexedDB review workflow | P0 |
| admin | Hackathons | `/api/v1/admin/hackathons`, `/api/v1/admin/hackathons/:id`, `/rounds`, `/rounds/:roundId/initialize` | GET, PATCH | Admin view of hackathons/rounds | IndexedDB read/update | P1 |
| admin | Workspaces | `/api/v1/admin/workspaces`, `/api/v1/admin/workspaces/:id`, `/api/v1/workspaces/:id/invites` | GET, POST | Workspaces and invites | IndexedDB CRUD | P1 |
| judge | Session/login | `/auth/me`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/change-password` | GET, POST | Judge identity, forced password flag | Local judge identity; forced-password flag simulated | P0 |
| judge | Judge dashboard | `/api/v1/judge/hackathons` | GET | Hackathons assigned to current judge | Derived from local assignments | P0 |
| judge | Invite acceptance | `/api/v1/invites/judge/token/:token`, `/accept`, `/decline` | GET, POST | Invite details and account creation | Simulated invite token table | P1 |
| judge | Scoring context | `/api/v1/hackathons/:slug`, `/judging/rubric`, `/judging/my-assignments`, `/rounds` | GET | Hackathon, rubric, assignments, rounds | IndexedDB/static data | P0 |
| judge | Score submission | `/api/v1/hackathons/:slug/judging/submissions/:submissionId/scores` | POST | Judge scores | IndexedDB score writes | P0 |
| judge | Conflict of interest | `/api/v1/hackathons/:slug/judging/assignments/:assignmentId/coi` | POST | Assignment COI status | IndexedDB status update | P1 |
| judge | My scores | `/api/v1/hackathons/:slug/judging/my-scores` | GET | Submitted score history | Derived from local score table | P0 |
| judge | Leaderboard | `/api/v1/hackathons/:slug/judging/leaderboard` | GET | Ranked scores | Client computed from local scores | P1 |
| judge | Notifications | `/api/v1/notifications`, `/unread-count`, `/:id/read`, `/read-all` | GET, PATCH | Judge notifications | IndexedDB notifications | P1 |

---

# 3. Authentication

| Feature | Current Implementation | Frontend Replacement |
|---|---|---|
| Login | `POST /auth/login` checks D1 users/password hash and sets HttpOnly `access_token` and refresh cookies. Used by platform/admin/judge login pages. | Replace with a local demo account selector or email/password form backed by IndexedDB. No real security claims. |
| Logout | `POST /auth/logout` revokes refresh token family and clears cookies. | Clear local identity/session state. |
| Session | `GET /auth/me` resolves the current user from HttpOnly cookies and returns roles. API clients call `POST /auth/refresh` after non-auth `401`. | Store `currentUserId` and active role in localStorage/IndexedDB; remove refresh retry or make it a no-op. |
| Roles | Backend resolves platform admin, organizer, judge, team, and workspace roles from D1 per request. Roles are not trusted from JWT alone. | Local role records in IndexedDB. Good enough for UX branching, not authorization. |
| OAuth | Backend supports Google and GitHub OAuth via `/auth/google`, `/auth/callback/google`, `/auth/github`, `/auth/callback/github`, with state in KV. | Remove, link out, or simulate with fixed local users. Cannot be preserved in a static-only app. |
| Cookies | HttpOnly cookies are set server-side and sent via `credentials: 'include'`. | Use localStorage/IndexedDB only. This changes the threat model and should be documented in UI/dev docs. |
| Password reset / verification / 2FA | Backend routes use D1, KV, OTP generation, email, and TOTP/recovery-code logic. Current frontends use only `change-password` in judge. | Keep only local `change-password` behavior if needed. Remove or simulate the rest. |

---

# 4. Persistent Data

| Data | Current Storage | Replacement |
|---|---|---|
| Users | D1 `users`, refresh tokens, platform admins, role tables | IndexedDB `users`, `sessions`, `roles` seeded with demo identities |
| Workspaces | D1 workspaces, workspace members, workspace invites | IndexedDB `workspaces`, `workspaceMembers`, `workspaceInvites` |
| Hackathon requests | D1 request table and admin review status updates | IndexedDB `hackathonRequests`; status transitions handled client-side |
| Hackathons | D1 hackathon records plus Durable Object lifecycle state | Static seed plus IndexedDB `hackathons`; lifecycle simulated in client |
| Organizers | D1 organizer roles | IndexedDB role records |
| Teams | D1 teams, members, invite codes | IndexedDB `teams`, `teamMembers`; invite codes simulated |
| Team repos | D1 repo metadata plus GitHub webhook updates | Store repo URL/name only; optional GitHub public API for public repo display |
| Submissions | D1 submissions, tags, commit SHA, analysis JSON | IndexedDB `submissions`; GitHub-derived metadata optional/public-only |
| Judging | D1 judges, rubrics, assignments, scores, conflicts | IndexedDB `judges`, `rubrics`, `assignments`, `scores`, `coi` |
| Rounds/results | D1 rounds and round result rows | IndexedDB `rounds`; compute results in browser |
| Announcements | D1 announcements | IndexedDB `announcements` |
| Notifications | D1 in-app notifications plus queue-created records | IndexedDB `notifications`; generated synchronously by local actions |
| Audit | D1 audit hash chain | Local activity log without hash-chain integrity |
| OAuth/session state | KV and HttpOnly cookies | Remove or replace with local demo identity |
| Email jobs | Queues and SMTP service | Remove or show local "invite created" messages |

---

# 5. Server-only Features

| Feature | Current Backend | Frontend Replacement |
|---|---|---|
| GitHub OAuth | `/auth/github` and `/auth/callback/github` use OAuth app secrets and KV state. | Cannot run statically. Replace with manual repo URL entry or public GitHub API calls that need no secret. |
| Google OAuth | `/auth/google` and `/auth/callback/google` use OAuth app secrets and KV state. | Cannot run statically. Replace with demo identity. |
| GitHub webhooks | `/webhooks/github` validates HMAC signatures and queues push/tag/installation work. | Remove. Provide manual refresh/import buttons for public repo data if useful. |
| Queues | `github-webhooks` and `devsage-notifications` process async repo and notification/email work. | Replace with synchronous local updates; no background delivery. |
| Durable Objects | `HackathonStateMachine` coordinates lifecycle, submission locking, and deadline alarms. | Client-only state machine in IndexedDB. No cross-user locking or authoritative deadlines. |
| Cron | Hourly scheduled handler transitions deadlines, sends reminders, and backfills audit hashes. | Run checks on app load or via local timers while tab is open only. |
| Email | SMTP service sends invites, OTPs, password resets, notifications. | Remove delivery; display generated links/tokens in UI. |
| Secrets | JWT, OAuth, webhook, SMTP secrets live in Worker env. | No secrets in frontend. Any feature requiring a secret must be removed or moved to a public-only mode. |
| Authorization | Middleware enforces auth, platform admin, and per-hackathon roles. | UI-only role gates. Not secure and not suitable for production multi-user data. |
| Audit integrity | Backend writes hash-chained audit records. | Local activity feed only; integrity guarantee removed. |

---

# 6. Classification

## KEEP CLIENT-SIDE

- Routing, page layout, filters, search, dashboards, tables, forms, modals, and toast flows.
- React Query caching shape, once query functions are pointed at a local data adapter.
- Hackathon lifecycle UI and state labels.
- Round setup, rubric editing, judge assignment screens, scoring UI, and leaderboard display.
- Notification popovers and read/unread interactions.

## STATIC DATA

- Public hackathon catalog for `apps/web`.
- Public hackathon detail pages.
- Demo users, workspaces, teams, submissions, rounds, rubrics, judges, announcements, and initial notifications.
- Help text, templates, judging guidelines, and sample leaderboard rows.

## INDEXEDDB

- Auth/session demo identity.
- Workspaces and workspace membership.
- Hackathon requests and admin review state.
- Hackathons and lifecycle status.
- Teams, invite codes, submissions, rounds, rubrics, judges, assignments, scores, conflicts, announcements, notifications, and local activity log.

Recommended shape: create one shared frontend data adapter in `packages/shared`
or a new local package, then point all four apps at the same browser storage
layer. Avoid duplicating fake API logic per app.

## GITHUB PUBLIC API

- Optional read-only enrichment for public repositories:
  - repo metadata
  - latest commits
  - tags/releases
  - README or language summary
- Must be unauthenticated or user-token based. Do not embed tokens in `VITE_*`.

## SIMULATE

- Login, logout, refresh, `auth/me`, roles, and forced password change.
- Workspace, judge, and admin invite tokens.
- Email delivery by displaying generated links/tokens.
- Audit events as local activity records.
- Queue-created notifications.
- Cron/deadline transitions on app load.
- Hackathon state machine transitions.
- Judge auto-assignment and reassignment.
- Leaderboard computation.
- Admin stats from local data.

## REMOVE

- Real OAuth login.
- Real server-side authorization.
- Real GitHub webhook ingestion.
- Real SMTP/email sending.
- Real refresh-token rotation and token family replay detection.
- Real password reset and email OTP delivery.
- Real 2FA security guarantees.
- Real audit hash-chain integrity.
- Real cross-user concurrency/locking.
- Server-side secrets and any code path requiring them.
- Admin audit backfill as a meaningful operation.

---

# 7. Migration Blockers

- **Authentication semantics change completely.** Current apps rely on HttpOnly
  cookie sessions and backend role resolution. A static frontend can only
  simulate identity and roles.
- **Organizer/admin/judge mutations need a local persistence layer.** Platform,
  Admin, and Judge cannot be preserved with static JSON alone.
- **Multi-user correctness is not possible in-browser.** Role enforcement,
  concurrent judging, submission locks, invite ownership, admin actions, and
  lifecycle deadlines are currently backend responsibilities.
- **Server-only integrations have no safe frontend equivalent.** OAuth secrets,
  SMTP credentials, webhook secrets, JWT secrets, and queue consumers must not
  move into Vite apps.
- **Audit and compliance guarantees are lost.** Local activity records cannot
  replace backend hash-chained audit events.
- **Cross-app data must be centralized.** Four separate SPAs need one shared
  local data adapter or seeded dataset, otherwise behavior will drift quickly.
- **Some frontend calls are already broader than the published docs.** Current
  source includes routes such as judge token invite acceptance, notification
  preferences, submission GitHub analysis routes, additional round result/publish
  routes, and auth password/verification routes. Use source, not only
  `docs/api-contracts.md`, as migration input.
- **There is existing frontend/backend route drift.** For example,
  `apps/platform/src/pages/invite-accept.tsx` calls `GET /api/v1/invites/:code`
  and `POST /api/v1/invites/:code/accept`, while `apps/api/src/routes/invites.ts`
  implements `/team/:token`, `/judge/:id/*`, and `/judge/token/:token/*`.

---

# 8. Phase 1 Conclusion

The backend dependency can be removed only if the product is reframed as a
single-browser demo/local management experience. `apps/web` can become mostly
static with minimal loss. `apps/platform`, `apps/admin`, and `apps/judge` need a
shared IndexedDB-backed data layer plus simulated auth, roles, invites,
notifications, lifecycle transitions, and judging workflows.

Recommended Phase 2 work:

1. Build a shared local data adapter that exposes the same response envelopes as
   `apiRequest`.
2. Seed realistic demo data for all four apps.
3. Replace auth endpoints with local identity/session helpers.
4. Migrate public read-only endpoints first: hackathons, details, rounds,
   rubric, teams, submissions, announcements, leaderboard.
5. Migrate mutation workflows next: workspaces, hackathon requests, judging,
   rounds, scoring, notifications, invites.
6. Remove or clearly mark server-only features that cannot be preserved in a
   static frontend.
