-- DevSage seed data — accounts only
-- Platform admins + dev/test user accounts
-- Generated: 2026-02-26

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
