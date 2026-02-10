import type { NormalizedGitHubEvent } from '../lib/webhook-normalize.js';
import type { Env } from '../types/env.js';
import { handlePush } from './push-handler.js';
import { handleTagCreate } from './tag-create-handler.js';
import { handleTagDelete } from './tag-delete-handler.js';
import { handleInstallation } from './installation-handler.js';

export async function processWebhookBatch(
  batch: MessageBatch<NormalizedGitHubEvent>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const event = message.body;
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
        default:
          break;
      }
      message.ack();
    } catch (error) {
      const event = message.body;
      console.error('Queue handler error', { type: event?.type, error });
      message.retry({ delaySeconds: Math.min(300, 30 * message.attempts) });
    }
  }
}
