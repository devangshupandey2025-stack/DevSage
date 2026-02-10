import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const hackathons = sqliteTable('hackathons', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  organizer_id: text('organizer_id').notNull().references(() => users.id),
  status: text('status', { 
    enum: ['draft', 'registration_open', 'registration_closed', 'active', 'judging', 'completed', 'archived'] 
  }).notNull().default('draft'),
  max_team_size: integer('max_team_size').notNull().default(4),
  registration_start_date: text('registration_start_date').notNull(),
  hacking_start_date: text('hacking_start_date').notNull(),
  submission_deadline: text('submission_deadline').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
