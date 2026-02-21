import type { MessageBatch } from '@cloudflare/workers-types';
import { handlePushEvent } from './push-handler.js';
import { handleTagCreateEvent } from './tag-create-handler.js';
import { handleTagDeleteEvent } from './tag-delete-handler.js';
import { handleInstallationEvent } from './installation-handler.js';
import { handleNotificationMessage } from './notification-handler.js';

// The Env type — just use the bindings directly
interface QueueEnv {
  DB: D1Database;
  KV: KVNamespace;
  HACKATHON_SM: DurableObjectNamespace;
  WEBHOOK_QUEUE: Queue;
  NOTIFICATION_QUEUE: Queue;
  SMTP_URL: string;
  SMTP_USERNAME: string;
  SMTP_PASSWORD: string;
  SMTP_EMAIL_ADDR?: string;
  EMAIL_FROM: string;
  FRONTEND_URL: string;
  PLATFORM_URL: string;
  JUDGE_URL: string;
}

export async function queueHandler(
  batch: MessageBatch,
  env: QueueEnv,
  ctx: ExecutionContext
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const body = message.body as { type: string; payload?: unknown; [key: string]: unknown };

      if (batch.queue === 'github-webhooks') {
        await dispatchWebhookMessage(body, env);
      } else if (batch.queue === 'devsage-notifications') {
        await handleNotificationMessage(body, env);
      }

      message.ack();
    } catch (err) {
      console.error(`Queue message failed: ${err instanceof Error ? err.message : err}`);
      message.retry();
    }
  }
}

async function dispatchWebhookMessage(
  body: { type: string; payload?: unknown; [key: string]: unknown },
  env: QueueEnv
): Promise<void> {
  const { type, payload } = body;

  switch (type) {
    case 'github_push':
      await handlePushEvent(payload as Record<string, unknown>, env);
      break;
    case 'github_tag_created':
      await handleTagCreateEvent(payload as Record<string, unknown>, body as Record<string, unknown>, env);
      break;
    case 'github_tag_deleted':
      await handleTagDeleteEvent(payload as Record<string, unknown>, env);
      break;
    case 'github_installation':
    case 'github_installation_repos_added':
    case 'github_installation_repos_removed':
      await handleInstallationEvent(type, payload as Record<string, unknown>, env);
      break;
    default:
      console.warn(`Unknown webhook message type: ${type}`);
  }
}
