# 10 — Data Model & Schema

> 17 tables in Cloudflare D1 (SQLite) via Drizzle ORM. UUID primary keys, ISO-8601 timestamps, snake_case columns, camelCase Drizzle references. Estimated ~17 MB at target scale.

**Related docs:** [Infrastructure](./12-infrastructure.md) | [API Design](./11-api-design.md) | [Audit Trail](./09-audit-trail.md)

---

## Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ organizer_roles : manages
    users ||--o{ team_members : joins
    users ||--o{ judges : invited_as
    users ||--o{ audit_events : performs
    users ||--o| platform_admins : is

    hackathons ||--o{ organizer_roles : managed_by
    hackathons ||--o{ teams : hosts
    hackathons ||--o{ submissions : receives
    hackathons ||--o{ commit_log : tracks
    hackathons ||--o{ force_push_events : flags
    hackathons ||--o{ judges : invites
    hackathons ||--o{ rubric_criteria : defines
    hackathons ||--o{ judge_assignments : organizes
    hackathons ||--o{ audit_events : produces

    teams ||--o{ team_members : contains
    teams ||--o{ submissions : submits
    teams ||--o{ commit_log : pushes
    teams ||--o{ force_push_events : triggers
    teams ||--o{ judge_assignments : reviewed_by

    submissions ||--o{ scores : receives
    submissions ||--o{ ai_reviews : analyzed_by
    submissions ||--o| judge_assignments : pinned_to

    judges ||--o{ judge_assignments : assigned_to
    judges ||--o{ scores : submits

    rubric_criteria ||--o{ scores : scored_on
```

---

## Table Catalog

### Identity & Access Control

#### `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `github_id` | INTEGER | UNIQUE NOT NULL | GitHub user ID (primary identity) |
| `google_id` | TEXT | UNIQUE | Google user ID (optional, for account linking) |
| `github_username` | TEXT | NOT NULL | GitHub login handle |
| `display_name` | TEXT | NOT NULL | Display name from OAuth |
| `email` | TEXT | | Email from OAuth profile |
| `avatar_url` | TEXT | | Avatar URL from OAuth |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |
| `updated_at` | TEXT | NOT NULL | ISO-8601 UTC |

#### `platform_admins`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `user_id` | TEXT | FK users(id), UNIQUE | One admin record per user |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |

#### `organizer_invites`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `email` | TEXT | NOT NULL | Invitee email |
| `invite_code` | TEXT | UNIQUE | 8-char alphanumeric |
| `status` | TEXT | NOT NULL | pending / accepted / expired / revoked |
| `invited_by` | TEXT | FK users(id) | Platform admin who invited |
| `accepted_by` | TEXT | FK users(id) | User who accepted |
| `accepted_at` | TEXT | | When accepted |
| `expires_at` | TEXT | NOT NULL | 14 days from creation |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |

---

### Hackathon Lifecycle

#### `hackathons`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `slug` | TEXT | UNIQUE NOT NULL | URL-safe identifier |
| `title` | TEXT | NOT NULL | Display name |
| `description` | TEXT | | Markdown |
| `rules_md` | TEXT | | Competition rules |
| `registration_opens` | TEXT | NOT NULL | ISO-8601 UTC |
| `registration_closes` | TEXT | NOT NULL | ISO-8601 UTC |
| `submission_deadline` | TEXT | NOT NULL | ISO-8601 UTC |
| `judging_starts` | TEXT | | ISO-8601 UTC |
| `judging_ends` | TEXT | | ISO-8601 UTC |
| `min_team_size` | INTEGER | NOT NULL, DEFAULT 1 | |
| `max_team_size` | INTEGER | NOT NULL, DEFAULT 5 | |
| `max_teams` | INTEGER | | NULL = unlimited |
| `submission_tag_pattern` | TEXT | NOT NULL, DEFAULT 'submission_v%' | Git tag pattern |
| `max_submissions_per_team` | INTEGER | | NULL = unlimited |
| `allow_late_submissions` | INTEGER | NOT NULL, DEFAULT 0 | Boolean |
| `primary_color` | TEXT | DEFAULT '#6366f1' | Theme color |
| `logo_r2_key` | TEXT | | R2 storage key |
| `banner_r2_key` | TEXT | | R2 storage key |
| `custom_subdomain` | TEXT | | e.g., "acmhack" |
| `status` | TEXT | NOT NULL, DEFAULT 'draft' | CHECK: 7 valid states |
| `created_by` | TEXT | FK users(id), NOT NULL | Owner |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |
| `updated_at` | TEXT | NOT NULL | ISO-8601 UTC |

#### `organizer_roles`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `hackathon_id` | TEXT | FK hackathons(id) CASCADE | |
| `user_id` | TEXT | FK users(id) | |
| `role` | TEXT | NOT NULL, DEFAULT 'admin' | owner / admin / moderator |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |

Unique: `(hackathon_id, user_id)`

---

### Teams & Participation

#### `teams`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `hackathon_id` | TEXT | FK hackathons(id) CASCADE | |
| `name` | TEXT | NOT NULL | 2-50 characters |
| `repo_full_name` | TEXT | | "owner/repo" |
| `repo_url` | TEXT | | GitHub URL |
| `github_installation_id` | INTEGER | | GitHub App installation |
| `bot_active` | INTEGER | NOT NULL, DEFAULT 0 | Boolean |
| `invite_code` | TEXT | UNIQUE | 8-char join code |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |

Unique: `(hackathon_id, name)`, `(hackathon_id, repo_full_name)`

#### `team_members`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `team_id` | TEXT | FK teams(id) CASCADE | |
| `user_id` | TEXT | FK users(id) | |
| `role` | TEXT | NOT NULL, DEFAULT 'member' | leader / member |
| `joined_at` | TEXT | NOT NULL | ISO-8601 UTC |

Unique: `(team_id, user_id)`

---

### Submissions & Activity

#### `submissions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `team_id` | TEXT | FK teams(id) CASCADE | |
| `hackathon_id` | TEXT | FK hackathons(id) CASCADE | |
| `tag_name` | TEXT | NOT NULL | e.g., "submission_v1" |
| `commit_sha` | TEXT | NOT NULL | Pinned at acceptance |
| `commit_message` | TEXT | | Truncated to 500 chars |
| `commit_author` | TEXT | | Truncated to 100 chars |
| `branch` | TEXT | DEFAULT 'main' | |
| `submitted_at` | TEXT | NOT NULL | From GitHub event timestamp |
| `received_at` | TEXT | NOT NULL | Server receive time |
| `is_late` | INTEGER | NOT NULL, DEFAULT 0 | Boolean |
| `is_final` | INTEGER | NOT NULL, DEFAULT 0 | Boolean |
| `version` | INTEGER | NOT NULL | 1, 2, 3... |
| `status` | TEXT | NOT NULL, DEFAULT 'received' | 7 valid states |
| `validation_errors` | TEXT | | JSON array |
| `locked_at` | TEXT | | When DO locked |
| `webhook_delivery_id` | TEXT | UNIQUE | Idempotency key |

Unique: `(team_id, tag_name)`

#### `commit_log` (append-only)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `team_id` | TEXT | FK teams(id) CASCADE | |
| `hackathon_id` | TEXT | FK hackathons(id) CASCADE | |
| `commit_sha` | TEXT | NOT NULL | |
| `message` | TEXT | | Truncated to 500 chars |
| `author_username` | TEXT | | |
| `branch` | TEXT | DEFAULT 'main' | |
| `pushed_at` | TEXT | NOT NULL | From GitHub event |
| `is_force_push` | INTEGER | NOT NULL, DEFAULT 0 | Boolean |
| `commits_in_push` | INTEGER | DEFAULT 1 | |
| `webhook_delivery_id` | TEXT | | |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |

#### `force_push_events`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `team_id` | TEXT | FK teams(id) CASCADE | |
| `hackathon_id` | TEXT | FK hackathons(id) CASCADE | |
| `before_sha` | TEXT | NOT NULL | Previous HEAD |
| `after_sha` | TEXT | NOT NULL | New HEAD |
| `branch` | TEXT | NOT NULL | |
| `commits_lost_shas` | TEXT | | JSON array |
| `commits_lost_count` | INTEGER | DEFAULT 0 | |
| `detected_at` | TEXT | NOT NULL | ISO-8601 UTC |
| `notified_organizer` | INTEGER | NOT NULL, DEFAULT 0 | Boolean |
| `action_taken` | TEXT | DEFAULT 'logged' | logged / warned / flagged |
| `submissions_invalidated` | TEXT | | JSON array of IDs |
| `webhook_delivery_id` | TEXT | | |

---

### Judging System

#### `judges`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `hackathon_id` | TEXT | FK hackathons(id) CASCADE | |
| `user_id` | TEXT | FK users(id) | |
| `invite_status` | TEXT | NOT NULL, DEFAULT 'pending' | pending / accepted / declined |
| `invited_at` | TEXT | NOT NULL | ISO-8601 UTC |
| `accepted_at` | TEXT | | |

Unique: `(hackathon_id, user_id)`

#### `rubric_criteria`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `hackathon_id` | TEXT | FK hackathons(id) CASCADE | |
| `name` | TEXT | NOT NULL | e.g., "Innovation" |
| `description` | TEXT | | |
| `max_score` | INTEGER | NOT NULL, DEFAULT 10 | |
| `weight` | REAL | NOT NULL, DEFAULT 1.0 | |
| `sort_order` | INTEGER | NOT NULL, DEFAULT 0 | Display order |

Unique: `(hackathon_id, name)`

#### `judge_assignments`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `judge_id` | TEXT | FK judges(id) CASCADE | |
| `team_id` | TEXT | FK teams(id) CASCADE | |
| `hackathon_id` | TEXT | FK hackathons(id) CASCADE | |
| `submission_id` | TEXT | FK submissions(id) | Pinned submission (nullable) |
| `status` | TEXT | NOT NULL, DEFAULT 'pending' | pending / in_progress / completed |
| `assigned_at` | TEXT | NOT NULL | ISO-8601 UTC |

Unique: `(judge_id, team_id)`

#### `scores` (write-once)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `submission_id` | TEXT | FK submissions(id) | |
| `judge_id` | TEXT | FK judges(id) | |
| `criteria_id` | TEXT | FK rubric_criteria(id) | |
| `score` | INTEGER | NOT NULL, CHECK >= 0 | |
| `comment` | TEXT | | Optional remark |
| `scored_at` | TEXT | NOT NULL | ISO-8601 UTC |

Unique: `(submission_id, judge_id, criteria_id)`

#### `ai_reviews` (append-only)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `submission_id` | TEXT | FK submissions(id) | |
| `commit_sha` | TEXT | NOT NULL | Pinned to exact commit |
| `provider` | TEXT | NOT NULL | e.g., "openai-compatible" |
| `model` | TEXT | NOT NULL | e.g., "gpt-4o-mini" |
| `prompt_hash` | TEXT | NOT NULL | SHA-256 for reproducibility |
| `summary` | TEXT | | |
| `strengths` | TEXT | | JSON array |
| `concerns` | TEXT | | JSON array |
| `raw_response` | TEXT | | Full response for audit |
| `tokens_used` | INTEGER | | |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |

---

### Audit & Compliance

#### `audit_events` (append-only)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `hackathon_id` | TEXT | FK hackathons(id) | Nullable (platform events) |
| `actor_id` | TEXT | FK users(id) | Nullable (cron/bot) |
| `actor_type` | TEXT | NOT NULL | user / system / bot / cron |
| `action` | TEXT | NOT NULL | e.g., "submission.received" |
| `entity_type` | TEXT | NOT NULL | e.g., "submission" |
| `entity_id` | TEXT | NOT NULL | UUID of affected entity |
| `details` | TEXT | | JSON object |
| `ip_address` | TEXT | | |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |

---

## Indexes

```sql
CREATE INDEX idx_teams_hackathon ON teams(hackathon_id);
CREATE INDEX idx_teams_repo ON teams(repo_full_name);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_submissions_team ON submissions(team_id);
CREATE INDEX idx_submissions_hackathon ON submissions(hackathon_id);
CREATE INDEX idx_submissions_status ON submissions(hackathon_id, status);
CREATE INDEX idx_submissions_webhook ON submissions(webhook_delivery_id);
CREATE INDEX idx_commit_log_team ON commit_log(team_id, pushed_at);
CREATE INDEX idx_commit_log_hackathon ON commit_log(hackathon_id, pushed_at);
CREATE INDEX idx_force_push_team ON force_push_events(team_id);
CREATE INDEX idx_scores_submission ON scores(submission_id);
CREATE INDEX idx_scores_judge ON scores(judge_id);
CREATE INDEX idx_judge_assignments_judge ON judge_assignments(judge_id);
CREATE INDEX idx_judge_assignments_hackathon ON judge_assignments(hackathon_id);
CREATE INDEX idx_audit_hackathon ON audit_events(hackathon_id, created_at);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id);
```

---

## Storage Estimates

| Table | Rows (3 hackathons, 500 users) | Size |
|-------|-------------------------------|------|
| users | 500 | ~200 KB |
| hackathons | 3 | ~15 KB |
| teams | 150 | ~60 KB |
| team_members | 500 | ~50 KB |
| submissions | 450 | ~150 KB |
| commit_log | 15,000 | ~5 MB |
| force_push_events | ~50 | ~30 KB |
| judges | ~30 | ~10 KB |
| rubric_criteria | ~15 | ~5 KB |
| judge_assignments | ~450 | ~100 KB |
| scores | 4,500 | ~1 MB |
| ai_reviews | 450 | ~2 MB |
| audit_events | 25,000 | ~8 MB |
| platform_admins | ~5 | ~1 KB |
| organizer_invites | ~20 | ~5 KB |
| organizer_roles | ~15 | ~5 KB |
| **Total** | | **~17 MB** |

D1 free tier: 5 GB. Effectively infinite at this scale.

---

## Conventions

| Convention | Rule |
|------------|------|
| Primary keys | TEXT UUIDs via `crypto.randomUUID()` |
| Timestamps | TEXT ISO-8601 UTC (`new Date().toISOString()`) |
| Column names | snake_case in SQL |
| Drizzle refs | camelCase in TypeScript |
| Booleans | INTEGER 0/1 (SQLite has no native bool) |
| JSON fields | TEXT with `JSON.stringify()` / `JSON.parse()` |
| Cascading deletes | ON DELETE CASCADE on child tables |
| Migrations | `drizzle-kit generate` from `packages/db/` |

---

## v3 Planned Enhancements

### New Tables

v3 introduces 11 new tables to support in-app notifications, templates, file uploads, skill matching, audience voting, multi-track hackathons, multi-org federation, API keys, and pre-computed analytics.

#### `notifications`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `user_id` | TEXT | FK users(id) CASCADE | Recipient |
| `hackathon_id` | TEXT | FK hackathons(id) CASCADE | Nullable (platform-level notifications) |
| `type` | TEXT | NOT NULL | Notification type (matches notification event types) |
| `title` | TEXT | NOT NULL | Short display title |
| `body` | TEXT | | Notification body (plain text or markdown) |
| `action_url` | TEXT | | Deep link into the app |
| `read` | INTEGER | NOT NULL, DEFAULT 0 | Boolean |
| `batched` | INTEGER | NOT NULL, DEFAULT 0 | Boolean — included in a digest email |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |

Index: `idx_notifications_user ON notifications(user_id, read, created_at)`

#### `notification_preferences`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `user_id` | TEXT | FK users(id) CASCADE | |
| `hackathon_id` | TEXT | FK hackathons(id) CASCADE | Nullable (global default) |
| `notification_type` | TEXT | NOT NULL | Event type or `*` for all |
| `channel` | TEXT | NOT NULL | email / in_app / push / slack / discord |
| `enabled` | INTEGER | NOT NULL, DEFAULT 1 | Boolean |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |
| `updated_at` | TEXT | NOT NULL | ISO-8601 UTC |

Unique: `(user_id, hackathon_id, notification_type, channel)`

#### `hackathon_templates`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `name` | TEXT | NOT NULL | Template display name |
| `description` | TEXT | | What this template is for |
| `config` | TEXT | NOT NULL | JSON: full hackathon config (dates excluded) |
| `rubric_config` | TEXT | | JSON: array of rubric criteria definitions |
| `created_by` | TEXT | FK users(id) | Template author |
| `is_public` | INTEGER | NOT NULL, DEFAULT 0 | Boolean — visible to all organizers |
| `use_count` | INTEGER | NOT NULL, DEFAULT 0 | Times cloned |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |
| `updated_at` | TEXT | NOT NULL | ISO-8601 UTC |

#### `submission_artifacts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `submission_id` | TEXT | FK submissions(id) CASCADE | |
| `team_id` | TEXT | FK teams(id) CASCADE | |
| `hackathon_id` | TEXT | FK hackathons(id) CASCADE | |
| `artifact_type` | TEXT | NOT NULL | video / deck / screenshot / document |
| `filename` | TEXT | NOT NULL | Original filename |
| `r2_key` | TEXT | NOT NULL | R2 object storage key |
| `content_type` | TEXT | NOT NULL | MIME type |
| `size_bytes` | INTEGER | NOT NULL | File size |
| `uploaded_by` | TEXT | FK users(id) | |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |

Index: `idx_artifacts_submission ON submission_artifacts(submission_id)`

#### `team_skills`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `team_id` | TEXT | FK teams(id) CASCADE | |
| `skill` | TEXT | NOT NULL | Skill tag (e.g., "react", "machine-learning", "rust") |
| `proficiency` | TEXT | NOT NULL, DEFAULT 'intermediate' | beginner / intermediate / expert |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |

Unique: `(team_id, skill)`

#### `audience_votes`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `hackathon_id` | TEXT | FK hackathons(id) CASCADE | |
| `submission_id` | TEXT | FK submissions(id) CASCADE | |
| `user_id` | TEXT | FK users(id) | Voter |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |

Unique: `(hackathon_id, submission_id, user_id)` — one vote per user per submission

#### `hackathon_tracks`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `hackathon_id` | TEXT | FK hackathons(id) CASCADE | |
| `name` | TEXT | NOT NULL | Track name (e.g., "AI/ML", "Web3", "Social Impact") |
| `description` | TEXT | | Track description |
| `max_teams` | INTEGER | | Nullable — unlimited if null |
| `sort_order` | INTEGER | NOT NULL, DEFAULT 0 | Display order |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |

Unique: `(hackathon_id, name)`

Teams opt into a track via a new `track_id` FK column on the `teams` table. Judging can be scoped per-track — leaderboards are computed per-track and overall.

#### `organizations`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `slug` | TEXT | UNIQUE NOT NULL | URL-safe identifier |
| `name` | TEXT | NOT NULL | Organization display name |
| `logo_r2_key` | TEXT | | R2 storage key |
| `billing_email` | TEXT | | Contact email |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |
| `updated_at` | TEXT | NOT NULL | ISO-8601 UTC |

#### `org_members`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `org_id` | TEXT | FK organizations(id) CASCADE | |
| `user_id` | TEXT | FK users(id) CASCADE | |
| `role` | TEXT | NOT NULL, DEFAULT 'member' | owner / admin / member |
| `joined_at` | TEXT | NOT NULL | ISO-8601 UTC |

Unique: `(org_id, user_id)`

Hackathons gain an optional `org_id` FK. Organization members with `admin` or `owner` role automatically receive `admin` organizer role on all hackathons owned by the org.

#### `api_keys`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `user_id` | TEXT | FK users(id) CASCADE | Key owner |
| `org_id` | TEXT | FK organizations(id) CASCADE | Nullable — org-scoped or user-scoped |
| `name` | TEXT | NOT NULL | Human-readable label |
| `key_hash` | TEXT | UNIQUE NOT NULL | SHA-256 hash of the API key (plaintext never stored) |
| `key_prefix` | TEXT | NOT NULL | First 8 chars for identification (e.g., "dsk_a1b2...") |
| `scopes` | TEXT | NOT NULL | JSON array of permitted scopes |
| `last_used_at` | TEXT | | ISO-8601 UTC |
| `expires_at` | TEXT | | Nullable — null means no expiry |
| `revoked_at` | TEXT | | Nullable — set when revoked |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |

API keys use the `dsk_` prefix (DevSage Key). Authentication: the key is sent in the `Authorization: Bearer dsk_...` header. The middleware hashes the key and looks up `key_hash` in the table. Scopes control access granularity (e.g., `hackathon.read`, `submission.write`, `audit.read`).

#### `analytics_snapshots`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `hackathon_id` | TEXT | FK hackathons(id) CASCADE | |
| `snapshot_type` | TEXT | NOT NULL | daily_summary / phase_summary / final_report |
| `data` | TEXT | NOT NULL | JSON: pre-computed metrics |
| `computed_at` | TEXT | NOT NULL | ISO-8601 UTC |
| `created_at` | TEXT | NOT NULL | ISO-8601 UTC |

Index: `idx_analytics_hackathon ON analytics_snapshots(hackathon_id, snapshot_type, computed_at)`

The cron handler computes daily snapshots: team count, submission count, commit velocity, judge progress, average scores. These snapshots power the organizer analytics dashboard without requiring expensive real-time aggregation queries.

### Updated Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ organizer_roles : manages
    users ||--o{ team_members : joins
    users ||--o{ judges : invited_as
    users ||--o{ audit_events : performs
    users ||--o| platform_admins : is
    users ||--o{ notifications : receives
    users ||--o{ notification_preferences : configures
    users ||--o{ audience_votes : casts
    users ||--o{ api_keys : owns
    users ||--o{ org_members : belongs_to

    hackathons ||--o{ organizer_roles : managed_by
    hackathons ||--o{ teams : hosts
    hackathons ||--o{ submissions : receives
    hackathons ||--o{ commit_log : tracks
    hackathons ||--o{ force_push_events : flags
    hackathons ||--o{ judges : invites
    hackathons ||--o{ rubric_criteria : defines
    hackathons ||--o{ judge_assignments : organizes
    hackathons ||--o{ audit_events : produces
    hackathons ||--o{ notifications : generates
    hackathons ||--o{ hackathon_tracks : contains
    hackathons ||--o{ audience_votes : collects
    hackathons ||--o{ analytics_snapshots : summarized_by

    organizations ||--o{ org_members : has
    organizations ||--o{ hackathons : owns
    organizations ||--o{ api_keys : scopes

    teams ||--o{ team_members : contains
    teams ||--o{ submissions : submits
    teams ||--o{ commit_log : pushes
    teams ||--o{ force_push_events : triggers
    teams ||--o{ judge_assignments : reviewed_by
    teams ||--o{ team_skills : tagged_with

    submissions ||--o{ scores : receives
    submissions ||--o{ ai_reviews : analyzed_by
    submissions ||--o| judge_assignments : pinned_to
    submissions ||--o{ submission_artifacts : includes
    submissions ||--o{ audience_votes : voted_on

    judges ||--o{ judge_assignments : assigned_to
    judges ||--o{ scores : submits

    rubric_criteria ||--o{ scores : scored_on

    hackathon_tracks ||--o{ teams : categorizes
    hackathon_templates ||--o{ hackathons : cloned_to
```

### Updated Storage Estimates

| Table | Rows (50 hackathons, 10,000 users) | Size |
|-------|-----------------------------------|------|
| users | 10,000 | ~4 MB |
| hackathons | 50 | ~250 KB |
| teams | 2,500 | ~1 MB |
| team_members | 10,000 | ~1 MB |
| submissions | 7,500 | ~2.5 MB |
| commit_log | 500,000 | ~170 MB |
| force_push_events | ~500 | ~300 KB |
| judges | ~500 | ~150 KB |
| rubric_criteria | ~250 | ~80 KB |
| judge_assignments | ~7,500 | ~1.7 MB |
| scores | 75,000 | ~17 MB |
| ai_reviews | 7,500 | ~35 MB |
| audit_events | 500,000 | ~160 MB |
| platform_admins | ~10 | ~2 KB |
| organizer_invites | ~200 | ~50 KB |
| organizer_roles | ~250 | ~60 KB |
| notifications | 200,000 | ~65 MB |
| notification_preferences | 50,000 | ~10 MB |
| hackathon_templates | ~100 | ~200 KB |
| submission_artifacts | 15,000 | ~5 MB |
| team_skills | 10,000 | ~2 MB |
| audience_votes | 50,000 | ~10 MB |
| hackathon_tracks | ~200 | ~50 KB |
| organizations | ~50 | ~20 KB |
| org_members | ~500 | ~100 KB |
| api_keys | ~200 | ~60 KB |
| analytics_snapshots | ~5,000 | ~10 MB |
| **Total** | | **~495 MB** |

D1 free tier: 5 GB. At 10,000-user scale, storage usage is under 10% of the free limit. The largest tables are `commit_log` and `audit_events` — both append-only and candidates for R2 archival after retention periods expire. With archival, active D1 storage stays under 200 MB.

### Migration Strategy

v2-to-v3 migration is additive — no existing columns are modified or removed:

| Step | Migration | Risk |
|------|-----------|------|
| 1 | `CREATE TABLE` for all 11 new tables | Zero risk — no existing data affected |
| 2 | `ALTER TABLE teams ADD COLUMN track_id TEXT REFERENCES hackathon_tracks(id)` | Nullable FK — existing teams get null |
| 3 | `ALTER TABLE hackathons ADD COLUMN org_id TEXT REFERENCES organizations(id)` | Nullable FK — existing hackathons get null |
| 4 | `ALTER TABLE audit_events ADD COLUMN event_hash TEXT` | Nullable — backfill via migration script |
| 5 | `ALTER TABLE audit_events ADD COLUMN prev_hash TEXT` | Nullable — backfill via migration script |
| 6 | Backfill `event_hash` and `prev_hash` for existing audit events | Run as one-time script; compute hashes in chronological order per hackathon |
| 7 | `CREATE INDEX` for all new tables | Standard index creation |

All migrations are generated via `drizzle-kit generate` and applied via `wrangler d1 migrations apply`. The migration is designed to be applied with zero downtime — all new columns are nullable or have defaults, and no existing constraints are modified.

### Data Partitioning Strategy

At 50+ concurrent hackathons, query performance depends on efficient partitioning:

| Strategy | Implementation |
|----------|---------------|
| Hackathon-scoped queries | Every query includes `WHERE hackathon_id = ?` — the primary partition key |
| Composite indexes | All high-volume tables have `(hackathon_id, ...)` as the leading index column |
| Archival partitioning | Completed hackathons older than the retention period have their data archived to R2 and deleted from D1 |
| Read replicas | D1 read replicas (when available) serve read-heavy dashboard queries; writes go to the primary |
| DO isolation | Each hackathon's Durable Object maintains its own SQLite database — no cross-hackathon contention for state machine operations |

The `hackathon_id` column is the natural partition key. No application-level sharding is needed at the 10,000-user / 50-hackathon scale — D1's SQLite engine handles this volume comfortably. If DevSage grows beyond 100,000 users, a per-organization D1 database strategy (one D1 instance per org) provides horizontal scaling without application changes.

### v3 Data Model Feature Summary

| Feature | New Tables | Columns Modified | Priority |
|---------|-----------|-----------------|----------|
| In-app notifications | `notifications`, `notification_preferences` | None | High |
| Hackathon templates | `hackathon_templates` | None | Medium |
| Submission artifacts (R2) | `submission_artifacts` | None | High |
| Skill tags for matching | `team_skills` | None | Low |
| Audience voting | `audience_votes` | None | Medium |
| Multi-track hackathons | `hackathon_tracks` | `teams.track_id` | Medium |
| Multi-org federation | `organizations`, `org_members` | `hackathons.org_id` | Low |
| API keys | `api_keys` | None | Medium |
| Analytics snapshots | `analytics_snapshots` | None | Medium |
| Tamper detection | None | `audit_events.event_hash`, `audit_events.prev_hash` | High |

---

## File References

| File | Purpose |
|------|---------|
| `packages/db/src/schema/*.ts` | All 17 table definitions |
| `packages/db/src/schema/index.ts` | Barrel export |
| `packages/db/src/client.ts` | `createDbClient()` factory |
| `packages/db/drizzle.config.ts` | Drizzle kit configuration |
| `packages/db/migrations/` | Generated SQL migration files |
