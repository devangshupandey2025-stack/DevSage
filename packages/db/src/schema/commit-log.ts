import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { teamRepos } from './team-repos.js';

export const commitLog = sqliteTable('commit_log', {
  id: text('id').primaryKey(),
  team_repo_id: text('team_repo_id').notNull().references(() => teamRepos.id, { onDelete: 'cascade' }),
  commit_sha: text('commit_sha').notNull(),
  commit_message: text('commit_message').notNull(),
  author_login: text('author_login'),
  author_email: text('author_email'),
  committed_at: text('committed_at').notNull(),
  pushed_at: text('pushed_at').notNull(),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  repoTimeIdx: index('idx_commit_log_repo_time').on(table.team_repo_id, table.committed_at),
}));
