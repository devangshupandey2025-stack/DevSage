import { sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  avatar_url: text('avatar_url'),
  provider: text('provider', { enum: ['google', 'github'] }).notNull(),
  provider_id: text('provider_id').notNull(),
  role: text('role', { enum: ['organizer', 'participant'] }).notNull().default('participant'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => ({
  users_email_provider_unique: unique().on(table.email, table.provider),
}));
