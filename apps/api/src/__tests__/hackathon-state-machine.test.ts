import { HACKATHON_STATUS_TRANSITIONS, type HackathonStatus } from '@devsage/shared';
import { describe, expect, it } from 'vitest';

interface HackathonConfig {
  registrationOpens: string;
  registrationCloses: string;
  submissionDeadline: string;
  judgingStarts: string | null;
  judgingEnds: string | null;
  maxTeams: number | null;
  maxSubmissionsPerTeam: number | null;
  allowLateSubmissions: number;
  submissionTagPattern: string;
}

interface HackathonState {
  hackathonId: string;
  status: HackathonStatus;
  config: HackathonConfig;
  version: number;
  transitionedAt: string;
}

interface SubmissionLock {
  teamId: string;
  tagName: string;
  submissionId: string;
  commitSha: string;
  webhookDeliveryId: string;
}

interface TeamSubmissionCount {
  teamId: string;
  count: number;
}

function makeConfig(overrides: Partial<HackathonConfig> = {}): HackathonConfig {
  return {
    registrationOpens: '2026-03-01T00:00:00Z',
    registrationCloses: '2026-03-10T00:00:00Z',
    submissionDeadline: '2026-03-20T23:59:59Z',
    judgingStarts: '2026-03-21T00:00:00Z',
    judgingEnds: '2026-03-25T00:00:00Z',
    maxTeams: null,
    maxSubmissionsPerTeam: null,
    allowLateSubmissions: 0,
    submissionTagPattern: 'submission_v%',
    ...overrides,
  };
}

function makeState(overrides: Partial<HackathonState> = {}): HackathonState {
  return {
    hackathonId: 'hack-1',
    status: 'draft',
    config: makeConfig(),
    version: 1,
    transitionedAt: new Date().toISOString(),
    ...overrides,
  };
}

function transitionState(state: HackathonState, targetStatus: HackathonStatus, expectedVersion?: number): HackathonState {
  if (expectedVersion !== undefined && state.version !== expectedVersion) {
    throw new Error('VERSION_MISMATCH');
  }

  const allowed = HACKATHON_STATUS_TRANSITIONS[state.status];
  if (!allowed.includes(targetStatus)) {
    throw new Error(`INVALID_TRANSITION: ${state.status} → ${targetStatus}`);
  }

  return {
    ...state,
    status: targetStatus,
    version: state.version + 1,
    transitionedAt: new Date().toISOString(),
  };
}

function acceptSubmission(
  state: HackathonState,
  locks: SubmissionLock[],
  teamCounts: TeamSubmissionCount[],
  params: {
    teamId: string;
    submissionId: string;
    tagName: string;
    commitSha: string;
    timestamp: string;
    webhookDeliveryId: string;
  },
): { accepted: boolean; reason?: string } {
  const existingDelivery = locks.find((l) => l.webhookDeliveryId === params.webhookDeliveryId);
  if (existingDelivery) {
    return { accepted: true, reason: 'Already processed (idempotent)' };
  }

  if (state.status !== 'active') {
    return { accepted: false, reason: `Hackathon is in '${state.status}' status, not accepting submissions` };
  }

  const deadline = Date.parse(state.config.submissionDeadline);
  const submissionTime = Date.parse(params.timestamp);
  if (Number.isFinite(deadline) && Number.isFinite(submissionTime) && submissionTime > deadline) {
    if (!state.config.allowLateSubmissions) {
      return { accepted: false, reason: 'Submission deadline has passed' };
    }
  }

  if (state.config.maxSubmissionsPerTeam !== null) {
    const teamEntry = teamCounts.find((t) => t.teamId === params.teamId);
    const currentCount = teamEntry?.count ?? 0;
    if (currentCount >= state.config.maxSubmissionsPerTeam) {
      return { accepted: false, reason: `Team has reached maximum submissions (${state.config.maxSubmissionsPerTeam})` };
    }
  }

  locks.push({
    teamId: params.teamId,
    submissionId: params.submissionId,
    tagName: params.tagName,
    commitSha: params.commitSha,
    webhookDeliveryId: params.webhookDeliveryId,
  });

  const teamEntry = teamCounts.find((t) => t.teamId === params.teamId);
  if (teamEntry) {
    teamEntry.count++;
  } else {
    teamCounts.push({ teamId: params.teamId, count: 1 });
  }

  return { accepted: true };
}

