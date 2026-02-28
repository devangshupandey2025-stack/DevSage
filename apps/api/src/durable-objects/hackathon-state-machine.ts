import { DurableObject } from 'cloudflare:workers';
import { VALID_TRANSITIONS } from '../lib/constants.js';

interface DOEnv {
  DB: D1Database;
  KV: KVNamespace;
  NOTIFICATION_QUEUE: Queue;
  WEBHOOK_QUEUE: Queue;
}

export class HackathonStateMachine extends DurableObject<DOEnv> {
  private initialized = false;

  constructor(ctx: DurableObjectState, env: DOEnv) {
    super(ctx, env);
  }

  private ensureTables(): void {
    if (this.initialized) return;
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS lifecycle_state (
        hackathon_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS submission_locks (
        submission_key TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL,
        locked_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS team_submissions (
        team_id TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0
      );
    `);
    this.initialized = true;
  }

  override async fetch(request: Request): Promise<Response> {
    this.ensureTables();
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === 'POST' && path === '/initialize') {
        return this.handleInitialize(request);
      }
      if (request.method === 'POST' && path === '/transition') {
        return this.handleTransition(request);
      }
      if (request.method === 'GET' && path === '/state') {
        return this.handleGetState();
      }
      if (request.method === 'POST' && path === '/accept-submission') {
        return this.handleAcceptSubmission(request);
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`DO error on ${path}: ${message}`);
      return new Response(JSON.stringify({ error: message }), { status: 500 });
    }
  }

  private async handleInitialize(request: Request): Promise<Response> {
    const body = await request.json() as {
      hackathon_id: string;
      status?: string;
      submission_deadline?: string;
    };

    const { hackathon_id, status = 'draft', submission_deadline } = body;

    // Idempotent: check if already initialized
    const existing = this.ctx.storage.sql.exec(
      'SELECT status, version FROM lifecycle_state WHERE hackathon_id = ?',
      hackathon_id
    ).toArray();

    if (existing.length > 0) {
      return Response.json({
        ok: true,
        data: { status: existing[0].status, version: existing[0].version, already_initialized: true },
      });
    }

    const now = new Date().toISOString();
    this.ctx.storage.sql.exec(
      'INSERT INTO lifecycle_state (hackathon_id, status, version, updated_at) VALUES (?, ?, 1, ?)',
      hackathon_id, status, now
    );

    // Set alarm for submission deadline if transitioning to active
    if (status === 'active' && submission_deadline) {
      const deadlineMs = new Date(submission_deadline).getTime();
      if (deadlineMs > Date.now()) {
        await this.ctx.storage.setAlarm(deadlineMs);
      }
    }

    return Response.json({ ok: true, data: { status, version: 1, already_initialized: false } });
  }

  private async handleTransition(request: Request): Promise<Response> {
    const body = await request.json() as {
      target_status: string;
      version: number;
      submission_deadline?: string;
    };

    const { target_status, version, submission_deadline } = body;

    const current = this.ctx.storage.sql.exec(
      'SELECT hackathon_id, status, version FROM lifecycle_state LIMIT 1'
    ).toArray();

    if (current.length === 0) {
      return Response.json(
        { ok: false, error: { code: 'NOT_INITIALIZED', message: 'DO not initialized' } },
        { status: 400 }
      );
    }

    const state = current[0] as { hackathon_id: string; status: string; version: number };

    // Validate transition
    const allowed = VALID_TRANSITIONS[state.status as string];
    if (!allowed || !allowed.includes(target_status)) {
      return Response.json(
        { ok: false, error: { code: 'INVALID_TRANSITION', message: `Cannot transition from ${state.status} to ${target_status}` } },
        { status: 409 }
      );
    }

    // Optimistic locking (version=-1 bypasses for cron/alarm)
    if (version !== -1 && version !== state.version) {
      return Response.json(
        { ok: false, error: { code: 'VERSION_CONFLICT', message: `Expected version ${version}, got ${state.version}` } },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const newVersion = (state.version as number) + 1;

    this.ctx.storage.sql.exec(
      'UPDATE lifecycle_state SET status = ?, version = ?, updated_at = ?',
      target_status, newVersion, now
    );

    // Set alarm for submission deadline when transitioning to active
    if (target_status === 'active' && submission_deadline) {
      const deadlineMs = new Date(submission_deadline).getTime();
      if (deadlineMs > Date.now()) {
        await this.ctx.storage.setAlarm(deadlineMs);
      }
    }

    // Clear alarm when transitioning away from active
    if (state.status === 'active' && target_status !== 'active') {
      await this.ctx.storage.deleteAlarm();
    }

    return Response.json({
      ok: true,
      data: { status: target_status, version: newVersion, previous_status: state.status },
    });
  }

  private handleGetState(): Response {
    const current = this.ctx.storage.sql.exec(
      'SELECT hackathon_id, status, version, updated_at FROM lifecycle_state LIMIT 1'
    ).toArray();

    if (current.length === 0) {
      return Response.json(
        { ok: false, error: { code: 'NOT_INITIALIZED', message: 'DO not initialized' } },
        { status: 400 }
      );
    }

    return Response.json({ ok: true, data: current[0] });
  }

  private async handleAcceptSubmission(request: Request): Promise<Response> {
    const body = await request.json() as {
      submission_key: string;  // {team_id}:{tag_name}
      submission_id: string;
      team_id: string;
    };

    const { submission_key, submission_id, team_id } = body;

    // Check lifecycle state — must be 'active'
    const state = this.ctx.storage.sql.exec(
      'SELECT status FROM lifecycle_state LIMIT 1'
    ).toArray();

    if (state.length === 0 || state[0].status !== 'active') {
      return Response.json({
        ok: true,
        data: { accepted: false, reason: 'Hackathon is not accepting submissions' },
      });
    }

    const now = new Date().toISOString();

    // Try to insert lock — if key already exists, INSERT OR IGNORE does nothing
    const result = this.ctx.storage.sql.exec(
      'INSERT OR IGNORE INTO submission_locks (submission_key, submission_id, locked_at) VALUES (?, ?, ?)',
      submission_key, submission_id, now
    );

    if (result.rowsWritten === 0) {
      // Already locked — duplicate submission for this tag
      return Response.json({
        ok: true,
        data: { accepted: false, reason: 'Submission already locked for this tag' },
      });
    }

    // Update team submission count
    this.ctx.storage.sql.exec(
      'INSERT INTO team_submissions (team_id, count) VALUES (?, 1) ON CONFLICT(team_id) DO UPDATE SET count = count + 1',
      team_id
    );

    return Response.json({ ok: true, data: { accepted: true } });
  }

  /**
   * Alarm handler: auto-transition from active → judging when deadline hits.
   */
  override async alarm(): Promise<void> {
    this.ensureTables();

    const state = this.ctx.storage.sql.exec(
      'SELECT hackathon_id, status, version FROM lifecycle_state LIMIT 1'
    ).toArray();

    if (state.length === 0) return;
    const current = state[0] as { hackathon_id: string; status: string; version: number };

    if (current.status !== 'active') return;

    // Transition to judging
    const now = new Date().toISOString();
    const newVersion = (current.version as number) + 1;

    this.ctx.storage.sql.exec(
      'UPDATE lifecycle_state SET status = ?, version = ?, updated_at = ?',
      'judging', newVersion, now
    );

    // Sync D1 status (DO has access to env bindings)
    await this.env.DB.prepare(
      'UPDATE hackathons SET status = ?, updated_at = ? WHERE id = ?'
    ).bind('judging', now, current.hackathon_id).run();

    // Enqueue notification
    await this.env.NOTIFICATION_QUEUE.send({
      type: 'hackathon.judging_started',
      hackathon_id: current.hackathon_id,
    });
  }
}
