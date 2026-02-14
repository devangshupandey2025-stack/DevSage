PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- Non-destructive migration to add `id` PK to `team_members`.
-- Creates a new table, copies (deduped) rows generating new ids, swaps tables, and recreates indexes.

CREATE TABLE IF NOT EXISTS team_members_new (
  id TEXT PRIMARY KEY NOT NULL,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Copy existing rows, deduplicate by (team_id, user_id) keeping earliest joined_at
INSERT INTO team_members_new (id, team_id, user_id, joined_at)
SELECT lower(hex(randomblob(16))) as id, team_id, user_id, joined_at FROM (
  SELECT team_id, user_id, MIN(joined_at) AS joined_at
  FROM team_members
  GROUP BY team_id, user_id
);

-- If the original table doesn't exist this is a no-op; DROP IF EXISTS is safe.
DROP TABLE IF EXISTS team_members;

ALTER TABLE team_members_new RENAME TO team_members;

-- Recreate indexes / unique constraints expected by the application
CREATE UNIQUE INDEX IF NOT EXISTS team_members_unique_team_user ON team_members(team_id, user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);

COMMIT;

PRAGMA foreign_keys = ON;
