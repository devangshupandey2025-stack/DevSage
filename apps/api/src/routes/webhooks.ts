import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import { errorResponse, successResponse } from '../lib/response.js';
import { normalizeGitHubEvent } from '../lib/webhook-normalize.js';

const webhooks = new Hono<{ Bindings: Env }>();

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);

  let diff = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < maxLength; index++) {
    const leftByte = leftBytes[index] ?? 0;
    const rightByte = rightBytes[index] ?? 0;
    diff |= leftByte ^ rightByte;
  }

  return diff === 0;
}

webhooks.post('/github', async (c) => {
  const body = await c.req.text();
  const signature = c.req.header('X-Hub-Signature-256');
  const deliveryId = c.req.header('X-GitHub-Delivery');
  const eventType = c.req.header('X-GitHub-Event');

  if (!signature || !deliveryId || !eventType) {
    return errorResponse(
      c,
      400,
      'MISSING_WEBHOOK_HEADERS',
      'Missing required GitHub webhook headers'
    );
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(c.env.GITHUB_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signedBody = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = `sha256=${toHex(signedBody)}`;

  if (!timingSafeEqual(signature, expected)) {
    return errorResponse(c, 401, 'INVALID_SIGNATURE', 'Invalid webhook signature');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return errorResponse(c, 400, 'INVALID_BODY', 'Invalid JSON body');
  }

  const normalizedEvent = normalizeGitHubEvent(eventType, payload, deliveryId);

  if (!normalizedEvent) {
    return successResponse(
      c,
      { message: 'Event acknowledged but not processed (unknown or irrelevant event type)' },
      {},
      200
    );
  }

  await c.env.WEBHOOK_QUEUE.send(normalizedEvent);

  return successResponse(
    c,
    { message: `Event accepted and enqueued: ${normalizedEvent.type}` },
    {},
    202
  );
});

export default webhooks;
