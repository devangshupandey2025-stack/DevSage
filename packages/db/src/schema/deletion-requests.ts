import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const deletionRequests = sqliteTable('deletion_requests', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token_hash: text('token_hash').notNull(),
  expires_at: text('expires_at').notNull(),
  confirmed_at: text('confirmed_at'),
  completed_at: text('completed_at'),
  created_at: text('created_at').notNull(),
}, (table) => ({
  userIdx: index('deletion_requests_user_idx').on(table.user_id),
  tokenHashIdx: index('deletion_requests_token_hash_idx').on(table.token_hash),
}));
