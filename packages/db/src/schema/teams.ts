import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  repo_full_name: text('repo_full_name'),
  repo_url: text('repo_url'),
  github_installation_id: integer('github_installation_id'),
  bot_active: integer('bot_active').notNull().default(0),
  invite_code: text('invite_code').unique(),
  created_at: text('created_at').notNull(),
}, (table) => ({
  uniqueHackathonName: unique().on(table.hackathon_id, table.name),
  uniqueHackathonRepo: unique().on(table.hackathon_id, table.repo_full_name),
  idxTeamsHackathon: index('idx_teams_hackathon').on(table.hackathon_id),
  idxTeamsRepo: index('idx_teams_repo').on(table.repo_full_name),
}));
