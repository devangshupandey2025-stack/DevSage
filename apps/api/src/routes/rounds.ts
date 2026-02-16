import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { authMiddleware } from '../middleware/auth.js';
import { hackathonContext } from '../middleware/hackathon.js';
import { requireRole } from '../middleware/role.js';

const rounds = new Hono<AppEnv>();
rounds.use('/*', hackathonContext);

// Create round
rounds.post('/', authMiddleware, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;
  const body = await c.req.json<{
    name: string; description?: string; round_number: number;
    submission_deadline?: string; is_elimination?: boolean; sort_order?: number;
  }>();

  if (!body.name || !body.round_number) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Name and round_number required');
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO hackathon_rounds (id, hackathon_id, name, description, round_number, submission_deadline, is_elimination, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, hackathon.id, body.name, body.description ?? null, body.round_number,
    body.submission_deadline ?? null, body.is_elimination ? 1 : 0, body.sort_order ?? 0).run();

  const created = await c.env.DB.prepare('SELECT * FROM hackathon_rounds WHERE id = ?').bind(id).first();
  return successResponse(c, created, { status: 201 });
});

// List rounds
rounds.get('/', async (c) => {
  const hackathon = c.get('hackathon')!;
  const rows = await c.env.DB.prepare(
    'SELECT * FROM hackathon_rounds WHERE hackathon_id = ? ORDER BY round_number ASC'
  ).bind(hackathon.id).all();
  return successResponse(c, rows.results || []);
});

// Update round
rounds.patch('/:roundId', authMiddleware, requireRole('co_organizer'), async (c) => {
  const roundId = c.req.param('roundId');
  const body = await c.req.json<Record<string, unknown>>();

  const allowedFields = ['name', 'description', 'submission_deadline', 'is_elimination', 'sort_order'];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const field of allowedFields) {
    if (field in body) {
      updates.push(`${field} = ?`);
      values.push(field === 'is_elimination' ? (body[field] ? 1 : 0) : body[field]);
    }
  }

  if (updates.length === 0) return errorResponse(c, 400, 'VALIDATION_ERROR', 'No fields to update');

  values.push(roundId);
  await c.env.DB.prepare(`UPDATE hackathon_rounds SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  const updated = await c.env.DB.prepare('SELECT * FROM hackathon_rounds WHERE id = ?').bind(roundId).first();
  return successResponse(c, updated);
});

// Delete round
rounds.delete('/:roundId', authMiddleware, requireRole('co_organizer'), async (c) => {
  const roundId = c.req.param('roundId');
  await c.env.DB.prepare('DELETE FROM hackathon_rounds WHERE id = ?').bind(roundId).run();
  return successResponse(c, { deleted: true });
});

export default rounds;
