-- DevSage consolidated seed data
-- Platform admins + dev/test accounts + sample workspace/hackathon
-- Generated: 2026-02-21

-- ============================================================
-- PLATFORM ADMINS (production)
-- ============================================================

-- Admin 1: Devangshu Pandey
INSERT OR IGNORE INTO `users` (`id`, `email`, `name`, `password_hash`, `created_at`)
VALUES (
  'admin-00000000-0000-0000-0000-000000000001',
  'devangshupandey84@gmail.com',
  'Devangshu Pandey',
  'OcXKHwZMMB9M4PpY9UIAzg==:lszYNK0007ZbPZyFTUZCzaSu9j3L+NG9rOoZnekgnjA=',
  '2026-02-15T00:00:00.000Z'
);
--> statement-breakpoint
INSERT OR IGNORE INTO `platform_admins` (`id`, `user_id`, `role`, `created_at`)
VALUES (
  'padmin-00000000-0000-0000-0000-000000000001',
  'admin-00000000-0000-0000-0000-000000000001',
  'super_admin',
  '2026-02-15T00:00:00.000Z'
);
--> statement-breakpoint

-- Admin 2: Kevin Daniel
INSERT OR IGNORE INTO `users` (`id`, `email`, `name`, `password_hash`, `created_at`)
VALUES (
  'admin-00000000-0000-0000-0000-000000000002',
  'lrkevindaniel@gmail.com',
  'Kevin Daniel',
  'eEhAfBRoy8GkXXMqI1xp+A==:BrijHQLuBAEpKAWoijVSfSEYoSkw86xeAMmKlfdbyHQ=',
  '2026-02-15T00:00:00.000Z'
);
--> statement-breakpoint
INSERT OR IGNORE INTO `platform_admins` (`id`, `user_id`, `role`, `created_at`)
VALUES (
  'padmin-00000000-0000-0000-0000-000000000002',
  'admin-00000000-0000-0000-0000-000000000002',
  'super_admin',
  '2026-02-15T00:00:00.000Z'
);
--> statement-breakpoint

-- ============================================================
-- DEV/TEST USERS
-- Passwords: {email_prefix}shikdd (e.g. srijanshikdd, adminshikdd)
-- ============================================================

