import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { workspaces } from './workspaces.js';
import { users } from './users.js';

export const workspaceInvites = sqliteTable('workspace_invites', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  email: text('email').notNull(),
  workspace_id: text('workspace_id').notNull().references(() => workspaces.id),
  role: text('role').notNull().default('workspace_member'),
  message: text('message'),
  status: text('status', { enum: ['pending', 'accepted', 'expired', 'revoked'] }).notNull().default('pending'),
  expires_at: text('expires_at').notNull(),
  created_by: text('created_by').notNull().references(() => users.id),
  accepted_by: text('accepted_by').references(() => users.id),
  accepted_at: text('accepted_at'),
  created_at: text('created_at').notNull(),
}, (table) => ({
  emailStatusIdx: index('workspace_invites_email_status_idx').on(table.email, table.status),
  wsIdx: index('workspace_invites_ws_idx').on(table.workspace_id),
}));
