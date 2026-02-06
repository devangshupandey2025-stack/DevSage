import { DurableObject } from 'cloudflare:workers';
import { HACKATHON_STATUS_TRANSITIONS, type HackathonStatus } from '@devsage/shared';
import type { Env } from '../types/env.js';

interface LifecycleState {
  hackathonId: string;
  status: HackathonStatus;
  registrationStart: string;
  hackingStart: string;
  submissionDeadline: string;
  transitionedAt: string;
  version: number;
}

interface InitializeLifecycleRequest {
  hackathonId: string;
  registrationStart: string;
  hackingStart: string;
  submissionDeadline: string;
}

const ACTION_MAP = {
  openRegistration: { from: 'DRAFT', to: 'REGISTRATION_OPEN' },
  startHacking: { from: 'REGISTRATION_OPEN', to: 'HACKING' },
  closeSubmissions: { from: 'HACKING', to: 'SUBMISSION_CLOSED' },
  complete: { from: 'SUBMISSION_CLOSED', to: 'COMPLETED' },
} as const;

type LifecycleAction = keyof typeof ACTION_MAP;

interface TransitionError {
  status: number;
  body: {
    error: string;
    code: string;
    currentState?: LifecycleState;
    allowedTransitions?: HackathonStatus[];
    allowedActions?: LifecycleAction[];
  };
}

type TransitionResult =
  | {
      ok: true;
      state: LifecycleState;
    }
  | {
      ok: false;
      error: TransitionError;
    };

const ACTION_ENTRIES = Object.entries(ACTION_MAP) as Array<
  [LifecycleAction, (typeof ACTION_MAP)[LifecycleAction]]
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLifecycleAction(value: unknown): value is LifecycleAction {
  return typeof value === 'string' && value in ACTION_MAP;
}

function isHackathonStatus(value: string): value is HackathonStatus {
  return Object.prototype.hasOwnProperty.call(HACKATHON_STATUS_TRANSITIONS, value);
}

