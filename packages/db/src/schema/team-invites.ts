import { sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { teams } from './teams.js';
import { users } from './users.js';

export const teamInvites = sqliteTable('team_invites', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  invite_token: text('invite_token').notNull().unique(),
  status: text('status').notNull().default('pending'),
  invited_by: text('invited_by').references(() => users.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  expires_at: text('expires_at').notNull(),
}, (table) => ({
  teamEmailUniq: uniqueIndex('uq_team_invites_team_email').on(table.team_id, table.email),
  emailIdx: index('idx_team_invites_email').on(table.email),
}));
