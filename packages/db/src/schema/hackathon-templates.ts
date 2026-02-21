import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces.js';
import { users } from './users.js';

export const hackathonTemplates = sqliteTable('hackathon_templates', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  settings: text('settings').notNull().default('{}'),
  tracks: text('tracks').notNull().default('[]'),
  rounds: text('rounds').notNull().default('[]'),
  rubric: text('rubric').notNull().default('[]'),
  is_platform_default: integer('is_platform_default').notNull().default(0),
  created_by: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updated_at: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  workspaceIdx: index('idx_hackathon_templates_workspace').on(table.workspace_id),
}));
