import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { normalizeGitHubEvent } from '../lib/webhook-normalize.js';
import type { WebhookQueueMessage } from '../lib/queue-utils.js';

const webhooks = new Hono<AppEnv>();

// GitHub webhook receiver
webhooks.post('/github', async (c) => {
  const signature = c.req.header('X-Hub-Signature-256');
  const eventType = c.req.header('X-GitHub-Event');
  const deliveryId = c.req.header('X-GitHub-Delivery');

  if (!signature || !eventType || !deliveryId) {
    return c.json({ error: 'Missing headers' }, 400);
  }

  // HMAC verification (constant-time via double-HMAC)
  const body = await c.req.text();
  const isValid = await verifyWebhookSignature(body, signature, c.env.GITHUB_WEBHOOK_SECRET);
  if (!isValid) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const payload = JSON.parse(body) as Record<string, unknown>;

  // Normalize event
  const normalized = normalizeGitHubEvent(eventType, payload);
  if (!normalized) {
    // Event type not handled — acknowledge and ignore
    c.executionCtx.waitUntil(recordDelivery(c.env.DB, deliveryId, eventType, 'ignored'));
    return c.json({ received: true, action: 'ignored' });
  }

  // Enqueue for async processing
  const message: WebhookQueueMessage = {
    type: `github_${normalized.type}`,
    payload: normalized.data,
    received_at: new Date().toISOString(),
    delivery_id: deliveryId,
  };

  await c.env.WEBHOOK_QUEUE.send(message);

  // Record delivery (non-blocking)
  c.executionCtx.waitUntil(recordDelivery(c.env.DB, deliveryId, eventType, 'queued'));

  return c.json({ received: true, action: 'queued' });
});

/**
 * Constant-time HMAC verification via double-HMAC comparison.
 * Workers don't have timingSafeEqual, so we HMAC both values
 * and compare the HMACs (any timing leak reveals nothing useful).
 */
async function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Compute expected signature
    const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedHex = 'sha256=' + Array.from(new Uint8Array(expectedSig))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Double-HMAC comparison for constant-time
    const comparisonKey = await crypto.subtle.importKey(
      'raw',
      crypto.getRandomValues(new Uint8Array(32)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const hmac1 = await crypto.subtle.sign('HMAC', comparisonKey, encoder.encode(expectedHex));
    const hmac2 = await crypto.subtle.sign('HMAC', comparisonKey, encoder.encode(signature));

    const a = new Uint8Array(hmac1);
    const b = new Uint8Array(hmac2);
    if (a.length !== b.length) return false;

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    return result === 0;
  } catch {
    return false;
  }
}

async function recordDelivery(
  db: D1Database,
  deliveryId: string,
  eventType: string,
  status: string
): Promise<void> {
  try {
    await db.prepare(
      `INSERT OR IGNORE INTO webhook_deliveries (id, github_delivery_id, event_type, status, received_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), deliveryId, eventType, status, new Date().toISOString()).run();
  } catch (err) {
    console.warn('Failed to record webhook delivery:', err instanceof Error ? err.message : err);
  }
}

export default webhooks;
