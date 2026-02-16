# Audit Ingestion

> `apps/api/src/lib/audit.ts` — `insertAuditEvent()` implementation.

## Function

```ts
async function insertAuditEvent(
  db: D1Database,
  event: {
    hackathon_id?: string | null;
    actor_id?: string | null;
    actor_type: 'user' | 'system' | 'bot' | 'cron';
    event_type: string;
    entity_type: string;
    entity_id: string;
    metadata?: Record<string, unknown>;
    changes?: Record<string, { old: unknown; new: unknown }>;
  }
): Promise<void> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // 1. Get previous hash + next sequence number
  const prev = await db.prepare(`
    SELECT hash, sequence FROM audit_events
    WHERE hackathon_id ${event.hackathon_id ? '= ?' : 'IS NULL'}
    ORDER BY sequence DESC LIMIT 1
  `).bind(...(event.hackathon_id ? [event.hackathon_id] : [])).first();

  const prevHash = prev?.hash ?? '0'.repeat(64);
  const sequence = (prev?.sequence ?? 0) + 1;

  // 2. Compute hash
  const hash = await computeHash({
    id,
    hackathon_id: event.hackathon_id ?? null,
    actor_id: event.actor_id ?? null,
    actor_type: event.actor_type,
    event_type: event.event_type,
    entity_type: event.entity_type,
    entity_id: event.entity_id,
    metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    created_at: createdAt,
  }, prevHash);

  // 3. Insert
  await db.prepare(`
    INSERT INTO audit_events (id, sequence, hackathon_id, actor_id, actor_type, event_type, entity_type, entity_id, metadata, changes, hash, prev_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, sequence,
    event.hackathon_id ?? null,
    event.actor_id ?? null,
    event.actor_type,
    event.event_type,
    event.entity_type,
    event.entity_id,
    event.metadata ? JSON.stringify(event.metadata) : null,
    event.changes ? JSON.stringify(event.changes) : null,
    hash, prevHash, createdAt,
  ).run();
}
```

## Usage in Route Handlers

```ts
// After a state transition:
await insertAuditEvent(db, {
  hackathon_id: hackathonId,
  actor_id: userId,
  actor_type: 'user',
  event_type: 'hackathon.transitioned',
  entity_type: 'hackathon',
  entity_id: hackathonId,
  changes: {
    status: { old: 'draft', new: 'active' },
  },
});

// System event (no actor):
await insertAuditEvent(db, {
  hackathon_id: hackathonId,
  actor_type: 'cron',
  event_type: 'cron.deadline_transition',
  entity_type: 'hackathon',
  entity_id: hackathonId,
});
```

## Implementation Notes

- `insertAuditEvent()` is called in every mutation route handler
- Sequence is per-hackathon (or global if `hackathon_id` is null)
- Hash chain provides tamper evidence — not encryption
- The function is synchronous with the mutation (not queued) — audit must not be lost
- If the audit insert fails, the mutation should also fail (transactional integrity)
