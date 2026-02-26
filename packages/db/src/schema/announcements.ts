import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { hackathons } from './hackathons.js';
import { users } from './users.js';

export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').references(() => hackathons.id, { onDelete: 'cascade' }),
  author_id: text('author_id').references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  pinned: integer('pinned').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updated_at: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  hackathonIdx: index('idx_announcements_hackathon').on(table.hackathon_id),
}));
