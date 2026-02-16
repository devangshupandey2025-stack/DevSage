-- Email/Password Auth Migration
-- Drops ALL tables (FK dependencies) and recreates with new users + refresh_tokens schema
-- Generated: 2026-02-16

-- ============================================================
-- PHASE 1: Disable FK checks and DROP all existing tables
-- ============================================================

PRAGMA foreign_keys=OFF;
--> statement-breakpoint
DROP TABLE IF EXISTS `round_results`;
--> statement-breakpoint
DROP TABLE IF EXISTS `ai_reviews`;
--> statement-breakpoint
DROP TABLE IF EXISTS `scores`;
--> statement-breakpoint
DROP TABLE IF EXISTS `judge_assignments`;
--> statement-breakpoint
DROP TABLE IF EXISTS `force_push_events`;
--> statement-breakpoint
DROP TABLE IF EXISTS `commit_log`;
--> statement-breakpoint
DROP TABLE IF EXISTS `submissions`;
--> statement-breakpoint
DROP TABLE IF EXISTS `rubric_criteria`;
--> statement-breakpoint
DROP TABLE IF EXISTS `judges`;
--> statement-breakpoint
DROP TABLE IF EXISTS `webhook_deliveries`;
--> statement-breakpoint
DROP TABLE IF EXISTS `team_repos`;
--> statement-breakpoint
DROP TABLE IF EXISTS `team_members`;
--> statement-breakpoint
DROP TABLE IF EXISTS `audit_events`;
--> statement-breakpoint
DROP TABLE IF EXISTS `in_app_notifications`;
--> statement-breakpoint
DROP TABLE IF EXISTS `notification_deliveries`;
--> statement-breakpoint
DROP TABLE IF EXISTS `notification_idempotency`;
--> statement-breakpoint
DROP TABLE IF EXISTS `teams`;
--> statement-breakpoint
DROP TABLE IF EXISTS `organizer_roles`;
--> statement-breakpoint
DROP TABLE IF EXISTS `hackathon_notification_config`;
--> statement-breakpoint
DROP TABLE IF EXISTS `hackathon_rounds`;
--> statement-breakpoint
DROP TABLE IF EXISTS `hackathon_sponsors`;
--> statement-breakpoint
DROP TABLE IF EXISTS `hackathons`;
--> statement-breakpoint
DROP TABLE IF EXISTS `hackathon_templates`;
--> statement-breakpoint
DROP TABLE IF EXISTS `workspace_invites`;
--> statement-breakpoint
DROP TABLE IF EXISTS `workspace_members`;
--> statement-breakpoint
DROP TABLE IF EXISTS `workspaces`;
--> statement-breakpoint
DROP TABLE IF EXISTS `refresh_tokens`;
--> statement-breakpoint
DROP TABLE IF EXISTS `platform_admins`;
--> statement-breakpoint
DROP TABLE IF EXISTS `pending_installations`;
--> statement-breakpoint
DROP TABLE IF EXISTS `deletion_requests`;
--> statement-breakpoint
DROP TABLE IF EXISTS `team_messages`;
--> statement-breakpoint
DROP TABLE IF EXISTS `team_invites`;
--> statement-breakpoint
DROP TABLE IF EXISTS `judge_tracks`;
--> statement-breakpoint
DROP TABLE IF EXISTS `custom_phases`;
--> statement-breakpoint
DROP TABLE IF EXISTS `hackathon_tracks`;
--> statement-breakpoint
DROP TABLE IF EXISTS `users`;
--> statement-breakpoint

-- ============================================================
-- PHASE 2: Re-enable FK checks
-- ============================================================

PRAGMA foreign_keys=ON;
--> statement-breakpoint

-- ============================================================
-- PHASE 3: CREATE all tables (parent-first order)
-- ============================================================

-- 1. users — NEW email/password schema
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`avatar_url` text,
	`created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint

-- 2. pending_installations (no FK deps)
CREATE TABLE `pending_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`repo_full_name` text NOT NULL,
	`installation_id` text NOT NULL,
	`installed_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_installations_provider_repo_idx` ON `pending_installations` (`provider`,`repo_full_name`);
