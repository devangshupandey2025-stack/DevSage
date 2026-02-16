import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces.js';
import { users } from './users.js';

export const hackathons = sqliteTable('hackathons', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  status: text('status').notNull().default('draft'),
  start_date: text('start_date'),
  end_date: text('end_date'),
  submission_deadline: text('submission_deadline'),
  max_team_size: integer('max_team_size').notNull().default(5),
  min_team_size: integer('min_team_size').notNull().default(1),
  max_teams: integer('max_teams'),
  settings: text('settings'),
  created_by: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updated_at: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  workspaceIdx: index('idx_hackathons_workspace').on(table.workspace_id),
  statusIdx: index('idx_hackathons_status').on(table.status),
}));
