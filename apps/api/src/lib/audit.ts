interface AuditEventInput {
  hackathon_id?: string | null;
  actor_id?: string | null;
  actor_type: 'user' | 'system' | 'bot' | 'cron';
  event_type: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, unknown> | null;
  changes?: Record<string, unknown> | null;
}

export async function insertAuditEvent(
  db: D1Database,
  input: AuditEventInput
): Promise<string> {
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO audit_events (id, hackathon_id, actor_id, actor_type, event_type, entity_type, entity_id, metadata, changes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    input.hackathon_id ?? null,
    input.actor_id ?? null,
    input.actor_type,
    input.event_type,
    input.entity_type,
    input.entity_id,
    input.metadata ? JSON.stringify(input.metadata) : null,
    input.changes ? JSON.stringify(input.changes) : null
  ).run();
  return id;
}

export async function backfillAuditHashes(db: D1Database, limit: number = 100): Promise<number> {
  // Find unhashed events using rowid ordering
  const unhashed = await db.prepare(
    `SELECT rowid, id, hackathon_id FROM audit_events WHERE hash IS NULL ORDER BY rowid ASC LIMIT ?`
  ).bind(limit).all<{ rowid: number; id: string; hackathon_id: string | null }>();

  if (!unhashed.results || unhashed.results.length === 0) return 0;

  let processed = 0;
  for (const event of unhashed.results) {
    // Get prev_hash for this hackathon's chain
    const prev = await db.prepare(
      `SELECT hash FROM audit_events
       WHERE hackathon_id IS ? AND hash IS NOT NULL AND rowid < ?
       ORDER BY rowid DESC LIMIT 1`
    ).bind(event.hackathon_id, event.rowid).first<{ hash: string }>();

    const prevHash = prev?.hash ?? null;

    // Compute hash: SHA-256(id + prev_hash + hackathon_id)
    const encoder = new TextEncoder();
    const hashInput = `${event.id}:${prevHash ?? 'genesis'}:${event.hackathon_id ?? 'global'}`;
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(hashInput));
    const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');

    await db.prepare(
      `UPDATE audit_events SET hash = ?, prev_hash = ? WHERE id = ?`
    ).bind(hash, prevHash, event.id).run();

    processed++;
  }

  return processed;
}
