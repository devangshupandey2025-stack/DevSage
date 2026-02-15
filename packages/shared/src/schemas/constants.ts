import { HackathonStatus } from './hackathon.js';

export const HACKATHON_STATUSES = [
  'draft',
  'active',
  'judging',
  'completed',
  'archived',
] as const;

export const HACKATHON_STATUS_TRANSITIONS: Record<HackathonStatus, HackathonStatus[]> = {
  draft: ['active'],
  active: ['judging'],
  judging: ['completed'],
  completed: ['archived'],
  archived: [],
};

export const ORGANIZER_ROLES = ['organizer', 'co_organizer'] as const;
export const TEAM_MEMBER_ROLES = ['leader', 'member'] as const;
export const SUBMISSION_STATUSES = [
  'received',
  'validated',
  'validation_failed',
  'locked',
  'under_review',
  'scored',
  'invalid',
  'superseded',
] as const;
export const ACTOR_TYPES = ['user', 'system', 'bot', 'cron'] as const;
export const ROLES = ['anonymous', 'team_member', 'team_lead', 'judge', 'co_organizer', 'organizer'] as const;

export const JUDGE_INVITE_STATUSES = ['pending', 'accepted', 'declined', 'removed'] as const;
export const REGISTRATION_MODES = ['open', 'domain_restricted', 'approval_based'] as const;
export const ROUND_STATUSES = ['pending', 'active', 'judging', 'completed'] as const;
export const ROUND_RESULT_STATUSES = ['advanced', 'eliminated'] as const;
export const WORKSPACE_ROLES = ['workspace_owner', 'workspace_admin', 'workspace_member'] as const;
export const PLATFORM_ADMIN_ROLES = ['super_admin', 'platform_admin'] as const;
export const FORCE_PUSH_SEVERITIES = ['info', 'warning', 'critical'] as const;

export const MAX_TEAM_NAME_LENGTH = 50;
export const JOIN_CODE_LENGTH = 8;
