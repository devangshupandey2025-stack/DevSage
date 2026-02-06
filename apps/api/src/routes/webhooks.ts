import { Hono } from 'hono';
import type { Env } from '../types/env.js';

const webhooks = new Hono<{ Bindings: Env }>();

interface GitHubPushPayload {
  repository: {
    full_name: string;
  };
  head_commit: {
    id: string;
  };
  ref: string;
  pusher: {
    name: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parsePushPayload(value: unknown): GitHubPushPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const { repository, head_commit: headCommit, ref, pusher } = value;
  if (!isRecord(repository) || !isRecord(pusher) || !isRecord(headCommit)) {
    return null;
  }

  if (
    typeof repository.full_name !== 'string' ||
    typeof headCommit.id !== 'string' ||
    typeof ref !== 'string' ||
    typeof pusher.name !== 'string'
  ) {
    return null;
  }

  return {
    repository: {
      full_name: repository.full_name,
    },
    head_commit: {
      id: headCommit.id,
    },
    ref,
    pusher: {
      name: pusher.name,
    },
  };
}

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
  const event = c.req.header('X-GitHub-Event');

  if (!signature || !deliveryId || !event) {
    return c.json(
      { error: 'Missing required GitHub webhook headers', code: 'MISSING_WEBHOOK_HEADERS' },
      400
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
    return c.json({ error: 'Invalid webhook signature', code: 'INVALID_SIGNATURE' }, 401);
  }

  if (event !== 'push') {
    return c.json({ acknowledged: true, processed: false }, 200);
  }

  let payloadRaw: unknown;
  try {
    payloadRaw = JSON.parse(body);
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, 400);
  }

  const payload = parsePushPayload(payloadRaw);
  if (!payload) {
    return c.json({ error: 'Invalid push payload', code: 'INVALID_PUSH_PAYLOAD' }, 400);
  }

  await c.env.WEBHOOK_QUEUE.send({
    repoFullName: payload.repository.full_name,
    commitSha: payload.head_commit.id,
    ref: payload.ref,
    deliveryId,
    pusherName: payload.pusher.name,
  });

  return c.json({ accepted: true }, 202);
});

export default webhooks;
