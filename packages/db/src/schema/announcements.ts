import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';
import { users } from './users.js';

export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey(),
  hackathonId: text('hackathon_id').references(() => hackathons.id, { onDelete: 'cascade' }),
  authorId: text('author_id').references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  pinned: integer('pinned').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
