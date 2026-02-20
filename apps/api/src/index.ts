import { createApp } from './app.js';

// Routes
import auth from './routes/auth.js';
import authHandler from './routes/auth-handler.js';
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
import health from './routes/health.js';
import hackathonShell from './routes/hackathon-shell.js';

// Queue & Cron
import { queueHandler } from './queue/index.js';
import { cronHandler } from './cron/index.js';

const app = createApp()
  // Auth
  .route('/auth', auth)
  .route('/api/auth', authHandler)
  // Core API
  .route('/api/v1/hackathons', hackathons)
  .route('/api/v1/hackathons/:slug/teams', teams)
  .route('/api/v1/hackathons/:slug/teams', teamRepos)
  .route('/api/v1/hackathons/:slug/submissions', submissions)
  .route('/api/v1/hackathons/:slug/judging', judging)
  .route('/api/v1/hackathons/:slug/rounds', rounds)
  .route('/api/v1/hackathons/:slug/organizers', organizers)
  .route('/api/v1/hackathons/:slug/audit', audit)
  .route('/api/v1/hackathons/:slug/announcements', announcements)
  .route('/api/v1/workspaces', workspaces)
  .route('/api/v1/admin', admin)
  .route('/api/v1/notifications', notifications)
  .route('/api/v1/invites', invites)
  .route('/api/v1', health)
  .route('/api/v1', hackathonShell)
  // Webhooks
  .route('/webhooks', webhooks);

export type AppType = typeof app;

export default {
  fetch: app.fetch,
  queue: queueHandler,
  scheduled: cronHandler,
};

// Durable Object re-export (REQUIRED for wrangler)
export { HackathonStateMachine } from './durable-objects/hackathon-state-machine.js';
