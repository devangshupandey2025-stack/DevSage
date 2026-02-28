import { insertAuditEvent } from '../lib/audit.js';
import { backfillAuditHashes } from '../lib/audit.js';

interface CronEnv {
  DB: D1Database;
  KV: KVNamespace;
  HACKATHON_SM: DurableObjectNamespace;
  NOTIFICATION_QUEUE: Queue;
}

export async function cronHandler(
  _event: ScheduledEvent,
  env: CronEnv,
  _ctx: ExecutionContext
): Promise<void> {
  // Run independent cron tasks in parallel for better performance
  const results = await Promise.allSettled([
    checkSubmissionDeadlines(env),
    sendDeadlineReminders(env),
    backfillAuditHashes(env.DB, 100),
  ]);

  // Log failures without blocking
  const taskNames = ['checkSubmissionDeadlines', 'sendDeadlineReminders', 'backfillAuditHashes'];
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      const reason = (results[i] as PromiseRejectedResult).reason;
      console.error(`Cron task ${taskNames[i]} failed:`, reason instanceof Error ? reason.message : reason);
    }
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

  // Process transitions in parallel (each is independent)
  await Promise.allSettled(
    expired.results.map(async (h) => {
      // Dedup: check KV to prevent double-fire from overlapping cron + DO alarm
      const dedupKey = `cron:transition:${h.id}`;
      const already = await env.KV.get(dedupKey);
      if (already) return;

      // Mark as processing (TTL 5 min)
      await env.KV.put(dedupKey, 'processing', { expirationTtl: 300 });

      // Request transition via DO
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
    }),
  );
}

async function sendDeadlineReminders(env: CronEnv): Promise<void> {
  const now = Date.now();

  const active = await env.DB.prepare(`
    SELECT h.id as hackathon_id, hr.submission_deadline FROM hackathons h
    JOIN hackathon_rounds hr ON hr.hackathon_id = h.id
    WHERE h.status = 'active'
      AND hr.submission_deadline IS NOT NULL
      AND hr.status = 'active'
  `).all<{ hackathon_id: string; submission_deadline: string }>();

  if (!active.results) return;

  // Send reminders in parallel
  await Promise.allSettled(
    active.results.map(async (r) => {
      const deadline = new Date(r.submission_deadline).getTime();
      const hoursRemaining = (deadline - now) / (1000 * 60 * 60);

      // Dedup reminders using KV
      const send = async (hours: number) => {
        const dedupKey = `cron:reminder:${r.hackathon_id}:${hours}h`;
        const already = await env.KV.get(dedupKey);
        if (already) return;
        await env.KV.put(dedupKey, '1', { expirationTtl: 7200 }); // 2h TTL
        await env.NOTIFICATION_QUEUE.send({
          type: 'deadline_reminder',
          hackathon_id: r.hackathon_id,
          data: { hours_remaining: hours },
        });
      };

      // 24h reminder (23-24h window)
      if (hoursRemaining > 23 && hoursRemaining <= 24) {
        await send(24);
      }

      // 1h reminder (0-1h window)
      if (hoursRemaining > 0 && hoursRemaining <= 1) {
        await send(1);
      }
    }),
  );
}
