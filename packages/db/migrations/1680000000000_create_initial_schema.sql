PRAGMA foreign_keys = ON;

-- users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  github_id INTEGER NOT NULL UNIQUE,
  google_id TEXT UNIQUE,
  github_username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- hackathons
CREATE TABLE IF NOT EXISTS hackathons (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  rules_md TEXT,
  registration_opens TEXT NOT NULL,
  registration_closes TEXT NOT NULL,
  submission_deadline TEXT NOT NULL,
  judging_starts TEXT,
  judging_ends TEXT,
  min_team_size INTEGER NOT NULL DEFAULT 1,
  max_team_size INTEGER NOT NULL DEFAULT 5,
  max_teams INTEGER,
  submission_tag_pattern TEXT NOT NULL DEFAULT 'submission_v%',
  max_submissions_per_team INTEGER,
  allow_late_submissions INTEGER NOT NULL DEFAULT 0,
  primary_color TEXT DEFAULT '#6366f1',
  logo_r2_key TEXT,
  banner_r2_key TEXT,
  custom_subdomain TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- organizer_invites
CREATE TABLE IF NOT EXISTS organizer_invites (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by TEXT NOT NULL,
  accepted_by TEXT,
  accepted_at TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (invited_by) REFERENCES users(id),
  FOREIGN KEY (accepted_by) REFERENCES users(id)
);

-- organizer_roles
CREATE TABLE IF NOT EXISTS organizer_roles (
  id TEXT PRIMARY KEY NOT NULL,
  hackathon_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL,
  FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS organizer_roles_unique_hackathon_user ON organizer_roles(hackathon_id, user_id);

-- platform_admins
CREATE TABLE IF NOT EXISTS platform_admins (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- teams
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY NOT NULL,
  hackathon_id TEXT NOT NULL,
  name TEXT NOT NULL,
  repo_full_name TEXT,
  repo_url TEXT,
  github_installation_id INTEGER,
  bot_active INTEGER NOT NULL DEFAULT 0,
  invite_code TEXT UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_unique_hackathon_name ON teams(hackathon_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS teams_unique_hackathon_repo ON teams(hackathon_id, repo_full_name);
CREATE INDEX IF NOT EXISTS idx_teams_hackathon ON teams(hackathon_id);
CREATE INDEX IF NOT EXISTS idx_teams_repo ON teams(repo_full_name);

-- team_members
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY NOT NULL,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS team_members_unique_team_user ON team_members(team_id, user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);

-- submissions
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY NOT NULL,
  team_id TEXT NOT NULL,
  hackathon_id TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  commit_message TEXT,
  commit_author TEXT,
  branch TEXT DEFAULT 'main',
  submitted_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  is_late INTEGER NOT NULL DEFAULT 0,
  is_final INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  validation_errors TEXT,
  locked_at TEXT,
  webhook_delivery_id TEXT UNIQUE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS submissions_unique_team_tag ON submissions(team_id, tag_name);
CREATE INDEX IF NOT EXISTS idx_submissions_team ON submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_submissions_hackathon ON submissions(hackathon_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(hackathon_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_webhook ON submissions(webhook_delivery_id);

-- judges
CREATE TABLE IF NOT EXISTS judges (
  id TEXT PRIMARY KEY NOT NULL,
  hackathon_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  invite_status TEXT NOT NULL DEFAULT 'pending',
  invited_at TEXT NOT NULL,
  accepted_at TEXT,
  FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS judges_unique_hackathon_user ON judges(hackathon_id, user_id);

-- judge_assignments
CREATE TABLE IF NOT EXISTS judge_assignments (
  id TEXT PRIMARY KEY NOT NULL,
  judge_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  hackathon_id TEXT NOT NULL,
  submission_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_at TEXT NOT NULL,
  FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS judge_assignments_unique_judge_team ON judge_assignments(judge_id, team_id);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_judge ON judge_assignments(judge_id);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_hackathon ON judge_assignments(hackathon_id);

-- rubric_criteria
CREATE TABLE IF NOT EXISTS rubric_criteria (
  id TEXT PRIMARY KEY NOT NULL,
  hackathon_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  max_score INTEGER NOT NULL DEFAULT 10,
  weight REAL NOT NULL DEFAULT 1.0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS rubric_criteria_unique_hackathon_name ON rubric_criteria(hackathon_id, name);

-- scores
CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY NOT NULL,
  submission_id TEXT NOT NULL,
  judge_id TEXT NOT NULL,
  criteria_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  comment TEXT,
  scored_at TEXT NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (judge_id) REFERENCES judges(id),
  FOREIGN KEY (criteria_id) REFERENCES rubric_criteria(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS scores_unique_submission_judge_criteria ON scores(submission_id, judge_id, criteria_id);
CREATE INDEX IF NOT EXISTS idx_scores_submission ON scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_scores_judge ON scores(judge_id);

-- force_push_events
CREATE TABLE IF NOT EXISTS force_push_events (
  id TEXT PRIMARY KEY NOT NULL,
  team_id TEXT NOT NULL,
  hackathon_id TEXT NOT NULL,
  before_sha TEXT NOT NULL,
  after_sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  commits_lost_shas TEXT,
  commits_lost_count INTEGER DEFAULT 0,
  detected_at TEXT NOT NULL,
  notified_organizer INTEGER NOT NULL DEFAULT 0,
  action_taken TEXT DEFAULT 'logged',
  submissions_invalidated TEXT,
  webhook_delivery_id TEXT,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_force_push_team ON force_push_events(team_id);

-- commit_log
CREATE TABLE IF NOT EXISTS commit_log (
  id TEXT PRIMARY KEY NOT NULL,
  team_id TEXT NOT NULL,
  hackathon_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  message TEXT,
  author_username TEXT,
  branch TEXT DEFAULT 'main',
  pushed_at TEXT NOT NULL,
  is_force_push INTEGER NOT NULL DEFAULT 0,
  commits_in_push INTEGER DEFAULT 1,
  webhook_delivery_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_commit_log_team ON commit_log(team_id, pushed_at);
CREATE INDEX IF NOT EXISTS idx_commit_log_hackathon ON commit_log(hackathon_id, pushed_at);

-- audit_events
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  hackathon_id TEXT,
  actor_id TEXT,
  actor_type TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (hackathon_id) REFERENCES hackathons(id),
  FOREIGN KEY (actor_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_audit_hackathon ON audit_events(hackathon_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id);

-- ai_reviews
CREATE TABLE IF NOT EXISTS ai_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  submission_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  summary TEXT,
  strengths TEXT,
  concerns TEXT,
  raw_response TEXT,
  tokens_used INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);

-- end of script