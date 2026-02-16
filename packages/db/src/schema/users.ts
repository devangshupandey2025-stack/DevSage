import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  github_id: integer('github_id').unique(),
  github_username: text('github_username'),
  google_id: text('google_id').unique(),
  avatar_url: text('avatar_url'),
  auth_provider: text('auth_provider').notNull(),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  last_login_at: text('last_login_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});
