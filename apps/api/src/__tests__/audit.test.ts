import { describe, it, expect } from 'vitest';
import type { AuditEventInput } from '../lib/audit.js';

describe('audit event helper', () => {
  it('accepts all actor types in AuditEventInput', () => {
    const actorTypes = ['user', 'system', 'bot', 'cron'] as const;

    for (const actorType of actorTypes) {
      const input: AuditEventInput = {
        actorType,
        action: `test.${actorType}`,
        entityType: 'test',
        entityId: 'test-1',
      };
      expect(input.actorType).toBe(actorType);
    }
  });

  it('allows optional fields in AuditEventInput', () => {
    const input: AuditEventInput = {
      actorType: 'system',
      action: 'cron.deadline_check',
      entityType: 'hackathon',
      entityId: 'hack-1',
    };

    expect(input.hackathonId).toBeUndefined();
    expect(input.actorId).toBeUndefined();
    expect(input.details).toBeUndefined();
    expect(input.ipAddress).toBeUndefined();
  });

  it('allows all fields in AuditEventInput', () => {
    const input: AuditEventInput = {
      hackathonId: 'hack-1',
      actorId: 'user-1',
      actorType: 'user',
      action: 'hackathon.created',
      entityType: 'hackathon',
      entityId: 'hack-1',
      details: { title: 'Test Hackathon' },
      ipAddress: '127.0.0.1',
    };

    expect(input.hackathonId).toBe('hack-1');
    expect(input.actorId).toBe('user-1');
    expect(input.actorType).toBe('user');
    expect(input.action).toBe('hackathon.created');
    expect(input.entityType).toBe('hackathon');
    expect(input.entityId).toBe('hack-1');
    expect(input.details).toEqual({ title: 'Test Hackathon' });
    expect(input.ipAddress).toBe('127.0.0.1');
  });
});
