import { sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { hackathons } from './hackathons.js';
import { user } from './auth-user.js';

export const judges = sqliteTable('judges', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  user_id: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  email: text('email').notNull(),
  invite_status: text('invite_status').notNull().default('pending'),
  invite_token: text('invite_token').notNull().unique(),
  invited_by: text('invited_by').references(() => user.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  accepted_at: text('accepted_at'),
}, (table) => ({
  hackathonUserUniq: uniqueIndex('judges_hackathon_id_user_id_unique').on(table.hackathon_id, table.user_id),
  userIdx: index('idx_judges_user').on(table.user_id),
}));
