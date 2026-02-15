import {
  CreateHackathonRequestSchema,
  HACKATHON_STATUS_TRANSITIONS,
  SubmissionSchema,
  UserSchema,
} from '../index.js';
import { describe, expect, it } from 'vitest';

describe('shared schemas', () => {
  it('CreateHackathonRequestSchema accepts valid data', () => {
    const result = CreateHackathonRequestSchema.safeParse({
      slug: 'global-hackathon-2026',
      title: 'Global Hackathon 2026',
      description: 'Build practical AI tools for engineering teams worldwide.',
      startsAt: '2026-01-01T00:00:00.000Z',
      judgingStarts: '2026-01-15T00:00:00.000Z',
      judgingEnds: '2026-01-20T00:00:00.000Z',
      maxTeamSize: 4,
    });

    expect(result.success).toBe(true);
  });

  it('CreateHackathonRequestSchema rejects invalid data', () => {
    const shortTitle = CreateHackathonRequestSchema.safeParse({
      slug: 'global-hackathon-2026',
      title: 'Hi',
      description: 'Build practical AI tools for engineering teams worldwide.',
      startsAt: '2026-01-01T00:00:00.000Z',
      maxTeamSize: 4,
    });

    const shortSlug = CreateHackathonRequestSchema.safeParse({
      slug: 'ab',
      title: 'Global Hackathon 2026',
      description: 'Build practical AI tools for engineering teams worldwide.',
      maxTeamSize: 4,
    });

    expect(shortTitle.success).toBe(false);
    expect(shortSlug.success).toBe(false);
  });

  it('UserSchema validates correctly', () => {
    const result = UserSchema.safeParse({
      id: '523e4567-e89b-12d3-a456-426614174000',
      githubId: 12345,
      githubUsername: 'alexdev',
      displayName: 'Alex',
      email: 'alex@example.com',
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  it('SubmissionSchema validates required fields and status enum', () => {
    const valid = SubmissionSchema.safeParse({
      id: '223e4567-e89b-12d3-a456-426614174000',
      hackathonId: '323e4567-e89b-12d3-a456-426614174000',
      teamId: '423e4567-e89b-12d3-a456-426614174000',
      tagName: 'submission_v1',
      commitSha: 'a'.repeat(40),
      commitMessage: 'Initial submission',
      commitAuthor: 'alex',
      branch: 'main',
      submittedAt: '2026-01-02T00:00:00.000Z',
      receivedAt: '2026-01-02T00:00:00.000Z',
      isLate: 0,
      isFinal: 0,
      version: 1,
      status: 'received',
    });

    const invalid = SubmissionSchema.safeParse({
      id: '223e4567-e89b-12d3-a456-426614174000',
      hackathonId: '323e4567-e89b-12d3-a456-426614174000',
      teamId: '423e4567-e89b-12d3-a456-426614174000',
      tagName: 'submission_v1',
      commitSha: 'a'.repeat(40),
      submittedAt: '2026-01-02T00:00:00.000Z',
      receivedAt: '2026-01-02T00:00:00.000Z',
      isLate: 0,
      isFinal: 0,
      version: 1,
      status: 'pending',
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it('HACKATHON_STATUS_TRANSITIONS has correct transitions (v3 5-state)', () => {
    expect(HACKATHON_STATUS_TRANSITIONS.draft).toEqual(['active']);
    expect(HACKATHON_STATUS_TRANSITIONS.active).toEqual(['judging']);
    expect(HACKATHON_STATUS_TRANSITIONS.judging).toEqual(['completed']);
    expect(HACKATHON_STATUS_TRANSITIONS.completed).toEqual(['archived']);
    expect(HACKATHON_STATUS_TRANSITIONS.archived).toEqual([]);
  });
});
