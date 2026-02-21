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

export async function insertAuditEvent(
  db: D1Database,
  input: AuditEventInput
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Get next sequence number
  const seqResult = await db.prepare(
    'SELECT MAX(sequence) as max_seq FROM audit_events'
  ).first<{ max_seq: number | null }>();
  const sequence = (seqResult?.max_seq ?? 0) + 1;

  // Get previous hash for chain integrity
  const prevResult = await db.prepare(
    `SELECT hash FROM audit_events WHERE hackathon_id IS ? ORDER BY sequence DESC LIMIT 1`
  ).bind(input.hackathon_id ?? null).first<{ hash: string }>();
  const prevHash = prevResult?.hash ?? null;

  // Compute SHA-256 hash
  const encoder = new TextEncoder();
  const hashInput = `${id}:${prevHash ?? 'genesis'}:${input.hackathon_id ?? 'global'}`;
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(hashInput));
  const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');

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
}

export async function backfillAuditHashes(db: D1Database, limit: number = 100): Promise<number> {
  // Find unhashed events using sequence ordering
  const unhashed = await db.prepare(
    `SELECT sequence, id, hackathon_id FROM audit_events WHERE hash IS NULL ORDER BY sequence ASC LIMIT ?`
  ).bind(limit).all<{ sequence: number; id: string; hackathon_id: string | null }>();

  if (!unhashed.results || unhashed.results.length === 0) return 0;

  let processed = 0;
  for (const event of unhashed.results) {
    // Get prev_hash for this hackathon's chain
    const prev = await db.prepare(
      `SELECT hash FROM audit_events
       WHERE hackathon_id IS ? AND hash IS NOT NULL AND sequence < ?
       ORDER BY sequence DESC LIMIT 1`
    ).bind(event.hackathon_id, event.sequence).first<{ hash: string }>();

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
