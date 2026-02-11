CREATE TABLE `ai_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`commit_sha` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`prompt_hash` text NOT NULL,
	`summary` text,
	`strengths` text,
	`concerns` text,
	`raw_response` text,
	`tokens_used` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text,
	`actor_id` text,
	`actor_type` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`details` text,
	`ip_address` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_hackathon` ON `audit_events` (`hackathon_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `commit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`hackathon_id` text NOT NULL,
	`commit_sha` text NOT NULL,
	`message` text,
	`author_username` text,
	`branch` text DEFAULT 'main',
	`pushed_at` text NOT NULL,
	`is_force_push` integer DEFAULT 0 NOT NULL,
	`commits_in_push` integer DEFAULT 1,
	`webhook_delivery_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_commit_log_team` ON `commit_log` (`team_id`,`pushed_at`);--> statement-breakpoint
CREATE INDEX `idx_commit_log_hackathon` ON `commit_log` (`hackathon_id`,`pushed_at`);--> statement-breakpoint
CREATE TABLE `force_push_events` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`hackathon_id` text NOT NULL,
	`before_sha` text NOT NULL,
	`after_sha` text NOT NULL,
	`branch` text NOT NULL,
	`commits_lost_shas` text,
	`commits_lost_count` integer DEFAULT 0,
	`detected_at` text NOT NULL,
	`notified_organizer` integer DEFAULT 0 NOT NULL,
	`action_taken` text DEFAULT 'logged',
	`submissions_invalidated` text,
	`webhook_delivery_id` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_force_push_team` ON `force_push_events` (`team_id`);--> statement-breakpoint
CREATE TABLE `hackathons` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`rules_md` text,
	`registration_opens` text NOT NULL,
	`registration_closes` text NOT NULL,
	`submission_deadline` text NOT NULL,
	`judging_starts` text,
	`judging_ends` text,
	`min_team_size` integer DEFAULT 1 NOT NULL,
	`max_team_size` integer DEFAULT 5 NOT NULL,
	`max_teams` integer,
	`submission_tag_pattern` text DEFAULT 'submission_v%' NOT NULL,
	`max_submissions_per_team` integer,
	`allow_late_submissions` integer DEFAULT 0 NOT NULL,
	`primary_color` text DEFAULT '#6366f1',
	`logo_r2_key` text,
	`banner_r2_key` text,
	`custom_subdomain` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hackathons_slug_unique` ON `hackathons` (`slug`);--> statement-breakpoint
CREATE TABLE `judge_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`judge_id` text NOT NULL,
	`team_id` text NOT NULL,
	`hackathon_id` text NOT NULL,
	`submission_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`assigned_at` text NOT NULL,
	FOREIGN KEY (`judge_id`) REFERENCES `judges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_judge_assignments_judge` ON `judge_assignments` (`judge_id`);--> statement-breakpoint
CREATE INDEX `idx_judge_assignments_hackathon` ON `judge_assignments` (`hackathon_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `judge_assignments_judge_id_team_id_unique` ON `judge_assignments` (`judge_id`,`team_id`);--> statement-breakpoint
CREATE TABLE `judges` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`user_id` text NOT NULL,
	`invite_status` text DEFAULT 'pending' NOT NULL,
	`invited_at` text NOT NULL,
	`accepted_at` text,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `judges_hackathon_id_user_id_unique` ON `judges` (`hackathon_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `organizer_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizer_roles_hackathon_id_user_id_unique` ON `organizer_roles` (`hackathon_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `rubric_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`max_score` integer DEFAULT 10 NOT NULL,
	`weight` real DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rubric_criteria_hackathon_id_name_unique` ON `rubric_criteria` (`hackathon_id`,`name`);--> statement-breakpoint
CREATE TABLE `scores` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`judge_id` text NOT NULL,
	`criteria_id` text NOT NULL,
	`score` integer NOT NULL,
	`comment` text,
	`scored_at` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`judge_id`) REFERENCES `judges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criteria_id`) REFERENCES `rubric_criteria`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_scores_submission` ON `scores` (`submission_id`);--> statement-breakpoint
CREATE INDEX `idx_scores_judge` ON `scores` (`judge_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scores_submission_id_judge_id_criteria_id_unique` ON `scores` (`submission_id`,`judge_id`,`criteria_id`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`hackathon_id` text NOT NULL,
	`tag_name` text NOT NULL,
	`commit_sha` text NOT NULL,
	`commit_message` text,
	`commit_author` text,
	`branch` text DEFAULT 'main',
	`submitted_at` text NOT NULL,
	`received_at` text NOT NULL,
	`is_late` integer DEFAULT 0 NOT NULL,
	`is_final` integer DEFAULT 0 NOT NULL,
	`version` integer NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`validation_errors` text,
	`locked_at` text,
	`webhook_delivery_id` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_webhook_delivery_id_unique` ON `submissions` (`webhook_delivery_id`);--> statement-breakpoint
CREATE INDEX `idx_submissions_team` ON `submissions` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_submissions_hackathon` ON `submissions` (`hackathon_id`);--> statement-breakpoint
CREATE INDEX `idx_submissions_status` ON `submissions` (`hackathon_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_submissions_webhook` ON `submissions` (`webhook_delivery_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_team_id_tag_name_unique` ON `submissions` (`team_id`,`tag_name`);--> statement-breakpoint
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
CREATE INDEX `idx_team_members_user` ON `team_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_team_members_team` ON `team_members` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_team_id_user_id_unique` ON `team_members` (`team_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`name` text NOT NULL,
	`repo_full_name` text,
	`repo_url` text,
	`github_installation_id` integer,
	`bot_active` integer DEFAULT 0 NOT NULL,
	`invite_code` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_invite_code_unique` ON `teams` (`invite_code`);--> statement-breakpoint
CREATE INDEX `idx_teams_hackathon` ON `teams` (`hackathon_id`);--> statement-breakpoint
CREATE INDEX `idx_teams_repo` ON `teams` (`repo_full_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_hackathon_id_name_unique` ON `teams` (`hackathon_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_hackathon_id_repo_full_name_unique` ON `teams` (`hackathon_id`,`repo_full_name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` integer NOT NULL,
	`google_id` text,
	`github_username` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`avatar_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_id_unique` ON `users` (`github_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);