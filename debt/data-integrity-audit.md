# DevSage Data Integrity Audit

**Date:** 2026-02-15  
**Scope:** `packages/db/`, `packages/shared/`, `apps/api/src/routes/`, `apps/api/src/lib/`, `apps/api/src/queue/`  
**Severity Scale:** 🔴 Critical (data loss / runtime errors) · 🟠 High (silent bugs) · 🟡 Medium (technical debt) · 🟢 Low (cosmetic / cleanup)

---

## 1. Executive Summary

The DevSage database layer has **serious schema drift** between three independent sources of truth: the Drizzle ORM definitions (`packages/db/src/schema/`), the actual migration SQL (`0000_schema.sql`), and the raw SQL queries in API routes. The API routes use raw `db.prepare()` SQL — not Drizzle query builder — so the Drizzle schema serves only as a migration generator, not a runtime type guard. This means column-name mismatches between routes and the generated SQL cause **silent `NULL` returns or runtime errors** in production.

**Key findings:**

- **7 critical schema-code mismatches** where routes query columns that don't exist in the migration (e.g., `is_final`, `ai_score`, `track_id` on judges, `invited_at`/`responded_at`, `role` on platform_admins)
- **3 sources of truth for the submissions table** that all disagree (Drizzle schema has `is_current`, migration has `is_current`, routes and test helpers use `is_final`)
- **Migration SQL indexes columns (`sequence`, `action`) that don't exist** in the `audit_events` CREATE TABLE
- **Zod schemas are entirely dead code** — never imported by the API (no `@devsage/shared` imports in any route file)
- **7 database tables are dead** — defined in schema/migrations but never queried by any code
- **Scores table has all FKs set to `ON DELETE no action`** — deleting a judge or submission orphans score rows and breaks FK constraints
- **Account deletion cascade is incomplete** — manual cleanup misses announcements, OTP sessions, and other user-owned rows

---

## 2. Schema-Code Mismatches

### 2.1 Submissions Table — Three Conflicting Schemas 🔴

| Source | Column | Exists? |
|--------|--------|---------|
| Drizzle schema (`packages/db/src/schema/submissions.ts`) | `is_current` | ✅ |
| Migration SQL (`0000_schema.sql:506`) | `is_current` | ✅ |
| API routes (`submissions.ts`, `rounds.ts`) | `is_final` | ❌ Not in migration |
| Test helpers (`helpers.ts:375`) | `is_final` | ✅ (test creates it) |
| Queue handlers (`tag-create-handler.ts:90`) | `is_final`, `is_late`, `repo_full_name`, `webhook_delivery_id`, `commit_message`, `commit_author`, `branch`, `received_at` | ❌ None in migration |

**Affected files:**
- `apps/api/src/routes/submissions.ts:264,265,300,325,426` — queries `is_final`
- `apps/api/src/routes/rounds.ts:219` — queries `is_final`
- `apps/api/src/services/judging-service.ts:20,99` — queries `is_final`
- `apps/api/src/queue/tag-create-handler.ts:77,90` — writes `is_final`, `is_late`, `repo_full_name`, `webhook_delivery_id`
- `apps/api/src/queue/tag-delete-handler.ts:35` — updates `is_final`

**Impact:** Every submission query in production either returns `NULL` for `is_final` (SQLite returns NULL for unknown columns in `SELECT *`) or the test helper schema is the *actual* production schema and the Drizzle schema / migration are stale. Either way, there's a complete disconnect.

### 2.2 Submissions — Ghost Columns `ai_score`, `analysis_json`, `ai_review_json` 🔴

Routes query columns that exist in neither Drizzle schema nor migration:

- `apps/api/src/routes/submissions.ts:296` — `SELECT ... s.ai_score ...`
- `apps/api/src/routes/submissions.ts:300` — `WHERE ... s.ai_score IS NOT NULL`
- `apps/api/src/routes/submissions.ts:311` — returns `ai_score` in response
- `apps/api/src/routes/submissions.ts:348-349` — parses `analysis_json`, `ai_review_json`
- `apps/api/src/routes/submissions.ts:386-388` — TypeScript interface expects these

**Impact:** AI leaderboard endpoint (`GET /ai-leaderboard`) returns empty results because `ai_score IS NOT NULL` always fails. Single submission detail silently swallows parse errors for missing JSON fields.

### 2.3 Judges Table — Missing `track_id`, `invited_at`, `responded_at` 🔴

The Drizzle schema defines judges with: `id, hackathon_id, user_id, email, invite_status, invite_token, invited_by, created_at, accepted_at`

Routes INSERT/SELECT/UPDATE with additional columns:

- `apps/api/src/routes/judging.ts:128` — `INSERT INTO judges (..., track_id, invited_by, invited_at, responded_at)`
- `apps/api/src/routes/judging.ts:199` — `INSERT INTO judges (..., invited_at)`
- `apps/api/src/routes/judging.ts:214` — `SELECT j.track_id, j.invited_at, j.responded_at`
- `apps/api/src/routes/judging.ts:278` — INSERT with `track_id, invited_at, responded_at`
- `apps/api/src/routes/judging.ts:311` — `UPDATE judges SET track_id = ?`
- `apps/api/src/routes/judging.ts:328` — `UPDATE judges SET invite_status = ?, responded_at = ?`
- `apps/api/src/routes/invites.ts:97,226` — `UPDATE judges SET ... responded_at = ?`

