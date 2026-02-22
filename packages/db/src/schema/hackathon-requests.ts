import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces.js';
import { users } from './users.js';

export const hackathonRequests = sqliteTable('hackathon_requests', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  requested_by: text('requested_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  starts_at: text('starts_at'),
  ends_at: text('ends_at'),
  num_events: integer('num_events'),
  additional_details: text('additional_details'),
  status: text('status').notNull().default('submitted'),
  admin_notes: text('admin_notes'),
  status_history: text('status_history').notNull().default('[]'),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updated_at: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  workspaceIdx: index('idx_hackathon_requests_workspace').on(table.workspace_id),
  statusIdx: index('idx_hackathon_requests_status').on(table.status),
  requestedByIdx: index('idx_hackathon_requests_requested_by').on(table.requested_by),
}));
