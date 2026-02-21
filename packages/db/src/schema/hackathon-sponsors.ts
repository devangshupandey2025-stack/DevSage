import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { hackathons } from './hackathons.js';

export const hackathonSponsors = sqliteTable('hackathon_sponsors', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tier: text('tier').notNull(),
  logo_url: text('logo_url'),
  website_url: text('website_url'),
  description: text('description'),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  hackathonIdx: index('idx_sponsors_hackathon').on(table.hackathon_id),
}));
