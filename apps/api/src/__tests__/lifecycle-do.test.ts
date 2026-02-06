import { HACKATHON_STATUS_TRANSITIONS, type HackathonStatus } from '@devsage/shared';
import { describe, expect, it } from 'vitest';

type LifecycleAction = 'openRegistration' | 'startHacking' | 'closeSubmissions' | 'complete';

interface LifecycleState {
  status: HackathonStatus;
  version: number;
}

const ACTION_MAP: Record<LifecycleAction, { from: HackathonStatus; to: HackathonStatus }> = {
  openRegistration: { from: 'DRAFT', to: 'REGISTRATION_OPEN' },
  startHacking: { from: 'REGISTRATION_OPEN', to: 'HACKING' },
  closeSubmissions: { from: 'HACKING', to: 'SUBMISSION_CLOSED' },
  complete: { from: 'SUBMISSION_CLOSED', to: 'COMPLETED' },
};

function transitionLifecycle(state: LifecycleState, action: LifecycleAction, expectedVersion: number): LifecycleState {
  if (state.version !== expectedVersion) {
    throw new Error('VERSION_MISMATCH');
  }

  const transition = ACTION_MAP[action];
  const allowed = HACKATHON_STATUS_TRANSITIONS[state.status];
  if (transition.from !== state.status || !allowed.includes(transition.to)) {
    throw new Error('INVALID_TRANSITION');
  }

  return {
    status: transition.to,
    version: state.version + 1,
  };
}

describe('lifecycle state machine critical paths', () => {
  it('supports DRAFT to COMPLETED transition sequence', () => {
    let state: LifecycleState = { status: 'DRAFT', version: 1 };

    state = transitionLifecycle(state, 'openRegistration', 1);
    expect(state.status).toBe('REGISTRATION_OPEN');

    state = transitionLifecycle(state, 'startHacking', 2);
    expect(state.status).toBe('HACKING');

    state = transitionLifecycle(state, 'closeSubmissions', 3);
    expect(state.status).toBe('SUBMISSION_CLOSED');

    state = transitionLifecycle(state, 'complete', 4);
    expect(state.status).toBe('COMPLETED');
    expect(state.version).toBe(5);
  });

  it('rejects invalid transition', () => {
    const state: LifecycleState = { status: 'DRAFT', version: 1 };

    expect(() => transitionLifecycle(state, 'complete', 1)).toThrowError('INVALID_TRANSITION');
  });

  it('rejects version mismatch', () => {
    const state: LifecycleState = { status: 'REGISTRATION_OPEN', version: 2 };

    expect(() => transitionLifecycle(state, 'startHacking', 1)).toThrowError('VERSION_MISMATCH');
  });
});
