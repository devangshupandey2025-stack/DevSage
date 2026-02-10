import { Hono } from 'hono';
import type { Env } from './types/env.js';
import { errorHandler } from './middleware/error-handler.js';
import auth from './routes/auth.js';
import hackathons from './routes/hackathons.js';
import teams from './routes/teams.js';
import webhooks from './routes/webhooks.js';
import submissions from './routes/submissions.js';

// Re-export Durable Object classes (CRITICAL: wrangler requires this)
export { HackathonLifecycleDO } from './durable-objects/hackathon-lifecycle.js';
export { SubmissionDO } from './durable-objects/submission.js';

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

function isAllowedCorsOrigin(origin: string, frontendUrl: string): boolean {
  if (origin === frontendUrl) {
    return true;
  }

  // Local dev (when not using Vite proxy)
  if (origin === 'http://localhost:5173') {
    return true;
  }

  return false;
}

interface WebhookQueueMessage {
  repoFullName: string;
  commitSha: string;
  ref: string;
  deliveryId: string;
  pusherName: string;
}

interface RepoMapping {
  hackathonId: string;
  teamId: string;
}

interface LifecycleState {
  status: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseQueueMessage(value: unknown): WebhookQueueMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const { repoFullName, commitSha, ref, deliveryId, pusherName } = value;
  if (
    typeof repoFullName !== 'string' ||
    typeof commitSha !== 'string' ||
    typeof ref !== 'string' ||
    typeof deliveryId !== 'string' ||
    typeof pusherName !== 'string'
  ) {
    return null;
  }

  return { repoFullName, commitSha, ref, deliveryId, pusherName };
}

function parseLifecycleState(value: unknown): LifecycleState | null {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return null;
  }

  return { status: value.status };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// Global error handler
app.onError(errorHandler);

// CORS (needed when web is on devsage.org and API is on api.devsage.org)
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  if (origin && isAllowedCorsOrigin(origin, c.env.FRONTEND_URL)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Headers', 'Content-Type');
    c.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    c.header('Vary', 'Origin');
  }

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  await next();
});

// Mount route groups
app.route('/auth', auth);
app.route('/hackathons', hackathons);
app.route('/hackathons', teams);
app.route('/webhooks', webhooks);
app.route('/hackathons', submissions);

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'DevSage API' });
});

// Export Worker with fetch and queue handlers
export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch, env: Env) {
    for (const msg of batch.messages) {
      try {
        const payload = parseQueueMessage(msg.body);
        if (!payload) {
          msg.ack();
          continue;
        }

        const mapping = await env.KV.get<RepoMapping>(`repo:${payload.repoFullName}`, 'json');
        if (!mapping || typeof mapping.hackathonId !== 'string' || typeof mapping.teamId !== 'string') {
          msg.ack();
          continue;
        }

        const lifecycleId = env.HACKATHON_LIFECYCLE.idFromName(mapping.hackathonId);
        const lifecycleStub = env.HACKATHON_LIFECYCLE.get(lifecycleId);
        const lifecycleResponse = await lifecycleStub.fetch('http://do/state');
        if (!lifecycleResponse.ok) {
          msg.ack();
          continue;
        }

        const lifecyclePayload = await readJson(lifecycleResponse);
        const lifecycle = parseLifecycleState(lifecyclePayload);
        if (!lifecycle || lifecycle.status !== 'active') {
          msg.ack();
          continue;
        }

        const submissionId = env.SUBMISSION.idFromName(mapping.hackathonId);
        const submissionStub = env.SUBMISSION.get(submissionId);
        const submissionResponse = await submissionStub.fetch('http://do/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            hackathonId: mapping.hackathonId,
            teamId: mapping.teamId,
            repoFullName: payload.repoFullName,
            commitSha: payload.commitSha,
            deliveryId: payload.deliveryId,
          }),
        });

        if (!submissionResponse.ok) {
          const reason = await submissionResponse.text();
          console.error('SubmissionDO rejected webhook submission', {
            repoFullName: payload.repoFullName,
            hackathonId: mapping.hackathonId,
            teamId: mapping.teamId,
            deliveryId: payload.deliveryId,
            status: submissionResponse.status,
            reason,
          });
        }

        msg.ack();
      } catch (error) {
        console.error('Queue processing error', error);
        msg.retry();
      }
    }
  }
};
