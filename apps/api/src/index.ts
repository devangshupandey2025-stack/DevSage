import { Hono } from 'hono';
import type { AppEnv } from './types/env.js';
import { successResponse } from './lib/response.js';

// Middleware
import { corsMiddleware } from './middleware/cors.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { optionalAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';

// Routes
import hackathons from './routes/hackathons.js';
import teams from './routes/teams.js';
import teamRepos from './routes/team-repos.js';
import submissions from './routes/submissions.js';
import judging from './routes/judging.js';
import rounds from './routes/rounds.js';
import webhooks from './routes/webhooks.js';
import workspaces from './routes/workspaces.js';
import admin from './routes/admin.js';
import notifications from './routes/notifications.js';
import invites from './routes/invites.js';
import audit from './routes/audit.js';
import organizers from './routes/organizers.js';
import announcements from './routes/announcements.js';
import judgePortal from './routes/judge-portal.js';
import auth from './routes/auth.js';

// Queue & Cron
import { queueHandler } from './queue/index.js';
import { cronHandler } from './cron/index.js';

const app = new Hono<AppEnv>();

// Global middleware chain
app.use('*', corsMiddleware);
app.use('*', requestIdMiddleware);
app.use('*', optionalAuth);
app.onError(errorHandler);

// Root route for health check or info
app.get('/', (c) => successResponse(c, { message: 'DevSage API running' }));

// Health check
app.get('/health', (c) => c.json({ ok: true, timestamp: new Date().toISOString() }));

// Mount routes
app.route('/api/v1/hackathons', hackathons);
app.route('/api/v1/hackathons/:slug/teams', teams);
app.route('/api/v1/hackathons/:slug/teams', teamRepos);
app.route('/api/v1/hackathons/:slug/submissions', submissions);
app.route('/api/v1/hackathons/:slug/judging', judging);
app.route('/api/v1/hackathons/:slug/rounds', rounds);
app.route('/api/v1/hackathons/:slug/organizers', organizers);
app.route('/api/v1/hackathons/:slug/audit', audit);
app.route('/api/v1/hackathons/:slug/announcements', announcements);
app.route('/api/v1/workspaces', workspaces);
app.route('/api/v1/admin', admin);
app.route('/api/v1/notifications', notifications);
app.route('/api/v1/invites', invites);
app.route('/api/v1/judge', judgePortal);
app.route('/auth', auth);
app.route('/webhooks', webhooks);

// Export Worker handlers
export default {
  fetch: app.fetch,
  queue: queueHandler,
  scheduled: cronHandler,
};

// Durable Object re-export (REQUIRED for wrangler)
export { HackathonStateMachine } from './durable-objects/hackathon-state-machine.js';