function isValidDateString(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function toAlarmTimestamp(date: string): number {
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid lifecycle date: ${date}`);
  }

  return Math.max(timestamp, Date.now());
}

export class HackathonLifecycleDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS lifecycle_state (
          hackathon_id TEXT PRIMARY KEY,
          current_status TEXT NOT NULL,
          registration_start TEXT NOT NULL,
          hacking_start TEXT NOT NULL,
          submission_deadline TEXT NOT NULL,
          transitioned_at TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1
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
        return Response.json({ error: 'Lifecycle not initialized', code: 'NOT_INITIALIZED' }, { status: 404 });
      }

      return Response.json(state);
    }

    return Response.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  async alarm(): Promise<void> {
    const state = this.getState();
    if (!state) {
      return;
    }

    if (state.status === 'REGISTRATION_OPEN') {
      const hackingStartTimestamp = Date.parse(state.hackingStart);
      if (!Number.isFinite(hackingStartTimestamp)) {
        return;
      }

      if (Date.now() < hackingStartTimestamp) {
        await this.ctx.storage.setAlarm(hackingStartTimestamp);
        return;
      }

      const result = await this.transitionState({
        action: 'startHacking',
        expectedVersion: state.version,
      });

      if (!result.ok && result.error.status !== 409) {
        throw new Error(result.error.body.error);
      }

      return;
    }

    if (state.status === 'HACKING') {
      const submissionDeadlineTimestamp = Date.parse(state.submissionDeadline);
      if (!Number.isFinite(submissionDeadlineTimestamp)) {
        return;
      }

      if (Date.now() < submissionDeadlineTimestamp) {
        await this.ctx.storage.setAlarm(submissionDeadlineTimestamp);
        return;
      }

      const result = await this.transitionState({
        action: 'closeSubmissions',
        expectedVersion: state.version,
      });

      if (!result.ok && result.error.status !== 409) {
        throw new Error(result.error.body.error);
      }

      return;
    }

    await this.ctx.storage.deleteAlarm();
  }

  private getState(): LifecycleState | null {
    const rows = this.ctx.storage.sql
      .exec(`
        SELECT
          hackathon_id AS hackathonId,
          current_status AS status,
          registration_start AS registrationStart,
          hacking_start AS hackingStart,
          submission_deadline AS submissionDeadline,
          transitioned_at AS transitionedAt,
          version
        FROM lifecycle_state
        LIMIT 1
      `)
      .toArray();

    const row = rows[0];
    if (!isRecord(row)) {
      return null;
    }

    const {
      hackathonId,
      status,
      registrationStart,
      hackingStart,
      submissionDeadline,
      transitionedAt,
      version,
    } = row;

    if (
      typeof hackathonId !== 'string' ||
      typeof status !== 'string' ||
      typeof registrationStart !== 'string' ||
      typeof hackingStart !== 'string' ||
      typeof submissionDeadline !== 'string' ||
      typeof transitionedAt !== 'string' ||
      typeof version !== 'number'
    ) {
      throw new Error('Invalid lifecycle_state row shape');
    }

    if (!isHackathonStatus(status)) {
      throw new Error(`Invalid status stored in lifecycle_state: ${status}`);
    }

    return {
      hackathonId,
      status,
      registrationStart,
      hackingStart,
      submissionDeadline,
      transitionedAt,
      version,
    };
  }

  private allowedActionsForStatus(status: HackathonStatus): LifecycleAction[] {
    return ACTION_ENTRIES.filter(([, transition]) => transition.from === status).map(([action]) => action);
  }

  private conflict(
    currentState: LifecycleState,
    error: string,
    code: string,
    status = 409
  ): TransitionResult {
    return {
      ok: false,
      error: {
        status,
        body: {
          error,
          code,
          currentState,
          allowedTransitions: HACKATHON_STATUS_TRANSITIONS[currentState.status],
          allowedActions: this.allowedActionsForStatus(currentState.status),
        },
      },
    };
  }

  private async scheduleAlarmForState(state: LifecycleState): Promise<void> {
    if (state.status === 'REGISTRATION_OPEN') {
      await this.ctx.storage.setAlarm(toAlarmTimestamp(state.hackingStart));
      return;
    }

    if (state.status === 'HACKING') {
      await this.ctx.storage.setAlarm(toAlarmTimestamp(state.submissionDeadline));
      return;
    }

    await this.ctx.storage.deleteAlarm();
  }

  private async transitionState({
    action,
    expectedVersion,
  }: {
    action: LifecycleAction;
    expectedVersion: number;
  }): Promise<TransitionResult> {
    const currentState = this.getState();
    if (!currentState) {
      return {
        ok: false,
        error: {
          status: 404,
          body: {
            error: 'Lifecycle not initialized',
            code: 'NOT_INITIALIZED',
          },
        },
      };
    }

    if (currentState.version !== expectedVersion) {
      return this.conflict(currentState, 'Version mismatch', 'VERSION_MISMATCH');
    }

    const transition = ACTION_MAP[action];
    const allowedStatuses = HACKATHON_STATUS_TRANSITIONS[currentState.status];
    const isAllowed = transition.from === currentState.status && allowedStatuses.includes(transition.to);
    if (!isAllowed) {
      return this.conflict(currentState, 'Invalid transition', 'INVALID_TRANSITION');
    }

    const transitionedAt = new Date().toISOString();
    this.ctx.storage.sql.exec(
      `
        UPDATE lifecycle_state
        SET current_status = ?, transitioned_at = ?, version = version + 1
        WHERE hackathon_id = ? AND version = ?
      `,
      transition.to,
      transitionedAt,
      currentState.hackathonId,
      expectedVersion
    );

    const nextState = this.getState();
    if (!nextState) {
      return {
        ok: false,
        error: {
          status: 500,
          body: {
            error: 'Lifecycle state missing after transition',
            code: 'LIFECYCLE_STATE_MISSING',
          },
        },
      };
    }

    if (nextState.version !== expectedVersion + 1 || nextState.status !== transition.to) {
      return this.conflict(nextState, 'Concurrent modification detected', 'CONCURRENT_MODIFICATION');
    }

    await this.scheduleAlarmForState(nextState);

    return {
      ok: true,
      state: nextState,
    };
  }

  private parseInitializeRequest(body: unknown): InitializeLifecycleRequest | null {
    if (!isRecord(body)) {
      return null;
    }

    const { hackathonId, registrationStart, hackingStart, submissionDeadline } = body;
    if (
      typeof hackathonId !== 'string' ||
      typeof registrationStart !== 'string' ||
      typeof hackingStart !== 'string' ||
      typeof submissionDeadline !== 'string'
    ) {
      return null;
    }

    if (
      !isValidDateString(registrationStart) ||
      !isValidDateString(hackingStart) ||
      !isValidDateString(submissionDeadline)
    ) {
      return null;
    }

    return {
      hackathonId,
      registrationStart,
      hackingStart,
      submissionDeadline,
    };
  }

  private async handleInitialize(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
    }

    const payload = this.parseInitializeRequest(body);
    if (!payload) {
      return Response.json(
        {
          error: 'Expected { hackathonId, registrationStart, hackingStart, submissionDeadline }',
          code: 'INVALID_BODY',
        },
        { status: 400 }
      );
    }

    const existingState = this.getState();
    if (existingState) {
      if (existingState.hackathonId !== payload.hackathonId) {
        return Response.json(
          {
            error: 'Lifecycle already initialized for a different hackathon',
            code: 'LIFECYCLE_ALREADY_INITIALIZED',
            currentState: existingState,
          },
          { status: 409 }
        );
      }

      return Response.json(existingState);
    }

    const now = new Date().toISOString();
    this.ctx.storage.sql.exec(
      `
        INSERT INTO lifecycle_state (
          hackathon_id,
          current_status,
          registration_start,
          hacking_start,
          submission_deadline,
          transitioned_at,
          version
        ) VALUES (?, ?, ?, ?, ?, ?, 1)
      `,
      payload.hackathonId,
      'DRAFT',
      payload.registrationStart,
      payload.hackingStart,
      payload.submissionDeadline,
      now
    );

    await this.ctx.storage.deleteAlarm();

    const createdState = this.getState();
    if (!createdState) {
      return Response.json(
        { error: 'Failed to initialize lifecycle state', code: 'INITIALIZATION_FAILED' },
        { status: 500 }
      );
    }

    return Response.json(createdState, { status: 201 });
  }

  private async handleTransition(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
    }

    if (!isRecord(body) || !isLifecycleAction(body.action)) {
      return Response.json(
        {
          error: 'Unknown action. Expected one of: openRegistration, startHacking, closeSubmissions, complete',
          code: 'INVALID_ACTION',
        },
        { status: 400 }
      );
    }

    if (typeof body.expectedVersion !== 'number' || !Number.isInteger(body.expectedVersion) || body.expectedVersion <= 0) {
      return Response.json(
        {
          error: 'expectedVersion must be a positive integer',
          code: 'INVALID_EXPECTED_VERSION',
        },
        { status: 400 }
      );
    }

    const result = await this.transitionState({
      action: body.action,
      expectedVersion: body.expectedVersion,
    });

    if (!result.ok) {
      return Response.json(result.error.body, { status: result.error.status });
    }

    return Response.json(result.state);
  }
}