**Migration SQL (`0000_schema.sql:469-482`):** judges table has NO `track_id`, `invited_at`, or `responded_at` columns.

**Test helpers (`helpers.ts:328-341`):** creates judges WITH `track_id`, `invited_at`, `responded_at` — confirming routes expect them.

**Impact:** Judge invitations fail with D1 errors on INSERT (binding count mismatch), or silently write NULLs to non-existent columns. Judge listing returns NULL for track/timing data.

### 2.4 Platform Admins — Ghost `role` Column 🟠

- `apps/api/src/routes/admin.ts:43` — `INSERT INTO platform_admins (id, user_id, role, created_by, created_at)`
- Migration (`0000_schema.sql:165-172`): only `id, user_id, added_by, created_at`

**Two mismatches:**
1. Route inserts `role` — column doesn't exist in schema
2. Route uses `created_by` — migration has `added_by`

**Impact:** Adding platform admins may fail with a column-count bind error, or the `role` value is silently discarded.

### 2.5 Audit Events — Missing `sequence`, `action`, `actor_ip`, `actor_user_agent`, `details` 🔴

The `insertAuditEvent()` function (`apps/api/src/lib/audit.ts:40`) inserts:
```sql
INSERT INTO audit_events (id, sequence, hackathon_id, actor_id, actor_type, actor_ip, actor_user_agent, action, entity_type, entity_id, details, changes, hash, prev_hash, created_at)
```

The migration (`0000_schema.sql:613-628`) defines:
```sql
CREATE TABLE audit_events (id, hackathon_id, actor_id, actor_type, event_type, entity_type, entity_id, metadata, changes, hash, prev_hash, created_at)
```

**Column mapping mismatches:**

| Code uses | Migration has | Match? |
|-----------|--------------|--------|
| `sequence` | — | ❌ Missing |
| `action` | `event_type` | ❌ Name mismatch |
| `actor_ip` | — | ❌ Missing |
| `actor_user_agent` | — | ❌ Missing |
| `details` | `metadata` | ❌ Name mismatch |

The migration also creates indexes on non-existent columns:
- `0000_schema.sql:748` — `CREATE INDEX idx_audit_action ON audit_events (action)` — column doesn't exist in CREATE TABLE
- `0000_schema.sql:758` — `CREATE INDEX idx_audit_hackathon_seq ON audit_events (hackathon_id, sequence)` — column doesn't exist

**Impact:** Every audit event insertion fails in production, OR the test helper schema (which includes these columns) is the real production schema and the migration is stale.

### 2.6 Test Helpers as Shadow Schema 🟠

The test helpers file (`apps/api/src/__tests__/helpers.ts`) defines its OWN `CREATE TABLE` statements that serve as the *actual* working schema. This test schema differs significantly from both the Drizzle schema and the migration SQL. The test helpers schema is likely what dev mode uses (since `pnpm dev` resets the local DB), meaning:

- **Drizzle schemas** → used only for `drizzle-kit generate` (migration generation)
- **Migration SQL** → out of date, never regenerated after route changes
- **Test helpers** → the real runtime schema for dev/test
- **Production** → unknown; depends on whether migrations were re-run or manual DDL was applied

---

## 3. Zod-DB Alignment

### 3.1 Zod Schemas Are Dead Code 🟡

No API route file imports from `@devsage/shared`. Grep for `@devsage/shared` and `from.*shared` in `apps/api/src/routes/` returns **zero results**. The Zod schemas exist in `packages/shared/src/schemas/` but are never used for request validation in the API.

Routes do inline validation or no validation at all:
```typescript
// Typical route pattern (no Zod)
const body = await c.req.json();
// Direct use of body.email, body.name, etc. — no schema validation
```

### 3.2 Field Mismatches (if Zod were used)

| Zod Schema | Zod Field | DB Column | Mismatch |
|------------|-----------|-----------|----------|
| `submissionResponseSchema` | `is_current: z.boolean()` | Migration: `is_current integer` / Routes: `is_final` | ❌ Name + type |
| `roundResultResponseSchema` | `advanced: z.boolean()` | DB: `status text` ('advanced'/'eliminated') | ❌ Type mismatch |
| `hackathonResponseSchema` | `tracks: z.string()` | DB: `tracks text` (JSON) | ⚠️ Correct type but semantic mismatch (JSON as string) |
| `hackathonResponseSchema` | `allow_resubmission: z.number()` | DB: `integer` | ✅ Match (SQLite integer → JS number) |
| `userResponseSchema` | `avatar_url: z.string().url().nullable()` | DB `users.avatar_url: text` | ✅ Match |
| `userResponseSchema` | Missing `github_username` | DB has `github_username` | ❌ Missing field |
| `userResponseSchema` | Missing `password_must_change` | DB has `password_must_change` | ❌ Missing field |
| `judgeAssignmentResponseSchema` | `round: z.number().int().default(1)` | DB: `round integer DEFAULT 1` | ✅ Match |
| `auditEventResponseSchema` | `event_type: z.string()` | Route code uses `action` | ❌ Name mismatch |
| `auditQuerySchema` | `event_type: z.string()` | Route code filters by `action` | ❌ Name mismatch |

