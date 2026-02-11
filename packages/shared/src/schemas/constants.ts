import { HackathonStatus } from './hackathon.js';

export const HACKATHON_STATUSES = [
  'draft',
  'registration_open',
  'registration_closed',
  'active',
  'judging',
  'completed',
  'archived',
] as const;

export const HACKATHON_STATUS_TRANSITIONS: Record<HackathonStatus, HackathonStatus[]> = {
  draft: ['registration_open'],
  registration_open: ['registration_closed'],
  registration_closed: ['active'],
  active: ['judging'],
  judging: ['completed'],
  completed: ['archived'],
  archived: [],
};

export const ORGANIZER_ROLES = ['owner', 'admin', 'moderator'] as const;
export const TEAM_MEMBER_ROLES = ['leader', 'member'] as const;
export const SUBMISSION_STATUSES = [
  'received',
  'validated',
  'invalid',
  'locked',
  'under_review',
  'scored',
  'invalidated',
] as const;
export const ACTOR_TYPES = ['user', 'system', 'bot', 'cron'] as const;
export const ROLES = ['anonymous', 'participant', 'team_leader', 'judge', 'moderator', 'admin', 'owner'] as const;

export const MAX_TEAM_NAME_LENGTH = 50;
export const JOIN_CODE_LENGTH = 8;
