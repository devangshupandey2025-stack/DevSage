import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';
import { workspaces } from './workspaces.js';

export const hackathonTemplates = sqliteTable('hackathon_templates', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').references(() => workspaces.id),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  config_snapshot: text('config_snapshot').notNull(),
  rubric_snapshot: text('rubric_snapshot').notNull().default('[]'),
  created_by: text('created_by').notNull().references(() => users.id),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => ({
  idxWs: index('hackathon_templates_ws_idx').on(table.workspace_id),
  idxCreator: index('hackathon_templates_creator_idx').on(table.created_by),
}));
