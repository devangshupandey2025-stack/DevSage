/**
 * Centralised constants for the DevSage API.
 *
 * Every magic number / string that was previously inlined across route
 * handlers, queue handlers, and services lives here. Grouped by domain.
 */

// ─── Timeouts ────────────────────────────────────────────────

/** Default timeout for Durable Object fetch calls (ms). */
export const DO_FETCH_TIMEOUT_MS = 10_000;

/** Default timeout for external service calls — GitHub API, SMTP, etc. (ms). */
export const SERVICE_TIMEOUT_MS = 10_000;

// ─── JWT ─────────────────────────────────────────────────────

/** JWT token expiry duration: 7 days in seconds. */
export const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

// ─── Submissions ─────────────────────────────────────────────

/** Default git-tag pattern for matching submission tags (`%` = version wildcard). */
export const DEFAULT_SUBMISSION_TAG_PATTERN = 'submission_v%';

/** Maximum number of commits stored per push event. GitHub caps at 20 anyway. */
export const MAX_COMMITS_PER_PUSH = 20;

/** Number of judges assigned per team during round-robin assignment. */
export const REVIEWS_PER_TEAM = 3;

// ─── Cron ────────────────────────────────────────────────────

/** Look-ahead window for deadline reminder emails (24 h in ms). */
export const DEADLINE_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

// ─── Queue ───────────────────────────────────────────────────

/** Maximum retry attempts before dead-lettering a queue message. */
export const MAX_QUEUE_RETRIES = 3;

/** Ceiling on retry delay (seconds). */
export const MAX_RETRY_DELAY_SECONDS = 300;

/** Base multiplier for exponential back-off between retries (seconds). */
export const RETRY_BACKOFF_BASE_SECONDS = 30;

// ─── Hackathon Defaults ──────────────────────────────────────

/** Default primary colour for hackathon branding. */
export const DEFAULT_PRIMARY_COLOR = '#6366f1';

/** Default minimum team size. */
export const DEFAULT_MIN_TEAM_SIZE = 1;

/** Default maximum team size. */
export const DEFAULT_MAX_TEAM_SIZE = 5;

// ─── Durable Object Paths ────────────────────────────────────

/**
 * Well-known HTTP paths exposed by the HackathonStateMachine Durable Object.
 * Using constants prevents typos in `stub.fetch('http://do/...')` calls.
 */
export const DO_PATHS = {
  INITIALIZE: 'http://do/initialize',
  TRANSITION: 'http://do/transition',
  STATE: 'http://do/state',
  ACCEPT_SUBMISSION: 'http://do/accept-submission',
  CAN_ACCEPT: 'http://do/can-accept-submissions',
  submissions: (hackathonId: string): string =>
    `http://do/submissions/${hackathonId}`,
  submission: (hackathonId: string, teamId: string): string =>
    `http://do/submission/${hackathonId}/${teamId}`,
} as const;
