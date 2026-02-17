export const ROLE_HIERARCHY: Record<string, number> = {
  organizer: 1,
  co_organizer: 2,
  judge: 3,
  leader: 4,
  member: 5,
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

export const KV_TTL = {
  ROLE_CACHE: 60,
  INSTALLATION_TOKEN: 3000,
  LEADERBOARD_JUDGING: 60,
  LEADERBOARD_COMPLETED: 3600,
} as const;
