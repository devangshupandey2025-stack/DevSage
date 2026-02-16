import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { hackathonContext } from '../middleware/hackathon.js';

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
    query += ' AND is_current = 1';
    countQuery += ' AND is_current = 1';
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

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

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
    'SELECT * FROM submissions WHERE hackathon_id = ? AND team_id = ? AND is_current = 1 ORDER BY created_at DESC LIMIT 1'
  ).bind(hackathon.id, teamId).first();

  if (!submission) return errorResponse(c, 404, 'NOT_FOUND', 'No submission found');
  return successResponse(c, submission);
});

export default submissions;
