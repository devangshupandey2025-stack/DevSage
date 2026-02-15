import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
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
  device: text('device'),
  location: text('location'),
  used_at: text('used_at'),
  created_at: text('created_at').notNull(),
}, (table) => ({
  userIdx: index('refresh_tokens_user_idx').on(table.user_id),
  familyIdx: index('refresh_tokens_family_idx').on(table.family_id),
  expiresIdx: index('refresh_tokens_expires_idx').on(table.expires_at),
}));