### 3.3 Missing Zod Schemas

The following DB tables/entities have no corresponding Zod schema:
- `platform_admins` — no create/response schema
- `platform_invites` — no create/response schema
- `deletion_requests` — no schema
- `custom_phases` — no schema
- `hackathon_notification_config` — no schema
- `otp_sessions` — no schema
- `pending_installations` — no schema
- `webhook_deliveries` — no response schema
- `announcements` — no create/response schema (despite having a route)

---

## 4. Foreign Key Analysis

### 4.1 Complete FK Map

**49 tables, ~79 foreign keys.** Organized by ON DELETE behavior:

#### CASCADE (35 FKs) — Automatic cleanup
| Child Table | FK Column | Parent Table | Notes |
|-------------|-----------|--------------|-------|
| `email_verification_tokens` | `user_id` | `users` | ✅ Correct |
| `otp_sessions` | `user_id` | `users` | ✅ Correct |
| `password_reset_tokens` | `user_id` | `users` | ✅ Correct |
| `refresh_tokens` | `user_id` | `users` | ✅ Correct |
| `deletion_requests` | `user_id` | `users` | ✅ Correct |
| `workspace_members` | `workspace_id` | `workspaces` | ✅ Correct |
| `workspace_members` | `user_id` | `users` | ✅ Correct |
| `workspace_invites` | `workspace_id` | `workspaces` | ✅ Correct |
| `organizer_roles` | `hackathon_id` | `hackathons` | ✅ Correct |
| `organizer_roles` | `user_id` | `users` | ✅ Correct |
| `teams` | `hackathon_id` | `hackathons` | ✅ Correct |
| `team_members` | `team_id` | `teams` | ✅ Correct |
| `team_members` | `user_id` | `users` | ✅ Correct |
| `team_repos` | `team_id` | `teams` | ✅ Correct |
| `team_invites` | `team_id` | `teams` | ✅ Correct |
| `team_messages` | `team_id` | `teams` | ✅ Correct |
| `team_messages` | `user_id` | `users` | ✅ Correct |
| `judges` | `hackathon_id` | `hackathons` | ✅ Correct |
| `judge_tracks` | `judge_id` | `judges` | ✅ Correct |
| `judge_tracks` | `track_id` | `hackathon_tracks` | ✅ Correct |
| `judge_assignments` | `hackathon_id` | `hackathons` | ✅ Correct |
| `judge_assignments` | `judge_id` | `judges` | ✅ Correct |
| `judge_assignments` | `team_id` | `teams` | ✅ Correct |
| `submissions` | `hackathon_id` | `hackathons` | ✅ Correct |
| `submissions` | `team_id` | `teams` | ✅ Correct |
| `hackathon_rounds` | `hackathon_id` | `hackathons` | ✅ Correct |
| `hackathon_sponsors` | `hackathon_id` | `hackathons` | ✅ Correct |
| `hackathon_tracks` | `hackathon_id` | `hackathons` | ✅ Correct |
| `custom_phases` | `hackathon_id` | `hackathons` | ✅ Correct |
| `hackathon_notification_config` | `hackathon_id` | `hackathons` | ✅ Correct |
| `hackathon_notification_config` | `user_id` | `users` | ✅ Correct |
| `round_results` | `hackathon_id` / `round_id` / `team_id` | various | ✅ Correct |
| `in_app_notifications` | `user_id` / `hackathon_id` | various | ✅ Correct |
| `commit_log` | `team_repo_id` | `team_repos` | ✅ Correct |
| `force_push_events` | `team_repo_id` | `team_repos` | ✅ Correct |

#### SET NULL (19 FKs) — Parent deletion nullifies reference
| Child Table | FK Column | Parent Table | Notes |
|-------------|-----------|--------------|-------|
| `judges` | `user_id` | `users` | ✅ Correct (judge record survives user deletion) |
| `judges` | `invited_by` | `users` | ✅ Correct |
| `audit_events` | `hackathon_id` / `actor_id` | various | ✅ Correct (audit survives deletion) |
| `notification_deliveries` | `recipient_id` | `users` | ✅ Correct |
| `workspace_invites` | `invited_by` | `users` | ✅ Correct |
| `team_invites` | `invited_by` | `users` | ✅ Correct |
| `workspace_members` | `invited_by` | `users` | ✅ Correct |
| `organizer_roles` | `invited_by` | `users` | ✅ Correct |
| `hackathon_templates` | `created_by` | `users` | ✅ Correct |
| `platform_invites` | `created_by` | `users` | ✅ Correct |
| `platform_admins` | `added_by` | `users` | ✅ Correct |
| `submissions` | `round_id` | `hackathon_rounds` | ⚠️ Set null on round delete — submission loses round association |

