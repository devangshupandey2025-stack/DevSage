import { sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';
import { teams } from './teams.js';

export const submissions = sqliteTable('submissions', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id),
  team_id: text('team_id').notNull().references(() => teams.id),
  repo_full_name: text('repo_full_name').notNull(),
  commit_sha: text('commit_sha').notNull(),
  submitted_at: text('submitted_at').notNull(),
  status: text('status', { enum: ['pending', 'accepted', 'locked'] }).notNull().default('pending'),
}, (table) => ({
  uniqueHackathonTeam: unique().on(table.hackathon_id, table.team_id),
}));
