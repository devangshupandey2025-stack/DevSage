# Backend Overview

Current state of the API (`apps/api/`) and what needs to be built.

## What Exists

### Routes (19 files, ~120 endpoints)
| File | Endpoints | Status |
|------|-----------|--------|
| `auth.ts` | register, login, OAuth (GitHub+Google), refresh, logout, me, password-reset | Complete |
| `two-factor.ts` | 2FA setup, verify, disable, backup codes | Complete |
| `hackathons.ts` | CRUD, transition, template application | Complete |
| `teams.ts` | CRUD, invites, leadership transfer, seeding | Complete (gaps: elimination, disbanding) |
| `submissions.ts` | CRUD, GitHub repo listing, submission locking via DO | Complete (gaps: 9 DB fields) |
| `judging.ts` | Rubric CRUD, scoring, leaderboard, judge assignment | Partial (gaps: time windows, guidelines) |
| `rounds.ts` | CRUD, initialization, team advancement | Partial (gaps: scoring windows) |
| `workspaces.ts` | CRUD, member management, invites | Partial (gaps: deletion, ownership transfer) |
| `hackathon-requests.ts` | Submit, review, approve/reject, resubmit | Complete |
| `templates.ts` | CRUD (settings, tracks, rounds, rubric) | Complete |
| `admin.ts` | Users, hackathons, admin management, stats | Complete |
| `notifications.ts` | CRUD, preferences | Partial (gap: preference enforcement) |
| `announcements.ts` | CRUD, notification dispatch | Complete |
| `organizers.ts` | Add/list/remove organizer roles | Complete |
| `audit.ts` | Cursor-paginated audit retrieval | Complete |
| `judge-portal.ts` | List assigned hackathons | Complete |
| `team-repos.ts` | Link GitHub repo, manage repos | Complete |
| `invites.ts` | Team, judge, workspace invite acceptance | Complete |
| `webhooks.ts` | GitHub webhook receiver (HMAC verified) | Complete |

### Infrastructure
- **Middleware**: 10 files (CORS, CSRF, auth, rate-limit, error-handler, role, platform-admin, hackathon, cache, request-id)
- **Services**: 4 files (github, email, smtp, judging-service)
- **Queue handlers**: 7 files (notifications, push, tag-create, tag-delete, installation)
- **Durable Objects**: 1 (HackathonStateMachine — 5-state lifecycle)
- **Cron**: Hourly (deadline checks, reminders, audit backfill)
- **Tests**: 24 files, 223 passing

### Database
- 48 tables across 46 schema files
- 4 migrations applied (schema, seed, indexes, phase5 features)
- 262 raw SQL `.prepare()` calls — Drizzle ORM unused at runtime

## What's Missing

### Critical Debt (4 items)
1. `getInstallationToken()` stub — GitHub App broken
2. Bearer path trusts JWT claims without DB verification
3. SMTP credentials logged plaintext
4. Dev-mode detection leaks stack traces

### Feature Gaps (13 items)
| ID | Feature | Effort | Dependency |
|----|---------|--------|------------|
| GAP-001 | Billing & subscription (Stripe) | XL | None |
| GAP-003 | Hackathon registration on branded sites | L | GitHub integration |
| GAP-004 | Judging time window enforcement | M | None |
| GAP-005 | Judge guidelines enforcement | S | None |
| GAP-006 | Analytics backend API | L | None |
| GAP-007 | Eliminated team notifications & disbanding | M | None |
| GAP-008 | Per-round submission tag patterns | S | None |
| GAP-010 | Workspace deletion endpoint | S | None |
| GAP-011 | Ownership transfer endpoint | S | None |
| GAP-012 | Notification preferences enforcement | M | None |
| GAP-013 | Submission schema gaps (9 fields) | M | None |

### Architecture Debt
- Fat controllers (no service layer) — all business logic in route handlers
- 262 raw SQL calls — no query builder abstraction
- Duplicate state: `VALID_TRANSITIONS` in routes + DO
- 15+ magic numbers scattered across codebase
