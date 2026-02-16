export const ROLE_HIERARCHY: Record<string, number> = {
  organizer: 1,
  co_organizer: 2,
  judge: 3,
  team_lead: 4,
  team_member: 5,
  anonymous: 6,
};

export const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active'],
  active: ['judging'],
  judging: ['completed'],
  completed: ['archived'],
  archived: ['completed'], // un-archive for score corrections
};

export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';

/**
 * Static dev user returned when DEV_AUTH_BYPASS is enabled.
 * Matches the UserContext shape from types/env.ts.
 */
export const DEV_USER = {
  id: '00000000-0000-0000-0000-dev000000000',
  email: 'dev@localhost',
  name: 'Dev User',
  github_id: null,
  github_username: 'dev-user',
  avatar_url: null,
} as const;

export const KV_TTL = {
  OAUTH_STATE: 600,         // 10 minutes
  ROLE_CACHE: 60,           // 1 minute
  INSTALLATION_TOKEN: 3000, // 50 minutes
  LEADERBOARD_JUDGING: 60,  // during judging
  LEADERBOARD_COMPLETED: 3600, // after completion
} as const;
