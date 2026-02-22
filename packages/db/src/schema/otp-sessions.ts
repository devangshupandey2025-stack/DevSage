import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const otpSessions = sqliteTable('otp_sessions', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  otp_hash: text('otp_hash').notNull(),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  attempts: integer('attempts').notNull().default(0),
  max_attempts: integer('max_attempts').notNull().default(5),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  expires_at: text('expires_at').notNull(),
  verified_at: text('verified_at'),
}, (table) => ({
  userIdIdx: index('idx_otp_sessions_user_id').on(table.user_id),
  expiresAtIdx: index('idx_otp_sessions_expires_at').on(table.expires_at),
}));

export const emailVerificationTokens = sqliteTable('email_verification_tokens', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token_hash: text('token_hash').notNull().unique(),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  expires_at: text('expires_at').notNull(),
  used_at: text('used_at'),
}, (table) => ({
  userIdIdx: index('idx_email_verification_user_id').on(table.user_id),
  tokenHashIdx: index('idx_email_verification_token_hash').on(table.token_hash),
  expiresAtIdx: index('idx_email_verification_expires_at').on(table.expires_at),
}));

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token_hash: text('token_hash').notNull().unique(),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  expires_at: text('expires_at').notNull(),
  used_at: text('used_at'),
}, (table) => ({
  userIdIdx: index('idx_password_reset_user_id').on(table.user_id),
  tokenHashIdx: index('idx_password_reset_token_hash').on(table.token_hash),
  expiresAtIdx: index('idx_password_reset_expires_at').on(table.expires_at),
}));
