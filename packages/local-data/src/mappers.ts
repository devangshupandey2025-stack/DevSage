/**
 * Response mappers — IndexedDB records → API response objects.
 *
 * The adapter layer converts local records into the shapes the four
 * frontends expect from the remote API. Different consumers need
 * different views: public participant views (devsage.org) vs. the
 * authenticated organizer/admin/judge views.
 */

import type {
  ActivityRecord,
  AdminInviteRecord,
  AnnouncementRecord,
  ConflictRecord,
  HackathonRecord,
  HackathonRequestRecord,
  NotificationRecord,
  RoundRecord,
  RoundResultRecord,
  SubmissionRecord,
  TeamInviteRecord,
  TeamRecord,
  UserRecord,
  WorkspaceInviteRecord,
  WorkspaceRecord,
} from "./db/schema.js";
import type { AssignmentWithDetails, JudgeWithUser, LeaderboardEntry } from "./repositories/judging.js";
import type { TeamMemberWithUser, TeamWithDetails } from "./repositories/teams.js";
import type { WorkspaceMemberWithUser } from "./repositories/workspaces.js";
import { roundsRepository } from "./repositories/rounds.js";

// ---------------------------------------------------------------------------
// JSON coercion — records store JSON payloads as TEXT
// ---------------------------------------------------------------------------

export function parseJsonArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    } catch {
      // Not JSON — empty list.
    }
  }
  return [];
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Not JSON — empty object.
    }
  }
  return {};
}

// ---------------------------------------------------------------------------
// Hackathons
// ---------------------------------------------------------------------------

/** Public participant-facing hackathon shape (devsage.org). */
export function mapHackathonWebView(h: HackathonRecord): Record<string, unknown> {
  return {
    id: h.id,
    workspace_id: h.workspace_id,
    slug: h.slug,
    name: h.title,
    title: h.title,
    tagline: h.tagline,
    description: h.description,
    status: h.status,
    starts_at: h.starts_at,
    judging_starts: h.judging_starts,
    judging_ends: h.judging_ends,
    ends_at: h.judging_ends ?? h.starts_at,
    rules_md: h.rules_md,
    min_team_size: h.min_team_size,
    max_team_size: h.max_team_size,
    max_teams: h.max_teams,
    registration_mode: h.registration_mode,
    registration_open:
      h.registration_mode === "open" && (h.status === "draft" || h.status === "active"),
    prizes: parseJsonArray(h.prizes),
    created_at: h.created_at,
    updated_at: h.updated_at,
  };
}

/** Organizer/authenticated hackathon shape (platform/admin/judge). */
export function mapHackathonPlatform(h: HackathonRecord): Record<string, unknown> {
  return {
    id: h.id,
    workspace_id: h.workspace_id,
    slug: h.slug,
    title: h.title,
    tagline: h.tagline,
    description: h.description,
    rules_md: h.rules_md,
    status: h.status,
    starts_at: h.starts_at,
    judging_starts: h.judging_starts,
    judging_ends: h.judging_ends,
    min_team_size: h.min_team_size,
    max_team_size: h.max_team_size,
    max_teams: h.max_teams,
    submission_tag_pattern: h.submission_tag_pattern,
    allow_resubmission: h.allow_resubmission === 1,
    allow_registration_during_active: h.allow_registration_during_active === 1,
    notify_all_on_deadline: h.notify_all_on_deadline === 1,
    show_judge_comments_to_participants: h.show_judge_comments_to_participants === 1,
    registration_mode: h.registration_mode,
    allowed_email_domains: parseJsonArray(h.allowed_email_domains),
    require_repo: h.require_repo === 1,
    timezone: h.timezone,
    template_id: h.template_id,
    tracks: parseJsonArray(h.tracks),
    prizes: parseJsonArray(h.prizes),
    settings: parseJsonObject(h.settings),
    created_by: h.created_by,
    created_at: h.created_at,
    updated_at: h.updated_at,
  };
}

