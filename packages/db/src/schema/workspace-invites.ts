import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces.js';
import { users } from './users.js';

export const workspaceInvites = sqliteTable('workspace_invites', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull(),
  invite_token: text('invite_token').notNull().unique(),
  invited_by: text('invited_by').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('pending'),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  expires_at: text('expires_at').notNull(),
}, (table) => ({
  emailIdx: index('idx_workspace_invites_email').on(table.email),
}));
