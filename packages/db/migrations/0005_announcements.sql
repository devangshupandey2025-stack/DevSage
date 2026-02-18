CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text REFERENCES `hackathons`(`id`) ON DELETE CASCADE NOT NULL,
	`author_id` text REFERENCES `users`(`id`),
	`title` text NOT NULL,
	`content` text NOT NULL,
	`pinned` integer NOT NULL DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
CREATE INDEX `announcements_hackathon_id_idx` ON `announcements`(`hackathon_id`);
