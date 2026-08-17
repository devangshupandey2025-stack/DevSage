/**
 * Local IndexedDB record types for the frontend-only DevSage runtime.
 *
 * These records mirror the DevSage product model (not the exact D1 schema).
 * Where IndexedDB records differ from API response objects, the adapter layer
 * maps between them explicitly.
 *
 * Security note: this is local demo state, not a production database.
 * No real authentication or authorization is provided.
 */

import type {
  HackathonStatus,
  HackathonRole,
  OrganizerRole,
  TeamStatus,
  SubmissionStatus,
  JudgeInviteStatus,
  TeamMemberRole,
  WorkspaceRole,
  WorkspaceType,
  AssignmentStatus,
} from "@devsage/shared";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export interface MetaRecord {
  key: string;
  value: unknown;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  github_username: string | null;
  /** SHA-256 hex digest of the demo password (never plaintext). */
  password_hash: string | null;
  /** True when the app should force a password change (judge demo flow). */
  password_must_change: boolean;
  is_platform_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  /** Active UX role used for UI branching (not authorization). */
  active_role: "platform_admin" | "organizer" | "judge" | "participant" | null;
  /** 1 for the current session, 0 otherwise. */
  current: number;
  created_at: string;
  updated_at: string;
}

export interface RoleRecord {
  id: string;
  user_id: string;
  /** 'platform' | 'workspace' | 'hackathon' */
  scope: string;
  /** workspace id, hackathon id, or 'global' for platform scope */
  scope_id: string;
  role: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: WorkspaceType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMemberRecord {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface WorkspaceInviteRecord {
  id: string;
  token: string;
  workspace_id: string;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  status: "pending" | "accepted" | "declined" | "expired";
  created_by: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

// ---------------------------------------------------------------------------
// Hackathon requests (organizer → admin pipeline)
// ---------------------------------------------------------------------------

export type HackathonRequestStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "building"
  | "ready"
  | "rejected";

export interface HackathonRequestRecord {
  id: string;
  workspace_id: string | null;
  requested_by: string;
  title: string;
  description: string | null;
  slug: string;
  status: HackathonRequestStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  num_events: number | null;
  expected_participants: number | null;
  team_min_size: number | null;
  team_max_size: number | null;
  additional_details: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Hackathons
// ---------------------------------------------------------------------------

export interface HackathonRecord {
  id: string;
  workspace_id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  rules_md: string | null;
  status: HackathonStatus;
  starts_at: string | null;
  judging_starts: string | null;
  judging_ends: string | null;
  min_team_size: number;
  max_team_size: number;
  max_teams: number | null;
  submission_tag_pattern: string;
  allow_resubmission: number;
  allow_registration_during_active: number;
  notify_all_on_deadline: number;
  show_judge_comments_to_participants: number;
  registration_mode: string;
  allowed_email_domains: string;
  require_repo: number;
  timezone: string;
  template_id: string | null;
  tracks: string;
  prizes: string;
  settings: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizerRoleRecord {
  id: string;
  hackathon_id: string;
  user_id: string;
  role: OrganizerRole;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export interface TeamRecord {
  id: string;
  hackathon_id: string;
  name: string;
  invite_code: string;
  track_id: string | null;
  status: TeamStatus;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberRecord {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  joined_at: string;
}

export interface TeamInviteRecord {
  id: string;
  token: string;
  team_id: string;
  email: string;
  status: "pending" | "accepted" | "declined" | "expired";
  created_by: string;
  created_at: string;
  expires_at: string;
}

export interface TeamRepoRecord {
  id: string;
  team_id: string;
  repo_full_name: string;
  repo_url: string;
  linked_at: string;
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export interface SubmissionRecord {
  id: string;
  hackathon_id: string;
  team_id: string;
  round_id: string | null;
  tag_name: string;
  commit_sha: string;
  submitted_at: string;
  status: SubmissionStatus;
  validated_at: string | null;
  is_current: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

export type RoundStatus = "draft" | "published" | "results" | "completed";

export interface RoundRecord {
  id: string;
  hackathon_id: string;
  name: string;
  description: string | null;
  round_number: number;
  status: RoundStatus;
  submission_deadline: string | null;
  is_elimination: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RoundResultRecord {
  id: string;
  round_id: string;
  team_id: string;
  rank: number;
  total_score: number;
  advanced: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Judging
// ---------------------------------------------------------------------------

export interface RubricCriterionRecord {
  id: string;
  hackathon_id: string;
  name: string;
  description: string | null;
  max_score: number;
  weight: number;
  track_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface JudgeRecord {
  id: string;
  hackathon_id: string;
  user_id: string;
  status: JudgeInviteStatus;
  invited_at: string;
  accepted_at: string | null;
}

export interface JudgeAssignmentRecord {
  id: string;
  hackathon_id: string;
  judge_id: string;
  team_id: string;
  submission_id: string | null;
  round: number;
  status: AssignmentStatus;
  assigned_at: string;
  completed_at: string | null;
}

export interface JudgeTrackRecord {
  id: string;
  judge_id: string;
  hackathon_id: string;
  track_id: string;
}

export interface ScoreRecord {
  id: string;
  assignment_id: string;
  judge_id: string;
  submission_id: string;
  criterion_id: string;
  round: number;
  score: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConflictRecord {
  id: string;
  assignment_id: string;
  judge_id: string;
  submission_id: string;
  status: "declared" | "cleared";
  reason: string | null;
  declared_at: string;
}

// ---------------------------------------------------------------------------
// Announcements / notifications / activity
// ---------------------------------------------------------------------------

export interface AnnouncementRecord {
  id: string;
  hackathon_id: string;
  title: string;
  body: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: number;
  read_at: string | null;
  created_at: string;
}

export interface ActivityRecord {
  id: string;
  hackathon_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminInviteRecord {
  id: string;
  email: string;
  token: string;
  status: "pending" | "accepted" | "expired";
  invited_by: string;
  created_at: string;
  expires_at: string;
}

// ---------------------------------------------------------------------------
// Table name constants
// ---------------------------------------------------------------------------

export const TABLES = {
  meta: "meta",
  users: "users",
  sessions: "sessions",
  roles: "roles",
  workspaces: "workspaces",
  workspaceMembers: "workspaceMembers",
  workspaceInvites: "workspaceInvites",
  hackathonRequests: "hackathonRequests",
  hackathons: "hackathons",
  organizerRoles: "organizerRoles",
  teams: "teams",
  teamMembers: "teamMembers",
  teamInvites: "teamInvites",
  teamRepos: "teamRepos",
  submissions: "submissions",
  rounds: "rounds",
  roundResults: "roundResults",
  rubrics: "rubrics",
  judges: "judges",
  judgeAssignments: "judgeAssignments",
  judgeTracks: "judgeTracks",
  scores: "scores",
  conflicts: "conflicts",
  announcements: "announcements",
  notifications: "notifications",
  activity: "activity",
  adminInvites: "adminInvites",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

/** All tables that store domain data (excludes meta). */
export const DOMAIN_TABLES: readonly TableName[] = [
  TABLES.users,
  TABLES.sessions,
  TABLES.roles,
  TABLES.workspaces,
  TABLES.workspaceMembers,
  TABLES.workspaceInvites,
  TABLES.hackathonRequests,
  TABLES.hackathons,
  TABLES.organizerRoles,
  TABLES.teams,
  TABLES.teamMembers,
  TABLES.teamInvites,
  TABLES.teamRepos,
  TABLES.submissions,
  TABLES.rounds,
  TABLES.roundResults,
  TABLES.rubrics,
  TABLES.judges,
  TABLES.judgeAssignments,
  TABLES.judgeTracks,
  TABLES.scores,
  TABLES.conflicts,
  TABLES.announcements,
  TABLES.notifications,
  TABLES.activity,
  TABLES.adminInvites,
];