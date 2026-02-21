import {
  createHackathonSchema,
  hackathonStatusSchema,
  submissionResponseSchema,
  userResponseSchema,
} from '../index.js';
import { describe, expect, it } from 'vitest';

describe('shared schemas', () => {
  it('createHackathonSchema accepts valid data', () => {
    const result = createHackathonSchema.safeParse({
      name: 'Global Hackathon 2026',
      slug: 'global-hackathon-2026',
      description: 'Build practical AI tools for engineering teams worldwide.',
      start_date: '2026-01-01T00:00:00Z',
      max_team_size: 4,
    });

    expect(result.success).toBe(true);
  });

  it('createHackathonSchema rejects invalid data', () => {
    const emptyName = createHackathonSchema.safeParse({
      name: '',
      slug: 'global-hackathon-2026',
    });

    const badSlug = createHackathonSchema.safeParse({
      name: 'Global Hackathon 2026',
      slug: 'INVALID SLUG!',
    });

    expect(emptyName.success).toBe(false);
    expect(badSlug.success).toBe(false);
  });

  it('userResponseSchema validates correctly', () => {
    const result = userResponseSchema.safeParse({
      id: '523e4567-e89b-12d3-a456-426614174000',
      email: 'alex@example.com',
      name: 'Alex',
      github_username: 'alexdev',
      avatar_url: null,
      auth_provider: 'github',
      created_at: '2026-01-01T00:00:00Z',
    });

    expect(result.success).toBe(true);
  });

  it('submissionResponseSchema validates required fields and status enum', () => {
    const valid = submissionResponseSchema.safeParse({
      id: '223e4567-e89b-12d3-a456-426614174000',
      hackathon_id: '323e4567-e89b-12d3-a456-426614174000',
      team_id: '423e4567-e89b-12d3-a456-426614174000',
      round_id: null,
      tag_name: 'submission_v1',
      commit_sha: 'a'.repeat(40),
      submitted_at: '2026-01-02T00:00:00Z',
      status: 'validated',
      validated_at: null,
      is_current: true,
      created_at: '2026-01-02T00:00:00Z',
    });

    const invalid = submissionResponseSchema.safeParse({
      id: '223e4567-e89b-12d3-a456-426614174000',
      hackathon_id: '323e4567-e89b-12d3-a456-426614174000',
      team_id: '423e4567-e89b-12d3-a456-426614174000',
      round_id: null,
      tag_name: 'submission_v1',
      commit_sha: 'a'.repeat(40),
      submitted_at: '2026-01-02T00:00:00Z',
      status: 'nonexistent_status',
      validated_at: null,
      is_current: true,
      created_at: '2026-01-02T00:00:00Z',
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it('hackathonStatusSchema has correct 5-state enum', () => {
    const values = hackathonStatusSchema.options;
    expect(values).toEqual(['draft', 'active', 'judging', 'completed', 'archived']);
  });
});
