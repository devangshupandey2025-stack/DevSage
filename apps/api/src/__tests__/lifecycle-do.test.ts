import { describe, it, expect } from 'vitest';
import { VALID_TRANSITIONS } from '../lib/constants.js';

describe('Lifecycle Durable Object', () => {
  it('exports valid state transitions', () => {
    expect(VALID_TRANSITIONS.draft).toContain('active');
    expect(VALID_TRANSITIONS.active).toContain('judging');
  });

  it('supports the full forward chain', () => {
    let current = 'draft';
    const chain: string[] = [current];

    while (VALID_TRANSITIONS[current]?.length === 1 && !chain.includes(VALID_TRANSITIONS[current][0]) || false) {
      current = VALID_TRANSITIONS[current][0];
      chain.push(current);
    }

    // The forward chain should reach archived
    expect(chain).toContain('draft');
    expect(chain).toContain('active');
    expect(chain).toContain('judging');
    expect(chain).toContain('completed');
    expect(chain).toContain('archived');
  });

  it('archived can un-archive back to completed only', () => {
    expect(VALID_TRANSITIONS.archived).toEqual(['completed']);
  });
});
