import type { NormalizedGitHubEvent } from '../lib/webhook-normalize.js';
import type { Env } from '../types/env.js';
import { handlePush } from './push-handler.js';
import { handleTagCreate } from './tag-create-handler.js';
import { handleTagDelete } from './tag-delete-handler.js';
import { handleInstallation } from './installation-handler.js';
import type { NotificationMessage } from './notification-handler.js';
import { handleNotification } from './notification-handler.js';
import {
  MAX_QUEUE_RETRIES,
  MAX_RETRY_DELAY_SECONDS,
  RETRY_BACKOFF_BASE_SECONDS,
} from '../lib/constants.js';

function isValidWebhookEvent(body: unknown): body is NormalizedGitHubEvent {
  if (!body || typeof body !== 'object') return false;
  const event = body as Record<string, unknown>;
  return typeof event.type === 'string' && typeof event.deliveryId === 'string';
}

function isValidNotificationMessage(body: unknown): body is NotificationMessage {
  if (!body || typeof body !== 'object') return false;
  const msg = body as Record<string, unknown>;
  return typeof msg.type === 'string' && typeof msg.hackathonId === 'string';
}

async function logDeadLetter(env: Env, queue: string, body: unknown, error: string): Promise<void> {
  try {
    await env.DB.prepare(`
      INSERT INTO audit_events (id, actor_type, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      'system',
      'queue.dead_letter',
      'queue',
      queue,
      JSON.stringify({ error, body: typeof body === 'object' ? body : String(body) }),
      new Date().toISOString(),
    ).run();
  } catch {
    console.error('Failed to log dead letter event');
  }
}

export async function processWebhookBatch(
  batch: MessageBatch<NormalizedGitHubEvent>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const event = message.body;

      if (!isValidWebhookEvent(event)) {
        console.warn('Malformed webhook message, discarding', { body: event });
        message.ack();
        continue;
      }

      switch (event.type) {
        case 'push':
          await handlePush(event, env);
          break;
        case 'tag_created':
          await handleTagCreate(event, env);
          break;
        case 'tag_deleted':
          await handleTagDelete(event, env);
          break;
        case 'installation':
          await handleInstallation(event, env);
          break;
        default: {
          const _exhaustive: never = event;
          console.warn('Unknown webhook event type, discarding', { event: _exhaustive });
          break;
        }
      }
      message.ack();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Queue handler error', { type: (message.body as unknown as Record<string, unknown>)?.type, error: errorMsg, attempt: message.attempts });

      if (message.attempts >= MAX_QUEUE_RETRIES) {
        await logDeadLetter(env, 'github-webhooks', message.body, errorMsg);
        message.ack();
      } else {
        message.retry({ delaySeconds: Math.min(MAX_RETRY_DELAY_SECONDS, RETRY_BACKOFF_BASE_SECONDS * message.attempts) });
      }
    }
  }
}

export async function processNotificationBatch(
  batch: MessageBatch<NotificationMessage>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      if (!isValidNotificationMessage(message.body)) {
        console.warn('Malformed notification message, discarding', { body: message.body });
        message.ack();
        continue;
      }

      await handleNotification(message.body, env);
      message.ack();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Notification handler error', { type: (message.body as Record<string, unknown>)?.type, error: errorMsg, attempt: message.attempts });

      if (message.attempts >= MAX_QUEUE_RETRIES) {
        await logDeadLetter(env, 'devsage-notifications', message.body, errorMsg);
        message.ack();
      } else {
        message.retry({ delaySeconds: Math.min(MAX_RETRY_DELAY_SECONDS, RETRY_BACKOFF_BASE_SECONDS * message.attempts) });
      }
    }
  }
}
