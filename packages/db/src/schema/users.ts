import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  password_hash: text('password_hash'),
  github_id: integer('github_id'),
  github_username: text('github_username'),
  google_id: text('google_id'),
  avatar_url: text('avatar_url'),
  password_must_change: integer('password_must_change').notNull().default(0),
  email_verified: integer('email_verified').notNull().default(0),
  email_bounced: integer('email_bounced').notNull().default(0),
  suspended: integer('suspended').notNull().default(0),
  suspended_at: text('suspended_at'),
  suspended_reason: text('suspended_reason'),
  last_login_at: text('last_login_at'),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updated_at: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_unique').on(table.email),
  githubIdIdx: uniqueIndex('users_github_id_unique').on(table.github_id),
  googleIdIdx: uniqueIndex('users_google_id_unique').on(table.google_id),
  githubUsernameIdx: index('idx_users_github_username').on(table.github_username),
}));
