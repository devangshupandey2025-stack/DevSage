-- Insert a system user and a visible hackathon `hack001`
-- This migration is only initial data for dev/test purposes.

-- NOTE: Cloudflare D1 / Wrangler rejects explicit SQL transactions (BEGIN/COMMIT).
-- Keep seed migrations idempotent so re-running them in dev/test won't fail.
-- Use `INSERT OR IGNORE` so existing rows are preserved and FK relationships remain valid.

INSERT OR IGNORE INTO users (id, github_id, github_username, display_name, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  1,
  'devseed',
  'Dev Seed',
  '2026-02-13T00:00:00.000Z',
  '2026-02-13T00:00:00.000Z'
);

INSERT OR IGNORE INTO hackathons (
  id, slug, title, description, registration_opens, registration_closes, submission_deadline, min_team_size, max_team_size, status, created_by, created_at, updated_at
)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'hack001',
  'hack001',
  'Seeded hackathon entry (hack001)',
  '2026-02-01T00:00:00.000Z',
  '2026-03-01T00:00:00.000Z',
  '2026-03-10T00:00:00.000Z',
  1,
  5,
  'registration_open',
  '00000000-0000-0000-0000-000000000001',
  '2026-02-13T00:00:00.000Z',
  '2026-02-14T00:00:00.000Z'
);


