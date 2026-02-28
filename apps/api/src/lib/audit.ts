interface AuditEventInput {
  hackathon_id?: string | null;
  actor_id?: string | null;
  actor_type: 'user' | 'system' | 'bot' | 'cron';
  actor_ip?: string | null;
  actor_user_agent?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: Record<string, unknown> | null;
  changes?: Record<string, unknown> | null;
}

/**
 * Compute SHA-256 hash for audit chain integrity.
 * Includes event content (action, entity, details) for tamper detection.
 */
async function computeAuditHash(
  id: string,
  prevHash: string | null,
  hackathonId: string | null,
  action: string,
  entityType: string,
  entityId: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const hashInput = `${id}:${prevHash ?? 'genesis'}:${hackathonId ?? 'global'}:${action}:${entityType}:${entityId}`;
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(hashInput));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function insertAuditEvent(
  db: D1Database,
  input: AuditEventInput
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    // Get next sequence number scoped to hackathon (or global)
    const scopeFilter = input.hackathon_id
      ? 'hackathon_id = ?'
      : 'hackathon_id IS NULL';
    const seqResult = await db.prepare(
      `SELECT MAX(sequence) as max_seq FROM audit_events WHERE ${scopeFilter}`
    ).bind(...(input.hackathon_id ? [input.hackathon_id] : [])).first<{ max_seq: number | null }>();
    const sequence = (seqResult?.max_seq ?? 0) + 1;

    // Get previous hash for chain integrity
    const prevResult = await db.prepare(
      `SELECT hash FROM audit_events WHERE ${scopeFilter} AND hash IS NOT NULL ORDER BY sequence DESC LIMIT 1`
    ).bind(...(input.hackathon_id ? [input.hackathon_id] : [])).first<{ hash: string }>();
    const prevHash = prevResult?.hash ?? null;

    // Compute hash including event content for tamper detection
    const hash = await computeAuditHash(
      id, prevHash, input.hackathon_id ?? null,
      input.action, input.entity_type, input.entity_id,
    );

    await db.prepare(
      `INSERT INTO audit_events (id, sequence, hackathon_id, actor_id, actor_type, actor_ip, actor_user_agent, action, entity_type, entity_id, details, changes, hash, prev_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      sequence,
      input.hackathon_id ?? null,
      input.actor_id ?? null,
      input.actor_type,
      input.actor_ip ?? null,
      input.actor_user_agent ?? null,
      input.action,
      input.entity_type,
      input.entity_id,
      JSON.stringify(input.details ?? {}),
      input.changes ? JSON.stringify(input.changes) : null,
      hash,
      prevHash,
      now
    ).run();
    return id;
  } catch (err) {
    // Log audit failures — these run in waitUntil() and must not be silent
    console.error(`[audit] Failed to insert audit event (action=${input.action}, entity=${input.entity_type}:${input.entity_id}):`,
      err instanceof Error ? err.message : err);
    return id;
  }
}

export async function backfillAuditHashes(db: D1Database, limit: number = 100): Promise<number> {
  // Find unhashed events using sequence ordering
  const unhashed = await db.prepare(
    `SELECT sequence, id, hackathon_id, action, entity_type, entity_id FROM audit_events WHERE hash IS NULL ORDER BY sequence ASC LIMIT ?`
  ).bind(limit).all<{ sequence: number; id: string; hackathon_id: string | null; action: string; entity_type: string; entity_id: string }>();

  if (!unhashed.results || unhashed.results.length === 0) return 0;

  let processed = 0;
  for (const event of unhashed.results) {
    try {
      // Get prev_hash for this hackathon's chain
      const scopeFilter = event.hackathon_id
        ? 'hackathon_id = ?'
        : 'hackathon_id IS NULL';
      const prev = await db.prepare(
        `SELECT hash FROM audit_events
         WHERE ${scopeFilter} AND hash IS NOT NULL AND sequence < ?
         ORDER BY sequence DESC LIMIT 1`
      ).bind(...(event.hackathon_id ? [event.hackathon_id] : []), event.sequence).first<{ hash: string }>();

      const prevHash = prev?.hash ?? null;

      // Compute hash including event content
      const hash = await computeAuditHash(
        event.id, prevHash, event.hackathon_id,
        event.action, event.entity_type, event.entity_id,
      );

      await db.prepare(
        `UPDATE audit_events SET hash = ?, prev_hash = ? WHERE id = ?`
      ).bind(hash, prevHash, event.id).run();

      processed++;
    } catch (err) {
      // Skip corrupt events instead of blocking the entire batch
      console.error(`[audit] Failed to backfill hash for event ${event.id}:`, err instanceof Error ? err.message : err);
      continue;
    }
  }

  return processed;
}