-- 1. Srijan Guchhait (super_admin)
INSERT OR IGNORE INTO `users` (`id`, `email`, `name`, `password_hash`, `created_at`)
VALUES (
  'seed-0000-0000-0000-000000000001',
  'srijan.guchhait@gmail.com',
  'Srijan Guchhait',
  'k+SyggXNxqM9mU+YSk26pg==:XX7MNM9FFFwvEvtUFxXUPGxUm07CB1wl7jxzcSGj88c=',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- 2. Platform Admin (platform_admin)
INSERT OR IGNORE INTO `users` (`id`, `email`, `name`, `password_hash`, `created_at`)
VALUES (
  'seed-0000-0000-0000-000000000002',
  'admin@devsage.org',
  'Platform Admin',
  'AQEC5Oq29Ek4CuiM/zjA+w==:+Q67LaIM+6h5P9DPAnEbTxt+ewu4Eh9K55fNyxhOoBA=',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- 3. Organizer
INSERT OR IGNORE INTO `users` (`id`, `email`, `name`, `password_hash`, `created_at`)
VALUES (
  'seed-0000-0000-0000-000000000003',
  'organizer@devsage.org',
  'Test Organizer',
  'fCCZcWoW29Ca1T5zFhCbFw==:ePuGaLbqXHjjKpZNwW8NAOUFa/LpfEX4KdcTxcT12i0=',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- 4. Co-Organizer
INSERT OR IGNORE INTO `users` (`id`, `email`, `name`, `password_hash`, `created_at`)
VALUES (
  'seed-0000-0000-0000-000000000004',
  'coorganizer@devsage.org',
  'Test Co-Organizer',
  'v4FPw6hZGmUTa1cYFrLF9Q==:cxJCC58Tn8oc/d+aqEFiKjrV7QNE1CZlhgwGDqGLYqY=',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- 5. Judge
INSERT OR IGNORE INTO `users` (`id`, `email`, `name`, `password_hash`, `created_at`)
VALUES (
  'seed-0000-0000-0000-000000000005',
  'judge@devsage.org',
  'Test Judge',
  '2/lLgVdFSc/FCYoiHY8aDw==:1G3MInkyyUCunDbeyMvfzAJeQ6lwRaRGNIrmQHSgYE4=',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- 6. Team Lead
INSERT OR IGNORE INTO `users` (`id`, `email`, `name`, `password_hash`, `created_at`)
VALUES (
  'seed-0000-0000-0000-000000000006',
  'lead@devsage.org',
  'Test Team Lead',
  'Sid1oixLMKTnfKqHxJzKqw==:G0nwcRdf/uUESd/dI+VOjT8LtmWXkMUcLK765/0i8uk=',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- 7. Participant
INSERT OR IGNORE INTO `users` (`id`, `email`, `name`, `password_hash`, `created_at`)
VALUES (
  'seed-0000-0000-0000-000000000007',
  'participant@devsage.org',
  'Test Participant',
  'gKyOV6maYZPXoPsHa6w0EA==:Mr4jmFZOJEJrsnVDgSiaB88/D9tmb4l+rxN0JnZvlOg=',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- ============================================================
-- PLATFORM ADMINS (dev/test)
-- ============================================================

-- Srijan → super_admin
INSERT OR IGNORE INTO `platform_admins` (`id`, `user_id`, `role`, `created_at`)
VALUES (
  'padmin-seed-0000-0000-000000000001',
  'seed-0000-0000-0000-000000000001',
  'super_admin',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- admin@devsage.org → platform_admin
INSERT OR IGNORE INTO `platform_admins` (`id`, `user_id`, `role`, `created_at`)
VALUES (
  'padmin-seed-0000-0000-000000000002',
  'seed-0000-0000-0000-000000000002',
  'platform_admin',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- ============================================================
-- WORKSPACE (created by Srijan)
-- ============================================================

INSERT OR IGNORE INTO `workspaces` (`id`, `name`, `slug`, `description`, `logo_url`, `website`, `settings`, `created_by`, `created_at`, `updated_at`)
VALUES (
  'ws-seed-0000-0000-000000000001',
  'DevSage',
  'devsage',
  'DevSage hackathon platform workspace',
  NULL,
  NULL,
  '{}',
  'seed-0000-0000-0000-000000000001',
  '2026-02-16T00:00:00.000Z',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================

-- Srijan → workspace_owner
INSERT OR IGNORE INTO `workspace_members` (`id`, `workspace_id`, `user_id`, `role`, `invited_by`, `created_at`, `updated_at`)
VALUES (
  'wm-seed-0000-0000-000000000001',
  'ws-seed-0000-0000-000000000001',
  'seed-0000-0000-0000-000000000001',
  'workspace_owner',
  NULL,
  '2026-02-16T00:00:00.000Z',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- organizer@devsage.org → workspace_member
INSERT OR IGNORE INTO `workspace_members` (`id`, `workspace_id`, `user_id`, `role`, `invited_by`, `created_at`, `updated_at`)
VALUES (
  'wm-seed-0000-0000-000000000003',
  'ws-seed-0000-0000-000000000001',
  'seed-0000-0000-0000-000000000003',
  'workspace_member',
  'seed-0000-0000-0000-000000000001',
  '2026-02-16T00:00:00.000Z',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- ============================================================
-- HACKATHON (seed-hack001, created by organizer)
-- ============================================================

INSERT OR IGNORE INTO `hackathons` (`id`, `workspace_id`, `slug`, `title`, `tagline`, `description`, `rules_md`, `status`, `starts_at`, `judging_starts`, `judging_ends`, `min_team_size`, `max_team_size`, `max_teams`, `submission_tag_pattern`, `allow_resubmission`, `allow_registration_during_active`, `notify_all_on_deadline`, `show_judge_comments_to_participants`, `registration_mode`, `allowed_email_domains`, `require_repo`, `timezone`, `template_id`, `tracks`, `prizes`, `settings`, `created_by`, `created_at`, `updated_at`)
VALUES (
  'seed-hack-0000-0000-000000000001',
  'ws-seed-0000-0000-000000000001',
  'seed-hack001',
  'Seed Hackathon',
  'Test hackathon for development',
  'A seed hackathon with all role types pre-configured.',
  NULL,
  'active',
  '2026-02-16T00:00:00.000Z',
  NULL,
  NULL,
  1,
  5,
  NULL,
  'submission_v%',
  0,
  0,
  0,
  0,
  'open',
  '[]',
  1,
  'UTC',
  NULL,
  '[]',
  '[]',
  '{}',
  'seed-0000-0000-0000-000000000003',
  '2026-02-16T00:00:00.000Z',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

INSERT OR IGNORE INTO `hackathon_rounds` (`id`, `hackathon_id`, `round_number`, `name`, `type`, `status`, `submission_deadline`, `started_at`, `completed_at`, `created_at`, `updated_at`)
VALUES (
  'round-seed-0000-0000-000000000001',
  'seed-hack-0000-0000-000000000001',
  1,
  'Round 1',
  'standard',
  'active',
  NULL,
  '2026-02-16T00:00:00.000Z',
  NULL,
  '2026-02-16T00:00:00.000Z',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- ============================================================
-- ORGANIZER ROLES (on seed-hack001)
-- ============================================================

-- organizer@devsage.org → organizer
INSERT OR IGNORE INTO `organizer_roles` (`id`, `hackathon_id`, `user_id`, `role`, `created_at`)
VALUES (
  'org-seed-0000-0000-000000000003',
  'seed-hack-0000-0000-000000000001',
  'seed-0000-0000-0000-000000000003',
  'organizer',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- coorganizer@devsage.org → co_organizer
INSERT OR IGNORE INTO `organizer_roles` (`id`, `hackathon_id`, `user_id`, `role`, `created_at`)
VALUES (
  'org-seed-0000-0000-000000000004',
  'seed-hack-0000-0000-000000000001',
  'seed-0000-0000-0000-000000000004',
  'co_organizer',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- ============================================================
-- JUDGES (on seed-hack001)
-- ============================================================

-- judge@devsage.org → accepted judge
INSERT OR IGNORE INTO `judges` (`id`, `hackathon_id`, `user_id`, `invite_status`, `track_id`, `invited_by`, `invited_at`, `responded_at`)
VALUES (
  'judge-seed-0000-0000-000000000005',
  'seed-hack-0000-0000-000000000001',
  'seed-0000-0000-0000-000000000005',
  'accepted',
  NULL,
  'seed-0000-0000-0000-000000000003',
  '2026-02-16T00:00:00.000Z',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- ============================================================
-- TEAM + TEAM MEMBERS (on seed-hack001)
-- ============================================================

INSERT OR IGNORE INTO `teams` (`id`, `hackathon_id`, `name`, `description`, `invite_code`, `track_id`, `ready`, `created_at`, `updated_at`)
VALUES (
  'team-seed-0000-0000-000000000001',
  'seed-hack-0000-0000-000000000001',
  'Seed Team',
  'Test team with all participant roles',
  'SEED-TEAM-001',
  NULL,
  0,
  '2026-02-16T00:00:00.000Z',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- lead@devsage.org → team leader
INSERT OR IGNORE INTO `team_members` (`id`, `team_id`, `user_id`, `role`, `joined_at`)
VALUES (
  'tm-seed-0000-0000-000000000006',
  'team-seed-0000-0000-000000000001',
  'seed-0000-0000-0000-000000000006',
  'leader',
  '2026-02-16T00:00:00.000Z'
);
--> statement-breakpoint

-- participant@devsage.org → team member
INSERT OR IGNORE INTO `team_members` (`id`, `team_id`, `user_id`, `role`, `joined_at`)
VALUES (
  'tm-seed-0000-0000-000000000007',
  'team-seed-0000-0000-000000000001',
  'seed-0000-0000-0000-000000000007',
  'member',
  '2026-02-16T00:00:00.000Z'
);
