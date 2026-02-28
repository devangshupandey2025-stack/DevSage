// ── Role Hierarchy ────────────────────────────────────────────────
export const ROLE_HIERARCHY: Record<string, number> = {
  organizer: 1,
  co_organizer: 2,
  judge: 3,
  leader: 4,
  member: 5,
  anonymous: 6,
};

// ── Hackathon State Machine ──────────────────────────────────────
export const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active'],
  active: ['judging'],
  judging: ['completed'],
  completed: ['archived'],
  archived: ['completed'], // un-archive for score corrections
};

// ── Invite Codes ─────────────────────────────────────────────────
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';

// ── KV Cache TTLs (seconds) ──────────────────────────────────────
export const KV_TTL = {
  ROLE_CACHE: 60,
  INSTALLATION_TOKEN: 3000,
  LEADERBOARD_JUDGING: 60,
  LEADERBOARD_COMPLETED: 3600,
  AUTH_CONTEXT: 60, // User context cache for auth middleware (KV min TTL is 60s)
} as const;

// ── Rate Limiting ────────────────────────────────────────────────
export interface RateLimitConfig {
  max: number;
  windowSeconds: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  auth: { max: 10, windowSeconds: 60 },
  api: { max: 100, windowSeconds: 60 },
  webhook: { max: 200, windowSeconds: 60 },
  admin: { max: 50, windowSeconds: 60 },
};

// ── Pagination ───────────────────────────────────────────────────
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MAX_SEED_TEAMS: 100,
  MAX_SEED_EMAILS: 500,
  MAX_BULK_JUDGES: 50,
  MAX_NOTIFICATION_RECIPIENTS: 1000,
  MAX_BATCH_CHUNK: 20, // D1 batch parameter limit safety
} as const;

// ── Timing ───────────────────────────────────────────────────────
export const TIMING = {
  ACCESS_TOKEN_EXPIRY_SECONDS: 15 * 60, // 15 minutes
  REFRESH_TOKEN_EXPIRY_DAYS: 30,
  PASSWORD_RESET_TTL_SECONDS: 1800, // 30 minutes
  OTP_TTL_SECONDS: 600, // 10 minutes
  OTP_MAX_ATTEMPTS: 5,
  INVITE_EXPIRY_DAYS: 7,
  TEAM_INVITE_EXPIRY_DAYS: 30,
  SERVICE_TIMEOUT_MS: 10_000,
  SMTP_TIMEOUT_MS: 15_000,
  OAUTH_STATE_TTL_SECONDS: 600,
} as const;

// ── PBKDF2 ───────────────────────────────────────────────────────
export const PASSWORD = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  PBKDF2_ITERATIONS: 600_000, // OWASP 2024 recommendation for SHA-256
  SALT_BYTES: 16,
  KEY_BYTES: 32,
} as const;

// ── HTTP Cache ──────────────────────────────────────────────────
export const HTTP_CACHE = {
  HACKATHON_DETAIL_MAX_AGE: 10,
  HACKATHON_DETAIL_SWR: 30,
  LEADERBOARD_MAX_AGE: 15,
  LEADERBOARD_SWR: 60,
} as const;

// ── Submission Analysis Limits ──────────────────────────────────
export const SUBMISSION_ANALYSIS = {
  TOP_EXTENSIONS: 8,
  DEPENDENCIES: 25,
  ENTRY_FILES: 10,
  DEPENDENCIES_DISPLAY: 15,
} as const;

// ── Workspace Limits ────────────────────────────────────────────
export const WORKSPACE = {
  MAX_OWNERS: 2,
} as const;
