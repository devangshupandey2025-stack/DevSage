-- Seed platform admin: devangshupandey84@gmail.com
-- This migration creates a user and grants them platform admin access.
-- Uses INSERT OR IGNORE for idempotency.

-- Insert user record
INSERT OR IGNORE INTO users (
  id,
  github_id,
  github_username,
  display_name,
  email,
  email_verified,
  created_at,
  updated_at
)
VALUES (
  'admin-00000000-0000-0000-0000-000000000001',
  999999999,
  'devangshupandey84',
  'Devangshu Pandey',
  'devangshupandey84@gmail.com',
  1,
  '2026-02-15T00:00:00.000Z',
  '2026-02-15T00:00:00.000Z'
);

-- Grant platform admin access
INSERT OR IGNORE INTO platform_admins (
  id,
  user_id,
  role,
  created_at
)
VALUES (
  'padmin-00000000-0000-0000-0000-000000000001',
  'admin-00000000-0000-0000-0000-000000000001',
  'super_admin',
  '2026-02-15T00:00:00.000Z'
);
