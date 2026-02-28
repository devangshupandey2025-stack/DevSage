-- ============================================================
-- Phase 5: Plan Gap Features Migration
-- Adds columns and tables for TOTP 2FA, submission fields,
-- notification preferences, workspace soft-delete, and
-- judging time windows.
-- ============================================================

-- ── Submission schema gaps (GAP-013) ────────────────────────────
-- Route references these fields but they don't exist in the DB.
-- is_final aliases is_current for consistency with route code.
ALTER TABLE submissions ADD COLUMN title TEXT;
ALTER TABLE submissions ADD COLUMN description TEXT;
ALTER TABLE submissions ADD COLUMN demo_url TEXT;
ALTER TABLE submissions ADD COLUMN video_url TEXT;
ALTER TABLE submissions ADD COLUMN repo_url TEXT;
ALTER TABLE submissions ADD COLUMN repo_full_name TEXT;
ALTER TABLE submissions ADD COLUMN ai_score REAL;
ALTER TABLE submissions ADD COLUMN analysis_json TEXT;
ALTER TABLE submissions ADD COLUMN ai_review_json TEXT;
ALTER TABLE submissions ADD COLUMN is_final INTEGER DEFAULT 1 NOT NULL;

-- Sync is_final with existing is_current values
UPDATE submissions SET is_final = is_current;

-- Index for AI leaderboard query
CREATE INDEX IF NOT EXISTS idx_submissions_ai_leaderboard ON submissions(hackathon_id, is_final, ai_score);

-- ── TOTP 2FA tables (GAP-002) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS user_totp_secrets (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  enabled INTEGER DEFAULT 0 NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
  enabled_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_totp_secrets_user ON user_totp_secrets(user_id);

CREATE TABLE IF NOT EXISTS backup_codes (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_backup_codes_user ON backup_codes(user_id);

-- Add 2FA flag to users table
ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0 NOT NULL;

-- ── Workspace soft-delete (GAP-010) ────────────────────────────
ALTER TABLE workspaces ADD COLUMN deleted_at TEXT;

-- ── Template CRUD improvements (GAP-009) ───────────────────────
-- updated_at and is_public were added in 0002, these are additional indexes
CREATE INDEX IF NOT EXISTS idx_hackathon_templates_public ON hackathon_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_hackathon_templates_created_by ON hackathon_templates(created_by);

-- ── Notification preferences index (GAP-012) ───────────────────
CREATE INDEX IF NOT EXISTS idx_notification_config_user ON hackathon_notification_config(user_id);

-- ── Judge guidelines (GAP-005) already added judge_guidelines column in 0002 ──

-- ── Additional performance indexes ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_submissions_team_round ON submissions(team_id, round_id);
CREATE INDEX IF NOT EXISTS idx_submissions_hackathon_final ON submissions(hackathon_id, is_final);
CREATE INDEX IF NOT EXISTS idx_round_results_round_team ON round_results(round_id, team_id);
