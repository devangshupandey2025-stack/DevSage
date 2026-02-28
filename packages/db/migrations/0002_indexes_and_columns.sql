-- Performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_invites_status ON team_invites(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_hackathon_sequence ON audit_events(hackathon_id, sequence);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_read ON in_app_notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_judges_hackathon_user ON judges(hackathon_id, user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organizer_roles_user_id ON organizer_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_hackathons_status ON hackathons(status);
CREATE INDEX IF NOT EXISTS idx_hackathons_workspace_id ON hackathons(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scores_submission_id ON scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_judge_id ON judge_assignments(judge_id);

-- Judging time window columns
ALTER TABLE hackathon_rounds ADD COLUMN scoring_opens_at TEXT;
ALTER TABLE hackathon_rounds ADD COLUMN scoring_closes_at TEXT;

-- Judge guidelines
ALTER TABLE hackathons ADD COLUMN judge_guidelines TEXT;

-- Template CRUD support
ALTER TABLE hackathon_templates ADD COLUMN updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
ALTER TABLE hackathon_templates ADD COLUMN is_public INTEGER DEFAULT 0;
