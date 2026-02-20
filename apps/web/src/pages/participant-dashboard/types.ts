/* ─────────────────────────────────────────────────────────────
   Participant Dashboard — Shared Types
   ───────────────────────────────────────────────────────────── */

/** Hackathon status enum matching v2 API (5-state lifecycle) */
export type HackathonStatus =
  | 'draft'
  | 'active'
  | 'judging'
  | 'completed'
  | 'archived';

/** Submission lifecycle states */
export type SubmissionStatus =
  | 'received'
  | 'validated'
  | 'invalid'
  | 'locked'
  | 'under_review'
  | 'scored'
  | 'invalidated';

/** Team member roles within a team */
export type TeamMemberRole = 'leader' | 'member';

/* ── API Response Shapes ────────────────────────────────────── */

export interface Hackathon {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  rules_md?: string | null;
  primary_color?: string | null;
  banner_r2_key?: string | null;
  logo_r2_key?: string | null;
  status: HackathonStatus;
  starts_at: string | null;
  submission_deadline: string;
  judging_starts?: string | null;
  judging_ends?: string | null;
  min_team_size?: number;
  max_team_size: number;
  max_teams?: number | null;
  submission_tag_pattern: string;
  max_submissions_per_team?: number | null;
  allow_late_submissions?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  user_id: string;
  role: TeamMemberRole;
  joined_at: string;
  display_name: string;
  image?: string | null;
  github_username?: string;
}

export interface Team {
  id: string;
  hackathon_id: string;
  name: string;
  repo_full_name: string | null;
  repo_url: string | null;
  invite_code: string;
  bot_active: boolean;
  github_installation_id?: number | null;
  created_at: string;
  members?: TeamMember[];
}

export interface Submission {
  id: string;
  team_id: string;
  hackathon_id: string;
  tag_name: string;
  commit_sha: string;
  commit_message?: string | null;
  commit_author?: string | null;
  branch?: string | null;
  submitted_at: string;
  received_at: string;
  is_late: boolean;
  is_final: boolean;
  version: number;
  status: SubmissionStatus;
  validation_errors?: string | null;
  locked_at?: string | null;
  webhook_delivery_id?: string | null;
}

export interface ActivityEvent {
  id: string;
  hackathon_id: string | null;
  actor_id: string | null;
  actor_type: 'user' | 'system' | 'bot' | 'cron';
  action: string;
  entity_type: string;
  entity_id: string;
  details: string | null;
  created_at: string;
  /** Resolved display name (joined from users table or derived) */
  actor_name?: string;
}

export interface RubricCriterion {
  id: string;
  hackathon_id: string;
  name: string;
  description: string | null;
  max_score: number;
  weight: number;
  sort_order: number;
}

export interface LeaderboardEntry {
  rank: number;
  team_id: string;
  team_name: string;
  weighted_score: number;
  judge_count: number;
  submission_tag?: string;
}

/* ── API Envelope ────────────────────────────────────────────── */

export interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

/* ── Derived Dashboard State ─────────────────────────────────── */

export interface DeadlineInfo {
  label: string;
  date: Date;
  isPast: boolean;
  isImminent: boolean; // < 2 hours away
  relative: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  href?: string;
  action?: string;
}

export type DashboardPhase =
  | 'pre_registration'    // registration hasn't opened
  | 'registration'        // registration is open
  | 'pre_hacking'         // draft — waiting for activation
  | 'hacking'             // active — main dashboard state
  | 'submission_locked'   // active but past deadline
  | 'judging'             // judging phase
  | 'completed'           // completed / archived
  | 'no_team';            // user hasn't joined a team yet
