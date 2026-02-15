import { sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';
import { users } from './users.js';

export const organizerRoles = sqliteTable('organizer_roles', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['organizer', 'co_organizer'] }).notNull().default('co_organizer'),
  assigned_by: text('assigned_by').references(() => users.id),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => ({
  uniqueHackathonUser: unique().on(table.hackathon_id, table.user_id),
}));
