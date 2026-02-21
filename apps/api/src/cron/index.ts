import { insertAuditEvent } from '../lib/audit.js';
import { backfillAuditHashes } from '../lib/audit.js';

interface CronEnv {
  DB: D1Database;
  KV: KVNamespace;
  HACKATHON_SM: DurableObjectNamespace;
  NOTIFICATION_QUEUE: Queue;
}

export async function cronHandler(
  event: ScheduledEvent,
  env: CronEnv,
  ctx: ExecutionContext
): Promise<void> {
  try {
    await checkSubmissionDeadlines(env);
    await sendDeadlineReminders(env);
    await backfillAuditHashes(env.DB, 100);
  } catch (err) {
    console.error('Cron handler error:', err instanceof Error ? err.message : err);
  }
}

async function checkSubmissionDeadlines(env: CronEnv): Promise<void> {
  const now = new Date().toISOString();

  // Find active hackathons whose latest round deadline has passed
  const expired = await env.DB.prepare(`
    SELECT DISTINCT h.id, h.status FROM hackathons h
    JOIN hackathon_rounds hr ON hr.hackathon_id = h.id
    WHERE h.status = 'active'
      AND hr.submission_deadline IS NOT NULL
      AND hr.submission_deadline <= ?
      AND hr.status = 'active'
  `).bind(now).all<{ id: string; status: string }>();

  if (!expired.results) return;

  for (const h of expired.results) {
    try {
      // Request transition via DO (version: -1 bypasses optimistic locking)
      const doId = env.HACKATHON_SM.idFromName(h.id);
      const stub = env.HACKATHON_SM.get(doId);
      await stub.fetch(new Request('http://do/transition', {
        method: 'POST',
        body: JSON.stringify({ target_status: 'judging', version: -1 }),
      }));

      // Sync D1
      await env.DB.prepare(
        'UPDATE hackathons SET status = ?, updated_at = ? WHERE id = ?'
      ).bind('judging', now, h.id).run();

      // Audit
      await insertAuditEvent(env.DB, {
        hackathon_id: h.id,
        actor_type: 'cron',
        action: 'cron.deadline_transition',
        entity_type: 'hackathon',
        entity_id: h.id,
        changes: { status: { old: 'active', new: 'judging' } },
      });

      // Notify
      await env.NOTIFICATION_QUEUE.send({
        type: 'hackathon.judging_started',
        hackathon_id: h.id,
      });
    } catch (err) {
      console.error(`Failed to transition hackathon ${h.id}:`, err instanceof Error ? err.message : err);
    }
  }
}

async function sendDeadlineReminders(env: CronEnv): Promise<void> {
  const now = Date.now();

  // Get submission deadlines from hackathon_rounds of active hackathons
  const active = await env.DB.prepare(`
    SELECT h.id as hackathon_id, hr.submission_deadline FROM hackathons h
    JOIN hackathon_rounds hr ON hr.hackathon_id = h.id
    WHERE h.status = 'active'
      AND hr.submission_deadline IS NOT NULL
      AND hr.status = 'active'
  `).all<{ hackathon_id: string; submission_deadline: string }>();

  if (!active.results) return;

  for (const r of active.results) {
    const deadline = new Date(r.submission_deadline).getTime();
    const hoursRemaining = (deadline - now) / (1000 * 60 * 60);

    // 24h reminder (23-24h window)
    if (hoursRemaining > 23 && hoursRemaining <= 24) {
      await env.NOTIFICATION_QUEUE.send({
        type: 'deadline_reminder',
        hackathon_id: r.hackathon_id,
        data: { hours_remaining: 24 },
      });
    }

    // 1h reminder (0-1h window)
    if (hoursRemaining > 0 && hoursRemaining <= 1) {
      await env.NOTIFICATION_QUEUE.send({
        type: 'deadline_reminder',
        hackathon_id: r.hackathon_id,
        data: { hours_remaining: 1 },
      });
    }
  }
}
