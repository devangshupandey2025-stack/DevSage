import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';
import { users } from './users.js';

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  sequence: integer('sequence').notNull(),
  hackathon_id: text('hackathon_id').references(() => hackathons.id),
  actor_id: text('actor_id').references(() => users.id),
  actor_type: text('actor_type', { enum: ['user', 'system', 'bot', 'cron'] }).notNull(),
  actor_ip: text('actor_ip'),
  actor_user_agent: text('actor_user_agent'),
  action: text('action').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: text('entity_id').notNull(),
  details: text('details').notNull().default('{}'),
  changes: text('changes'),
  hash: text('hash').notNull(),
  prev_hash: text('prev_hash'),
  anonymized_at: text('anonymized_at'),
  created_at: text('created_at').notNull(),
}, (table) => ({
  idxAuditHackathonTime: index('idx_audit_hackathon_time').on(table.hackathon_id, table.created_at),
  idxAuditHackathonSeq: index('idx_audit_hackathon_seq').on(table.hackathon_id, table.sequence),
  idxAuditEntity: index('idx_audit_entity').on(table.entity_type, table.entity_id),
  idxAuditActor: index('idx_audit_actor').on(table.actor_id, table.created_at),
  idxAuditAction: index('idx_audit_action').on(table.action),
  idxAuditCreatedAt: index('idx_audit_created_at').on(table.created_at),
}));
