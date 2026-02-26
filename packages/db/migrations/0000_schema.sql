-- ============================================================
-- DevSage — Consolidated Schema
-- All tables for the hackathon platform
-- Generated from Drizzle ORM schema + production fixes
-- ============================================================

CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`password_hash` text,
	`github_id` integer,
	`github_username` text,
	`google_id` text,
	`avatar_url` text,
	`email_verified` integer DEFAULT 0 NOT NULL,
	`email_bounced` integer DEFAULT 0 NOT NULL,
	`suspended` integer DEFAULT 0 NOT NULL,
	`suspended_at` text,
	`suspended_reason` text,
	`last_login_at` text,
	`password_must_change` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint

CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `jwks` (
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint

CREATE TABLE `two_factor` (
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE TABLE `passkey` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`public_key` text NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`counter` integer NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`transports` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE TABLE `email_verification_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `otp_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`otp_hash` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 5 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`expires_at` text NOT NULL,
	`verified_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `password_reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`family_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL,
	`revoked_at` text,
	`replaced_by` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `platform_admins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`added_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE TABLE `platform_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`invite_code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE TABLE `workspaces` (
`id` text PRIMARY KEY NOT NULL,
`name` text NOT NULL,
`slug` text NOT NULL,
`description` text DEFAULT '' NOT NULL,
`type` text DEFAULT 'club' NOT NULL,
`logo_url` text,
`website` text,
`settings` text DEFAULT '{}' NOT NULL,
`created_by` text NOT NULL,
`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE TABLE `workspace_members` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`invited_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE TABLE `workspace_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`invite_token` text NOT NULL,
	`invited_by` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE TABLE `hackathon_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`name` text NOT NULL,
	`description` text,
	`settings` text DEFAULT '{}' NOT NULL,
	`tracks` text DEFAULT '[]' NOT NULL,
	`rounds` text DEFAULT '[]' NOT NULL,
	`rubric` text DEFAULT '[]' NOT NULL,
	`is_platform_default` integer DEFAULT 0 NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

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
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE TABLE `hackathon_requests` (
`id` text PRIMARY KEY NOT NULL,
`workspace_id` text NOT NULL,
`requested_by` text NOT NULL,
`title` text NOT NULL,
`description` text,
`starts_at` text,
`ends_at` text,
`num_events` integer,
`expected_participants` integer,
`team_min_size` integer,
`team_max_size` integer,
`additional_details` text,
`hackathon_id` text,
`status` text DEFAULT 'submitted' NOT NULL,
`admin_notes` text,
`status_history` text DEFAULT '[]' NOT NULL,
`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

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
	`is_initialized` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `hackathon_sponsors` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`name` text NOT NULL,
	`tier` text NOT NULL,
	`logo_url` text,
	`website_url` text,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `hackathon_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`max_teams` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `hackathon_notification_config` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email_enabled` integer DEFAULT 1 NOT NULL,
	`in_app_enabled` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `custom_phases` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`parent_status` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`start_date` text,
	`end_date` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `organizer_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`invited_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`name` text NOT NULL,
	`invite_code` text NOT NULL,
	`track_id` text,
	`status` text DEFAULT 'forming' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `hackathon_tracks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

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

CREATE TABLE `team_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`email` text NOT NULL,
	`invite_token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE TABLE `team_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `pending_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`repo_full_name` text NOT NULL,
	`installation_id` text NOT NULL,
	`installed_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE `judges` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`invite_status` text DEFAULT 'pending' NOT NULL,
	`invite_token` text NOT NULL,
	`invited_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`accepted_at` text,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE TABLE `judge_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`judge_id` text NOT NULL,
	`track_id` text NOT NULL,
	FOREIGN KEY (`judge_id`) REFERENCES `judges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `hackathon_tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`team_id` text NOT NULL,
	`round_id` text,
	`tag_name` text NOT NULL,
	`commit_sha` text NOT NULL,
	`submitted_at` text NOT NULL,
	`status` text DEFAULT 'pending_validation' NOT NULL,
	`validated_at` text,
	`validation_results` text,
	`delivery_id` text,
	`is_current` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`round_id`) REFERENCES `hackathon_rounds`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

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

CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text,
	`author_id` text,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`pinned` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text,
	`actor_id` text,
	`actor_type` text NOT NULL,
	`event_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`metadata` text,
	`changes` text,
	`hash` text,
	`prev_hash` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE TABLE `commit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`team_repo_id` text NOT NULL,
	`commit_sha` text NOT NULL,
	`commit_message` text NOT NULL,
	`author_login` text,
	`author_email` text,
	`committed_at` text NOT NULL,
	`pushed_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`team_repo_id`) REFERENCES `team_repos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `force_push_events` (
	`id` text PRIMARY KEY NOT NULL,
	`team_repo_id` text NOT NULL,
	`before_sha` text NOT NULL,
	`after_sha` text NOT NULL,
	`ref` text NOT NULL,
	`pusher_login` text NOT NULL,
	`detected_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`team_repo_id`) REFERENCES `team_repos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`github_delivery_id` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error_message` text,
	`received_at` text NOT NULL,
	`processed_at` text
);
--> statement-breakpoint

CREATE TABLE `deletion_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`confirmation_token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`confirmed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `in_app_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`hackathon_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`link` text,
	`read_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`notification_type` text NOT NULL,
	`channel` text NOT NULL,
	`recipient_id` text,
	`recipient_email` text,
	`status` text DEFAULT 'sent' NOT NULL,
	`error_message` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE TABLE `notification_idempotency` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint


-- ============================================================
-- INDEXES (performance + uniqueness)
-- ============================================================

CREATE INDEX `announcements_hackathon_id_idx` ON `announcements`(`hackathon_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `deletion_requests_confirmation_token_unique` ON `deletion_requests` (`confirmation_token`);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_verification_tokens_token_hash_unique` ON `email_verification_tokens` (`token_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `hackathon_notification_config_hackathon_id_unique` ON `hackathon_notification_config` (`hackathon_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `hackathon_rounds_number_idx` ON `hackathon_rounds` (`hackathon_id`,`round_number`);
--> statement-breakpoint
CREATE INDEX `hackathon_rounds_status_idx` ON `hackathon_rounds` (`hackathon_id`,`status`);
--> statement-breakpoint
CREATE INDEX `hackathon_sponsors_hackathon_tier_idx` ON `hackathon_sponsors` (`hackathon_id`,`tier`,`sort_order`);
--> statement-breakpoint
CREATE UNIQUE INDEX `hackathon_sponsors_name_idx` ON `hackathon_sponsors` (`hackathon_id`,`name`);
--> statement-breakpoint
CREATE INDEX `hackathon_templates_creator_idx` ON `hackathon_templates` (`created_by`);
--> statement-breakpoint
CREATE INDEX `hackathon_templates_ws_idx` ON `hackathon_templates` (`workspace_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `hackathons_slug_unique` ON `hackathons` (`slug`);
--> statement-breakpoint
CREATE INDEX `idx_ai_reviews_commit_sha` ON `ai_reviews` (`commit_sha`);
--> statement-breakpoint
CREATE INDEX `idx_ai_reviews_submission` ON `ai_reviews` (`submission_id`);
--> statement-breakpoint
CREATE INDEX `idx_announcements_hackathon_created` ON `announcements` (`hackathon_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_audit_action` ON `audit_events` (`action`);
--> statement-breakpoint
CREATE INDEX `idx_audit_actor` ON `audit_events` (`actor_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_audit_created_at` ON `audit_events` (`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_events` (`entity_type`,`entity_id`);
--> statement-breakpoint
CREATE INDEX `idx_audit_event_type` ON `audit_events` (`event_type`);
--> statement-breakpoint
CREATE INDEX `idx_audit_hackathon_seq` ON `audit_events` (`hackathon_id`,`sequence`);
--> statement-breakpoint
CREATE INDEX `idx_audit_hackathon_time` ON `audit_events` (`hackathon_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_commit_log_delivery` ON `commit_log` (`delivery_id`);
--> statement-breakpoint
CREATE INDEX `idx_commit_log_repo_time` ON `commit_log` (`team_repo_id`,`committed_at`);
--> statement-breakpoint
CREATE INDEX `idx_commit_log_sha` ON `commit_log` (`sha`);
--> statement-breakpoint
CREATE INDEX `idx_commit_log_team_time` ON `commit_log` (`hackathon_id`,`team_id`,`committed_at`);
--> statement-breakpoint
CREATE INDEX `idx_custom_phases_hackathon` ON `custom_phases` (`hackathon_id`);
--> statement-breakpoint
CREATE INDEX `idx_deletion_requests_user` ON `deletion_requests` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_email_verification_expires_at` ON `email_verification_tokens` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `idx_email_verification_token_hash` ON `email_verification_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_email_verification_user_id` ON `email_verification_tokens` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_force_push_hackathon_time` ON `force_push_events` (`hackathon_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_force_push_repo` ON `force_push_events` (`team_repo_id`);
--> statement-breakpoint
CREATE INDEX `idx_force_push_resolved` ON `force_push_events` (`resolved`);
--> statement-breakpoint
CREATE INDEX `idx_force_push_team` ON `force_push_events` (`team_id`);
--> statement-breakpoint
CREATE INDEX `idx_hackathon_requests_requested_by` ON `hackathon_requests` (`requested_by`);
--> statement-breakpoint
CREATE INDEX `idx_hackathon_requests_status` ON `hackathon_requests` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_hackathon_requests_workspace` ON `hackathon_requests` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_hackathon_requests_ws_status` ON `hackathon_requests` (`workspace_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_hackathon_templates_workspace` ON `hackathon_templates` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_hackathon_tracks_hackathon` ON `hackathon_tracks` (`hackathon_id`);
--> statement-breakpoint
CREATE INDEX `idx_hackathons_created_by` ON `hackathons` (`created_by`);
--> statement-breakpoint
CREATE INDEX `idx_hackathons_status` ON `hackathons` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_hackathons_workspace` ON `hackathons` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_judge_assignments_hackathon_round` ON `judge_assignments` (`hackathon_id`,`round`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_judge_assignments_judge` ON `judge_assignments` (`judge_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_judge_assignments_submission` ON `judge_assignments` (`submission_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_judges_hackathon_email` ON `judges` (`hackathon_id`,`email`);
--> statement-breakpoint
CREATE INDEX `idx_judges_hackathon_status` ON `judges` (`hackathon_id`,`invite_status`);
--> statement-breakpoint
CREATE INDEX `idx_judges_user` ON `judges` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_notification_deliveries_recipient` ON `notification_deliveries` (`recipient_id`);
--> statement-breakpoint
CREATE INDEX `idx_notification_deliveries_status` ON `notification_deliveries` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_notifications_hackathon` ON `in_app_notifications` (`hackathon_id`);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_read` ON `in_app_notifications` (`user_id`,`read_at`);
--> statement-breakpoint
CREATE INDEX `idx_organizer_roles_hackathon` ON `organizer_roles` (`hackathon_id`);
--> statement-breakpoint
CREATE INDEX `idx_organizer_roles_user` ON `organizer_roles` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_otp_sessions_expires_at` ON `otp_sessions` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `idx_otp_sessions_user_id` ON `otp_sessions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_password_reset_expires_at` ON `password_reset_tokens` (`expires_at`);___BEGIN___COMMAND_DONE_MARKER___0;
--> statement-breakpoint
CREATE INDEX `idx_password_reset_token_hash` ON `password_reset_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_password_reset_user_id` ON `password_reset_tokens` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_pending_installations_repo` ON `pending_installations` (`repo_full_name`);
--> statement-breakpoint
CREATE INDEX `idx_platform_invites_email` ON `platform_invites` (`email`);
--> statement-breakpoint
CREATE INDEX `idx_refresh_tokens_expires` ON `refresh_tokens` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `idx_refresh_tokens_family` ON `refresh_tokens` (`family_id`);
--> statement-breakpoint
CREATE INDEX `idx_refresh_tokens_user` ON `refresh_tokens` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_rubric_round` ON `rubric_criteria` (`hackathon_id`,`round`);
--> statement-breakpoint
CREATE INDEX `idx_scores_judge` ON `scores` (`judge_id`);
--> statement-breakpoint
CREATE INDEX `idx_scores_submission` ON `scores` (`submission_id`);
--> statement-breakpoint
CREATE INDEX `idx_scores_submission_criteria` ON `scores` (`submission_id`,`criteria_id`);
--> statement-breakpoint
CREATE INDEX `idx_sponsors_hackathon` ON `hackathon_sponsors` (`hackathon_id`);
--> statement-breakpoint
CREATE INDEX `idx_submissions_hackathon_current` ON `submissions` (`hackathon_id`,`is_current`);
--> statement-breakpoint
CREATE INDEX `idx_submissions_hackathon_final` ON `submissions` (`hackathon_id`,`is_final`);
--> statement-breakpoint
CREATE INDEX `idx_submissions_hackathon_status` ON `submissions` (`hackathon_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_submissions_round_team` ON `submissions` (`round_id`,`team_id`);
--> statement-breakpoint
CREATE INDEX `idx_submissions_team` ON `submissions` (`team_id`);
--> statement-breakpoint
CREATE INDEX `idx_submissions_team_round` ON `submissions` (`team_id`,`round_id`);
--> statement-breakpoint
CREATE INDEX `idx_team_invites_email` ON `team_invites` (`email`);
--> statement-breakpoint
CREATE INDEX `idx_team_members_team` ON `team_members` (`team_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_team_members_team_user` ON `team_members` (`team_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_team_members_user` ON `team_members` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_team_messages_team` ON `team_messages` (`team_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_teams_hackathon` ON `teams` (`hackathon_id`);
--> statement-breakpoint
CREATE INDEX `idx_teams_invite_code` ON `teams` (`invite_code`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE INDEX `idx_users_github_username` ON `users` (`github_username`);
--> statement-breakpoint
CREATE INDEX `idx_webhook_deliveries_event` ON `webhook_deliveries` (`event_type`);
--> statement-breakpoint
CREATE INDEX `idx_webhook_deliveries_status` ON `webhook_deliveries` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_workspace_invites_email` ON `workspace_invites` (`email`);
--> statement-breakpoint
CREATE INDEX `idx_workspace_members_user` ON `workspace_members` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_workspace_members_ws_role` ON `workspace_members` (`workspace_id`,`role`);
--> statement-breakpoint
CREATE INDEX `idx_workspaces_created_by` ON `workspaces` (`created_by`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workspaces_slug_unique` ON `workspaces` (`slug`);
--> statement-breakpoint
CREATE INDEX `in_app_notifications_created_idx` ON `in_app_notifications` (`created_at`);
--> statement-breakpoint
CREATE INDEX `in_app_notifications_user_hackathon_idx` ON `in_app_notifications` (`user_id`,`hackathon_id`);
--> statement-breakpoint
CREATE INDEX `in_app_notifications_user_read_idx` ON `in_app_notifications` (`user_id`,`read`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `judge_assignments_judge_id_team_id_round_unique` ON `judge_assignments` (`judge_id`,`team_id`,`round`);
--> statement-breakpoint
CREATE UNIQUE INDEX `judges_hackathon_id_user_id_unique` ON `judges` (`hackathon_id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `judges_invite_token_unique` ON `judges` (`invite_token`);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_deliveries_event_user_channel_idx` ON `notification_deliveries` (`event_id`,`user_id`,`channel`);
--> statement-breakpoint
CREATE INDEX `notification_deliveries_status_idx` ON `notification_deliveries` (`status`);
--> statement-breakpoint
CREATE INDEX `notification_deliveries_user_idx` ON `notification_deliveries` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_idempotency_idempotency_key_unique` ON `notification_idempotency` (`idempotency_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizer_roles_hackathon_id_user_id_unique` ON `organizer_roles` (`hackathon_id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_tokens_token_hash_unique` ON `password_reset_tokens` (`token_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_installations_provider_repo_idx` ON `pending_installations` (`provider`,`repo_full_name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_admins_user_id_unique` ON `platform_admins` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_invites_invite_code_unique` ON `platform_invites` (`invite_code`);
--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_tokens_token_hash_unique` ON `refresh_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `round_results_hackathon_status_idx` ON `round_results` (`hackathon_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `round_results_round_team_idx` ON `round_results` (`round_id`,`team_id`);
--> statement-breakpoint
CREATE INDEX `round_results_team_idx` ON `round_results` (`team_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `rubric_criteria_hackathon_id_name_track_id_round_unique` ON `rubric_criteria` (`hackathon_id`,`name`,`track_id`,`round`);
--> statement-breakpoint
CREATE UNIQUE INDEX `scores_submission_id_judge_id_criteria_id_round_unique` ON `scores` (`submission_id`,`judge_id`,`criteria_id`,`round`);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);
--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_delivery_id_unique` ON `submissions` (`delivery_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_team_id_tag_name_unique` ON `submissions` (`team_id`,`tag_name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_webhook_delivery_id_unique` ON `submissions` (`webhook_delivery_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_invites_invite_token_unique` ON `team_invites` (`invite_token`);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_team_id_user_id_unique` ON `team_members` (`team_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `team_repos_bot_idx` ON `team_repos` (`hackathon_id`,`bot_active`);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_repos_hackathon_repo_idx` ON `team_repos` (`hackathon_id`,`repo_full_name`);
--> statement-breakpoint
CREATE INDEX `team_repos_repo_idx` ON `team_repos` (`repo_full_name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_repos_team_id_unique` ON `team_repos` (`team_id`);
--> statement-breakpoint
CREATE INDEX `team_repos_team_idx` ON `team_repos` (`team_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_hackathon_id_name_unique` ON `teams` (`hackathon_id`,`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_invite_code_unique` ON `teams` (`invite_code`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_hackathon_notification_config_hackathon_user` ON `hackathon_notification_config` (`hackathon_id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_judge_tracks_judge_track` ON `judge_tracks` (`judge_id`,`track_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_organizer_roles_hackathon_user` ON `organizer_roles` (`hackathon_id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_team_invites_team_email` ON `team_invites` (`team_id`,`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_team_members_team_user` ON `team_members` (`team_id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_workspace_members_workspace_user` ON `workspace_members` (`workspace_id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_id_unique` ON `users` (`github_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_deliveries_delivery_id_unique` ON `webhook_deliveries` (`delivery_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_deliveries_github_delivery_id_unique` ON `webhook_deliveries` (`github_delivery_id`);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_hackathon_idx` ON `webhook_deliveries` (`hackathon_id`,`received_at`);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_repo_idx` ON `webhook_deliveries` (`repo_full_name`);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_status_idx` ON `webhook_deliveries` (`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invites_code_unique` ON `workspace_invites` (`code`);
--> statement-breakpoint
CREATE INDEX `workspace_invites_email_status_idx` ON `workspace_invites` (`email`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invites_invite_token_unique` ON `workspace_invites` (`invite_token`);
--> statement-breakpoint
CREATE INDEX `workspace_invites_ws_idx` ON `workspace_invites` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `workspace_members_user_idx` ON `workspace_members` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_members_ws_user_idx` ON `workspace_members` (`workspace_id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_unique` ON `workspaces` (`slug`);
--> statement-breakpoint