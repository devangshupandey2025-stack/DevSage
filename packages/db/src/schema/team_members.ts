import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { teams } from './teams.js';
import { users } from './users.js';

export const teamMembers = sqliteTable('team_members', {
  team_id: text('team_id').notNull().references(() => teams.id),
  user_id: text('user_id').notNull().references(() => users.id),
  joined_at: text('joined_at').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.team_id, table.user_id] }),
}));
