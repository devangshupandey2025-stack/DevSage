import { auditEvents } from '@devsage/db';
import type { DbClient } from '@devsage/db';

export interface AuditEventInput {
  hackathonId?: string;
  actorId?: string;
  actorType: 'user' | 'system' | 'bot' | 'cron';
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Insert an audit event. Fail-open: never throws.
 * If the DB insert fails, logs a warning and continues.
 */
export async function insertAuditEvent(db: DbClient, input: AuditEventInput): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      hackathon_id: input.hackathonId ?? null,
      actor_id: input.actorId ?? null,
      actor_type: input.actorType,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      details: input.details ? JSON.stringify(input.details) : null,
      ip_address: input.ipAddress ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('insertAuditEvent failed (non-fatal):', {
      action: input.action,
      entityType: input.entityType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
