import { DurableObject } from 'cloudflare:workers';
import { HACKATHON_STATUS_TRANSITIONS, type HackathonStatus } from '@devsage/shared';
import type { Env } from '../types/env.js';

// ─── Interfaces ──────────────────────────────────────────────

interface HackathonConfig {
  registrationOpens: string;
  registrationCloses: string;
  submissionDeadline: string;
  judgingStarts: string | null;
  judgingEnds: string | null;
  maxTeams: number | null;
  maxSubmissionsPerTeam: number | null;
  allowLateSubmissions: number; // SQLite integer boolean (0/1)
  submissionTagPattern: string;
}

interface HackathonState {
  hackathonId: string;
  status: HackathonStatus;
  config: HackathonConfig;
  version: number;
  transitionedAt: string;
}

interface InitializeRequest {
  hackathonId: string;
  config: HackathonConfig;
}

interface TransitionRequest {
  targetStatus: HackathonStatus;
  expectedVersion?: number;
}

interface AcceptSubmissionRequest {
  teamId: string;
  submissionId: string;
  tagName: string;
  commitSha: string;
  timestamp: string;
  webhookDeliveryId: string;
}

interface SubmissionResult {
  accepted: boolean;
  reason?: string;
  submissionId?: string;
}

// ─── Type Guards ─────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHackathonStatus(value: string): value is HackathonStatus {
  return Object.prototype.hasOwnProperty.call(HACKATHON_STATUS_TRANSITIONS, value);
}

