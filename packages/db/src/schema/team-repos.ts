import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { teams } from './teams.js';
import { hackathons } from './hackathons.js';

export const teamRepos = sqliteTable('team_repos', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id),
  provider: text('provider', { enum: ['github', 'gitlab', 'bitbucket'] }).notNull(),
  repo_full_name: text('repo_full_name').notNull(),
  repo_url: text('repo_url').notNull(),
  installation_id: text('installation_id'),
  bot_active: integer('bot_active').notNull().default(0),
  is_primary: integer('is_primary').notNull().default(1),
  access_token_encrypted: text('access_token_encrypted'),
  created_at: text('created_at').notNull(),
}, (table) => ({
  hackathonRepoIdx: uniqueIndex('team_repos_hackathon_repo_idx').on(table.hackathon_id, table.repo_full_name),
  teamIdx: index('team_repos_team_idx').on(table.team_id),
  repoIdx: index('team_repos_repo_idx').on(table.repo_full_name),
  botIdx: index('team_repos_bot_idx').on(table.hackathon_id, table.bot_active),
}));
