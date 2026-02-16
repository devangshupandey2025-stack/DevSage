-- Schema Alignment Migration (PRD v2.0)
-- Adds new tables, columns, and renames for PRD compliance
-- Generated: 2026-02-15

-- ============================================================
-- PHASE 1: New tables
-- ============================================================

-- Team invites (email-based invite system)
CREATE TABLE `team_invites` (
  `id` text PRIMARY KEY NOT NULL,
  `team_id` text NOT NULL REFERENCES `teams`(`id`) ON DELETE CASCADE,
  `email` text NOT NULL,
  `token_hash` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_team_invites_team` ON `team_invites` (`team_id`);
--> statement-breakpoint
CREATE INDEX `idx_team_invites_email_status` ON `team_invites` (`email`, `status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_invites_token_hash_unique` ON `team_invites` (`token_hash`);
--> statement-breakpoint

-- Team messages (in-hackathon team chat)
CREATE TABLE `team_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `team_id` text NOT NULL REFERENCES `teams`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `content` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_team_messages_team_created` ON `team_messages` (`team_id`, `created_at`);
--> statement-breakpoint

-- Judge-track many-to-many junction table
CREATE TABLE `judge_tracks` (
  `id` text PRIMARY KEY NOT NULL,
  `judge_id` text NOT NULL REFERENCES `judges`(`id`) ON DELETE CASCADE,
  `track_id` text NOT NULL REFERENCES `hackathon_tracks`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `judge_tracks_judge_id_track_id_unique` ON `judge_tracks` (`judge_id`, `track_id`);
--> statement-breakpoint

-- ============================================================
-- PHASE 2: New columns on existing tables
-- ============================================================

-- scores: add is_submitted flag and timestamps
ALTER TABLE `scores` ADD COLUMN `is_submitted` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `scores` ADD COLUMN `created_at` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `scores` ADD COLUMN `updated_at` text NOT NULL DEFAULT '';
--> statement-breakpoint

-- submissions: add demo_url and rejection_reason
ALTER TABLE `submissions` ADD COLUMN `demo_url` text;
--> statement-breakpoint
ALTER TABLE `submissions` ADD COLUMN `rejection_reason` text;
--> statement-breakpoint

-- teams: add member_count
ALTER TABLE `teams` ADD COLUMN `member_count` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint

-- workspaces: add type
ALTER TABLE `workspaces` ADD COLUMN `type` text DEFAULT 'individual' NOT NULL;
--> statement-breakpoint

-- rubric_criteria: add round_id FK
ALTER TABLE `rubric_criteria` ADD COLUMN `round_id` text REFERENCES `hackathon_rounds`(`id`) ON DELETE CASCADE;
--> statement-breakpoint

-- audit_events: add team_id
ALTER TABLE `audit_events` ADD COLUMN `team_id` text;
--> statement-breakpoint

-- notification_deliveries: add batch_id
ALTER TABLE `notification_deliveries` ADD COLUMN `batch_id` text;
--> statement-breakpoint

-- ============================================================
-- PHASE 3: Column renames
-- ============================================================

-- audit_events: action → event_type, details → metadata
ALTER TABLE `audit_events` RENAME COLUMN `action` TO `event_type`;
--> statement-breakpoint
ALTER TABLE `audit_events` RENAME COLUMN `details` TO `metadata`;
--> statement-breakpoint

-- webhook_deliveries: payload_hash → payload_summary, attempts → retry_count
ALTER TABLE `webhook_deliveries` RENAME COLUMN `payload_hash` TO `payload_summary`;
--> statement-breakpoint
ALTER TABLE `webhook_deliveries` RENAME COLUMN `attempts` TO `retry_count`;
--> statement-breakpoint

-- ============================================================
-- PHASE 4: Update indexes for renamed columns
-- ============================================================

-- Drop old action index and create new one for event_type
DROP INDEX IF EXISTS `idx_audit_action`;
--> statement-breakpoint
CREATE INDEX `idx_audit_event_type` ON `audit_events` (`event_type`);
--> statement-breakpoint

-- sequence column already exists from 0002_v3_clean_reset.sql — skipping
--> statement-breakpoint

-- Add actor_ip as alias for ip_address (PRD uses actor_ip)
-- Keeping ip_address as-is since it's already widely used
