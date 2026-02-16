import { eq, desc, isNull } from 'drizzle-orm';
import { auditEvents } from '@devsage/db';
import type { DbClient } from '@devsage/db';

const encoder = new TextEncoder();

interface HashableEvent {
  id: string;
  hackathon_id: string | null;
  actor_id: string | null;
  actor_type: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  metadata: string;
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
    event.event_type,
    event.entity_type,
    event.entity_id,
    event.metadata,
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
  eventType: string;
  entityType: string;
  entityId: string;
  teamId?: string;
  metadata?: Record<string, unknown>;
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
    const metadata = input.metadata ? JSON.stringify(input.metadata) : '{}';

    const hash = await computeEventHash(
      {
        id,
        hackathon_id: hackathonId,
        actor_id: input.actorId ?? null,
        actor_type: input.actorType,
        event_type: input.eventType,
        entity_type: input.entityType,
        entity_id: input.entityId,
        metadata,
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
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      team_id: input.teamId ?? null,
      metadata,
      changes: input.changes ? JSON.stringify(input.changes) : null,
      hash,
      prev_hash: prevHash,
      created_at: now,
    });
  } catch (error) {
    console.warn('insertAuditEvent failed (non-fatal):', {
      eventType: input.eventType,
      entityType: input.entityType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
