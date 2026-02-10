import { createDbClient } from '@devsage/db';
import type { NormalizedTagDeleteEvent } from '../lib/webhook-normalize.js';
import { insertAuditEvent } from '../lib/audit.js';
import type { Env } from '../types/env.js';

export async function handleTagDelete(event: NormalizedTagDeleteEvent, env: Env): Promise<void> {
  const db = createDbClient(env.DB);

  await insertAuditEvent(db, {
    actorType: 'bot',
    action: 'tag.deleted',
    entityType: 'tag',
    entityId: event.tagName,
    details: {
      repoFullName: event.repoFullName,
      tagName: event.tagName,
      senderLogin: event.senderLogin,
      deliveryId: event.deliveryId,
    },
  });
}
