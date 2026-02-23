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
  const roundType = body.type === 'elimination' ? 'elimination' : 'scoring_only';
  await c.env.DB.prepare(
    `INSERT INTO hackathon_rounds (id, hackathon_id, round_number, name, type, status, is_initialized, submission_deadline, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, hackathon.id, body.round_number, body.name, roundType,
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
  const hackathon = c.get('hackathon')!;
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
  values.push(hackathon.id);
  await c.env.DB.prepare(
    `UPDATE hackathon_rounds SET ${updates.join(', ')} WHERE id = ? AND hackathon_id = ?`
  ).bind(...values).run();

  const updated = await c.env.DB.prepare(
    'SELECT * FROM hackathon_rounds WHERE id = ? AND hackathon_id = ?'
  ).bind(roundId, hackathon.id).first();
  if (!updated) return errorResponse(c, 404, 'NOT_FOUND', 'Round not found');
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
  const hackathon = c.get('hackathon')!;
  const roundId = c.req.param('roundId');
  await c.env.DB.prepare(
    'DELETE FROM hackathon_rounds WHERE id = ? AND hackathon_id = ?'
  ).bind(roundId, hackathon.id).run();
  return successResponse(c, { deleted: true });
});

// ─── Team Advancement (Elimination Rounds) ───────────────────

// Get round results with advancement status
rounds.get('/:roundId/results', async (c) => {
  const hackathon = c.get('hackathon')!;
  const roundId = c.req.param('roundId');
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10), 1), 100);
  const offset = Math.max(parseInt(c.req.query('offset') || '0', 10), 0);

  const results = await c.env.DB.prepare(`
    SELECT rr.*, t.name as team_name, t.status as team_status
    FROM round_results rr
    JOIN teams t ON rr.team_id = t.id
    WHERE rr.round_id = ? AND rr.hackathon_id = ?
    ORDER BY rr.rank ASC
    LIMIT ? OFFSET ?
  `).bind(roundId, hackathon.id, limit + 1, offset).all();

  const items = results.results || [];
  const has_more = items.length > limit;
  return successResponse(c, items.slice(0, limit), { meta: { limit, offset, has_more } });
});

// Select advancing teams (elimination round)
rounds.post('/:roundId/advance', authMiddleware, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;
  const roundId = c.req.param('roundId');
  const body = await c.req.json<{ advancing_team_ids: string[] }>();

  if (!body.advancing_team_ids || !Array.isArray(body.advancing_team_ids)) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'advancing_team_ids array required');
  }

  // Verify this is an elimination round
  const round = await c.env.DB.prepare(
    'SELECT * FROM hackathon_rounds WHERE id = ? AND hackathon_id = ?'
  ).bind(roundId, hackathon.id).first<{ id: string; type: string; round_number: number }>();

  if (!round) return errorResponse(c, 404, 'NOT_FOUND', 'Round not found');
  if (round.type !== 'elimination') {
    return errorResponse(c, 400, 'INVALID_ROUND_TYPE', 'Can only advance teams in elimination rounds');
  }

  const now = new Date().toISOString();
  const user = c.get('user')!;
  const advancingSet = new Set(body.advancing_team_ids);

  // Get all teams with round results
  const allResults = await c.env.DB.prepare(
    'SELECT id, team_id FROM round_results WHERE round_id = ? AND hackathon_id = ?'
  ).bind(roundId, hackathon.id).all<{ id: string; team_id: string }>();

  const statements = [];

  for (const result of allResults.results || []) {
    const isAdvancing = advancingSet.has(result.team_id);
    // Update round_results status
    statements.push(
      c.env.DB.prepare(
        'UPDATE round_results SET status = ?, decided_by = ? WHERE id = ?'
      ).bind(isAdvancing ? 'advanced' : 'eliminated', user.id, result.id)
    );

    // Update team status for eliminated teams
    if (!isAdvancing) {
      statements.push(
        c.env.DB.prepare(
          "UPDATE teams SET status = 'eliminated', updated_at = ? WHERE id = ?"
        ).bind(now, result.team_id)
      );
    }
  }

  if (statements.length > 0) {
    for (let i = 0; i < statements.length; i += 20) {
      await c.env.DB.batch(statements.slice(i, i + 20));
    }
  }

  return successResponse(c, {
    advanced: body.advancing_team_ids.length,
    eliminated: (allResults.results?.length ?? 0) - body.advancing_team_ids.length,
  });
});

// Publish round results (compute leaderboard for the round)
rounds.post('/:roundId/publish', authMiddleware, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;
  const roundId = c.req.param('roundId');
  const user = c.get('user')!;

  const round = await c.env.DB.prepare(
    'SELECT * FROM hackathon_rounds WHERE id = ? AND hackathon_id = ?'
  ).bind(roundId, hackathon.id).first<{ id: string; type: string; round_number: number }>();

  if (!round) return errorResponse(c, 404, 'NOT_FOUND', 'Round not found');

  // Get all teams with their scores for this round
  const teamScores = await c.env.DB.prepare(`
    SELECT t.id as team_id, t.name as team_name,
           COALESCE(SUM(s.score * rc.weight), 0) as total_score
    FROM teams t
    LEFT JOIN submissions sub ON sub.team_id = t.id AND sub.round_id = ? AND sub.is_final = 1
    LEFT JOIN scores s ON s.submission_id = sub.id
    LEFT JOIN rubric_criteria rc ON s.criteria_id = rc.id
    WHERE t.hackathon_id = ? AND t.status != 'eliminated'
    GROUP BY t.id
    ORDER BY total_score DESC
  `).bind(roundId, hackathon.id).all<{ team_id: string; team_name: string; total_score: number }>();

  const now = new Date().toISOString();
  const statements = [];

  // Delete existing results for this round
  statements.push(
    c.env.DB.prepare('DELETE FROM round_results WHERE round_id = ? AND hackathon_id = ?').bind(roundId, hackathon.id)
  );

  // Insert ranked results
  const teams = teamScores.results || [];
  for (let i = 0; i < teams.length; i++) {
    const isScoreOnly = round.type === 'scoring_only';
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO round_results (id, hackathon_id, round_id, team_id, status, rank, total_score, decided_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), hackathon.id, roundId, teams[i].team_id,
        isScoreOnly ? 'advanced' : 'pending',
        i + 1, teams[i].total_score, user.id, now
      )
    );
  }

  // Mark round as completed
  statements.push(
    c.env.DB.prepare(
      "UPDATE hackathon_rounds SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?"
    ).bind(now, now, roundId)
  );

  // Execute in chunks of 20 to stay under D1 bound parameter limit
  for (let i = 0; i < statements.length; i += 20) {
    await c.env.DB.batch(statements.slice(i, i + 20));
  }

  return successResponse(c, {
    teams_ranked: teams.length,
    round_type: round.type,
  });
});

export default rounds;