#### NO ACTION (25 FKs) — Orphan Risk 🔴
| Child Table | FK Column | Parent Table | Risk Level |
|-------------|-----------|--------------|------------|
| `scores` | `submission_id` | `submissions` | 🔴 **HIGH** — Deleting submission fails or orphans scores |
| `scores` | `judge_id` | `judges` | 🔴 **HIGH** — Deleting judge fails or orphans scores |
| `scores` | `criteria_id` | `rubric_criteria` | 🔴 **HIGH** — Deleting criteria fails or orphans scores |
| `scores` | `assignment_id` | `judge_assignments` | 🔴 **HIGH** — Deleting assignment fails or orphans scores |
| `judge_assignments` | `submission_id` | `submissions` | 🟠 Nullable, but orphan risk |
| `hackathons` | `workspace_id` | `workspaces` | 🟠 Prevents workspace deletion with hackathons |
| `hackathons` | `created_by` | `users` | 🔴 **HIGH** — User deletion fails (FK violation) |
| `team_repos` | `hackathon_id` | `hackathons` | 🟠 Prevents hackathon deletion with linked repos |
| `round_results` | `decided_by` | `users` | 🟠 Prevents user deletion if they published results |
| `announcements` | `author_id` | `users` | 🔴 **HIGH** — User deletion fails if they authored announcements |
| `ai_reviews` | `submission_id` | `submissions` | 🟠 Dead table but would block submission deletion |
| `account` | `userId` | `user` | 🟠 Better Auth table — prevents user deletion |
| `session` | `userId` | `user` | 🟠 Better Auth table — prevents user deletion |
| `two_factor` | `user_id` | `user` | 🟠 Better Auth table — prevents user deletion |

### 4.2 Account Deletion Cascade Analysis 🔴

The `DELETE /auth/delete-account/confirm` handler (`apps/api/src/routes/auth.ts:558-564`) performs manual cascade cleanup:

```
1. UPDATE workspaces SET created_by = 'deleted-user' WHERE created_by = ?
2. UPDATE hackathons SET created_by = 'deleted-user' WHERE created_by = ?  
3. DELETE FROM scores WHERE judge_id IN (SELECT id FROM judges WHERE user_id = ?)
4. DELETE FROM judge_assignments WHERE judge_id IN (SELECT id FROM judges WHERE user_id = ?)
5. DELETE FROM users WHERE id = ?
```

**Missing cleanup (will cause FK violations):**

| Table | FK | ON DELETE | Impact |
|-------|----|----------|--------|
| `announcements` | `author_id → users` | no action | 🔴 DELETE fails if user authored announcements |
| `round_results` | `decided_by → users` | no action | 🔴 DELETE fails if user published round results |
| `hackathon_templates` | `created_by → users` | set null | ✅ Auto-handled |
| `account` | `userId → user` | no action | 🟠 Better Auth `user` table (separate from `users`) |
| `session` | `userId → user` | no action | 🟠 Better Auth `user` table |

**Also missed:** The manual cleanup deletes scores and judge_assignments for the user's judges, but doesn't handle:
- The `judges` records themselves (should be SET NULL on user_id, which is correct)
- `otp_sessions`, `email_verification_tokens`, `password_reset_tokens` — these have CASCADE, so they're auto-cleaned ✅

**Net result:** Account deletion will fail with a D1 FK constraint error if the user has ever authored an announcement or published round results.

---

## 5. Missing Constraints

### 5.1 Missing NOT NULL 🟡

| Table | Column | Current | Should Be | Rationale |
|-------|--------|---------|-----------|-----------|
| `hackathons` | `workspace_id` | NOT NULL | ✅ Correct | — |
| `users` | `name` | nullable | NOT NULL | Every user creation provides a name |
| `hackathon_rounds` | `type` | NOT NULL DEFAULT 'standard' | ✅ Correct | — |
| `audit_events` | `created_at` | NOT NULL | ✅ Correct | — |
| `submissions` | `round_id` | nullable | Consider NOT NULL | Routes always provide round_id |
| `workspaces` | `description` | NOT NULL DEFAULT '' | ✅ Correct | — |

### 5.2 Missing UNIQUE Constraints 🟡

| Table | Columns | Rationale |
|-------|---------|-----------|
| `hackathon_requests` | `(workspace_id, title)` | Prevent duplicate request titles per workspace |
| `platform_invites` | `(email, status)` WHERE status='pending' | Prevent duplicate pending invites — SQLite doesn't support partial unique, but app should check |
| `workspace_invites` | `(workspace_id, email)` | Prevent inviting same email twice to same workspace |

### 5.3 Missing CHECK Constraints 🟠

SQLite supports CHECK constraints, but **zero** are used. All status/enum columns rely on application logic:

