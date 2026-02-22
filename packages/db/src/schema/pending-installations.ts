import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const pendingInstallations = sqliteTable('pending_installations', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  repo_full_name: text('repo_full_name').notNull(),
  installation_id: text('installation_id').notNull(),
  installed_by: text('installed_by').notNull(),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  repoIdx: index('idx_pending_installations_repo').on(table.repo_full_name),
}));
