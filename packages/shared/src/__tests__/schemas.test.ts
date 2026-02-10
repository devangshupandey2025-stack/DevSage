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
      title: 'Global Hackathon 2026',
      description: 'Build practical AI tools for engineering teams worldwide.',
      registrationStartDate: '2026-01-01T00:00:00.000Z',
      hackingStartDate: '2026-01-10T00:00:00.000Z',
      submissionDeadline: '2026-01-20T00:00:00.000Z',
      maxTeamSize: 4,
    });

    expect(result.success).toBe(true);
  });

  it('CreateHackathonRequestSchema rejects invalid data', () => {
    const shortTitle = CreateHackathonRequestSchema.safeParse({
      title: 'Hi',
      description: 'Build practical AI tools for engineering teams worldwide.',
      registrationStartDate: '2026-01-01T00:00:00.000Z',
      hackingStartDate: '2026-01-10T00:00:00.000Z',
      submissionDeadline: '2026-01-20T00:00:00.000Z',
      maxTeamSize: 4,
    });

    const missingField = CreateHackathonRequestSchema.safeParse({
      title: 'Global Hackathon 2026',
      description: 'Build practical AI tools for engineering teams worldwide.',
      registrationStartDate: '2026-01-01T00:00:00.000Z',
      hackingStartDate: '2026-01-10T00:00:00.000Z',
      maxTeamSize: 4,
    });

    expect(shortTitle.success).toBe(false);
    expect(missingField.success).toBe(false);
  });

  it('UserSchema validates correctly', () => {
    const result = UserSchema.safeParse({
      id: '523e4567-e89b-12d3-a456-426614174000',
      email: 'alex@example.com',
      name: 'Alex',
      avatarUrl: null,
      provider: 'github',
      providerId: '12345',
      role: 'participant',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  it('SubmissionSchema validates commit SHA format', () => {
    const valid = SubmissionSchema.safeParse({
      id: '223e4567-e89b-12d3-a456-426614174000',
      hackathonId: '323e4567-e89b-12d3-a456-426614174000',
      teamId: '423e4567-e89b-12d3-a456-426614174000',
      repoFullName: 'devsage/platform',
      commitSha: 'a'.repeat(40),
      submittedAt: '2026-01-02T00:00:00.000Z',
      status: 'pending',
    });

    const invalid = SubmissionSchema.safeParse({
      id: '223e4567-e89b-12d3-a456-426614174000',
      hackathonId: '323e4567-e89b-12d3-a456-426614174000',
      teamId: '423e4567-e89b-12d3-a456-426614174000',
      repoFullName: 'devsage/platform',
      commitSha: 'not-a-sha',
      submittedAt: '2026-01-02T00:00:00.000Z',
      status: 'pending',
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it('HACKATHON_STATUS_TRANSITIONS has correct transitions', () => {
    expect(HACKATHON_STATUS_TRANSITIONS.draft).toEqual(['registration_open']);
    expect(HACKATHON_STATUS_TRANSITIONS.registration_open).toEqual(['registration_closed']);
    expect(HACKATHON_STATUS_TRANSITIONS.registration_closed).toEqual(['active']);
    expect(HACKATHON_STATUS_TRANSITIONS.active).toEqual(['judging']);
    expect(HACKATHON_STATUS_TRANSITIONS.judging).toEqual(['completed']);
    expect(HACKATHON_STATUS_TRANSITIONS.completed).toEqual(['archived']);
    expect(HACKATHON_STATUS_TRANSITIONS.archived).toEqual([]);
  });
});
