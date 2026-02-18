-- Add is_initialized column to hackathon_rounds
-- When a round is initialized (by admin), submissions are opened for participants
ALTER TABLE `hackathon_rounds` ADD COLUMN `is_initialized` integer NOT NULL DEFAULT 0;
