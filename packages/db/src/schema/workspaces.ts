import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  type: text('type').notNull().default('club'),
  logo_url: text('logo_url'),
  website: text('website'),
  settings: text('settings').notNull().default('{}'),
  created_by: text('created_by').notNull().references(() => users.id),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updated_at: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  createdByIdx: index('idx_workspaces_created_by').on(table.created_by),
}));