--> statement-breakpoint

-- 3. notification_idempotency (no FK deps)
CREATE TABLE `notification_idempotency` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_idempotency_idempotency_key_unique` ON `notification_idempotency` (`idempotency_key`);
--> statement-breakpoint

-- 4. refresh_tokens — UPDATED with created_at DEFAULT, removed unused columns
CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`family_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`revoked_at` text,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_tokens_token_hash_unique` ON `refresh_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_refresh_tokens_user` ON `refresh_tokens` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_refresh_tokens_family` ON `refresh_tokens` (`family_id`);
--> statement-breakpoint

-- 5. platform_admins (FK: users)
CREATE TABLE `platform_admins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'platform_admin' NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_admins_user_id_unique` ON `platform_admins` (`user_id`);
--> statement-breakpoint

-- 6. workspaces (FK: users)
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`logo_url` text,
	`website` text,
	`settings` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_unique` ON `workspaces` (`slug`);
--> statement-breakpoint

-- 7. notification_deliveries (FK: users)
CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`notification_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`delivered_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_deliveries_event_user_channel_idx` ON `notification_deliveries` (`event_id`,`user_id`,`channel`);
--> statement-breakpoint
CREATE INDEX `notification_deliveries_user_idx` ON `notification_deliveries` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `notification_deliveries_status_idx` ON `notification_deliveries` (`status`);
--> statement-breakpoint

