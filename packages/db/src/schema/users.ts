import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  github_id: integer('github_id').unique(),
  google_id: text('google_id').unique(),
  github_username: text('github_username'),
  github_elevated_token: text('github_elevated_token'),
  display_name: text('display_name').notNull(),
  email: text('email'),
  avatar_url: text('avatar_url'),
  email_verified: integer('email_verified').notNull().default(0),
  email_bounced: integer('email_bounced').notNull().default(0),
  suspended: integer('suspended').notNull().default(0),
  suspended_at: text('suspended_at'),
  suspended_reason: text('suspended_reason'),
  last_login_at: text('last_login_at'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => ({
  idxUsersEmail: index('idx_users_email').on(table.email),
}));
