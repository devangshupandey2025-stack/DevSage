import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { teams } from './teams.js';
import { users } from './users.js';

export const teamRepos = sqliteTable('team_repos', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().unique().references(() => teams.id, { onDelete: 'cascade' }),
  github_repo_url: text('github_repo_url').notNull(),
  github_owner: text('github_owner').notNull(),
  github_repo: text('github_repo').notNull(),
  github_installation_id: integer('github_installation_id'),
  bot_active: integer('bot_active').notNull().default(0),
  linked_by: text('linked_by').references(() => users.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  githubIdx: index('idx_team_repos_github').on(table.github_owner, table.github_repo),
}));
