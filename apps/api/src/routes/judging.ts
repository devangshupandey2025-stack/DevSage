import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { authMiddleware } from '../middleware/auth.js';
import { hackathonContext } from '../middleware/hackathon.js';
import { requireRole, requireExactRole } from '../middleware/role.js';
import { assignSubmissionsRoundRobin, computeLeaderboard } from '../services/judging-service.js';
import { generateETag, checkConditionalRequest } from '../lib/etag.js';
import { KV_TTL } from '../lib/constants.js';

const judging = new Hono<AppEnv>();
judging.use('/*', hackathonContext);

// === Rubric CRUD (organizer+) ===

// Create rubric criterion
judging.post('/rubric', authMiddleware, requireRole('co_organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const body = await c.req.json<{
    name: string; description?: string; max_score?: number;
    weight: number; track_id?: string | null; sort_order?: number; round?: number;
  }>();

  if (!body.name || body.weight === undefined) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Name and weight are required');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO rubric_criteria (id, hackathon_id, name, description, max_score, weight, track_id, sort_order, round, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, hackathon.id, body.name, body.description ?? '', body.max_score ?? 10, body.weight, body.track_id ?? null, body.sort_order ?? 0, body.round ?? 1, now).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      action: 'rubric.criterion_added', entity_type: 'rubric_criteria', entity_id: id,
      details: { name: body.name },
    })
  );

  const created = await c.env.DB.prepare('SELECT * FROM rubric_criteria WHERE id = ?').bind(id).first();
  return successResponse(c, created, { status: 201 });
});

// List rubric criteria
judging.get('/rubric', async (c) => {
  const hackathon = c.get('hackathon')!;
  const criteria = await c.env.DB.prepare(
    'SELECT * FROM rubric_criteria WHERE hackathon_id = ? ORDER BY sort_order ASC'
  ).bind(hackathon.id).all();
  return successResponse(c, criteria.results || []);
});

