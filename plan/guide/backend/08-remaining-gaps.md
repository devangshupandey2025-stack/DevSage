# Remaining Gaps

Features from role docs not fully covered in other plan files. Organized by priority.

## CRITICAL GAPS (should be Phase 2)

### CG-01: Forced Password Reset for Judges

**Source**: `role-judge.md` — "credentials provided" onboarding path requires forced password reset on first login.

**Schema change** (migration 0004):
```sql
ALTER TABLE users ADD COLUMN must_reset_password INTEGER NOT NULL DEFAULT 0;
```

**Implementation**:
1. When creating a judge with temp credentials (via `POST /api/v1/invites/judge/:id` setup flow), set `must_reset_password = 1`
2. On login: if `must_reset_password = 1`, return `{ ok: true, data: { must_reset_password: true } }` — frontend redirects to `/change-password`
3. After password change: set `must_reset_password = 0`
4. Block all API calls (except password change and logout) when `must_reset_password = 1`

### CG-06: Hackathon Registration Endpoint

**Source**: `role-participant.md` — public hackathon discovery and registration.

**Moved from Phase 4 to Phase 2** — this is a core participant flow.

**Endpoint**: `POST /api/v1/hackathons/:slug/register`
- Body: `{ teamName?: string, inviteCode?: string }`
- If `teamName` provided: create team + register caller as leader
- If `inviteCode` provided: join existing team
- Validates: hackathon is `active`, `registration_mode = 'open'`, email domain in `allowed_email_domains` (or empty = all allowed)
- Requires: authenticated user
- Returns: team info

### CG-07: Team Elimination & Disqualification

**Source**: `role-event-lead.md` (elimination as post-judging action), `role-participant.md` (team disbanding)

**Moved from Phase 4 to Phase 2** — part of the core judging/round workflow.

1. **Eliminate from round**: `POST /api/v1/hackathons/:slug/rounds/:roundId/eliminate`
   - Body: `{ teamIds: string[] }`
   - Sets `round_results.status = 'eliminated'`
   - Notifies team members (requires `06-notifications.md`)
   - Audit logs the action

2. **Disqualify team**: `PATCH /api/v1/hackathons/:slug/teams/:teamId` with `status: 'disqualified'`
   - Body must include `disqualification_reason` (required, stored in new column)
   - Reversible: set back to `active` with audit reason
   - Removes team from future round assignments
   - Notifies team + records in audit trail

3. **Schema change** (migration 0004):
   ```sql
   ALTER TABLE teams ADD COLUMN disqualification_reason TEXT;
   ```

## MEDIUM GAPS

### CG-02: Account Deletion Requests

**Source**: `role-devsage-team.md`, `role-workspace-managers.md` — users can request account deletion and personal data purge.

**Schema**: `deletion_requests` table already exists with `confirmation_token` and `status` columns.

**Endpoints**:
- `POST /api/v1/users/me/deletion-request` — user initiates deletion
  - Sends confirmation email with token
  - Creates `deletion_requests` record with `status = 'pending'`
- `POST /api/v1/users/me/deletion-request/confirm` — user confirms via email token
  - Sets `status = 'confirmed'`
- Cron job or admin action processes confirmed deletions:
  - Anonymize audit trail entries (set `actor_id = NULL`, remove PII from metadata)
  - Delete user record (cascades to refresh_tokens, team_members, etc.)
  - Retain anonymized audit events for compliance

### CG-03: Data Export Endpoint

**Source**: `role-devsage-team.md` — platform admin can export workspace or hackathon data.

**Endpoints**:
- `GET /api/v1/admin/export/workspace/:id` — export workspace data as JSON
- `GET /api/v1/admin/export/hackathon/:slug` — export hackathon data as JSON

Returns: all teams, submissions, scores, audit events, announcements for the entity. Large exports should be paginated or streamed.

### CG-04: Custom Domain Setup

**Source**: `role-devsage-team.md` — CNAME-based custom domains for hackathon pages.

**Implementation**: This is primarily a Cloudflare configuration task, not an API feature:
1. Add custom hostname via Cloudflare for Workers custom domains API
2. Store custom domain in hackathon settings JSON
3. Update CORS middleware to include custom domain origin
4. Endpoint: `PATCH /api/v1/admin/hackathons/:slug/domain` — set custom domain

### CG-05: Participant Seeding Improvements

**Source**: `role-event-lead.md` — Mode A (full structure) and Mode B (leaders only) seeding.

**Current**: `POST /api/v1/hackathons/:slug/teams/seed` exists but may not implement the full invite chain.

**What's missing**:
- Mode A: Bulk upload of teams with members. Each member should receive an invite email automatically.
- Mode B: Upload leaders only. Leaders receive invite email + invite code. Leaders then invite their own members.
- Validation: check `min_team_size` / `max_team_size` constraints during seeding

### CG-08: Announcement Targeting

**Source**: `role-event-lead.md` — announcements can target `all`, `round:<n>`, or `team:<id>`.

Addressed in `06-notifications.md` — schema change and fan-out logic included there.

### CG-10: Conflicting Role Prevention

