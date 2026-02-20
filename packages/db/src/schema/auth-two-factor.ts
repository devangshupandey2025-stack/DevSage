import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth-user.js';

export const twoFactor = sqliteTable('two_factor', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  userId: text('user_id').notNull().references(() => user.id),
});
