import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { teams } from './teams.js';

export const pendingInstallations = sqliteTable('pending_installations', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  github_owner: text('github_owner').notNull(),
  github_repo: text('github_repo').notNull(),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  repoIdx: index('idx_pending_installations_repo').on(table.github_owner, table.github_repo),
}));
