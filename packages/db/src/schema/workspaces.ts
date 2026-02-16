import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  type: text('type', { enum: ['club', 'individual'] }).notNull().default('individual'),
  description: text('description').notNull().default(''),
  logo_url: text('logo_url'),
  website: text('website'),
  settings: text('settings').notNull().default('{}'),
  created_by: text('created_by').notNull().references(() => users.id),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
