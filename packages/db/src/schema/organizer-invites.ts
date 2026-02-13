import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const organizerInvites = sqliteTable('organizer_invites', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  invite_code: text('invite_code').notNull().unique(),
  status: text('status', { enum: ['pending', 'accepted', 'expired', 'revoked'] }).notNull().default('pending'),
  invited_by: text('invited_by').notNull().references(() => users.id),
  accepted_by: text('accepted_by').references(() => users.id),
  accepted_at: text('accepted_at'),
  expires_at: text('expires_at').notNull(),
  created_at: text('created_at').notNull(),
});
