import { eq, desc, isNull } from 'drizzle-orm';
import { auditEvents } from '@devsage/db';
import type { DbClient } from '@devsage/db';

const encoder = new TextEncoder();

interface HashableEvent {
  id: string;
  hackathon_id: string | null;
  actor_id: string | null;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  created_at: string;
}

async function computeEventHash(
  event: HashableEvent,
  prevHash: string | null,
): Promise<string> {
  const payload = [
    event.id,
    event.hackathon_id ?? '',
    event.actor_id ?? '',
    event.actor_type,
    event.action,
    event.entity_type,
    event.entity_id,
    event.details,
    event.created_at,
    prevHash ?? 'GENESIS',
  ].join('|');

  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
  const hashArray = new Uint8Array(hashBuffer);
  let hex = '';
  for (const byte of hashArray) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export interface AuditEventInput {
  hackathonId?: string;
  actorId?: string;
  actorType: 'user' | 'system' | 'bot' | 'cron';
  actorIp?: string;
  actorUserAgent?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
  changes?: { before: Record<string, unknown>; after: Record<string, unknown> };
}

export async function insertAuditEvent(db: DbClient, input: AuditEventInput): Promise<void> {
  try {
    const hackathonId = input.hackathonId ?? null;

    const lastEvent = hackathonId
      ? await db
          .select({ sequence: auditEvents.sequence, hash: auditEvents.hash })
          .from(auditEvents)
          .where(eq(auditEvents.hackathon_id, hackathonId))
          .orderBy(desc(auditEvents.sequence))
          .limit(1)
          .get()
      : await db
          .select({ sequence: auditEvents.sequence, hash: auditEvents.hash })
          .from(auditEvents)
          .where(isNull(auditEvents.hackathon_id))
          .orderBy(desc(auditEvents.sequence))
          .limit(1)
          .get();

    const sequence = (lastEvent?.sequence ?? 0) + 1;
    const prevHash = lastEvent?.hash ?? null;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const details = input.details ? JSON.stringify(input.details) : '{}';

    const hash = await computeEventHash(
      {
        id,
        hackathon_id: hackathonId,
        actor_id: input.actorId ?? null,
        actor_type: input.actorType,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId,
        details,
        created_at: now,
      },
      prevHash,
    );

    await db.insert(auditEvents).values({
      id,
      sequence,
      hackathon_id: hackathonId,
      actor_id: input.actorId ?? null,
      actor_type: input.actorType,
      actor_ip: input.actorIp ?? null,
      actor_user_agent: input.actorUserAgent?.substring(0, 256) ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      details,
      changes: input.changes ? JSON.stringify(input.changes) : null,
      hash,
      prev_hash: prevHash,
      created_at: now,
    });
  } catch (error) {
    console.warn('insertAuditEvent failed (non-fatal):', {
      action: input.action,
      entityType: input.entityType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