/** Compact judge-portal hackathon shape. */
export function mapJudgeHackathon(h: HackathonRecord): Record<string, unknown> {
  return {
    id: h.id,
    workspace_id: h.workspace_id,
    title: h.title,
    slug: h.slug,
    status: h.status,
    starts_at: h.starts_at,
    judging_starts: h.judging_starts,
    judging_ends: h.judging_ends,
    created_at: h.created_at,
  };
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

const ROUND_STATUS_MAP: Record<RoundRecord["status"], string> = {
  draft: "pending",
  published: "active",
  results: "completed",
  completed: "completed",
};

/** Round view with the scoring-window fields the platform UI expects. */
export function mapRound(r: RoundRecord): Record<string, unknown> {
  const open = r.status === "published" || r.status === "results" || r.status === "completed";
  return {
    id: r.id,
    hackathon_id: r.hackathon_id,
    name: r.name,
    description: r.description,
    round_number: r.round_number,
    status: ROUND_STATUS_MAP[r.status] ?? r.status,
    is_initialized: r.status === "published" ? 1 : 0,
    type: r.is_elimination === 1 ? "elimination" : "scoring_only",
    is_elimination: r.is_elimination === 1,
    submission_deadline: r.submission_deadline,
    scoring_opens_at: open ? r.created_at : null,
    scoring_closes_at: r.submission_deadline,
    started_at: open ? r.updated_at : null,
    completed_at: r.status === "results" || r.status === "completed" ? r.updated_at : null,
    sort_order: r.sort_order,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function mapRoundResults(rows: RoundResultRecord[]): Record<string, unknown> {
  return { items: rows, total: rows.length };
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export function mapTeam(t: TeamRecord): Record<string, unknown> {
  return {
    id: t.id,
    hackathon_id: t.hackathon_id,
    name: t.name,
    invite_code: t.invite_code,
    track_id: t.track_id,
    status: t.status,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

export function mapTeamMember(m: TeamMemberWithUser): Record<string, unknown> {
  return {
    id: m.id,
    team_id: m.team_id,
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    name: m.user?.name ?? null,
    email: m.user?.email ?? null,
    avatar_url: m.user?.avatar_url ?? null,
    display_name: m.user?.name ?? null,
    github_username: m.user?.github_username ?? null,
    image: m.user?.avatar_url ?? null,
  };
}

export function mapTeamWithDetails(t: TeamWithDetails): Record<string, unknown> {
  return {
    ...mapTeam(t),
    repo_url: t.repos[0]?.repo_url ?? null,
    members: t.members.map(mapTeamMember),
    repos: t.repos,
  };
}

export function mapTeamInvite(i: TeamInviteRecord): Record<string, unknown> {
  return {
    id: i.id,
    token: i.token,
    invite_code: i.token,
    team_id: i.team_id,
    email: i.email,
    status: i.status,
    created_by: i.created_by,
    invited_by: i.created_by,
    created_at: i.created_at,
    expires_at: i.expires_at,
  };
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export function mapSubmission(s: SubmissionRecord): Record<string, unknown> {
  return {
    id: s.id,
    hackathon_id: s.hackathon_id,
    team_id: s.team_id,
    round_id: s.round_id,
    tag_name: s.tag_name,
    commit_sha: s.commit_sha,
    submitted_at: s.submitted_at,
    status: s.status,
    validated_at: s.validated_at,
    is_current: s.is_current === 1,
    created_at: s.created_at,
  };
}

// ---------------------------------------------------------------------------
// Judging
// ---------------------------------------------------------------------------

export function mapJudge(j: JudgeWithUser): Record<string, unknown> {
  return {
    id: j.id,
    hackathon_id: j.hackathon_id,
    user_id: j.user_id,
    status: j.status,
    invited_at: j.invited_at,
    accepted_at: j.accepted_at,
    name: j.user?.name ?? null,
    email: j.user?.email ?? null,
    avatar_url: j.user?.avatar_url ?? null,
    display_name: j.user?.name ?? null,
    image: j.user?.avatar_url ?? null,
  };
}

export function mapAssignment(a: AssignmentWithDetails): Record<string, unknown> {
  return {
    id: a.id,
    hackathon_id: a.hackathon_id,
    judge_id: a.judge_id,
    team_id: a.team_id,
    submission_id: a.submission_id,
    round: a.round,
    status: a.status,
    assigned_at: a.assigned_at,
    completed_at: a.completed_at,
    team_name: a.team?.name ?? null,
    tag_name: a.submission?.tag_name ?? null,
    commit_sha: a.submission?.commit_sha ?? null,
    team: a.team,
    submission: a.submission,
    judge_name: a.judge_name,
    scores: a.scores ?? [],
  };
}

export function mapConflict(c: ConflictRecord): Record<string, unknown> {
  return {
    id: c.id,
    assignment_id: c.assignment_id,
    judge_id: c.judge_id,
    submission_id: c.submission_id,
    status: c.status,
    reason: c.reason,
    declared_at: c.declared_at,
  };
}

export function mapLeaderboard(
  entry: LeaderboardEntry,
  judgesScored: number,
  totalJudges: number,
): Record<string, unknown> {
  return {
    rank: entry.rank,
    team_id: entry.team_id,
    team_name: entry.team_name,
    submission_id: entry.submission_id,
    round: entry.round,
    total_score: entry.total,
    score: entry.total,
    criteria_scores: entry.breakdown ?? [],
    judges_scored: judgesScored,
    judges_completed: judgesScored,
    total_judges: totalJudges,
  };
}

// ---------------------------------------------------------------------------
// Hackathon requests
// ---------------------------------------------------------------------------

export function mapRequest(r: HackathonRequestRecord): Record<string, unknown> {
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    requested_by: r.requested_by,
    title: r.title,
    slug: r.slug,
    description: r.description,
    status: r.status,
    review_notes: r.review_notes,
    reviewed_by: r.reviewed_by,
    reviewed_at: r.reviewed_at,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    num_events: r.num_events,
    expected_participants: r.expected_participants,
    team_min_size: r.team_min_size,
    team_max_size: r.team_max_size,
    additional_details: r.additional_details,
    status_history: JSON.stringify([{ status: r.status, at: r.updated_at, note: r.review_notes }]),
    admin_notes: r.review_notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Notifications / announcements / activity
// ---------------------------------------------------------------------------

export function mapNotification(n: NotificationRecord): Record<string, unknown> {
  return {
    id: n.id,
    user_id: n.user_id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    is_read: n.is_read === 1,
    read_at: n.read_at,
    created_at: n.created_at,
  };
}

export function mapAnnouncement(a: AnnouncementRecord): Record<string, unknown> {
  return {
    id: a.id,
    hackathon_id: a.hackathon_id,
    title: a.title,
    body: a.body,
    content: a.body,
    pinned: 0,
    created_by: a.created_by,
    created_at: a.created_at,
    updated_at: a.updated_at,
  };
}

export function mapAuditEvent(e: ActivityRecord): Record<string, unknown> {
  return {
    id: e.id,
    hackathon_id: e.hackathon_id,
    actor_id: e.actor_id,
    action: e.action,
    entity_type: e.entity_type,
    entity_id: e.entity_id,
    metadata: e.metadata ?? {},
    actor_type: null,
    changes: e.metadata ?? {},
    created_at: e.created_at,
  };
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

export function mapWorkspaceMember(m: WorkspaceMemberWithUser): Record<string, unknown> {
  return {
    id: m.id,
    workspace_id: m.workspace_id,
    user_id: m.user_id,
    role: m.role,
    created_at: m.created_at,
    name: m.user?.name ?? null,
    email: m.user?.email ?? null,
    avatar_url: m.user?.avatar_url ?? null,
    image: m.user?.avatar_url ?? null,
  };
}

export function mapWorkspaceInvite(i: WorkspaceInviteRecord): Record<string, unknown> {
  return {
    id: i.id,
    token: i.token,
    workspace_id: i.workspace_id,
    email: i.email,
    role: i.role,
    status: i.status,
    created_by: i.created_by,
    created_at: i.created_at,
    expires_at: i.expires_at,
    accepted_at: i.accepted_at,
  };
}

export function mapWorkspaceDetail(w: WorkspaceRecord, memberCount: number): Record<string, unknown> {
  return {
    id: w.id,
    name: w.name,
    slug: w.slug,
    description: w.description,
    type: w.type,
    created_by: w.created_by,
    created_at: w.created_at,
    updated_at: w.updated_at,
    member_count: memberCount,
  };
}

export function mapAdminWorkspace(w: WorkspaceRecord, hackathonCount: number): Record<string, unknown> {
  return {
    id: w.id,
    name: w.name,
    slug: w.slug,
    description: w.description,
    type: w.type,
    created_by: w.created_by,
    created_at: w.created_at,
    hackathon_count: hackathonCount,
  };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function latestSubmissionDeadline(hackathonId: string): Promise<string | null> {
  const rounds = await roundsRepository.listByHackathon(hackathonId);
  return rounds.length > 0 ? (rounds[rounds.length - 1].submission_deadline ?? null) : null;
}

export function mapAdminHackathon(
  h: HackathonRecord,
  submissionDeadline: string | null,
): Record<string, unknown> {
  return {
    id: h.id,
    workspace_id: h.workspace_id,
    title: h.title,
    slug: h.slug,
    status: h.status,
    starts_at: h.starts_at,
    judging_ends: h.judging_ends,
    submission_deadline: submissionDeadline,
    created_at: h.created_at,
  };
}

export function mapAdminUser(u: UserRecord): Record<string, unknown> {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar_url: u.avatar_url,
    image: u.avatar_url,
    github_username: u.github_username,
    is_platform_admin: u.is_platform_admin === true,
    created_at: u.created_at,
    last_login_at: null,
    updated_at: u.updated_at,
  };
}

export function mapAdminInvite(i: AdminInviteRecord): Record<string, unknown> {
  return {
    id: i.id,
    email: i.email,
    token: i.token,
    invite_code: i.token,
    status: i.status,
    invited_by: i.invited_by,
    created_at: i.created_at,
    expires_at: i.expires_at,
  };
}