| Table | Column | Valid Values | Risk |
|-------|--------|-------------|------|
| `hackathons` | `status` | draft, active, judging, completed, archived | Raw SQL could INSERT any string |
| `teams` | `status` | forming, ready, submitted, dissolved | No DB-level validation |
| `judges` | `invite_status` | pending, accepted, declined | No DB-level validation |
| `submissions` | `status` | pending_validation, validated, failed_validation, tag_deleted | No DB-level validation |
| `workspace_members` | `role` | owner, admin, member | No DB-level validation |
| `organizer_roles` | `role` | organizer, co_organizer | No DB-level validation |
| `team_members` | `role` | leader, member | No DB-level validation |
| `deletion_requests` | `status` | pending, confirmed, completed, cancelled | No DB-level validation |
| `judge_assignments` | `status` | pending, scored, skipped, conflict | No DB-level validation |
| `round_results` | `status` | advanced, eliminated | No DB-level validation |
| `hackathon_rounds` | `status` | pending, active, completed | No DB-level validation |
| `webhook_deliveries` | `status` | queued, processed, failed, ignored | No DB-level validation |
| `notification_deliveries` | `status` | sent, failed, bounced | No DB-level validation |
| `hackathon_requests` | `status` | submitted, reviewing, approved, rejected, ready | No DB-level validation |

### 5.4 Missing DEFAULT Values 🟢

| Table | Column | Current | Suggested |
|-------|--------|---------|-----------|
| `judge_assignments` | `assigned_at` | no default (manual bind) | `DEFAULT (strftime(...))` |
| `scores` | `scored_at` | no default (manual bind) | `DEFAULT (strftime(...))` |
| `rubric_criteria` | `created_at` | no default in migration (line 541) | `DEFAULT (strftime(...))` — Drizzle schema has it but migration doesn't |

---

## 6. Index Coverage

### 6.1 Existing Indexes (91 total)

The migration creates ~91 indexes. Key coverage areas:

**Well-indexed tables:**
- `users` — email (unique), github_id (unique), google_id (unique), github_username
- `submissions` — hackathon+current, team+round, 7 indexes total
- `audit_events` — 7 indexes (entity, event_type, actor, hackathon+seq, hackathon+time, action, created_at)
- `refresh_tokens` — token_hash (unique), user_id, family_id, expires_at
- `judge_assignments` — judge+team+round (unique), hackathon+round+status, judge+status

**Under-indexed tables:**
- `scores` — only submission_id and judge_id indexes (missing criteria_id)
- `hackathon_requests` — workspace, status, requested_by (adequate)
- `platform_invites` — only email (missing status+expires_at for cleanup queries)

### 6.2 Queries Without Supporting Indexes 🟡

| Route File | Query Pattern | Missing Index | Frequency |
|------------|--------------|---------------|-----------|
| `admin.ts:16` | `SELECT FROM users ORDER BY created_at DESC` | `idx_users_created_at` | Low (admin only) |
| `admin.ts:28` | `SELECT FROM hackathons ORDER BY created_at DESC` | Already has `idx_hackathons_status` but not `created_at` sort | Low |
| `admin.ts:186` | Workspace stats with subquery COUNT on workspace_members, hackathons | Covered by existing indexes | Low |
| `judging.ts:479-486` | `SELECT FROM scores s JOIN rubric_criteria rc ON s.criteria_id = rc.id WHERE s.submission_id = ?` | Missing `idx_scores_criteria` | High (scoring reads) |
| `judging.ts:538` | `SELECT FROM judges WHERE id = ? AND hackathon_id = ?` | Primary key covers `id`; compound would help | Medium |
| `rounds.ts:219` | `LEFT JOIN submissions sub ON sub.team_id = t.id AND sub.round_id = ? AND sub.is_final = 1` | `idx_submissions_team_round` exists but uses `is_final` not `is_current` | High |
| `workspaces.ts:57-63` | `SELECT w.* FROM workspaces w JOIN workspace_members wm ON w.id = wm.workspace_id WHERE wm.user_id = ?` | `idx_workspace_members_user` exists ✅ | Medium |
| `auth.ts:480-490` | `SELECT FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? GROUP BY family_id` | Missing composite `(user_id, revoked_at, expires_at)` | High (every token refresh) |
| `notifications.ts` | `SELECT FROM in_app_notifications WHERE user_id = ? AND read_at IS NULL` | `idx_notifications_user_read` exists ✅ | High |

### 6.3 Broken Index References 🔴

The migration creates indexes on columns that **don't exist** in their tables:

| Migration Line | Index | Column | Table Has Column? |
|---------------|-------|--------|------------------|
| `0000_schema.sql:748` | `idx_audit_action` | `action` | ❌ Table has `event_type` |
| `0000_schema.sql:758` | `idx_audit_hackathon_seq` | `sequence` | ❌ Column doesn't exist |

These `CREATE INDEX` statements either fail silently or the table was ALTERed outside of migrations.

---

## 7. Migration Issues

### 7.1 Journal Registration

**`meta/_journal.json`:**
```json
{
  "version": "7",
  "dialect": "sqlite",
  "entries": [
    {"idx": 0, "version": "6", "when": 1770739337950, "tag": "0000_schema"},
    {"idx": 1, "version": "6", "when": 1770969072178, "tag": "0001_seed"},
    {"idx": 2, "version": "6", "when": 1771000000000, "tag": "0002_add_password_must_change"}
  ]
}
```

- Journal version is "7" but entries use version "6" — minor inconsistency 🟢
- Only 3 migrations registered, but the test helpers schema has ~15+ additional columns that must have been added via untracked DDL 🔴