describe('HackathonStateMachine lifecycle transitions', () => {
  it('supports full 7-state forward transition chain', () => {
    let state = makeState();
    expect(state.status).toBe('draft');

    state = transitionState(state, 'registration_open', 1);
    expect(state.status).toBe('registration_open');
    expect(state.version).toBe(2);

    state = transitionState(state, 'registration_closed', 2);
    expect(state.status).toBe('registration_closed');

    state = transitionState(state, 'active', 3);
    expect(state.status).toBe('active');

    state = transitionState(state, 'judging', 4);
    expect(state.status).toBe('judging');

    state = transitionState(state, 'completed', 5);
    expect(state.status).toBe('completed');

    state = transitionState(state, 'archived', 6);
    expect(state.status).toBe('archived');
    expect(state.version).toBe(7);
  });

  it('rejects backward transitions', () => {
    const state = makeState({ status: 'active', version: 4 });

    expect(() => transitionState(state, 'draft', 4)).toThrowError('INVALID_TRANSITION');
    expect(() => transitionState(state, 'registration_open', 4)).toThrowError('INVALID_TRANSITION');
    expect(() => transitionState(state, 'registration_closed', 4)).toThrowError('INVALID_TRANSITION');
  });

  it('rejects skipping states', () => {
    const state = makeState({ status: 'draft', version: 1 });

    expect(() => transitionState(state, 'active', 1)).toThrowError('INVALID_TRANSITION');
    expect(() => transitionState(state, 'judging', 1)).toThrowError('INVALID_TRANSITION');
    expect(() => transitionState(state, 'completed', 1)).toThrowError('INVALID_TRANSITION');
    expect(() => transitionState(state, 'archived', 1)).toThrowError('INVALID_TRANSITION');
  });

  it('rejects transition from archived (terminal state)', () => {
    const state = makeState({ status: 'archived', version: 7 });
    const allStatuses: HackathonStatus[] = [
      'draft', 'registration_open', 'registration_closed', 'active', 'judging', 'completed', 'archived',
    ];

    for (const target of allStatuses) {
      expect(() => transitionState(state, target, 7)).toThrowError('INVALID_TRANSITION');
    }
  });

  it('rejects version mismatch', () => {
    const state = makeState({ status: 'registration_open', version: 2 });

    expect(() => transitionState(state, 'registration_closed', 1)).toThrowError('VERSION_MISMATCH');
    expect(() => transitionState(state, 'registration_closed', 3)).toThrowError('VERSION_MISMATCH');
  });

  it('allows transition without expectedVersion', () => {
    const state = makeState({ status: 'draft', version: 1 });
    const next = transitionState(state, 'registration_open');
    expect(next.status).toBe('registration_open');
    expect(next.version).toBe(2);
  });
});

