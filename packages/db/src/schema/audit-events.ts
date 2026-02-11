import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';
import { users } from './users.js';

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').references(() => hackathons.id),
  actor_id: text('actor_id').references(() => users.id),
  actor_type: text('actor_type', { enum: ['user', 'system', 'bot', 'cron'] }).notNull(),
  action: text('action').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: text('entity_id').notNull(),
  details: text('details'),
  ip_address: text('ip_address'),
  created_at: text('created_at').notNull(),
}, (table) => ({
  idxAuditHackathon: index('idx_audit_hackathon').on(table.hackathon_id, table.created_at),
  idxAuditEntity: index('idx_audit_entity').on(table.entity_type, table.entity_id),
}));