Addressed in `05-judging-system.md` section 10.

### CG-11: Scoring Window Extension

Addressed in `05-judging-system.md` section 2.

### CG-12: 15-Minute Closing Reminder

Addressed in `06-notifications.md` section 6 — recommended DO alarm approach.

### CG-14: Owner Max-2 Enforcement

Addressed in `07-workspace-billing.md` section 1.

## LOW GAPS

### GAP-006: Analytics Backend API

**Source**: `role-devsage-team.md` (platform stats), `role-event-lead.md` (hackathon analytics)

**Current**: `GET /api/v1/admin/stats` returns basic counts. Frontend analytics pages use mock data.

**Endpoints to Build**:
```
GET /api/v1/admin/analytics/overview     — Platform-wide time-series
GET /api/v1/hackathons/:slug/analytics   — Per-hackathon funnel, timeline
GET /api/v1/hackathons/:slug/analytics/engagement — Commit frequency, force pushes
GET /api/v1/workspaces/:id/analytics     — Workspace-level stats
```

**Implementation**: Pre-compute via cron, store in `analytics_cache` D1 table (see `02-performance.md` analytics section). No KV needed — D1 reads are fast enough.

### GAP-008: Per-Round Submission Tag Patterns

**Source**: `role-event-lead.md` (tag patterns per round)

**Current**: Single `submission_tag_pattern` on hackathon.

**What to Build**:
1. Add `tag_pattern` column to `hackathon_rounds`
2. Update tag-create-handler to match against round-specific pattern
3. If no round pattern, fall back to hackathon-level pattern

### GAP-013: Submission Schema Gaps

**Source**: Plan docs reference fields that exist in schema but aren't populated via API.

**Fields already in DB** (added in migration 0003): `title`, `description`, `demo_url`, `video_url`, `repo_url`, `repo_full_name`, `ai_score`, `analysis_json`, `ai_review_json`

**What to Build**:
1. Update `POST /api/v1/hackathons/:slug/submissions` to accept `title`, `description`, `demo_url`, `video_url`
2. Update `PATCH /api/v1/hackathons/:slug/submissions/:id` for editable fields
3. Auto-populate `repo_url` and `repo_full_name` from `team_repos` on submission creation
4. AI analysis is a stretch goal — stub the endpoint, return null

### Hackathon Page Content States

**Source**: `role-event-lead.md` — visitors, non-participants, and participants see different content at different hackathon states.

**Implementation**: Not a separate endpoint. Add a `viewer_context` field to `GET /api/v1/hackathons/:slug` response:
```typescript
{
  viewer_context: {
    is_participant: boolean,
    team_id: string | null,
    registration_open: boolean,
    can_submit: boolean,
    current_round: { id, name, status } | null,
  }
}
```

### Audit Trail Improvements

Missing audit events for: announcement CRUD, round CRUD, rubric changes, judge invite/accept, scoring window changes, workspace member role changes. Add `insertAuditEvent()` calls to these route handlers.

### Theming Endpoints

Store theming in existing `settings` JSON column (structured):
```typescript
// settings.theming
{
  logo_url: string,
  banner_url: string,
  primary_color: string,  // hex
  secondary_color: string,
  sponsor_content: string, // markdown
}
```

`PATCH /api/v1/hackathons/:slug/theming` — admin-only, updates `settings.theming`
`GET /api/v1/hackathons/:slug` already returns settings — ensure theming is included.

### Dead-Letter Queue & Admin Intervention

- `GET /api/v1/admin/webhooks/failed` — list dead-letter webhook deliveries
- `POST /api/v1/admin/webhooks/:id/replay` — re-enqueue a failed webhook
- `GET /api/v1/admin/queues/stats` — queue depth and processing metrics

## Migration 0004 Summary

All schema changes from plan files collected here:

```sql
-- From 05-judging-system.md
CREATE TABLE judge_conflicts (
  id TEXT PRIMARY KEY,
  judge_id TEXT NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  declared_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(judge_id, team_id)
);
CREATE INDEX idx_judge_conflicts_judge ON judge_conflicts(judge_id);
CREATE INDEX idx_judge_conflicts_team ON judge_conflicts(team_id);

ALTER TABLE judges ADD COLUMN guidelines_acknowledged_at TEXT;

-- From 08-remaining-gaps.md
ALTER TABLE teams ADD COLUMN disqualification_reason TEXT;
ALTER TABLE users ADD COLUMN must_reset_password INTEGER NOT NULL DEFAULT 0;

-- From 06-notifications.md
ALTER TABLE announcements ADD COLUMN target_type TEXT NOT NULL DEFAULT 'all';
ALTER TABLE announcements ADD COLUMN target_id TEXT;

-- From 04-github-integration.md
ALTER TABLE webhook_deliveries ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;

-- From 08-remaining-gaps.md (low priority)
ALTER TABLE hackathon_rounds ADD COLUMN tag_pattern TEXT;

-- From 02-performance.md
CREATE INDEX IF NOT EXISTS idx_teams_hackathon_status ON teams(hackathon_id, status);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_hackathon_round ON judge_assignments(hackathon_id, round);
```