// Update rubric criterion
judging.patch('/rubric/:criterionId', authMiddleware, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;
  const criterionId = c.req.param('criterionId');
  const body = await c.req.json<Record<string, unknown>>();

  const allowedFields = ['name', 'description', 'max_score', 'weight', 'track_id', 'sort_order', 'round'];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const field of allowedFields) {
    if (field in body) { updates.push(`${field} = ?`); values.push(body[field]); }
  }

  if (updates.length === 0) return errorResponse(c, 400, 'VALIDATION_ERROR', 'No fields to update');

  values.push(criterionId);
  await c.env.DB.prepare(`UPDATE rubric_criteria SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  const updated = await c.env.DB.prepare('SELECT * FROM rubric_criteria WHERE id = ?').bind(criterionId).first();
  return successResponse(c, updated);
});

// Delete rubric criterion
judging.delete('/rubric/:criterionId', authMiddleware, requireRole('co_organizer'), async (c) => {
  const criterionId = c.req.param('criterionId');
  await c.env.DB.prepare('DELETE FROM rubric_criteria WHERE id = ?').bind(criterionId).run();
  return successResponse(c, { deleted: true });
});

// === Judge Management (organizer+) ===

// Invite judge
judging.post('/judges', authMiddleware, requireRole('co_organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const body = await c.req.json<{ user_id: string; track_id?: string | null }>();

  if (!body.user_id) return errorResponse(c, 400, 'VALIDATION_ERROR', 'user_id is required');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await c.env.DB.prepare(
      `INSERT INTO judges (id, hackathon_id, user_id, invite_status, track_id, invited_by, invited_at) VALUES (?, ?, ?, 'pending', ?, ?, ?)`
    ).bind(id, hackathon.id, body.user_id, body.track_id ?? null, user.id, now).run();
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return errorResponse(c, 409, 'JUDGE_ALREADY_INVITED', 'Judge already invited');
    }
    throw err;
  }

  // Send invite notification via queue
  c.executionCtx.waitUntil(
    c.env.NOTIFICATION_QUEUE.send({
      type: 'judge.invited',
      hackathon_id: hackathon.id,
      data: { judge_id: id, user_id: body.user_id },
    })
  );

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      action: 'judge.invited', entity_type: 'judge', entity_id: id,
      details: { user_id: body.user_id },
    })
  );

  return successResponse(c, { id, user_id: body.user_id }, { status: 201 });
});

// Bulk invite judges
judging.post('/judges/bulk', authMiddleware, requireRole('co_organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const body = await c.req.json<{ user_ids: string[] }>();

  if (!body.user_ids || body.user_ids.length === 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'user_ids array is required');
  }

  const results: Array<{ user_id: string; status: string }> = [];
  const now = new Date().toISOString();

  // Chunk to stay under D1 param limit
  for (const userId of body.user_ids.slice(0, 50)) {
    const id = crypto.randomUUID();
    try {
      await c.env.DB.prepare(
      `INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_by, invited_at) VALUES (?, ?, ?, 'pending', ?, ?)`
      ).bind(id, hackathon.id, userId, user.id, now).run();
      results.push({ user_id: userId, status: 'invited' });
    } catch {
      results.push({ user_id: userId, status: 'already_invited' });
    }
  }

  return successResponse(c, results, { status: 201 });
});

// List judges (public - for overview metrics)
judging.get('/judges', async (c) => {
  const hackathon = c.get('hackathon')!;
  const judges = await c.env.DB.prepare(`
    SELECT j.id, j.invite_status, j.user_id, j.track_id, j.invited_at, j.responded_at,
           u.name, u.avatar_url
    FROM judges j
    LEFT JOIN users u ON j.user_id = u.id
    WHERE j.hackathon_id = ?
    ORDER BY j.invited_at ASC
  `).bind(hackathon.id).all();
  return successResponse(c, judges.results || []);
});

// Remove judge
judging.delete('/judges/:judgeId', authMiddleware, requireRole('co_organizer'), async (c) => {
  const judgeId = c.req.param('judgeId');
  await c.env.DB.prepare('DELETE FROM judges WHERE id = ?').bind(judgeId).run();
  return successResponse(c, { deleted: true });
});

// Assign judge to a track
judging.post('/judges/:judgeId/tracks', authMiddleware, requireRole('co_organizer'), async (c) => {
  const judgeId = c.req.param('judgeId');
  const body = await c.req.json<{ track_id: string | null }>();

  await c.env.DB.prepare('UPDATE judges SET track_id = ? WHERE id = ?').bind(body.track_id ?? null, judgeId).run();

  return successResponse(c, { updated: true });
});

// === Assignments (organizer+) ===

// Auto-assign submissions to judges (round-robin)
judging.post('/assign', authMiddleware, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;
  const body = await c.req.json<{ round_id?: string }>().catch((): { round_id?: string } => ({}));

  const result = await assignSubmissionsRoundRobin(c.env.DB, hackathon.id, body.round_id);
  return successResponse(c, result);
});

// Get assignments for a judge
judging.get('/judges/:judgeId/assignments', authMiddleware, async (c) => {
  const judgeId = c.req.param('judgeId');
  const assignments = await c.env.DB.prepare(`
    SELECT ja.id, ja.submission_id, ja.team_id, ja.round, ja.status, ja.assigned_at, ja.completed_at,
           s.tag_name, s.commit_sha, t.name as team_name
    FROM judge_assignments ja
    LEFT JOIN submissions s ON ja.submission_id = s.id
    JOIN teams t ON ja.team_id = t.id
    WHERE ja.judge_id = ?
    ORDER BY ja.assigned_at ASC
  `).bind(judgeId).all();
  return successResponse(c, assignments.results || []);
});

// === Scoring (judges only) ===

// Submit scores for a submission
judging.post('/submissions/:submissionId/scores', authMiddleware, requireExactRole('judge'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const submissionId = c.req.param('submissionId');
  const body = await c.req.json<{
    scores: Array<{ criteria_id: string; score: number; comment?: string; assignment_id: string; round?: number }>;
  }>();

  if (!body.scores || body.scores.length === 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Scores are required');
  }

  // Get judge record
  const judge = await c.env.DB.prepare(
    'SELECT id FROM judges WHERE hackathon_id = ? AND user_id = ? AND invite_status = ?'
  ).bind(hackathon.id, user.id, 'accepted').first<{ id: string }>();

  if (!judge) return errorResponse(c, 403, 'FORBIDDEN', 'Not an accepted judge');

  // Verify assignment exists
  const assignment = await c.env.DB.prepare(
    'SELECT id FROM judge_assignments WHERE judge_id = ? AND submission_id = ?'
  ).bind(judge.id, submissionId).first<{ id: string }>();

  if (!assignment) return errorResponse(c, 403, 'NOT_ASSIGNED', 'Not assigned to this submission');

  const now = new Date().toISOString();

  // Upsert scores
  for (const s of body.scores) {
    const round = s.round ?? 1;
    const assignmentId = s.assignment_id;
    await c.env.DB.prepare(`
      INSERT INTO scores (id, submission_id, judge_id, criteria_id, assignment_id, score, comment, round, scored_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(submission_id, judge_id, criteria_id, round) DO UPDATE SET score = ?, comment = ?, scored_at = ?
    `).bind(
      crypto.randomUUID(), submissionId, judge.id, s.criteria_id, assignmentId, s.score, s.comment ?? null, round, now,
      s.score, s.comment ?? null, now
    ).run();
  }

  // Update assignment status
  await c.env.DB.prepare(
    'UPDATE judge_assignments SET status = ?, completed_at = ? WHERE id = ?'
  ).bind('scored', now, assignment.id).run();

  // Invalidate leaderboard cache
  await c.env.KV.delete(`leaderboard:${hackathon.id}`);

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      action: 'score.submitted', entity_type: 'submission', entity_id: submissionId,
      details: { judge_id: judge.id, scores_count: body.scores.length },
    })
  );

  return successResponse(c, { scored: true });
});

// Get scores for a submission
judging.get('/submissions/:submissionId/scores', authMiddleware, requireRole('judge'), async (c) => {
  const submissionId = c.req.param('submissionId');
  const scores = await c.env.DB.prepare(`
    SELECT s.id, s.criteria_id, s.judge_id, s.assignment_id, s.score, s.comment, s.round, s.scored_at,
           rc.name as criterion_name, rc.max_score, rc.weight
    FROM scores s
    JOIN rubric_criteria rc ON s.criteria_id = rc.id
    WHERE s.submission_id = ?
    ORDER BY rc.sort_order ASC
  `).bind(submissionId).all();
  return successResponse(c, scores.results || []);
});

// === Leaderboard ===

judging.get('/leaderboard', async (c) => {
  const hackathon = c.get('hackathon')!;
  const roundId = c.req.query('round_id');
  const trackId = c.req.query('track_id');

  // Check KV cache
  const cacheKey = `leaderboard:${hackathon.id}:${roundId ?? 'all'}:${trackId ?? 'all'}`;
  const cached = await c.env.KV.get(cacheKey);
  if (cached) {
    const data = JSON.parse(cached);
    const etag = await generateETag(data);
    if (checkConditionalRequest(c.req.header('If-None-Match'), etag)) {
      return c.body(null, 304);
    }
    c.header('ETag', etag);
    return successResponse(c, data);
  }

  const leaderboard = await computeLeaderboard(c.env.DB, hackathon.id, roundId, trackId);

  // Cache with appropriate TTL
  const ttl = hackathon.status === 'judging' ? KV_TTL.LEADERBOARD_JUDGING : KV_TTL.LEADERBOARD_COMPLETED;
  c.executionCtx.waitUntil(
    c.env.KV.put(cacheKey, JSON.stringify(leaderboard), { expirationTtl: ttl })
  );

  const etag = await generateETag(leaderboard);
  c.header('ETag', etag);
  return successResponse(c, leaderboard);
});

// === Results Publication (organizer) ===

judging.post('/results/publish', authMiddleware, requireRole('organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const body = await c.req.json<{ round_id?: string }>().catch((): { round_id?: string } => ({}));

  if (hackathon.status !== 'judging' && hackathon.status !== 'completed') {
    return errorResponse(c, 409, 'INVALID_STATE', 'Cannot publish results in current state');
  }

  const leaderboard = await computeLeaderboard(c.env.DB, hackathon.id, body.round_id);

  // Persist results
  const now = new Date().toISOString();
  for (const entry of leaderboard) {
    const id = crypto.randomUUID();
    const roundId = body.round_id ?? null;
    await c.env.DB.prepare(`
      INSERT INTO round_results (id, hackathon_id, round_id, team_id, status, rank, total_score, decided_by, created_at)
      VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?)
      ON CONFLICT(round_id, team_id) DO UPDATE SET rank = ?, total_score = ?, status = 'published', decided_by = ?
    `).bind(id, hackathon.id, roundId, entry.team_id, entry.rank, entry.total_score, user.id, now, entry.rank, entry.total_score, user.id).run();
  }

  // Notify
  c.executionCtx.waitUntil(
    c.env.NOTIFICATION_QUEUE.send({
      type: 'results.published',
      hackathon_id: hackathon.id,
      data: { round_id: body.round_id, results_count: leaderboard.length },
    })
  );

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      action: 'results.published', entity_type: 'hackathon', entity_id: hackathon.id,
      details: { results_count: leaderboard.length },
    })
  );

  return successResponse(c, { published: true, results: leaderboard });
});

export default judging;
