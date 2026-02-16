import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { hackathons } from './hackathons.js';
import { users } from './users.js';

export const judges = sqliteTable('judges', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  user_id: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: text('email').notNull(),
  invite_status: text('invite_status').notNull().default('pending'),
  invite_token: text('invite_token').notNull().unique(),
  invited_by: text('invited_by').references(() => users.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  accepted_at: text('accepted_at'),
}, (table) => ({
  hackathonEmailUniq: uniqueIndex('uq_judges_hackathon_email').on(table.hackathon_id, table.email),
}));
