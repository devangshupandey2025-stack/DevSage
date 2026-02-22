CREATE TABLE `hackathon_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`requested_by` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`starts_at` text,
	`ends_at` text,
	`num_events` integer,
	`additional_details` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`admin_notes` text,
	`status_history` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_hackathon_requests_workspace` ON `hackathon_requests` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_hackathon_requests_status` ON `hackathon_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_hackathon_requests_requested_by` ON `hackathon_requests` (`requested_by`);