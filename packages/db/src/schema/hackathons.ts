import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const hackathons = sqliteTable('hackathons', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  rules_md: text('rules_md'),
  registration_opens: text('registration_opens').notNull(),
  registration_closes: text('registration_closes').notNull(),
  submission_deadline: text('submission_deadline').notNull(),
  judging_starts: text('judging_starts'),
  judging_ends: text('judging_ends'),
  min_team_size: integer('min_team_size').notNull().default(1),
  max_team_size: integer('max_team_size').notNull().default(5),
  max_teams: integer('max_teams'),
  submission_tag_pattern: text('submission_tag_pattern').notNull().default('submission_v%'),
  max_submissions_per_team: integer('max_submissions_per_team'),
  allow_late_submissions: integer('allow_late_submissions').notNull().default(0),
  primary_color: text('primary_color').default('#6366f1'),
  logo_r2_key: text('logo_r2_key'),
  banner_r2_key: text('banner_r2_key'),
  custom_subdomain: text('custom_subdomain'),
  status: text('status', {
    enum: ['draft', 'registration_open', 'registration_closed', 'active', 'judging', 'completed', 'archived']
  }).notNull().default('draft'),
  created_by: text('created_by').notNull().references(() => users.id),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
