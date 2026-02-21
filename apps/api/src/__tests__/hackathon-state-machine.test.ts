import { SELF } from 'cloudflare:test';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import {
  ensureSchema,
  resetDb,
  env,
} from './helpers.js';
import { VALID_TRANSITIONS } from '../lib/constants.js';

describe('Hackathon State Machine – Transition Validation', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('draft → active is a valid transition', () => {
    expect(VALID_TRANSITIONS.draft).toContain('active');
  });

  it('active → judging is a valid transition', () => {
    expect(VALID_TRANSITIONS.active).toContain('judging');
  });

  it('judging → completed is a valid transition', () => {
    expect(VALID_TRANSITIONS.judging).toContain('completed');
  });

  it('completed → archived is a valid transition', () => {
    expect(VALID_TRANSITIONS.completed).toContain('archived');
  });

  it('archived → completed is valid (un-archive for score corrections)', () => {
    expect(VALID_TRANSITIONS.archived).toContain('completed');
  });

  it('draft → completed is NOT a valid transition', () => {
    expect(VALID_TRANSITIONS.draft).not.toContain('completed');
  });

  it('active → draft is NOT valid (no backward transitions except un-archive)', () => {
    expect(VALID_TRANSITIONS.active).not.toContain('draft');
  });

  it('transition map covers all 5 states', () => {
    const states = Object.keys(VALID_TRANSITIONS);
    expect(states).toContain('draft');
    expect(states).toContain('active');
    expect(states).toContain('judging');
    expect(states).toContain('completed');
    expect(states).toContain('archived');
    expect(states.length).toBe(5);
  });

  it('each state has exactly one forward transition', () => {
    expect(VALID_TRANSITIONS.draft).toEqual(['active']);
    expect(VALID_TRANSITIONS.active).toEqual(['judging']);
    expect(VALID_TRANSITIONS.judging).toEqual(['completed']);
    expect(VALID_TRANSITIONS.completed).toEqual(['archived']);
    expect(VALID_TRANSITIONS.archived).toEqual(['completed']);
  });

  it('judging → draft is invalid (multiple backward skips)', () => {
    expect(VALID_TRANSITIONS.judging).not.toContain('draft');
  });

  it('completed → active is invalid', () => {
    expect(VALID_TRANSITIONS.completed).not.toContain('active');
  });
});
