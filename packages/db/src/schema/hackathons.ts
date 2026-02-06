import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const hackathons = sqliteTable('hackathons', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  organiser_id: text('organiser_id').notNull().references(() => users.id),
  status: text('status', { 
    enum: ['DRAFT', 'REGISTRATION_OPEN', 'HACKING', 'SUBMISSION_CLOSED', 'COMPLETED'] 
  }).notNull().default('DRAFT'),
  max_team_size: integer('max_team_size').notNull().default(4),
  registration_start_date: text('registration_start_date').notNull(),
  hacking_start_date: text('hacking_start_date').notNull(),
  submission_deadline: text('submission_deadline').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