### 7.2 Migration SQL Quality Issues 🟠

1. **Indexes on non-existent columns** (see §6.3) — `action` and `sequence` in audit_events
2. **Tables in migration but not in Drizzle schema:**
   - `ai_reviews` (migration line 580) — no Drizzle schema file, no code references
   - `email_verification_tokens` — defined in `otp-sessions.ts` but separate Drizzle table
   - `password_reset_tokens` — defined in `otp-sessions.ts` but separate Drizzle table
   - `jwks` — no Drizzle schema file (Better Auth internal table)
3. **Dual user tables:** `users` (custom, lines 1-30) AND `user` (Better Auth, lines 33-43) — two separate tables for user identity
4. **`rubric_criteria.created_at`** has no DEFAULT in migration (line 541) but Drizzle schema specifies a default — migration generation may have been done before the default was added

### 7.3 Seed Data Issues 🟡

**`0001_seed.sql` findings:**

- Seed creates workspace member with role `'organizer'` — but `workspaceRoleSchema` only allows `'owner' | 'admin' | 'member'`. **This is a role value mismatch.** The seed should use `'owner'` for the workspace creator.
  - *Correction after re-check:* The seed uses `'owner'` for Srijan's workspace membership and valid roles elsewhere. However, the seed doesn't exercise all status values, which limits test coverage.
- Seed hackathon status is `'active'` — valid ✅
- Seed judge has `invite_status = 'accepted'` — valid ✅
- Seed team members have `role = 'leader'` and `role = 'member'` — valid ✅
- Seed organizer_roles use `'organizer'` and `'co_organizer'` — valid ✅

---

## 8. Data Consistency Risks

### 8.1 The Three-Schema Problem 🔴

There are **three independent sources of truth** that have drifted apart:

1. **Drizzle ORM schemas** (`packages/db/src/schema/`) — defines table structure for migration generation
2. **Migration SQL** (`packages/db/migrations/0000_schema.sql`) — the DDL that was generated at some point
3. **Test helpers** (`apps/api/src/__tests__/helpers.ts`) — the *actual* runtime schema used for dev/test

The test helpers define a submissions table with 20+ columns (including `is_final`, `is_late`, `repo_full_name`, `webhook_delivery_id`, `commit_message`, `commit_author`, `branch`, `received_at`, `locked_at`, `finalized_at`), while the Drizzle schema only has 13 columns and the migration SQL has 13 columns.

**Root cause:** The team appears to have evolved the schema by editing test helpers and raw SQL queries directly, without regenerating Drizzle migrations. The `drizzle-kit generate` was likely only run once for `0000_schema.sql`.

### 8.2 Status Value Inconsistencies 🟠

| Context | Field | Values Used | Expected Values |
|---------|-------|-------------|-----------------|
| `round_results.status` | Route `rounds.ts:204-205` | `'advanced'`, `'eliminated'` | Zod: `advanced: z.boolean()` (type mismatch) |
| `submissions.status` | Test helpers default | `'received'` | Drizzle default: `'pending_validation'` |
| `judge_assignments.status` | `judging.ts:554-556` | `'conflict'` | Zod: `pending`, `scored`, `skipped` (missing `conflict`) |
| `hackathon_requests.status` | Route `hackathon-requests.ts` | `'submitted'`, `'reviewing'`, `'approved'`, `'rejected'`, `'ready'` | No Zod schema defined |

### 8.3 Timestamp Format Consistency ✅

All timestamp columns use `text` type with `DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))` — consistent UTC ISO-8601 format. Route code uses `new Date().toISOString()` which matches. No inconsistencies found.

**Exception:** Better Auth tables (`user`, `account`, `session`, `verification`) use `integer` columns with `{ mode: 'timestamp' }` — Unix epoch integers, not ISO strings. This is a deliberate difference for Better Auth compatibility.

### 8.4 UUID Generation ✅

All route code uses `crypto.randomUUID()` consistently. No instances of other UUID generation methods found.

### 8.5 Dual User Identity System 🟠

Two user tables exist:
- `users` (custom table) — used by all DevSage routes, has `password_hash`, `github_id`, etc.
- `user` (Better Auth table) — has `name`, `email`, `image`, `emailVerified`, `createdAt`, `updatedAt`

The `account` and `session` Better Auth tables reference `user(id)`, not `users(id)`. This means:
- Better Auth operations (passkey, 2FA) reference a **different user table** than DevSage business logic
- If a user exists in `users` but not `user`, Better Auth features break
- If a user exists in `user` but not `users`, DevSage business logic breaks
- Account deletion on `users` doesn't cascade to `user`, `account`, or `session`

---

## 9. Audit Trail Integrity

### 9.1 Hash Chain Implementation

**File:** `apps/api/src/lib/audit.ts`

The implementation computes `SHA-256(event_id : prev_hash : hackathon_id)` and stores:
- `hash` — this event's hash
- `prev_hash` — previous event's hash (for chain verification)
- `sequence` — global sequence number (MAX + 1, not per-hackathon)

**Issues:**

