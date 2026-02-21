import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token_hash: text('token_hash').notNull().unique(),
  family_id: text('family_id').notNull(),
  expires_at: text('expires_at').notNull(),
  revoked: integer('revoked').notNull().default(0),
  revoked_at: text('revoked_at'),
  replaced_by: text('replaced_by'),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  tokenHashIdx: uniqueIndex('refresh_tokens_token_hash_unique').on(table.token_hash),
  userIdx: index('idx_refresh_tokens_user').on(table.user_id),
  familyIdx: index('idx_refresh_tokens_family').on(table.family_id),
  expiresIdx: index('idx_refresh_tokens_expires').on(table.expires_at),
}));
