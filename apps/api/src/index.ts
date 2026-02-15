import { Hono } from 'hono';
import type { Env } from './types/env.js';
import type { ScheduledEvent } from '@cloudflare/workers-types';
import { errorHandler } from './middleware/error-handler.js';
import { corsMiddleware } from './middleware/cors.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { optionalAuth } from './middleware/auth.js';
import { DEADLINE_REMINDER_WINDOW_MS } from './lib/constants.js';
import { isNotificationMessage } from './lib/queue-utils.js';
import auth from './routes/auth.js';
import hackathons from './routes/hackathons.js';
import teams from './routes/teams.js';
import teamRepos from './routes/team-repos.js';
import webhooks from './routes/webhooks.js';
import submissions from './routes/submissions.js';
import judging from './routes/judging.js';
import admin from './routes/admin.js';
import invites from './routes/invites.js';
import workspaces from './routes/workspaces.js';
import notifications from './routes/notifications.js';
import audit from './routes/audit.js';
import organizers from './routes/organizers.js';
import { processWebhookBatch, processNotificationBatch } from './queue/index.js';
import type { NormalizedGitHubEvent } from './lib/webhook-normalize.js';
import type { NotificationMessage } from './queue/notification-handler.js';

export { HackathonStateMachine } from './durable-objects/hackathon-state-machine.js';

const app = new Hono<{ Bindings: Env }>();

// Middleware chain: CORS → Request ID → Auth (optional) → Rate Limiter → [Role per-route] → Handler
app.onError(errorHandler);
app.use('*', corsMiddleware);
app.use('*', requestIdMiddleware);
app.use('*', optionalAuth);
app.use('*', rateLimitMiddleware);

app.route('/auth', auth);
app.route('/api/v1/workspaces', workspaces);
app.route('/api/v1/hackathons', hackathons);
app.route('/api/v1/hackathons', teams);
app.route('/api/v1/hackathons', teamRepos);
app.route('/webhooks', webhooks);
app.route('/api/v1/hackathons', submissions);
app.route('/api/v1/hackathons', judging);
app.route('/api/v1/admin', admin);
app.route('/api/v1/invites', invites);
app.route('/api/v1/notifications', notifications);
app.route('/api/v1/hackathons', audit);
app.route('/api/v1/hackathons', organizers);

app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'DevSage API' });
});

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<NormalizedGitHubEvent | NotificationMessage>, env: Env) {
    const firstMessage = batch.messages[0];
    if (firstMessage && isNotificationMessage(firstMessage.body)) {
      await processNotificationBatch(batch as MessageBatch<NotificationMessage>, env);
    } else {
      await processWebhookBatch(batch as MessageBatch<NormalizedGitHubEvent>, env);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const now = new Date();

    // ── Part 1: Auto-transition overdue hackathons (safety net for missed DO alarms) ──
    try {
      const overdue = await env.DB.prepare(`
        SELECT id, slug, title, submission_deadline
        FROM hackathons
        WHERE status = 'active'
        AND submission_deadline IS NOT NULL
        AND submission_deadline <= ?
      `).bind(now.toISOString()).all();

      for (const row of overdue.results || []) {
        try {
          const hackathonId = row.id as string;
          const doId = env.HACKATHON_SM.idFromName(hackathonId);
          const stub = env.HACKATHON_SM.get(doId);

          const stateRes = await stub.fetch('http://do/state');
          const stateData = (await stateRes.json()) as { status?: string };

          if (stateData.status !== 'active') {
            continue;
          }

          const transitionRes = await stub.fetch('http://do/transition', {
            method: 'POST',
            body: JSON.stringify({ targetStatus: 'judging' }),
            headers: { 'Content-Type': 'application/json' },
          });

          if (transitionRes.ok) {
            await env.DB.prepare(`
              UPDATE hackathons SET status = 'judging', updated_at = ? WHERE id = ?
            `).bind(now.toISOString(), hackathonId).run();

            await env.DB.prepare(`
              INSERT INTO audit_events (id, hackathon_id, actor_type, action, entity_type, entity_id, details, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              crypto.randomUUID(),
              hackathonId,
              'cron',
              'hackathon.transition',
              'hackathon',
              hackathonId,
              JSON.stringify({ from: 'active', to: 'judging', trigger: 'cron_safety_net' }),
              now.toISOString(),
            ).run();
          }
        } catch (error) {
          console.error('Cron auto-transition failed for hackathon:', {
            hackathonId: row.id,
            slug: row.slug,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      console.error('Cron auto-transition query failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    // ── Part 2: Deadline reminders (24h look-ahead) ──
    try {
      const twentyFourHoursFromNow = new Date(now.getTime() + DEADLINE_REMINDER_WINDOW_MS);

      const approaching = await env.DB.prepare(`
        SELECT id, slug, title, submission_deadline
        FROM hackathons
        WHERE status = 'active'
        AND submission_deadline IS NOT NULL
        AND submission_deadline > ?
        AND submission_deadline <= ?
      `).bind(now.toISOString(), twentyFourHoursFromNow.toISOString()).all();

      for (const row of approaching.results || []) {
        const deadline = new Date(row.submission_deadline as string);
        const hoursRemaining = (deadline.getTime() - now.getTime()) / (60 * 60 * 1000);

        const reminderType = hoursRemaining <= 1 ? '1h' : '24h';
        const action = `deadline_reminder_${reminderType}`;

        const alreadySent = await env.DB.prepare(`
          SELECT 1 FROM audit_events
          WHERE hackathon_id = ? AND action = ?
          LIMIT 1
        `).bind(row.id, action).first();

        if (!alreadySent) {
          await env.DB.prepare(`
            INSERT INTO audit_events (id, hackathon_id, actor_type, action, entity_type, entity_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            crypto.randomUUID(),
            row.id,
            'cron',
            action,
            'hackathon',
            row.id,
            now.toISOString(),
          ).run();

          await env.NOTIFICATION_QUEUE.send({
            type: 'deadline_reminder',
            hackathonId: row.id as string,
            hoursRemaining: Math.floor(hoursRemaining),
          });
        }
      }
    } catch (error) {
      console.error('Cron deadline reminder failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  },
};