describe('HackathonStateMachine submission locking', () => {
  it('accepts submission in active state', () => {
    const state = makeState({ status: 'active', version: 4 });
    const locks: SubmissionLock[] = [];
    const teamCounts: TeamSubmissionCount[] = [];

    const result = acceptSubmission(state, locks, teamCounts, {
      teamId: 'team-1',
      submissionId: 'sub-1',
      tagName: 'submission_v1',
      commitSha: 'abc123',
      timestamp: '2026-03-15T12:00:00Z',
      webhookDeliveryId: 'delivery-1',
    });

    expect(result.accepted).toBe(true);
    expect(locks).toHaveLength(1);
    expect(teamCounts[0]?.count).toBe(1);
  });

  it('returns idempotent no-op for duplicate webhook_delivery_id', () => {
    const state = makeState({ status: 'active', version: 4 });
    const locks: SubmissionLock[] = [{
      teamId: 'team-1',
      submissionId: 'sub-1',
      tagName: 'submission_v1',
      commitSha: 'abc123',
      webhookDeliveryId: 'delivery-1',
    }];
    const teamCounts: TeamSubmissionCount[] = [{ teamId: 'team-1', count: 1 }];

    const result = acceptSubmission(state, locks, teamCounts, {
      teamId: 'team-1',
      submissionId: 'sub-1-dup',
      tagName: 'submission_v1',
      commitSha: 'abc123',
      timestamp: '2026-03-15T12:00:00Z',
      webhookDeliveryId: 'delivery-1',
    });

    expect(result.accepted).toBe(true);
    expect(result.reason).toContain('idempotent');
    expect(locks).toHaveLength(1);
    expect(teamCounts[0]?.count).toBe(1);
  });

  it('rejects submission when not in active state', () => {
    const state = makeState({ status: 'draft', version: 1 });
    const locks: SubmissionLock[] = [];
    const teamCounts: TeamSubmissionCount[] = [];

    const result = acceptSubmission(state, locks, teamCounts, {
      teamId: 'team-1',
      submissionId: 'sub-1',
      tagName: 'submission_v1',
      commitSha: 'abc123',
      timestamp: '2026-03-15T12:00:00Z',
      webhookDeliveryId: 'delivery-1',
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('draft');
  });

  it('rejects submission after deadline', () => {
    const state = makeState({
      status: 'active',
      version: 4,
      config: makeConfig({ submissionDeadline: '2026-03-20T23:59:59Z', allowLateSubmissions: 0 }),
    });
    const locks: SubmissionLock[] = [];
    const teamCounts: TeamSubmissionCount[] = [];

    const result = acceptSubmission(state, locks, teamCounts, {
      teamId: 'team-1',
      submissionId: 'sub-1',
      tagName: 'submission_v1',
      commitSha: 'abc123',
      timestamp: '2026-03-21T01:00:00Z',
      webhookDeliveryId: 'delivery-1',
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('deadline');
  });

  it('accepts late submission when allowLateSubmissions is enabled', () => {
    const state = makeState({
      status: 'active',
      version: 4,
      config: makeConfig({ submissionDeadline: '2026-03-20T23:59:59Z', allowLateSubmissions: 1 }),
    });
    const locks: SubmissionLock[] = [];
    const teamCounts: TeamSubmissionCount[] = [];

    const result = acceptSubmission(state, locks, teamCounts, {
      teamId: 'team-1',
      submissionId: 'sub-1',
      tagName: 'submission_v1',
      commitSha: 'abc123',
      timestamp: '2026-03-21T01:00:00Z',
      webhookDeliveryId: 'delivery-1',
    });

    expect(result.accepted).toBe(true);
    expect(locks).toHaveLength(1);
  });

  it('enforces max submissions per team', () => {
    const state = makeState({
      status: 'active',
      version: 4,
      config: makeConfig({ maxSubmissionsPerTeam: 2 }),
    });
    const locks: SubmissionLock[] = [];
    const teamCounts: TeamSubmissionCount[] = [{ teamId: 'team-1', count: 2 }];

    const result = acceptSubmission(state, locks, teamCounts, {
      teamId: 'team-1',
      submissionId: 'sub-3',
      tagName: 'submission_v3',
      commitSha: 'def456',
      timestamp: '2026-03-15T12:00:00Z',
      webhookDeliveryId: 'delivery-3',
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('maximum submissions');
  });

  it('allows submissions up to the max limit', () => {
    const state = makeState({
      status: 'active',
      version: 4,
      config: makeConfig({ maxSubmissionsPerTeam: 3 }),
    });
    const locks: SubmissionLock[] = [];
    const teamCounts: TeamSubmissionCount[] = [{ teamId: 'team-1', count: 2 }];

    const result = acceptSubmission(state, locks, teamCounts, {
      teamId: 'team-1',
      submissionId: 'sub-3',
      tagName: 'submission_v3',
      commitSha: 'def456',
      timestamp: '2026-03-15T12:00:00Z',
      webhookDeliveryId: 'delivery-3',
    });

    expect(result.accepted).toBe(true);
    expect(teamCounts[0]?.count).toBe(3);
  });

  it('allows unlimited submissions when maxSubmissionsPerTeam is null', () => {
    const state = makeState({
      status: 'active',
      version: 4,
      config: makeConfig({ maxSubmissionsPerTeam: null }),
    });
    const locks: SubmissionLock[] = [];
    const teamCounts: TeamSubmissionCount[] = [{ teamId: 'team-1', count: 100 }];

    const result = acceptSubmission(state, locks, teamCounts, {
      teamId: 'team-1',
      submissionId: 'sub-101',
      tagName: 'submission_v101',
      commitSha: 'ghi789',
      timestamp: '2026-03-15T12:00:00Z',
      webhookDeliveryId: 'delivery-101',
    });

    expect(result.accepted).toBe(true);
  });

  it('tracks submissions per team independently', () => {
    const state = makeState({
      status: 'active',
      version: 4,
      config: makeConfig({ maxSubmissionsPerTeam: 1 }),
    });
    const locks: SubmissionLock[] = [];
    const teamCounts: TeamSubmissionCount[] = [];

    const result1 = acceptSubmission(state, locks, teamCounts, {
      teamId: 'team-1',
      submissionId: 'sub-1',
      tagName: 'submission_v1',
      commitSha: 'abc',
      timestamp: '2026-03-15T12:00:00Z',
      webhookDeliveryId: 'del-1',
    });
    expect(result1.accepted).toBe(true);

    const result2 = acceptSubmission(state, locks, teamCounts, {
      teamId: 'team-2',
      submissionId: 'sub-2',
      tagName: 'submission_v1',
      commitSha: 'def',
      timestamp: '2026-03-15T12:00:00Z',
      webhookDeliveryId: 'del-2',
    });
    expect(result2.accepted).toBe(true);

    const result3 = acceptSubmission(state, locks, teamCounts, {
      teamId: 'team-1',
      submissionId: 'sub-3',
      tagName: 'submission_v2',
      commitSha: 'ghi',
      timestamp: '2026-03-15T12:00:00Z',
      webhookDeliveryId: 'del-3',
    });
    expect(result3.accepted).toBe(false);
    expect(result3.reason).toContain('maximum submissions');
  });
});

describe('HackathonStateMachine status transition map', () => {
  it('HACKATHON_STATUS_TRANSITIONS has all 7 states', () => {
    const states = Object.keys(HACKATHON_STATUS_TRANSITIONS);
    expect(states).toHaveLength(7);
    expect(states).toContain('draft');
    expect(states).toContain('registration_open');
    expect(states).toContain('registration_closed');
    expect(states).toContain('active');
    expect(states).toContain('judging');
    expect(states).toContain('completed');
    expect(states).toContain('archived');
  });

  it('each state has exactly one forward transition (except archived)', () => {
    expect(HACKATHON_STATUS_TRANSITIONS.draft).toEqual(['registration_open']);
    expect(HACKATHON_STATUS_TRANSITIONS.registration_open).toEqual(['registration_closed']);
    expect(HACKATHON_STATUS_TRANSITIONS.registration_closed).toEqual(['active']);
    expect(HACKATHON_STATUS_TRANSITIONS.active).toEqual(['judging']);
    expect(HACKATHON_STATUS_TRANSITIONS.judging).toEqual(['completed']);
    expect(HACKATHON_STATUS_TRANSITIONS.completed).toEqual(['archived']);
    expect(HACKATHON_STATUS_TRANSITIONS.archived).toEqual([]);
  });
});
