// Database
export { db, DevSageLocalDatabase } from "./db/database.js";
export type { MetaRecord as LocalMetaRecord } from "./db/schema.js";
export * from "./db/schema.js";

// Repositories
export { usersRepository } from "./repositories/users.js";
export type { CreateUserInput, UpdateUserInput, UserListResult } from "./repositories/users.js";
export { workspacesRepository } from "./repositories/workspaces.js";
export type { CreateWorkspaceInput, WorkspaceMemberWithUser } from "./repositories/workspaces.js";
export { hackathonsRepository, HACKATHON_TRANSITIONS } from "./repositories/hackathons.js";
export type { CreateHackathonInput } from "./repositories/hackathons.js";
export { teamsRepository } from "./repositories/teams.js";
export type { CreateTeamInput, TeamMemberWithUser, TeamWithDetails } from "./repositories/teams.js";
export { submissionsRepository } from "./repositories/submissions.js";
export type { CreateSubmissionInput } from "./repositories/submissions.js";
export { roundsRepository, ROUND_STATUSES } from "./repositories/rounds.js";
export type { CreateRoundInput } from "./repositories/rounds.js";
export {
  judgingRepository,
  computeLeaderboard,
  computeLeaderboardEntry,
} from "./repositories/judging.js";
export type {
  AssignmentWithDetails,
  JudgeWithUser,
  LeaderboardBreakdown,
  LeaderboardEntry,
  SubmitScoreInput,
} from "./repositories/judging.js";
export { announcementsRepository } from "./repositories/announcements.js";
export type { CreateAnnouncementInput } from "./repositories/announcements.js";
export { notificationsRepository } from "./repositories/notifications.js";
export type { CreateNotificationInput } from "./repositories/notifications.js";
export { activityRepository } from "./repositories/activity.js";
export type { CreateActivityInput } from "./repositories/activity.js";
export { hackathonRequestsRepository, REQUEST_TRANSITIONS } from "./repositories/requests.js";
export type { CreateRequestInput } from "./repositories/requests.js";
export { adminRepository } from "./repositories/admin.js";
export type { DashboardStats } from "./repositories/admin.js";

// Session
export { sessionStore, deriveActiveRole } from "./session/session-store.js";
export type { ActiveRole, LocalSession, MeResult } from "./session/session-store.js";

// Seed
export {
  clearAllData,
  DEMO_CRITERIA_IDS,
  DEMO_EMAILS,
  DEMO_HACKATHON_IDS,
  DEMO_IDS,
  DEMO_JUDGE_IDS,
  DEMO_PASSWORD,
  DEMO_ROUND_IDS,
  DEMO_SLUGS,
  DEMO_TEAM_IDS,
  DEMO_TOKENS,
  DEMO_WORKSPACE_IDS,
  META_KEYS,
  resetDemoData,
  SCHEMA_VERSION,
  SEED_TIMESTAMP,
  SEED_VERSION,
  seedIfNeeded,
} from "./seed/demo-data.js";
export type { SeedStatus } from "./seed/demo-data.js";

// Adapter
export { localApiRequest } from "./adapter.js";
export type { LocalFailure, LocalSuccess } from "./adapter.js";

// Helpers
export { now, paginate, sha256Hex, sortByCreatedAtDesc, uuid } from "./lib/utils.js";