function isValidDateString(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function parseInitializeRequest(value: unknown): InitializeRequest | null {
  if (!isRecord(value)) return null;

  const { hackathonId, config } = value;
  if (typeof hackathonId !== 'string' || !isRecord(config)) return null;

  const {
    registrationOpens,
    registrationCloses,
    submissionDeadline,
    judgingStarts,
    judgingEnds,
    maxTeams,
    maxSubmissionsPerTeam,
    allowLateSubmissions,
    submissionTagPattern,
  } = config;

  if (
    typeof registrationOpens !== 'string' || !isValidDateString(registrationOpens) ||
    typeof registrationCloses !== 'string' || !isValidDateString(registrationCloses) ||
    typeof submissionDeadline !== 'string' || !isValidDateString(submissionDeadline)
  ) return null;

  if (judgingStarts !== null && judgingStarts !== undefined && (typeof judgingStarts !== 'string' || !isValidDateString(judgingStarts))) return null;
  if (judgingEnds !== null && judgingEnds !== undefined && (typeof judgingEnds !== 'string' || !isValidDateString(judgingEnds))) return null;
  if (maxTeams !== null && maxTeams !== undefined && (typeof maxTeams !== 'number' || !Number.isInteger(maxTeams))) return null;
  if (maxSubmissionsPerTeam !== null && maxSubmissionsPerTeam !== undefined && (typeof maxSubmissionsPerTeam !== 'number' || !Number.isInteger(maxSubmissionsPerTeam))) return null;

  const parsedAllowLate = typeof allowLateSubmissions === 'number' ? allowLateSubmissions : (allowLateSubmissions ? 1 : 0);
  const parsedTagPattern = typeof submissionTagPattern === 'string' ? submissionTagPattern : 'submission_v%';

  return {
    hackathonId,
    config: {
      registrationOpens,
      registrationCloses,
      submissionDeadline,
      judgingStarts: (typeof judgingStarts === 'string' ? judgingStarts : null),
      judgingEnds: (typeof judgingEnds === 'string' ? judgingEnds : null),
      maxTeams: (typeof maxTeams === 'number' ? maxTeams : null),
      maxSubmissionsPerTeam: (typeof maxSubmissionsPerTeam === 'number' ? maxSubmissionsPerTeam : null),
      allowLateSubmissions: parsedAllowLate,
      submissionTagPattern: parsedTagPattern,
    },
  };
}

function parseTransitionRequest(value: unknown): TransitionRequest | null {
  if (!isRecord(value)) return null;
  const { targetStatus, expectedVersion } = value;
  if (typeof targetStatus !== 'string' || !isHackathonStatus(targetStatus)) return null;
  if (expectedVersion !== undefined && (typeof expectedVersion !== 'number' || !Number.isInteger(expectedVersion) || expectedVersion <= 0)) return null;
  return { targetStatus, expectedVersion: expectedVersion as number | undefined };
}

function parseAcceptSubmissionRequest(value: unknown): AcceptSubmissionRequest | null {
  if (!isRecord(value)) return null;
  const { teamId, submissionId, tagName, commitSha, timestamp, webhookDeliveryId } = value;
  if (
    typeof teamId !== 'string' ||
    typeof submissionId !== 'string' ||
    typeof tagName !== 'string' ||
    typeof commitSha !== 'string' ||
    typeof timestamp !== 'string' ||
    typeof webhookDeliveryId !== 'string'
  ) return null;
  return { teamId, submissionId, tagName, commitSha, timestamp, webhookDeliveryId };
}

// ─── Durable Object ──────────────────────────────────────────

export class HackathonStateMachine extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS lifecycle_state (
          hackathon_id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          config TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          transitioned_at TEXT NOT NULL
        )
      `);

      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS submission_locks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          team_id TEXT NOT NULL,
          tag_name TEXT NOT NULL,
          submission_id TEXT NOT NULL,
          commit_sha TEXT NOT NULL,
          webhook_delivery_id TEXT NOT NULL UNIQUE,
          locked_at TEXT NOT NULL
        )
      `);

      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS team_submissions (
          team_id TEXT PRIMARY KEY,
          submission_count INTEGER NOT NULL DEFAULT 0
        )
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/initialize') {
      return this.handleInitialize(request);
    }

    if (request.method === 'POST' && url.pathname === '/transition') {
      return this.handleTransition(request);
    }

    if (request.method === 'GET' && url.pathname === '/state') {
      const state = this.getState();
      if (!state) {
        return Response.json({ error: 'State machine not initialized', code: 'NOT_INITIALIZED' }, { status: 404 });
      }
      return Response.json({
        hackathonId: state.hackathonId,
        status: state.status,
        config: state.config,
        version: state.version,
        transitionedAt: state.transitionedAt,
      });
    }

    if (request.method === 'POST' && url.pathname === '/accept-submission') {
      return this.handleAcceptSubmission(request);
    }

    if (request.method === 'GET' && url.pathname === '/can-accept-submissions') {
      return this.handleCanAcceptSubmissions();
    }

    return Response.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  async alarm(): Promise<void> {
    const state = this.getState();
    if (!state) return;

    const now = Date.now();

    // Check if registration should close
    if (state.status === 'registration_open') {
      const closesAt = Date.parse(state.config.registrationCloses);
      if (Number.isFinite(closesAt) && now >= closesAt) {
        this.performTransition(state, 'registration_closed');
        const updated = this.getState();
        if (updated) await this.scheduleNextAlarm(updated);
        return;
      }
    }

    // Check if submissions should close (active → judging)
    if (state.status === 'active') {
      const deadline = Date.parse(state.config.submissionDeadline);
      if (Number.isFinite(deadline) && now >= deadline) {
        this.performTransition(state, 'judging');
        const updated = this.getState();
        if (updated) await this.scheduleNextAlarm(updated);
        return;
      }
    }

    // Check if judging should end
    if (state.status === 'judging' && state.config.judgingEnds) {
      const judgingEnds = Date.parse(state.config.judgingEnds);
      if (Number.isFinite(judgingEnds) && now >= judgingEnds) {
        this.performTransition(state, 'completed');
        const updated = this.getState();
        if (updated) await this.scheduleNextAlarm(updated);
        return;
      }
    }

    // Re-schedule for next upcoming deadline
    await this.scheduleNextAlarm(state);
  }

  // ─── Private: State Management ────────────────────────────

  private getState(): HackathonState | null {
    const rows = this.ctx.storage.sql
      .exec(`
        SELECT hackathon_id, status, config, version, transitioned_at
        FROM lifecycle_state
        LIMIT 1
      `)
      .toArray();

    const row = rows[0];
    if (!isRecord(row)) return null;

    const { hackathon_id, status, config, version, transitioned_at } = row;
    if (
      typeof hackathon_id !== 'string' ||
      typeof status !== 'string' ||
      typeof config !== 'string' ||
      typeof version !== 'number' ||
      typeof transitioned_at !== 'string'
    ) {
      throw new Error('Invalid lifecycle_state row shape');
    }

    if (!isHackathonStatus(status)) {
      throw new Error(`Invalid status stored in lifecycle_state: ${status}`);
    }

    let parsedConfig: HackathonConfig;
    try {
      parsedConfig = JSON.parse(config) as HackathonConfig;
    } catch {
      throw new Error('Invalid config JSON in lifecycle_state');
    }

    return {
      hackathonId: hackathon_id,
      status,
      config: parsedConfig,
      version,
      transitionedAt: transitioned_at,
    };
  }

  private performTransition(currentState: HackathonState, targetStatus: HackathonStatus): boolean {
    const allowed = HACKATHON_STATUS_TRANSITIONS[currentState.status];
    if (!allowed.includes(targetStatus)) return false;

    const now = new Date().toISOString();
    this.ctx.storage.sql.exec(
      `UPDATE lifecycle_state SET status = ?, version = version + 1, transitioned_at = ? WHERE hackathon_id = ? AND version = ?`,
      targetStatus,
      now,
      currentState.hackathonId,
      currentState.version,
    );

    return true;
  }

  private async scheduleNextAlarm(state: HackathonState): Promise<void> {
    const now = Date.now();
    const deadlines: number[] = [];

    if (state.status === 'registration_open') {
      const t = Date.parse(state.config.registrationCloses);
      if (Number.isFinite(t) && t > now) deadlines.push(t);
    }
    if (state.status === 'registration_closed' || state.status === 'active') {
      const t = Date.parse(state.config.submissionDeadline);
      if (Number.isFinite(t) && t > now) deadlines.push(t);
    }
    if ((state.status === 'active' || state.status === 'judging') && state.config.judgingEnds) {
      const t = Date.parse(state.config.judgingEnds);
      if (Number.isFinite(t) && t > now) deadlines.push(t);
    }

    if (deadlines.length > 0) {
      deadlines.sort((a, b) => a - b);
      await this.ctx.storage.setAlarm(deadlines[0]);
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }

  // ─── Private: HTTP Handlers ────────────────────────────────

  private async handleInitialize(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
    }

    const payload = parseInitializeRequest(body);
    if (!payload) {
      return Response.json(
        { error: 'Expected { hackathonId, config: { registrationOpens, registrationCloses, submissionDeadline, ... } }', code: 'INVALID_BODY' },
        { status: 400 },
      );
    }

    const existing = this.getState();
    if (existing) {
      if (existing.hackathonId !== payload.hackathonId) {
        return Response.json(
          { error: 'State machine already initialized for a different hackathon', code: 'ALREADY_INITIALIZED', currentState: existing },
          { status: 409 },
        );
      }
      // Idempotent: return existing state
      return Response.json({
        hackathonId: existing.hackathonId,
        status: existing.status,
        config: existing.config,
        version: existing.version,
        transitionedAt: existing.transitionedAt,
      });
    }

    const now = new Date().toISOString();
    const configJson = JSON.stringify(payload.config);

    this.ctx.storage.sql.exec(
      `INSERT INTO lifecycle_state (hackathon_id, status, config, version, transitioned_at) VALUES (?, ?, ?, 1, ?)`,
      payload.hackathonId,
      'draft',
      configJson,
      now,
    );

    await this.scheduleNextAlarm({
      hackathonId: payload.hackathonId,
      status: 'draft',
      config: payload.config,
      version: 1,
      transitionedAt: now,
    });

    const created = this.getState();
    if (!created) {
      return Response.json({ error: 'Failed to initialize state', code: 'INITIALIZATION_FAILED' }, { status: 500 });
    }

    return Response.json({
      hackathonId: created.hackathonId,
      status: created.status,
      config: created.config,
      version: created.version,
      transitionedAt: created.transitionedAt,
    }, { status: 201 });
  }

  private async handleTransition(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
    }

    const payload = parseTransitionRequest(body);
    if (!payload) {
      return Response.json(
        { error: 'Expected { targetStatus, expectedVersion? }', code: 'INVALID_BODY' },
        { status: 400 },
      );
    }

    const state = this.getState();
    if (!state) {
      return Response.json({ error: 'State machine not initialized', code: 'NOT_INITIALIZED' }, { status: 404 });
    }

    // Check optimistic concurrency
    if (payload.expectedVersion !== undefined && state.version !== payload.expectedVersion) {
      return Response.json(
        {
          error: 'Version mismatch',
          code: 'VERSION_MISMATCH',
          currentVersion: state.version,
          expectedVersion: payload.expectedVersion,
        },
        { status: 409 },
      );
    }

    // Check transition is allowed
    const allowed = HACKATHON_STATUS_TRANSITIONS[state.status];
    if (!allowed.includes(payload.targetStatus)) {
      return Response.json(
        {
          error: `Cannot transition from '${state.status}' to '${payload.targetStatus}'`,
          code: 'INVALID_TRANSITION',
          currentStatus: state.status,
          allowedTransitions: allowed,
        },
        { status: 400 },
      );
    }

    const success = this.performTransition(state, payload.targetStatus);
    if (!success) {
      return Response.json(
        { error: 'Transition failed', code: 'TRANSITION_FAILED' },
        { status: 500 },
      );
    }

    const updated = this.getState();
    if (!updated) {
      return Response.json({ error: 'State missing after transition', code: 'STATE_MISSING' }, { status: 500 });
    }

    await this.scheduleNextAlarm(updated);

    return Response.json({
      hackathonId: updated.hackathonId,
      status: updated.status,
      config: updated.config,
      version: updated.version,
      transitionedAt: updated.transitionedAt,
    });
  }

  private async handleAcceptSubmission(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
    }

    const payload = parseAcceptSubmissionRequest(body);
    if (!payload) {
      return Response.json(
        { error: 'Expected { teamId, submissionId, tagName, commitSha, timestamp, webhookDeliveryId }', code: 'INVALID_BODY' },
        { status: 400 },
      );
    }

    const state = this.getState();
    if (!state) {
      return Response.json({ error: 'State machine not initialized', code: 'NOT_INITIALIZED' }, { status: 404 });
    }

    // Check idempotency first: duplicate webhook_delivery_id
    const existingDelivery = this.ctx.storage.sql
      .exec(
        `SELECT webhook_delivery_id FROM submission_locks WHERE webhook_delivery_id = ? LIMIT 1`,
        payload.webhookDeliveryId,
      )
      .toArray()[0];

    if (isRecord(existingDelivery)) {
      // Idempotent no-op
      const result: SubmissionResult = { accepted: true, reason: 'Already processed (idempotent)', submissionId: payload.submissionId };
      return Response.json(result);
    }

    // Check if hackathon is in a state that accepts submissions
    if (state.status !== 'active') {
      const result: SubmissionResult = { accepted: false, reason: `Hackathon is in '${state.status}' status, not accepting submissions` };
      return Response.json(result, { status: 400 });
    }

    // Check deadline
    const deadline = Date.parse(state.config.submissionDeadline);
    const submissionTime = Date.parse(payload.timestamp);
    if (Number.isFinite(deadline) && Number.isFinite(submissionTime) && submissionTime > deadline) {
      if (!state.config.allowLateSubmissions) {
        const result: SubmissionResult = { accepted: false, reason: 'Submission deadline has passed' };
        return Response.json(result, { status: 400 });
      }
      // Late submission allowed — continue
    }

    // Check max submissions per team
    if (state.config.maxSubmissionsPerTeam !== null) {
      const teamCount = this.ctx.storage.sql
        .exec(`SELECT submission_count FROM team_submissions WHERE team_id = ? LIMIT 1`, payload.teamId)
        .toArray()[0];

      const currentCount = isRecord(teamCount) && typeof teamCount.submission_count === 'number'
        ? teamCount.submission_count
        : 0;

      if (currentCount >= state.config.maxSubmissionsPerTeam) {
        const result: SubmissionResult = {
          accepted: false,
          reason: `Team has reached maximum submissions (${state.config.maxSubmissionsPerTeam})`,
        };
        return Response.json(result, { status: 400 });
      }
    }

    // Lock the submission
    const now = new Date().toISOString();
    this.ctx.storage.sql.exec(
      `INSERT INTO submission_locks (team_id, tag_name, submission_id, commit_sha, webhook_delivery_id, locked_at) VALUES (?, ?, ?, ?, ?, ?)`,
      payload.teamId,
      payload.tagName,
      payload.submissionId,
      payload.commitSha,
      payload.webhookDeliveryId,
      now,
    );

    const existingTeam = this.ctx.storage.sql
      .exec(`SELECT team_id FROM team_submissions WHERE team_id = ? LIMIT 1`, payload.teamId)
      .toArray()[0];

    if (isRecord(existingTeam)) {
      this.ctx.storage.sql.exec(
        `UPDATE team_submissions SET submission_count = submission_count + 1 WHERE team_id = ?`,
        payload.teamId,
      );
    } else {
      this.ctx.storage.sql.exec(
        `INSERT INTO team_submissions (team_id, submission_count) VALUES (?, 1)`,
        payload.teamId,
      );
    }

    const result: SubmissionResult = { accepted: true, submissionId: payload.submissionId };
    return Response.json(result, { status: 201 });
  }

  private handleCanAcceptSubmissions(): Response {
    const state = this.getState();
    if (!state) {
      return Response.json({ allowed: false, reason: 'State machine not initialized' });
    }

    if (state.status !== 'active') {
      return Response.json({ allowed: false, reason: `Hackathon is in '${state.status}' status` });
    }

    const now = Date.now();
    const deadline = Date.parse(state.config.submissionDeadline);

    if (Number.isFinite(deadline) && now > deadline) {
      if (state.config.allowLateSubmissions) {
        return Response.json({ allowed: true, reason: 'Past deadline but late submissions allowed', deadlineRemaining: 0 });
      }
      return Response.json({ allowed: false, reason: 'Submission deadline has passed' });
    }

    const remaining = Number.isFinite(deadline) ? deadline - now : null;
    return Response.json({ allowed: true, deadlineRemaining: remaining });
  }
}
