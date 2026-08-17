import { Dexie, type Table } from "dexie";
import type {
  MetaRecord,
  UserRecord,
  SessionRecord,
  RoleRecord,
  WorkspaceRecord,
  WorkspaceMemberRecord,
  WorkspaceInviteRecord,
  HackathonRequestRecord,
  HackathonRecord,
  OrganizerRoleRecord,
  TeamRecord,
  TeamMemberRecord,
  TeamInviteRecord,
  TeamRepoRecord,
  SubmissionRecord,
  RoundRecord,
  RoundResultRecord,
  RubricCriterionRecord,
  JudgeRecord,
  JudgeAssignmentRecord,
  JudgeTrackRecord,
  ScoreRecord,
  ConflictRecord,
  AnnouncementRecord,
  NotificationRecord,
  ActivityRecord,
  AdminInviteRecord,
} from "./schema.js";

/**
 * IndexedDB database for the frontend-only DevSage runtime.
 *
 * All four SPAs open the same `devsage-local` database, so they share one
 * local data model when running under the same browser origin.
 */
export class DevSageLocalDatabase extends Dexie {
  meta!: Table<MetaRecord, string>;
  users!: Table<UserRecord, string>;
  sessions!: Table<SessionRecord, string>;
  roles!: Table<RoleRecord, string>;
  workspaces!: Table<WorkspaceRecord, string>;
  workspaceMembers!: Table<WorkspaceMemberRecord, string>;
  workspaceInvites!: Table<WorkspaceInviteRecord, string>;
  hackathonRequests!: Table<HackathonRequestRecord, string>;
  hackathons!: Table<HackathonRecord, string>;
  organizerRoles!: Table<OrganizerRoleRecord, string>;
  teams!: Table<TeamRecord, string>;
  teamMembers!: Table<TeamMemberRecord, string>;
  teamInvites!: Table<TeamInviteRecord, string>;
  teamRepos!: Table<TeamRepoRecord, string>;
  submissions!: Table<SubmissionRecord, string>;
  rounds!: Table<RoundRecord, string>;
  roundResults!: Table<RoundResultRecord, string>;
  rubrics!: Table<RubricCriterionRecord, string>;
  judges!: Table<JudgeRecord, string>;
  judgeAssignments!: Table<JudgeAssignmentRecord, string>;
  judgeTracks!: Table<JudgeTrackRecord, string>;
  scores!: Table<ScoreRecord, string>;
  conflicts!: Table<ConflictRecord, string>;
  announcements!: Table<AnnouncementRecord, string>;
  notifications!: Table<NotificationRecord, string>;
  activity!: Table<ActivityRecord, string>;
  adminInvites!: Table<AdminInviteRecord, string>;

  constructor() {
    super("devsage-local");

    // v1: meta only (Phase 1B.1 proof point).
    this.version(1).stores({
      meta: "key, updated_at",
    });

    // v2: full domain schema.
    this.version(2).stores({
      meta: "key, updated_at",
      users: "id, email",
      sessions: "id, user_id, current",
      roles: "id, user_id, scope, scope_id, role",
      workspaces: "id, slug, created_at",
      workspaceMembers: "id, workspace_id, user_id, role",
      workspaceInvites: "id, token, workspace_id, email, status",
      hackathonRequests: "id, workspace_id, requested_by, status, created_at",
      hackathons: "id, slug, workspace_id, status, created_at",
      organizerRoles: "id, hackathon_id, user_id, role",
      teams: "id, hackathon_id, invite_code, status",
      teamMembers: "id, team_id, user_id, role",
      teamInvites: "id, token, team_id, email, status",
      teamRepos: "id, team_id, repo_full_name",
      submissions: "id, hackathon_id, team_id, round_id, is_current, submitted_at",
      rounds: "id, hackathon_id, round_number, status",
      roundResults: "id, round_id, team_id, rank",
      rubrics: "id, hackathon_id, sort_order",
      judges: "id, hackathon_id, user_id, status",
      judgeAssignments: "id, judge_id, submission_id, status",
      judgeTracks: "id, judge_id, track_id",
      scores: "id, assignment_id, judge_id, submission_id, criterion_id",
      conflicts: "id, assignment_id, judge_id, status",
      announcements: "id, hackathon_id, created_at",
      notifications: "id, user_id, is_read, created_at",
      activity: "id, hackathon_id, actor_id, action, created_at",
      adminInvites: "id, email, token, status",
    });

    // v3: add query indexes missing from v2 (users.created_at,
    // users.is_platform_admin, judgeAssignments.hackathon_id,
    // adminInvites.created_at). No data migration required.
    this.version(3).stores({
      meta: "key, updated_at",
      users: "id, email, created_at, is_platform_admin",
      sessions: "id, user_id, current",
      roles: "id, user_id, scope, scope_id, role",
      workspaces: "id, slug, created_at",
      workspaceMembers: "id, workspace_id, user_id, role",
      workspaceInvites: "id, token, workspace_id, email, status",
      hackathonRequests: "id, workspace_id, requested_by, status, created_at",
      hackathons: "id, slug, workspace_id, status, created_at",
      organizerRoles: "id, hackathon_id, user_id, role",
      teams: "id, hackathon_id, invite_code, status",
      teamMembers: "id, team_id, user_id, role",
      teamInvites: "id, token, team_id, email, status",
      teamRepos: "id, team_id, repo_full_name",
      submissions: "id, hackathon_id, team_id, round_id, is_current, submitted_at",
      rounds: "id, hackathon_id, round_number, status",
      roundResults: "id, round_id, team_id, rank",
      rubrics: "id, hackathon_id, sort_order",
      judges: "id, hackathon_id, user_id, status",
      judgeAssignments: "id, judge_id, submission_id, status, hackathon_id",
      judgeTracks: "id, judge_id, track_id",
      scores: "id, assignment_id, judge_id, submission_id, criterion_id",
      conflicts: "id, assignment_id, judge_id, status",
      announcements: "id, hackathon_id, created_at",
      notifications: "id, user_id, is_read, created_at",
      activity: "id, hackathon_id, actor_id, action, created_at",
      adminInvites: "id, email, token, status, created_at",
    });
  }
}

export const db = new DevSageLocalDatabase();