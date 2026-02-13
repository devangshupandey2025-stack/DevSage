import { Hono } from 'hono';
import type { Env } from './types/env.js';
import type { ScheduledEvent } from '@cloudflare/workers-types';
import { errorHandler } from './middleware/error-handler.js';
import { corsMiddleware } from './middleware/cors.js';
import { DEADLINE_REMINDER_WINDOW_MS } from './lib/constants.js';
import { isNotificationMessage } from './lib/queue-utils.js';
import auth from './routes/auth.js';
import hackathons from './routes/hackathons.js';
import teams from './routes/teams.js';
import webhooks from './routes/webhooks.js';
import submissions from './routes/submissions.js';
import judging from './routes/judging.js';
import admin from './routes/admin.js';
import invites from './routes/invites.js';
import { processWebhookBatch, processNotificationBatch } from './queue/index.js';
import type { NormalizedGitHubEvent } from './lib/webhook-normalize.js';
import type { NotificationMessage } from './queue/notification-handler.js';

export { HackathonStateMachine } from './durable-objects/hackathon-state-machine.js';

const app = new Hono<{ Bindings: Env }>();

// Global error handler
app.onError(errorHandler);

// CORS (needed when web is on devsage.org and API is on api.devsage.org)
app.use('*', corsMiddleware);

// Mount route groups
app.route('/auth', auth);
app.route('/api/v1/hackathons', hackathons);
app.route('/api/v1/hackathons', teams);
app.route('/webhooks', webhooks);
app.route('/api/v1/hackathons', submissions);
app.route('/api/v1/hackathons', judging);
app.route('/api/v1/admin', admin);
app.route('/api/v1/invites', invites);

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'DevSage API' });
});

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<NormalizedGitHubEvent | NotificationMessage>, env: Env) {
    // Route to appropriate handler based on message type
    const firstMessage = batch.messages[0];
    if (firstMessage && isNotificationMessage(firstMessage.body)) {
      await processNotificationBatch(batch as MessageBatch<NotificationMessage>, env);
    } else {
      await processWebhookBatch(batch as MessageBatch<NormalizedGitHubEvent>, env);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      const now = new Date();
      const twentyFourHoursFromNow = new Date(now.getTime() + DEADLINE_REMINDER_WINDOW_MS);

      // Find hackathons with upcoming deadlines (active status only)
      const approaching = await env.DB.prepare(`
        SELECT id, slug, title, submission_deadline FROM hackathons
        WHERE status = 'active'
        AND submission_deadline > ?
        AND submission_deadline <= ?
      `).bind(now.toISOString(), twentyFourHoursFromNow.toISOString()).all();

      for (const hackathon of approaching.results || []) {
        const deadline = new Date(hackathon.submission_deadline as string);
        const hoursRemaining = (deadline.getTime() - now.getTime()) / (60 * 60 * 1000);

        // Determine reminder type (1h or 24h)
        const reminderType = hoursRemaining <= 1 ? '1h' : '24h';
        const action = `deadline_reminder_${reminderType}`;

        // Check if already sent via audit log
        const alreadySent = await env.DB.prepare(`
          SELECT 1 FROM audit_events
          WHERE hackathon_id = ? AND action = ?
          LIMIT 1
        `).bind(hackathon.id, action).first();

        if (!alreadySent) {
          // Record audit event first (idempotency marker)
          await env.DB.prepare(`
            INSERT INTO audit_events (id, hackathon_id, actor_type, action, entity_type, entity_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            crypto.randomUUID(),
            hackathon.id,
            'cron',
            action,
            'hackathon',
            hackathon.id,
            now.toISOString()
          ).run();

          // Enqueue notification
          await env.NOTIFICATION_QUEUE.send({
            type: 'deadline_reminder',
            hackathonId: hackathon.id as string,
            hoursRemaining: Math.floor(hoursRemaining),
          });
        }
      }
    } catch (error) {
      console.error('Cron scheduled handler failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  },
};
