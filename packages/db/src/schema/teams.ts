import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';
import { users } from './users.js';

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id),
  name: text('name').notNull(),
  join_code: text('join_code').notNull().unique(),
  captain_id: text('captain_id').notNull().references(() => users.id),
  created_at: text('created_at').notNull(),
});
