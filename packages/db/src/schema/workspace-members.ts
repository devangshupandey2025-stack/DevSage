import { sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { workspaces } from './workspaces.js';
import { users } from './users.js';

export const workspaceMembers = sqliteTable('workspace_members', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['workspace_owner', 'workspace_admin', 'workspace_member'] }).notNull(),
  invited_by: text('invited_by').references(() => users.id),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => ({
  wsUserIdx: uniqueIndex('workspace_members_ws_user_idx').on(table.workspace_id, table.user_id),
  userIdx: index('workspace_members_user_idx').on(table.user_id),
}));
