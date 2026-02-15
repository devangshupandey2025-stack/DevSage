import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';
import { users } from './users.js';

export const hackathonSponsors = sqliteTable('hackathon_sponsors', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tier: text('tier').notNull().default('standard'),
  logo_r2_key: text('logo_r2_key'),
  website: text('website'),
  description: text('description').notNull().default(''),
  sort_order: integer('sort_order').notNull().default(0),
  created_by: text('created_by').notNull().references(() => users.id),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => ({
  idxHackathonTier: index('hackathon_sponsors_hackathon_tier_idx').on(table.hackathon_id, table.tier, table.sort_order),
  uniqueName: uniqueIndex('hackathon_sponsors_name_idx').on(table.hackathon_id, table.name),
}));