1. **Race condition on sequence** 🔴 — `SELECT MAX(sequence)` followed by `INSERT` is not atomic. Two concurrent requests could get the same sequence number, breaking the chain.
2. **Global sequence, per-hackathon chain** 🟡 — Sequence is global (`MAX(sequence) as max_seq FROM audit_events`), but prev_hash lookup is per-hackathon (`WHERE hackathon_id IS ?`). This means sequence numbers have gaps within a hackathon, making chain verification harder.
3. **Missing `sequence` column in migration** 🔴 — As documented in §2.5, the migration CREATE TABLE doesn't include `sequence`. This column must have been added via untracked ALTER TABLE.

### 9.2 Audit Coverage

**Files that call `insertAuditEvent()`:** (36 call sites across 15 files)

| File | Action(s) Logged | Coverage |
|------|-----------------|----------|
| `auth.ts` | register, login, token_refresh, delete_account, password_change, email_verify, session_revoke | ✅ Complete |
| `hackathons.ts` | hackathon.create, hackathon.update, hackathon.transition, hackathon.delete | ✅ Complete |
| `teams.ts` | team.create, team.join, team.leave, team.transfer_leadership, team.dissolve, team.update, team.bulk_seed | ✅ Complete |
| `judging.ts` | rubric.create, judge.invite, judge.create_credentials, score.submit, judge.coi, judge.reassign, results.publish | ✅ Complete |
| `workspaces.ts` | workspace.create, workspace.invite_accept | Partial — missing update, member_remove |
| `team-repos.ts` | repo.link, repo.unlink | ✅ Complete |
| `invites.ts` | invite.accept (team), invite.accept (judge) | ✅ Complete |
| `organizers.ts` | organizer.add, organizer.remove | ✅ Complete |
| `submissions.ts` | submission.create | ✅ Partial — missing update/delete |
| `admin.ts` | admin.workspace_create | Partial — missing admin.add, admin.remove, hackathon ops |
| `cron/index.ts` | cron.deadline_transition | ✅ Complete |
| `queue/tag-create-handler.ts` | submission.received | ✅ Complete |
| `queue/tag-delete-handler.ts` | submission.tag_deleted | ✅ Complete |
| `queue/push-handler.ts` | push.force_push_detected | ✅ Complete |
| `queue/installation-handler.ts` | github.bot_activated | ✅ Complete |

**Missing audit coverage:** 🟡
- `announcements.ts` — CRUD operations on announcements are NOT audited
- `hackathon-requests.ts` — request status changes are NOT audited
- `rounds.ts` — round create/update/delete/advance are NOT audited
- `notifications.ts` — mark read/unread not audited (acceptable)
- `admin.ts` — admin add/remove, hackathon management not audited
- `workspaces.ts` — workspace update, member removal, invite send not audited

### 9.3 Audit Event Type Inventory

Based on all `insertAuditEvent()` calls, the following `action` values are used:

```
auth.register, auth.login, auth.token_refresh, auth.delete_account, auth.password_change,
auth.email_verify, auth.session_revoke,
hackathon.create, hackathon.update, hackathon.transition, hackathon.delete,
team.create, team.join, team.leave, team.transfer_leadership, team.dissolve,
team.update, team.bulk_seed,
rubric.create, judge.invite, judge.create_credentials,
score.submit, judge.coi, judge.reassign, results.publish,
workspace.create, workspace.invite_accept,
repo.link, repo.unlink,
invite.accept,
organizer.add, organizer.remove,
submission.create, submission.received, submission.tag_deleted,
push.force_push_detected, github.bot_activated,
cron.deadline_transition, admin.workspace_create
```

No centralized enum or constant for these values — they're string literals scattered across files.

---

## 10. Recommendations

### Priority 1 — Critical (Fix Immediately) 🔴

| # | Issue | Action | Effort |
|---|-------|--------|--------|
| **C1** | Submissions table schema drift | Regenerate Drizzle migration from actual production schema (test helpers version). Add `is_final`, `is_late`, `repo_full_name`, `webhook_delivery_id`, `commit_message`, `commit_author`, `branch`, `received_at`, `locked_at`, `finalized_at` columns to Drizzle schema. Remove `is_current` or alias it. | M |
| **C2** | Judges table missing columns | Add `track_id`, `invited_at`, `responded_at` to Drizzle schema and regenerate migration. | S |
| **C3** | Audit events missing columns | Add `sequence`, `action`, `actor_ip`, `actor_user_agent`, `details` to Drizzle schema. Rename `event_type` → `action` and `metadata` → `details` (or update code). | M |
| **C4** | Platform admins missing `role` column | Either add `role` to schema or remove from INSERT in `admin.ts`. Also fix `created_by` vs `added_by` column name mismatch. | S |
| **C5** | Account deletion cascade gaps | Add cleanup for `announcements` (SET author_id = NULL or update), `round_results` (SET decided_by = NULL). Change FKs to SET NULL or add manual cleanup. | S |
| **C6** | Scores table FK orphan risk | Change `scores` FKs to `ON DELETE CASCADE` (if parent deletion should cascade) or add application-level cleanup before deleting judges/submissions. | S |
| **C7** | Audit sequence race condition | Use `INSERT INTO audit_events (..., sequence) SELECT COALESCE(MAX(sequence), 0) + 1, ... FROM audit_events` as a single atomic statement, or use D1's `RETURNING` clause. | S |

