import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { hackathons } from './hackathons.js';
import { users } from './users.js';

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').references(() => hackathons.id, { onDelete: 'set null' }),
  actor_id: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
  actor_type: text('actor_type').notNull(),
  event_type: text('event_type').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: text('entity_id').notNull(),
  metadata: text('metadata'),
  changes: text('changes'),
  hash: text('hash'),
  prev_hash: text('prev_hash'),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  entityIdx: index('idx_audit_entity').on(table.entity_type, table.entity_id),
  eventTypeIdx: index('idx_audit_event_type').on(table.event_type),
  actorIdx: index('idx_audit_actor').on(table.actor_id),
}));
