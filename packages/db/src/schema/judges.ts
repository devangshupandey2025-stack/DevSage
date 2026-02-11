import { sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';
import { users } from './users.js';

export const judges = sqliteTable('judges', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id),
  invite_status: text('invite_status', { enum: ['pending', 'accepted', 'declined'] }).notNull().default('pending'),
  invited_at: text('invited_at').notNull(),
  accepted_at: text('accepted_at'),
}, (table) => ({
  uniqueHackathonUser: unique().on(table.hackathon_id, table.user_id),
}));
