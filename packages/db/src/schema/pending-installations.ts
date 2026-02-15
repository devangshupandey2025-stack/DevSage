import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const pendingInstallations = sqliteTable('pending_installations', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  repo_full_name: text('repo_full_name').notNull(),
  installation_id: text('installation_id').notNull(),
  installed_by: text('installed_by').notNull(),
  created_at: text('created_at').notNull(),
}, (table) => ({
  providerRepoIdx: uniqueIndex('pending_installations_provider_repo_idx').on(table.provider, table.repo_full_name),
}));
