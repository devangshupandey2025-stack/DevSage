import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { teamRepos } from './team-repos.js';

export const forcePushEvents = sqliteTable('force_push_events', {
  id: text('id').primaryKey(),
  team_repo_id: text('team_repo_id').notNull().references(() => teamRepos.id, { onDelete: 'cascade' }),
  before_sha: text('before_sha').notNull(),
  after_sha: text('after_sha').notNull(),
  ref: text('ref').notNull(),
  pusher_login: text('pusher_login').notNull(),
  detected_at: text('detected_at').notNull(),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  repoIdx: index('idx_force_push_repo').on(table.team_repo_id),
}));
