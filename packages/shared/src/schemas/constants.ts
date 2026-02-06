import { HackathonStatus } from './hackathon.js';

export const ROLES = ['organiser', 'participant'] as const;

export const MAX_TEAM_NAME_LENGTH = 50;
export const JOIN_CODE_LENGTH = 8;

export const HACKATHON_STATUS_TRANSITIONS: Record<HackathonStatus, HackathonStatus[]> = {
  DRAFT: ['REGISTRATION_OPEN'],
  REGISTRATION_OPEN: ['HACKING'],
  HACKING: ['SUBMISSION_CLOSED'],
  SUBMISSION_CLOSED: ['COMPLETED'],
  COMPLETED: [],
};