-- 8. workspace_members (FK: workspaces, users)
CREATE TABLE `workspace_members` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`invited_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_members_ws_user_idx` ON `workspace_members` (`workspace_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `workspace_members_user_idx` ON `workspace_members` (`user_id`);
--> statement-breakpoint

-- 9. workspace_invites (FK: workspaces, users)
CREATE TABLE `workspace_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`email` text NOT NULL,
	`workspace_id` text NOT NULL,
	`role` text DEFAULT 'workspace_member' NOT NULL,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text NOT NULL,
	`created_by` text NOT NULL,
	`accepted_by` text,
	`accepted_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accepted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invites_code_unique` ON `workspace_invites` (`code`);
--> statement-breakpoint
CREATE INDEX `workspace_invites_email_status_idx` ON `workspace_invites` (`email`,`status`);
--> statement-breakpoint
CREATE INDEX `workspace_invites_ws_idx` ON `workspace_invites` (`workspace_id`);
--> statement-breakpoint

-- 10. hackathon_templates (FK: workspaces, users)
CREATE TABLE `hackathon_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`config_snapshot` text NOT NULL,
	`rubric_snapshot` text DEFAULT '[]' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `hackathon_templates_ws_idx` ON `hackathon_templates` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `hackathon_templates_creator_idx` ON `hackathon_templates` (`created_by`);
--> statement-breakpoint

-- 11. hackathons (FK: workspaces, users, hackathon_templates)
CREATE TABLE `hackathons` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`tagline` text,
	`description` text,
	`rules_md` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`starts_at` text,
	`judging_starts` text,
	`judging_ends` text,
	`min_team_size` integer DEFAULT 1 NOT NULL,
	`max_team_size` integer DEFAULT 5 NOT NULL,
	`max_teams` integer,
	`submission_tag_pattern` text DEFAULT 'submission_v%' NOT NULL,
	`allow_resubmission` integer DEFAULT 0 NOT NULL,
	`allow_registration_during_active` integer DEFAULT 0 NOT NULL,
	`notify_all_on_deadline` integer DEFAULT 0 NOT NULL,
	`show_judge_comments_to_participants` integer DEFAULT 0 NOT NULL,
	`registration_mode` text DEFAULT 'open' NOT NULL,
	`allowed_email_domains` text DEFAULT '[]' NOT NULL,
	`require_repo` integer DEFAULT 1 NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`template_id` text,
	`tracks` text DEFAULT '[]' NOT NULL,
	`prizes` text DEFAULT '[]' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `hackathon_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hackathons_slug_unique` ON `hackathons` (`slug`);
--> statement-breakpoint
CREATE INDEX `idx_hackathons_workspace` ON `hackathons` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_hackathons_status` ON `hackathons` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_hackathons_created_by` ON `hackathons` (`created_by`);
--> statement-breakpoint

-- 12. hackathon_sponsors (FK: hackathons, users)
CREATE TABLE `hackathon_sponsors` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`name` text NOT NULL,
	`tier` text DEFAULT 'standard' NOT NULL,
	`logo_r2_key` text,
	`website` text,
	`description` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `hackathon_sponsors_hackathon_tier_idx` ON `hackathon_sponsors` (`hackathon_id`,`tier`,`sort_order`);
--> statement-breakpoint
CREATE UNIQUE INDEX `hackathon_sponsors_name_idx` ON `hackathon_sponsors` (`hackathon_id`,`name`);
--> statement-breakpoint

-- 13. hackathon_rounds (FK: hackathons)
CREATE TABLE `hackathon_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'standard' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`submission_deadline` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hackathon_rounds_number_idx` ON `hackathon_rounds` (`hackathon_id`,`round_number`);
--> statement-breakpoint
CREATE INDEX `hackathon_rounds_status_idx` ON `hackathon_rounds` (`hackathon_id`,`status`);
--> statement-breakpoint

-- 14. hackathon_notification_config (FK: hackathons)
CREATE TABLE `hackathon_notification_config` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`email_from_name` text,
	`email_reply_to` text,
	`broadcast_cooldown_minutes` integer DEFAULT 12 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hackathon_notification_config_hackathon_id_unique` ON `hackathon_notification_config` (`hackathon_id`);
--> statement-breakpoint

-- 15. organizer_roles (FK: hackathons, users)
CREATE TABLE `organizer_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'co_organizer' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizer_roles_hackathon_id_user_id_unique` ON `organizer_roles` (`hackathon_id`,`user_id`);
--> statement-breakpoint

-- 16. teams (FK: hackathons)
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`invite_code` text,
	`track_id` text,
	`ready` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_invite_code_unique` ON `teams` (`invite_code`);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_hackathon_id_name_unique` ON `teams` (`hackathon_id`,`name`);
--> statement-breakpoint
CREATE INDEX `idx_teams_hackathon` ON `teams` (`hackathon_id`);
--> statement-breakpoint
CREATE INDEX `idx_teams_invite_code` ON `teams` (`invite_code`);
--> statement-breakpoint

-- 17. in_app_notifications (FK: users, hackathons)
CREATE TABLE `in_app_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`hackathon_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`icon` text DEFAULT 'info' NOT NULL,
	`action_url` text,
	`action_label` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `in_app_notifications_user_read_idx` ON `in_app_notifications` (`user_id`,`read`,`created_at`);
--> statement-breakpoint
CREATE INDEX `in_app_notifications_user_hackathon_idx` ON `in_app_notifications` (`user_id`,`hackathon_id`);
--> statement-breakpoint
CREATE INDEX `in_app_notifications_created_idx` ON `in_app_notifications` (`created_at`);
--> statement-breakpoint

-- 18. audit_events (FK: hackathons, users)
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence` integer NOT NULL,
	`hackathon_id` text,
	`actor_id` text,
	`actor_type` text NOT NULL,
	`actor_ip` text,
	`actor_user_agent` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`changes` text,
	`hash` text NOT NULL,
	`prev_hash` text,
	`anonymized_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_hackathon_time` ON `audit_events` (`hackathon_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_audit_hackathon_seq` ON `audit_events` (`hackathon_id`,`sequence`);
--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_events` (`entity_type`,`entity_id`);
--> statement-breakpoint
CREATE INDEX `idx_audit_actor` ON `audit_events` (`actor_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_audit_action` ON `audit_events` (`action`);
--> statement-breakpoint
CREATE INDEX `idx_audit_created_at` ON `audit_events` (`created_at`);
--> statement-breakpoint

-- 19. team_members (FK: teams, users)
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_team_id_user_id_unique` ON `team_members` (`team_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_team_members_user` ON `team_members` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_team_members_team` ON `team_members` (`team_id`);
--> statement-breakpoint

-- 20. team_repos (FK: teams, hackathons)
CREATE TABLE `team_repos` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`hackathon_id` text NOT NULL,
	`provider` text NOT NULL,
	`repo_full_name` text NOT NULL,
	`repo_url` text NOT NULL,
	`installation_id` text,
	`bot_active` integer DEFAULT 0 NOT NULL,
	`is_primary` integer DEFAULT 1 NOT NULL,
	`access_token_encrypted` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_repos_hackathon_repo_idx` ON `team_repos` (`hackathon_id`,`repo_full_name`);
--> statement-breakpoint
CREATE INDEX `team_repos_team_idx` ON `team_repos` (`team_id`);
--> statement-breakpoint
CREATE INDEX `team_repos_repo_idx` ON `team_repos` (`repo_full_name`);
--> statement-breakpoint
CREATE INDEX `team_repos_bot_idx` ON `team_repos` (`hackathon_id`,`bot_active`);
--> statement-breakpoint

-- 21. webhook_deliveries (FK: hackathons, teams)
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_id` text NOT NULL,
	`provider` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`repo_full_name` text NOT NULL,
	`hackathon_id` text,
	`team_id` text,
	`payload_hash` text NOT NULL,
	`error_message` text,
	`processing_ms` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`received_at` text NOT NULL,
	`processed_at` text,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_deliveries_delivery_id_unique` ON `webhook_deliveries` (`delivery_id`);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_hackathon_idx` ON `webhook_deliveries` (`hackathon_id`,`received_at`);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_status_idx` ON `webhook_deliveries` (`status`);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_repo_idx` ON `webhook_deliveries` (`repo_full_name`);
--> statement-breakpoint

-- 22. judges (FK: hackathons, users)
CREATE TABLE `judges` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`user_id` text NOT NULL,
	`invite_status` text DEFAULT 'pending' NOT NULL,
	`track_id` text,
	`invited_by` text NOT NULL,
	`invited_at` text NOT NULL,
	`responded_at` text,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `judges_hackathon_id_user_id_unique` ON `judges` (`hackathon_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_judges_user` ON `judges` (`user_id`);
--> statement-breakpoint

-- 23. rubric_criteria (FK: hackathons)
CREATE TABLE `rubric_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`track_id` text,
	`round` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`max_score` integer DEFAULT 10 NOT NULL,
	`weight` real DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rubric_criteria_hackathon_id_name_track_id_round_unique` ON `rubric_criteria` (`hackathon_id`,`name`,`track_id`,`round`);
--> statement-breakpoint
CREATE INDEX `idx_rubric_round` ON `rubric_criteria` (`hackathon_id`,`round`);
--> statement-breakpoint

-- 24. submissions (FK: teams, hackathons, hackathon_rounds)
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`hackathon_id` text NOT NULL,
	`tag_name` text NOT NULL,
	`commit_sha` text NOT NULL,
	`commit_message` text,
	`commit_author` text,
	`branch` text DEFAULT 'main',
	`provider` text DEFAULT 'github' NOT NULL,
	`repo_full_name` text NOT NULL,
	`round_id` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`is_late` integer DEFAULT 0 NOT NULL,
	`is_final` integer DEFAULT 0 NOT NULL,
	`validation_results` text,
	`locked_at` text,
	`finalized_at` text,
	`submitted_at` text NOT NULL,
	`received_at` text NOT NULL,
	`webhook_delivery_id` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`round_id`) REFERENCES `hackathon_rounds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_webhook_delivery_id_unique` ON `submissions` (`webhook_delivery_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_team_id_tag_name_unique` ON `submissions` (`team_id`,`tag_name`);
--> statement-breakpoint
CREATE INDEX `idx_submissions_hackathon_status` ON `submissions` (`hackathon_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_submissions_team` ON `submissions` (`team_id`);
--> statement-breakpoint
CREATE INDEX `idx_submissions_hackathon_final` ON `submissions` (`hackathon_id`,`is_final`);
--> statement-breakpoint
CREATE INDEX `idx_submissions_round_team` ON `submissions` (`round_id`,`team_id`);
--> statement-breakpoint

-- 25. commit_log (FK: hackathons, teams, webhook_deliveries)
CREATE TABLE `commit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`team_id` text NOT NULL,
	`delivery_id` text,
	`sha` text NOT NULL,
	`message` text NOT NULL,
	`author_name` text NOT NULL,
	`author_email` text NOT NULL,
	`committed_at` text NOT NULL,
	`url` text NOT NULL,
	`branch` text NOT NULL,
	`files_added` integer DEFAULT 0 NOT NULL,
	`files_modified` integer DEFAULT 0 NOT NULL,
	`files_removed` integer DEFAULT 0 NOT NULL,
	`provider` text DEFAULT 'github' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`delivery_id`) REFERENCES `webhook_deliveries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_commit_log_team_time` ON `commit_log` (`hackathon_id`,`team_id`,`committed_at`);
--> statement-breakpoint
CREATE INDEX `idx_commit_log_sha` ON `commit_log` (`sha`);
--> statement-breakpoint
CREATE INDEX `idx_commit_log_delivery` ON `commit_log` (`delivery_id`);
--> statement-breakpoint

-- 26. force_push_events (FK: hackathons, teams, users, webhook_deliveries)
CREATE TABLE `force_push_events` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`team_id` text NOT NULL,
	`delivery_id` text,
	`repo_full_name` text NOT NULL,
	`branch` text NOT NULL,
	`before_sha` text NOT NULL,
	`after_sha` text NOT NULL,
	`estimated_lost_commits` integer DEFAULT 0 NOT NULL,
	`severity` text DEFAULT 'info' NOT NULL,
	`affected_submission_ids` text DEFAULT '[]' NOT NULL,
	`resolved` integer DEFAULT 0 NOT NULL,
	`resolved_by` text,
	`resolved_at` text,
	`resolution_note` text,
	`provider` text DEFAULT 'github' NOT NULL,
	`pusher_login` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`delivery_id`) REFERENCES `webhook_deliveries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_force_push_hackathon_time` ON `force_push_events` (`hackathon_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_force_push_team` ON `force_push_events` (`team_id`);
--> statement-breakpoint
CREATE INDEX `idx_force_push_resolved` ON `force_push_events` (`resolved`);
--> statement-breakpoint

-- 27. judge_assignments (FK: hackathons, judges, teams, submissions)
CREATE TABLE `judge_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`judge_id` text NOT NULL,
	`team_id` text NOT NULL,
	`submission_id` text,
	`round` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`assigned_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`judge_id`) REFERENCES `judges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `judge_assignments_judge_id_team_id_round_unique` ON `judge_assignments` (`judge_id`,`team_id`,`round`);
--> statement-breakpoint
CREATE INDEX `idx_judge_assignments_hackathon_round` ON `judge_assignments` (`hackathon_id`,`round`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_judge_assignments_judge` ON `judge_assignments` (`judge_id`,`status`);
--> statement-breakpoint

-- 28. scores (FK: submissions, judges, rubric_criteria, judge_assignments)
CREATE TABLE `scores` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`judge_id` text NOT NULL,
	`criteria_id` text NOT NULL,
	`assignment_id` text NOT NULL,
	`score` integer NOT NULL,
	`comment` text,
	`round` integer DEFAULT 1 NOT NULL,
	`scored_at` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`judge_id`) REFERENCES `judges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criteria_id`) REFERENCES `rubric_criteria`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignment_id`) REFERENCES `judge_assignments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scores_submission_id_judge_id_criteria_id_round_unique` ON `scores` (`submission_id`,`judge_id`,`criteria_id`,`round`);
--> statement-breakpoint
CREATE INDEX `idx_scores_submission` ON `scores` (`submission_id`);
--> statement-breakpoint
CREATE INDEX `idx_scores_judge` ON `scores` (`judge_id`);
--> statement-breakpoint

-- 29. ai_reviews (FK: submissions)
CREATE TABLE `ai_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`commit_sha` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`prompt_hash` text NOT NULL,
	`prompt_template_version` text NOT NULL,
	`summary` text,
	`strengths` text,
	`concerns` text,
	`raw_response` text,
	`tokens_used` integer,
	`latency_ms` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ai_reviews_submission` ON `ai_reviews` (`submission_id`);
--> statement-breakpoint
CREATE INDEX `idx_ai_reviews_commit_sha` ON `ai_reviews` (`commit_sha`);
--> statement-breakpoint

-- 30. round_results (FK: hackathons, hackathon_rounds, teams, users)
CREATE TABLE `round_results` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`round_id` text NOT NULL,
	`team_id` text NOT NULL,
	`status` text NOT NULL,
	`rank` integer,
	`total_score` real,
	`decided_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`round_id`) REFERENCES `hackathon_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `round_results_round_team_idx` ON `round_results` (`round_id`,`team_id`);
--> statement-breakpoint
CREATE INDEX `round_results_hackathon_status_idx` ON `round_results` (`hackathon_id`,`status`);
--> statement-breakpoint
CREATE INDEX `round_results_team_idx` ON `round_results` (`team_id`);
--> statement-breakpoint

-- 31. deletion_requests (FK: users)
CREATE TABLE `deletion_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`confirmation_token` text NOT NULL,
	`status` text NOT NULL DEFAULT 'pending',
	`created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`confirmed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deletion_requests_confirmation_token_unique` ON `deletion_requests` (`confirmation_token`);
--> statement-breakpoint
CREATE INDEX `idx_deletion_requests_user` ON `deletion_requests` (`user_id`);
--> statement-breakpoint

-- 32. hackathon_tracks (FK: hackathons)
CREATE TABLE `hackathon_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`max_teams` integer,
	`sort_order` integer NOT NULL DEFAULT 0,
	`created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_hackathon_tracks_hackathon` ON `hackathon_tracks` (`hackathon_id`);
--> statement-breakpoint

-- 33. custom_phases (FK: hackathons)
CREATE TABLE `custom_phases` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`parent_status` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer NOT NULL DEFAULT 0,
	`start_date` text,
	`end_date` text,
	`created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_custom_phases_hackathon` ON `custom_phases` (`hackathon_id`);
--> statement-breakpoint

-- 34. judge_tracks (FK: judges, hackathon_tracks)
CREATE TABLE `judge_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`judge_id` text NOT NULL,
	`track_id` text NOT NULL,
	FOREIGN KEY (`judge_id`) REFERENCES `judges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `hackathon_tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_judge_tracks_judge_track` ON `judge_tracks` (`judge_id`,`track_id`);
--> statement-breakpoint

-- 35. team_invites (FK: teams, users)
CREATE TABLE `team_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`email` text NOT NULL,
	`invite_token` text NOT NULL,
	`status` text NOT NULL DEFAULT 'pending',
	`invited_by` text,
	`created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`expires_at` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_invites_invite_token_unique` ON `team_invites` (`invite_token`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_team_invites_team_email` ON `team_invites` (`team_id`,`email`);
--> statement-breakpoint
CREATE INDEX `idx_team_invites_email` ON `team_invites` (`email`);
--> statement-breakpoint

-- 36. team_messages (FK: teams, users)
CREATE TABLE `team_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_team_messages_team` ON `team_messages` (`team_id`,`created_at`);
--> statement-breakpoint

-- ============================================================
-- PHASE 4: Seed platform admins
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