### Priority 2 — High (Fix This Sprint) 🟠

| # | Issue | Action | Effort |
|---|-------|--------|--------|
| **H1** | Zod schemas are dead code | Either integrate Zod validation into routes (import from `@devsage/shared`, validate request bodies) or document that validation is planned but not implemented. | L |
| **H2** | Test helpers as shadow schema | Reconcile test helpers schema with Drizzle schema. Run `drizzle-kit generate` from the actual production DDL. | M |
| **H3** | Dual user tables (`users` + `user`) | Document the relationship. Add sync logic or migrate Better Auth to use the `users` table. At minimum, ensure account deletion cleans up both. | M |
| **H4** | Missing audit on announcements, rounds, admin ops | Add `insertAuditEvent()` calls to `announcements.ts`, `rounds.ts`, `hackathon-requests.ts`, and remaining `admin.ts` operations. | M |
| **H5** | No CHECK constraints on status columns | Add CHECK constraints for all enum-like text columns (hackathon status, team status, judge invite_status, etc.) in next migration. | M |

### Priority 3 — Medium (Fix Next Sprint) 🟡

| # | Issue | Action | Effort |
|---|-------|--------|--------|
| **M1** | Dead tables | Remove or implement: `custom_phases`, `hackathon_notification_config`, `hackathon_sponsors`, `team_messages`, `verification`, `two_factor`, `ai_reviews` | S |
| **M2** | Missing indexes | Add `idx_scores_criteria`, `idx_refresh_tokens_user_expires`, `idx_users_created_at` | S |
| **M3** | Centralize audit event types | Create `AuditAction` const enum in `@devsage/shared` to replace scattered string literals | S |
| **M4** | Zod roundResult schema type mismatch | Change `advanced: z.boolean()` to `status: z.enum(['advanced', 'eliminated'])` | S |
| **M5** | Assignment status missing 'conflict' | Add `'conflict'` to `assignmentStatusSchema` in Zod constants | S |

### Priority 4 — Low (Backlog) 🟢

| # | Issue | Action | Effort |
|---|-------|--------|--------|
| **L1** | Migration journal version mismatch | Update journal entries to version "7" | S |
| **L2** | Unique constraints on invites | Add `(workspace_id, email)` unique on workspace_invites | S |
| **L3** | `rubric_criteria.created_at` missing DEFAULT in migration | Fix in next regeneration | S |
| **L4** | Submission default status mismatch | Test helpers use `'received'`, Drizzle uses `'pending_validation'` — standardize | S |

---

## Appendix A: Table Inventory

### Tables in Migration (49)
`users`, `user`, `account`, `session`, `verification`, `jwks`, `two_factor`, `passkey`, `email_verification_tokens`, `otp_sessions`, `password_reset_tokens`, `refresh_tokens`, `platform_admins`, `platform_invites`, `workspaces`, `workspace_members`, `workspace_invites`, `hackathon_templates`, `hackathons`, `hackathon_requests`, `hackathon_rounds`, `hackathon_sponsors`, `hackathon_tracks`, `hackathon_notification_config`, `custom_phases`, `organizer_roles`, `teams`, `team_members`, `team_repos`, `team_invites`, `team_messages`, `pending_installations`, `judges`, `judge_tracks`, `submissions`, `judge_assignments`, `rubric_criteria`, `scores`, `round_results`, `ai_reviews`, `announcements`, `audit_events`, `commit_log`, `force_push_events`, `webhook_deliveries`, `deletion_requests`, `in_app_notifications`, `notification_deliveries`, `notification_idempotency`

### Tables in Drizzle Schema (44 via index.ts exports)
All migration tables EXCEPT: `user`, `account`, `session`, `verification`, `jwks`, `passkey`, `two_factor`, `ai_reviews`, `email_verification_tokens`, `password_reset_tokens`

Note: `email_verification_tokens` and `password_reset_tokens` are defined in `otp-sessions.ts` but may not be exported. `user`, `account`, `session`, `verification`, `passkey`, `two_factor` are defined in `auth-*.ts` files but exported separately from the main schema index.

### Dead Tables (Never Queried by Route/Queue/Cron Code)
`custom_phases`, `hackathon_notification_config`, `hackathon_sponsors`, `team_messages`, `verification`, `two_factor`, `ai_reviews`

## Appendix B: Methodology

This audit was conducted by:
1. Reading all 46 Drizzle schema files in `packages/db/src/schema/`
2. Reading the migration SQL (`0000_schema.sql`, `0001_seed.sql`, `0002_add_password_must_change.sql`)
3. Reading the migration journal (`meta/_journal.json`)
4. Reading all 17 API route files in `apps/api/src/routes/`
5. Reading all 26 Zod schema files in `packages/shared/src/schemas/`
6. Reading audit, role, and cron implementation files
7. Searching for every `db.prepare()` call and cross-referencing column names against schema definitions
8. Searching for every `insertAuditEvent()` call to map audit coverage
9. Comparing test helpers schema against migration and Drizzle schemas
