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
    weight: number; track_id?: string | null; sort_order?: number;
  }>();

  if (!body.name || body.weight === undefined) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Name and weight are required');
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO rubric_criteria (id, hackathon_id, name, description, max_score, weight, track_id, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, hackathon.id, body.name, body.description ?? null, body.max_score ?? 10, body.weight, body.track_id ?? null, body.sort_order ?? 0).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      event_type: 'rubric.criterion_added', entity_type: 'rubric_criteria', entity_id: id,
      metadata: { name: body.name },
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

  const allowedFields = ['name', 'description', 'max_score', 'weight', 'track_id', 'sort_order'];
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
  const body = await c.req.json<{ email: string }>();

  if (!body.email) return errorResponse(c, 400, 'VALIDATION_ERROR', 'Email is required');

  const id = crypto.randomUUID();
  const inviteToken = crypto.randomUUID();

  try {
    await c.env.DB.prepare(
      `INSERT INTO judges (id, hackathon_id, email, invite_token, invited_by) VALUES (?, ?, ?, ?, ?)`
    ).bind(id, hackathon.id, body.email, inviteToken, user.id).run();
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return errorResponse(c, 409, 'JUDGE_ALREADY_INVITED', 'Judge already invited');
    }
    throw err;
  }

  // Send invite email via notification queue
  c.executionCtx.waitUntil(
    c.env.NOTIFICATION_QUEUE.send({
      type: 'judge.invited',
      hackathon_id: hackathon.id,
      data: { judge_id: id, email: body.email, invite_token: inviteToken },
    })
  );

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      event_type: 'judge.invited', entity_type: 'judge', entity_id: id,
      metadata: { email: body.email },
    })
  );

  return successResponse(c, { id, email: body.email, invite_token: inviteToken }, { status: 201 });
});

// Bulk invite judges
judging.post('/judges/bulk', authMiddleware, requireRole('co_organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const body = await c.req.json<{ emails: string[] }>();

  if (!body.emails || body.emails.length === 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Emails array is required');
  }

  const results: Array<{ email: string; status: string; invite_token?: string }> = [];

  // Chunk to stay under D1 param limit
  for (const email of body.emails.slice(0, 50)) {
    const id = crypto.randomUUID();
    const inviteToken = crypto.randomUUID();
    try {
      await c.env.DB.prepare(
        'INSERT INTO judges (id, hackathon_id, email, invite_token, invited_by) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, hackathon.id, email, inviteToken, user.id).run();
      results.push({ email, status: 'invited', invite_token: inviteToken });
    } catch {
      results.push({ email, status: 'already_invited' });
    }
  }

  return successResponse(c, results, { status: 201 });
});

// List judges
judging.get('/judges', authMiddleware, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;
  const judges = await c.env.DB.prepare(`
    SELECT j.id, j.email, j.invite_status, j.user_id, j.created_at, j.accepted_at,
           u.name, u.avatar_url
    FROM judges j
    LEFT JOIN users u ON j.user_id = u.id
    WHERE j.hackathon_id = ?
    ORDER BY j.created_at ASC
  `).bind(hackathon.id).all();
  return successResponse(c, judges.results || []);
});

// Remove judge
judging.delete('/judges/:judgeId', authMiddleware, requireRole('co_organizer'), async (c) => {
  const judgeId = c.req.param('judgeId');
  await c.env.DB.prepare('DELETE FROM judges WHERE id = ?').bind(judgeId).run();
  return successResponse(c, { deleted: true });
});

// Assign judge to tracks
judging.post('/judges/:judgeId/tracks', authMiddleware, requireRole('co_organizer'), async (c) => {
  const judgeId = c.req.param('judgeId');
  const body = await c.req.json<{ track_ids: string[] }>();

  if (!body.track_ids || body.track_ids.length === 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'track_ids required');
  }

  // Clear existing and re-insert
  await c.env.DB.prepare('DELETE FROM judge_tracks WHERE judge_id = ?').bind(judgeId).run();

  for (const trackId of body.track_ids) {
    await c.env.DB.prepare(
      'INSERT INTO judge_tracks (id, judge_id, track_id) VALUES (?, ?, ?)'
    ).bind(crypto.randomUUID(), judgeId, trackId).run();
  }

  return successResponse(c, { assigned: body.track_ids.length });
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
    SELECT ja.id, ja.submission_id, ja.status, ja.created_at,
           s.tag_name, s.commit_sha, s.team_id, t.name as team_name
    FROM judge_assignments ja
    JOIN submissions s ON ja.submission_id = s.id
    JOIN teams t ON s.team_id = t.id
    WHERE ja.judge_id = ?
    ORDER BY ja.created_at ASC
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
    scores: Array<{ criterion_id: string; score: number; notes?: string }>;
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
    await c.env.DB.prepare(`
      INSERT INTO scores (id, hackathon_id, submission_id, judge_id, criterion_id, score, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(judge_id, submission_id, criterion_id) DO UPDATE SET score = ?, notes = ?, updated_at = ?
    `).bind(
      crypto.randomUUID(), hackathon.id, submissionId, judge.id, s.criterion_id, s.score, s.notes ?? null, now, now,
      s.score, s.notes ?? null, now
    ).run();
  }

  // Update assignment status
  await c.env.DB.prepare(
    'UPDATE judge_assignments SET status = ? WHERE id = ?'
  ).bind('scored', assignment.id).run();

  // Invalidate leaderboard cache
  await c.env.KV.delete(`leaderboard:${hackathon.id}`);

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      event_type: 'score.submitted', entity_type: 'submission', entity_id: submissionId,
      metadata: { judge_id: judge.id, scores_count: body.scores.length },
    })
  );

  return successResponse(c, { scored: true });
});

// Get scores for a submission
judging.get('/submissions/:submissionId/scores', authMiddleware, requireRole('judge'), async (c) => {
  const submissionId = c.req.param('submissionId');
  const scores = await c.env.DB.prepare(`
    SELECT s.id, s.criterion_id, s.judge_id, s.score, s.notes, s.updated_at,
           rc.name as criterion_name, rc.max_score, rc.weight
    FROM scores s
    JOIN rubric_criteria rc ON s.criterion_id = rc.id
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
  for (const entry of leaderboard) {
    const id = crypto.randomUUID();
    const roundId = body.round_id ?? null;
    await c.env.DB.prepare(`
      INSERT INTO round_results (id, round_id, team_id, rank, total_score)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(round_id, team_id) DO UPDATE SET rank = ?, total_score = ?
    `).bind(id, roundId, entry.team_id, entry.rank, entry.total_score, entry.rank, entry.total_score).run();
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
      event_type: 'results.published', entity_type: 'hackathon', entity_id: hackathon.id,
      metadata: { results_count: leaderboard.length },
    })
  );

  return successResponse(c, { published: true, results: leaderboard });
});

export default judging;
