import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  family_id: text('family_id').notNull(),
  token_hash: text('token_hash').notNull().unique(),
  revoked_at: text('revoked_at'),
  expires_at: text('expires_at').notNull(),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  userIdx: index('idx_refresh_tokens_user').on(table.user_id),
  familyIdx: index('idx_refresh_tokens_family').on(table.family_id),
}));
