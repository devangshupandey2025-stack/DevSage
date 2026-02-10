import { Hono } from 'hono';
import type { Env } from './types/env.js';
import { errorHandler } from './middleware/error-handler.js';
import auth from './routes/auth.js';
import hackathons from './routes/hackathons.js';
import teams from './routes/teams.js';
import webhooks from './routes/webhooks.js';
import submissions from './routes/submissions.js';
import judging from './routes/judging.js';
import { processWebhookBatch } from './queue/index.js';
import type { NormalizedGitHubEvent } from './lib/webhook-normalize.js';

export { HackathonStateMachine } from './durable-objects/hackathon-state-machine.js';

const app = new Hono<{ Bindings: Env }>();

function isAllowedCorsOrigin(origin: string, frontendUrl: string): boolean {
  if (origin === frontendUrl) {
    return true;
  }

  if (origin === 'http://localhost:5173') {
    return true;
  }

  return false;
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
app.route('/api/v1/hackathons', hackathons);
app.route('/api/v1/hackathons', teams);
app.route('/webhooks', webhooks);
app.route('/api/v1/hackathons', submissions);
app.route('/api/v1/hackathons', judging);

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'DevSage API' });
});

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<NormalizedGitHubEvent>, env: Env) {
    await processWebhookBatch(batch, env);
  },
};
