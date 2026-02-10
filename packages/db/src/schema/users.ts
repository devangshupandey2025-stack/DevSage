import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  github_id: integer('github_id').notNull().unique(),
  google_id: text('google_id').unique(),
  github_username: text('github_username').notNull(),
  display_name: text('display_name').notNull(),
  email: text('email'),
  avatar_url: text('avatar_url'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
