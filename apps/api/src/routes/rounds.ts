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
    name: string; round_number: number; type?: string;
    submission_deadline?: string;
  }>();

  if (!body.name || !body.round_number) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Name and round_number required');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO hackathon_rounds (id, hackathon_id, round_number, name, type, status, is_initialized, submission_deadline, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, hackathon.id, body.round_number, body.name, body.type ?? 'standard',
    'upcoming', 0, body.submission_deadline ?? null, now, now).run();

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

// Update round (organizer – cannot change is_initialized, that's admin-only)
rounds.patch('/:roundId', authMiddleware, requireRole('co_organizer'), async (c) => {
  const roundId = c.req.param('roundId');
  const body = await c.req.json<Record<string, unknown>>();

  const allowedFields = ['name', 'type', 'status', 'submission_deadline', 'started_at', 'completed_at'];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const field of allowedFields) {
    if (field in body) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  if (updates.length === 0) return errorResponse(c, 400, 'VALIDATION_ERROR', 'No fields to update');

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(roundId);
  await c.env.DB.prepare(`UPDATE hackathon_rounds SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  const updated = await c.env.DB.prepare('SELECT * FROM hackathon_rounds WHERE id = ?').bind(roundId).first();
  return successResponse(c, updated);
});

// Initialize / un-initialize a round (organizer toggle)
rounds.patch('/:roundId/initialize', authMiddleware, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;
  const roundId = c.req.param('roundId');
  const body = await c.req.json<{ is_initialized: boolean }>();

  const round = await c.env.DB.prepare(
    'SELECT * FROM hackathon_rounds WHERE id = ? AND hackathon_id = ?'
  ).bind(roundId, hackathon.id).first();
  if (!round) return errorResponse(c, 404, 'NOT_FOUND', 'Round not found');

  const now = new Date().toISOString();
  const initValue = body.is_initialized ? 1 : 0;

  if (body.is_initialized) {
    await c.env.DB.prepare(
      `UPDATE hackathon_rounds SET is_initialized = ?, status = 'active', started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?`
    ).bind(initValue, now, now, roundId).run();
  } else {
    await c.env.DB.prepare(
      'UPDATE hackathon_rounds SET is_initialized = ?, updated_at = ? WHERE id = ?'
    ).bind(initValue, now, roundId).run();
  }

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
