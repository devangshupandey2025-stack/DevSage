-- Add role column to team_members (leader / member).
-- Default to 'member'; the team creator is set to 'leader' at insert time.

ALTER TABLE team_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member';

-- Backfill: promote the earliest member of each team to leader.
UPDATE team_members
SET role = 'leader'
WHERE rowid IN (
  SELECT MIN(rowid)
  FROM team_members
  GROUP BY team_id
);
