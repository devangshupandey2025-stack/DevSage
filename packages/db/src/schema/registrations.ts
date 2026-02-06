import { sqliteTable, text, primaryKey, unique } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';
import { users } from './users.js';

export const registrations = sqliteTable('registrations', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id),
  user_id: text('user_id').notNull().references(() => users.id),
  registered_at: text('registered_at').notNull(),
}, (table) => ({
  uniqueHackathonUser: unique().on(table.hackathon_id, table.user_id),
}));
