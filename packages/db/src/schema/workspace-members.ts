import { sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces.js';
import { user } from './auth-user.js';

export const workspaceMembers = sqliteTable('workspace_members', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  invited_by: text('invited_by').references(() => user.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  workspaceUserUniq: uniqueIndex('uq_workspace_members_workspace_user').on(table.workspace_id, table.user_id),
  userIdx: index('idx_workspace_members_user').on(table.user_id),
}));
