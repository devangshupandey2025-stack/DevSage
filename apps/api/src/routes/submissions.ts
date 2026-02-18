import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { hackathonContext } from '../middleware/hackathon.js';
import { authMiddleware } from '../middleware/auth.js';
import { insertAuditEvent } from '../lib/audit.js';

const submissions = new Hono<AppEnv>();
submissions.use('/*', hackathonContext);

// List submissions for hackathon
submissions.get('/', async (c) => {
  const hackathon = c.get('hackathon')!;
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');
  const teamId = c.req.query('team_id');
  const roundId = c.req.query('round_id');
  const currentOnly = c.req.query('current_only') !== 'false';

  let query = 'SELECT * FROM submissions WHERE hackathon_id = ?';
  let countQuery = 'SELECT COUNT(*) as total FROM submissions WHERE hackathon_id = ?';
  const params: unknown[] = [hackathon.id];

  if (currentOnly) {
    query += ' AND is_final = 1';
    countQuery += ' AND is_final = 1';
  }

  if (teamId) {
    query += ' AND team_id = ?';
    countQuery += ' AND team_id = ?';
    params.push(teamId);
  }

  if (roundId) {
    query += ' AND round_id = ?';
    countQuery += ' AND round_id = ?';
    params.push(roundId);
  }

  query += ' ORDER BY submitted_at DESC LIMIT ? OFFSET ?';

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(query).bind(...params, limit, offset).all(),
    c.env.DB.prepare(countQuery).bind(...params).first<{ total: number }>(),
  ]);

  return paginatedResponse(c, rows.results || [], count?.total ?? 0, limit, offset);
});

// Get specific submission
submissions.get('/:submissionId', async (c) => {
  const hackathon = c.get('hackathon')!;
  const submissionId = c.req.param('submissionId');

  const submission = await c.env.DB.prepare(
    'SELECT * FROM submissions WHERE id = ? AND hackathon_id = ?'
  ).bind(submissionId, hackathon.id).first();

  if (!submission) return errorResponse(c, 404, 'NOT_FOUND', 'Submission not found');
  return successResponse(c, submission);
});

// Get team's current submission
submissions.get('/team/:teamId/current', async (c) => {
  const hackathon = c.get('hackathon')!;
  const teamId = c.req.param('teamId');

  const submission = await c.env.DB.prepare(
    'SELECT * FROM submissions WHERE hackathon_id = ? AND team_id = ? AND is_final = 1 ORDER BY submitted_at DESC LIMIT 1'
  ).bind(hackathon.id, teamId).first();

  if (!submission) return errorResponse(c, 404, 'NOT_FOUND', 'No submission found');
  return successResponse(c, submission);
});

// Create or update a submission (authenticated team member)
submissions.post('/', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;

  // Find user's team
  const membership = await c.env.DB.prepare(`
    SELECT t.id as team_id, tm.role
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    WHERE t.hackathon_id = ? AND tm.user_id = ?
  `).bind(hackathon.id, user.id).first<{ team_id: string; role: string }>();

  if (!membership) {
    return errorResponse(c, 403, 'NOT_ON_TEAM', 'You must be on a team to submit');
  }

  const body = await c.req.json<{
    title: string;
    description: string;
    repo_url: string;
    demo_url?: string;
    video_url?: string;
    slide_url?: string;
  }>();

  if (!body.title || !body.repo_url) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Title and repo URL are required');
  }

  // Mark any existing final submissions as non-final
  await c.env.DB.prepare(
    'UPDATE submissions SET is_final = 0 WHERE hackathon_id = ? AND team_id = ? AND is_final = 1'
  ).bind(hackathon.id, membership.team_id).run();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO submissions (id, hackathon_id, team_id, title, description, repo_url, demo_url, video_url, slide_url, is_final, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).bind(
    id, hackathon.id, membership.team_id,
    body.title, body.description || '',
    body.repo_url, body.demo_url || '', body.video_url || '', body.slide_url || '',
    now
  ).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      action: 'submission.created',
      entity_type: 'submission',
      entity_id: id,
      details: { title: body.title },
    })
  );

  const created = await c.env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first();
  return successResponse(c, created, { status: 201 });
});

export default submissions;
