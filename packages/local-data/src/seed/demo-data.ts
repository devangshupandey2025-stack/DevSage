/**
 * Deterministic demo seed data for the frontend-only DevSage runtime.
 *
 * All IDs, slugs, invite tokens and timestamps are fixed, so screenshots,
 * tests and walkthroughs are predictable.
 *
 * Seeding is idempotent: it only re-runs when the stored seed version in
 * `meta` is older than SEED_VERSION. It never wipes user data on ordinary
 * app load. `resetDemoData()` explicitly clears and reseeds.
 */

import { db } from "../db/database.js";
import {
  DOMAIN_TABLES,
  type ActivityRecord,
  type AdminInviteRecord,
  type AnnouncementRecord,
  type ConflictRecord,
  type HackathonRecord,
  type HackathonRequestRecord,
  type JudgeAssignmentRecord,
  type JudgeRecord,
  type NotificationRecord,
  type RoleRecord,
  type RoundRecord,
  type RoundResultRecord,
  type RubricCriterionRecord,
  type ScoreRecord,
  type SubmissionRecord,
  type TeamInviteRecord,
  type TeamMemberRecord,
  type TeamRecord,
  type TeamRepoRecord,
  type UserRecord,
  type WorkspaceInviteRecord,
  type WorkspaceMemberRecord,
  type WorkspaceRecord,
} from "../db/schema.js";
import { now, sha256Hex } from "../lib/utils.js";

export const SEED_VERSION = "1";
export const SCHEMA_VERSION = 2;
export const SEED_TIMESTAMP = "2026-08-01T00:00:00.000Z";
export const DEMO_PASSWORD = "demo1234";

export const META_KEYS = {
  schemaVersion: "schema_version",
  seedVersion: "seed_version",
  lastSeededAt: "last_seeded_at",
  activeSessionId: "active_session_id",
} as const;

/** Offset helper: timestamp at seed-date + days (and optional hours). */
function t(days: number, hours = 0): string {
  const base = Date.parse(SEED_TIMESTAMP);
  return new Date(base + days * 86_400_000 + hours * 3_600_000).toISOString();
}

// ---------------------------------------------------------------------------
// Stable identities
// ---------------------------------------------------------------------------

export const DEMO_IDS = {
  admin: "11111111-1111-4111-8111-111111111111",
  owner: "22222222-2222-4222-8222-222222222222",
  coorg: "33333333-3333-4333-8333-333333333333",
  judge1: "44444444-4444-4444-8444-444444444444",
  judge2: "55555555-5555-4555-8555-555555555555",
  judge3: "66666666-6666-4666-8666-666666666666",
  p1: "77777777-7777-4777-8777-777777777777",
  p2: "88888888-8888-4888-8888-888888888888",
  p3: "99999999-9999-4999-8999-999999999999",
  p4: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  p5: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  p6: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  p7: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  p8: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
} as const;

export const DEMO_EMAILS = {
  admin: "admin@devsage.org",
  owner: "owner@devsage.org",
  coorg: "coorg@devsage.org",
  judge1: "judge1@devsage.org",
  judge2: "judge2@devsage.org",
  judge3: "judge3@devsage.org",
  p1: "dev.arya@devsage.org",
  p2: "dev.isha@devsage.org",
  p3: "dev.karan@devsage.org",
  p4: "dev.sneha@devsage.org",
  p5: "dev.rahul@devsage.org",
  p6: "dev.anika@devsage.org",
  p7: "dev.vikram@devsage.org",
  p8: "dev.tara@devsage.org",
} as const;

export const DEMO_WORKSPACE_IDS = {
  ieee: "11111111-2222-4333-8444-555555555555",
  jam: "11111111-3333-4333-8444-555555555555",
} as const;

export const DEMO_HACKATHON_IDS = {
  sprint: "11111111-4444-4333-8444-555555555555",
  jam: "11111111-5555-4333-8444-555555555555",
  fest: "11111111-6666-4333-8444-555555555555",
  archive: "11111111-7777-4333-8444-555555555555",
} as const;

export const DEMO_SLUGS = {
  sprint: "code-sprint",
  jam: "weekend-jam",
  fest: "hack-fest",
  archive: "winter-code-challenge",
} as const;

export const DEMO_ROUND_IDS = {
  sprintR1: "21111111-1111-4111-8111-111111111111",
  jamR1: "21111111-2222-4111-8111-111111111111",
  jamR2: "21111111-3333-4111-8111-111111111111",
  archiveR1: "21111111-4444-4111-8111-111111111111",
  archiveR2: "21111111-5555-4111-8111-111111111111",
} as const;

export const DEMO_TEAM_IDS = {
  sprint1: "31111111-1111-4111-8111-111111111111",
  sprint2: "31111111-2222-4111-8111-111111111111",
  sprint3: "31111111-3333-4111-8111-111111111111",
  sprint4: "31111111-4444-4111-8111-111111111111",
  jam1: "31111111-5555-4111-8111-111111111111",
  jam2: "31111111-6666-4111-8111-111111111111",
  jam3: "31111111-7777-4111-8111-111111111111",
  archive1: "31111111-8888-4111-8111-111111111111",
  archive2: "31111111-9999-4111-8111-111111111111",
} as const;

export const DEMO_JUDGE_IDS = {
  j1: "41111111-1111-4111-8111-111111111111",
  j2: "41111111-2222-4111-8111-111111111111",
  j3: "41111111-3333-4111-8111-111111111111",
  j4: "41111111-4444-4111-8111-111111111111",
} as const;

export const DEMO_CRITERIA_IDS = {
  jamC1: "51111111-1111-4111-8111-111111111111",
  jamC2: "51111111-2222-4111-8111-111111111111",
  jamC3: "51111111-3333-4111-8111-111111111111",
  jamC4: "51111111-4444-4111-8111-111111111111",
  sprintC1: "51111111-5555-4111-8111-111111111111",
  sprintC2: "51111111-6666-4111-8111-111111111111",
  sprintC3: "51111111-7777-4111-8111-111111111111",
} as const;

export const DEMO_TOKENS = {
  workspaceInvite: "wsinv-a1b2c3d4",
  teamInvite: "tminv-e5f6g7h8",
  adminInvite: "admininv-i9j0k1l2",
} as const;

// ---------------------------------------------------------------------------
// Seed body
// ---------------------------------------------------------------------------

async function buildUsers(): Promise<UserRecord[]> {
  const hash = await sha256Hex(DEMO_PASSWORD);
  const mk = (
    id: string,
    email: string,
    name: string,
    github: string | null,
    isAdmin: boolean,
    mustChange: boolean,
    createdAt: string,
  ): UserRecord => ({
    id,
    email,
    name,
    avatar_url: null,
    github_username: github,
    password_hash: hash,
    password_must_change: mustChange,
    is_platform_admin: isAdmin,
    created_at: createdAt,
    updated_at: createdAt,
  });

  return [
    mk(DEMO_IDS.admin, DEMO_EMAILS.admin, "Aarav Sharma", "aarav-dev", true, false, t(-120)),
    mk(DEMO_IDS.owner, DEMO_EMAILS.owner, "Priya Patel", "priya-patel", false, false, t(-110)),
    mk(DEMO_IDS.coorg, DEMO_EMAILS.coorg, "Rohan Verma", "rohan-verma", false, false, t(-100)),
    mk(DEMO_IDS.judge1, DEMO_EMAILS.judge1, "Ananya Iyer", "ananya-iyer", false, true, t(-90)),
    mk(DEMO_IDS.judge2, DEMO_EMAILS.judge2, "Kabir Nair", "kabir-nair", false, false, t(-85)),
    mk(DEMO_IDS.judge3, DEMO_EMAILS.judge3, "Meera Krishnan", "meera-k", false, false, t(-10)),
    mk(DEMO_IDS.p1, DEMO_EMAILS.p1, "Arya Menon", "arya-menon", false, false, t(-80)),
    mk(DEMO_IDS.p2, DEMO_EMAILS.p2, "Isha Desai", "isha-desai", false, false, t(-79)),
    mk(DEMO_IDS.p3, DEMO_EMAILS.p3, "Karan Shah", "karan-shah", false, false, t(-78)),
    mk(DEMO_IDS.p4, DEMO_EMAILS.p4, "Sneha Reddy", "sneha-reddy", false, false, t(-77)),
    mk(DEMO_IDS.p5, DEMO_EMAILS.p5, "Rahul Bose", "rahul-bose", false, false, t(-76)),
    mk(DEMO_IDS.p6, DEMO_EMAILS.p6, "Anika Rao", "anika-rao", false, false, t(-75)),
    mk(DEMO_IDS.p7, DEMO_EMAILS.p7, "Vikram Singh", "vikram-singh", false, false, t(-74)),
    mk(DEMO_IDS.p8, DEMO_EMAILS.p8, "Tara Gupta", "tara-gupta", false, false, t(-73)),
  ];
}

function buildWorkspaces(): WorkspaceRecord[] {
  return [
    {
      id: DEMO_WORKSPACE_IDS.ieee,
      name: "IEEE VIT Student Branch",
      slug: "ieee-vit",
      description: "Official IEEE student branch at VIT. Runs flagship hackathons.",
      type: "club" as const,
      created_by: DEMO_IDS.owner,
      created_at: t(-100),
      updated_at: t(-100),
    },
    {
      id: DEMO_WORKSPACE_IDS.jam,
      name: "Weekend Jam",
      slug: "weekend-jam",
      description: "Individual organizer account for weekend hackathons.",
      type: "individual" as const,
      created_by: DEMO_IDS.owner,
      created_at: t(-95),
      updated_at: t(-95),
    },
  ];
}

function buildWorkspaceMembers(): WorkspaceMemberRecord[] {
  const mk = (id: string, workspace_id: string, user_id: string, role: WorkspaceMemberRecord["role"], at: string): WorkspaceMemberRecord => ({
    id, workspace_id, user_id, role, created_at: at,
  });
  return [
    mk("61111111-1111-4111-8111-111111111111", DEMO_WORKSPACE_IDS.ieee, DEMO_IDS.owner, "owner", t(-100)),
    mk("61111111-2222-4111-8111-111111111111", DEMO_WORKSPACE_IDS.ieee, DEMO_IDS.coorg, "admin", t(-95)),
    mk("61111111-3333-4111-8111-111111111111", DEMO_WORKSPACE_IDS.jam, DEMO_IDS.owner, "owner", t(-95)),
  ];
}

function buildHackathons(): HackathonRecord[] {
  const mk = (h: {
    id: string; workspace_id: string; slug: string; title: string; tagline: string;
    status: HackathonRecord["status"]; starts_at: string | null; created: string; created_by: string;
  }): HackathonRecord => ({
    id: h.id,
    workspace_id: h.workspace_id,
    slug: h.slug,
    title: h.title,
    tagline: h.tagline,
    description: `${h.title} demo description for local frontend runtime.`,
    rules_md: "## Rules\n\n1. Teams of up to 4.\n2. Push a submission tag before the deadline.\n3. Have fun.",
    status: h.status,
    starts_at: h.starts_at,
    judging_starts: h.status === "judging" || h.status === "completed" ? t(10, 9) : null,
    judging_ends: h.status === "completed" ? t(12, 18) : h.status === "judging" ? t(14, 18) : null,
    min_team_size: 1,
    max_team_size: 4,
    max_teams: 50,
    submission_tag_pattern: "submission_v%",
    allow_resubmission: 0,
    allow_registration_during_active: 0,
    notify_all_on_deadline: 1,
    show_judge_comments_to_participants: 1,
    registration_mode: "open",
    allowed_email_domains: "[]",
    require_repo: 1,
    timezone: "Asia/Kolkata",
    template_id: null,
    tracks: "[]",
    prizes: "[]",
    settings: "{}",
    created_by: h.created_by,
    created_at: h.created,
    updated_at: h.created,
  });
  return [
    mk({
      id: DEMO_HACKATHON_IDS.sprint, workspace_id: DEMO_WORKSPACE_IDS.ieee, slug: DEMO_SLUGS.sprint,
      title: "IEEE CodeSprint 2026", tagline: "48 hours of pure code.",
      status: "active", starts_at: t(15, 9), created: t(-60), created_by: DEMO_IDS.owner,
    }),
    mk({
      id: DEMO_HACKATHON_IDS.jam, workspace_id: DEMO_WORKSPACE_IDS.jam, slug: DEMO_SLUGS.jam,
      title: "Weekend Jam Hackathon", tagline: "Ship a weekend project, win prizes.",
      status: "judging", starts_at: t(-4, 9), created: t(-45), created_by: DEMO_IDS.owner,
    }),
    mk({
      id: DEMO_HACKATHON_IDS.fest, workspace_id: DEMO_WORKSPACE_IDS.ieee, slug: DEMO_SLUGS.fest,
      title: "HackFest 2026", tagline: "The biggest student hackathon of the year.",
      status: "draft", starts_at: t(45, 9), created: t(-5), created_by: DEMO_IDS.owner,
    }),
    mk({
      id: DEMO_HACKATHON_IDS.archive, workspace_id: DEMO_WORKSPACE_IDS.jam, slug: DEMO_SLUGS.archive,
      title: "Winter Code Challenge", tagline: "Past hackathon, completed.",
      status: "completed", starts_at: t(-90, 9), created: t(-120), created_by: DEMO_IDS.owner,
    }),
  ];
}

function buildRoles(): RoleRecord[] {
  const mk = (id: string, user_id: string, scope: string, scope_id: string, role: string, at: string): RoleRecord => ({
    id, user_id, scope, scope_id, role, created_at: at,
  });
  const rows: RoleRecord[] = [
    // Platform admin
    mk("71111111-1111-4111-8111-111111111111", DEMO_IDS.admin, "platform", "global", "platform_admin", t(-120)),
    // Workspace roles
    mk("71111111-2222-4111-8111-111111111111", DEMO_IDS.owner, "workspace", DEMO_WORKSPACE_IDS.ieee, "owner", t(-100)),
    mk("71111111-3333-4111-8111-111111111111", DEMO_IDS.coorg, "workspace", DEMO_WORKSPACE_IDS.ieee, "admin", t(-95)),
    mk("71111111-4444-4111-8111-111111111111", DEMO_IDS.owner, "workspace", DEMO_WORKSPACE_IDS.jam, "owner", t(-95)),
    // Hackathon organizer roles
    mk("71111111-5555-4111-8111-111111111111", DEMO_IDS.owner, "hackathon", DEMO_HACKATHON_IDS.sprint, "organizer", t(-60)),
    mk("71111111-6666-4111-8111-111111111111", DEMO_IDS.coorg, "hackathon", DEMO_HACKATHON_IDS.sprint, "co_organizer", t(-55)),
    mk("71111111-7777-4111-8111-111111111111", DEMO_IDS.owner, "hackathon", DEMO_HACKATHON_IDS.fest, "organizer", t(-5)),
    mk("71111111-8888-4111-8111-111111111111", DEMO_IDS.owner, "hackathon", DEMO_HACKATHON_IDS.jam, "organizer", t(-45)),
    mk("71111111-9999-4111-8111-111111111111", DEMO_IDS.owner, "hackathon", DEMO_HACKATHON_IDS.archive, "organizer", t(-120)),
    // Judge hackathon roles
    mk("72111111-1111-4111-8111-111111111111", DEMO_IDS.judge1, "hackathon", DEMO_HACKATHON_IDS.jam, "judge", t(-30)),
    mk("72111111-2222-4111-8111-111111111111", DEMO_IDS.judge2, "hackathon", DEMO_HACKATHON_IDS.jam, "judge", t(-29)),
    mk("72111111-3333-4111-8111-111111111111", DEMO_IDS.judge1, "hackathon", DEMO_HACKATHON_IDS.sprint, "judge", t(-28)),
    // Participant hackathon roles
    mk("72111111-4444-4111-8111-111111111111", DEMO_IDS.p1, "hackathon", DEMO_HACKATHON_IDS.sprint, "team_lead", t(-50)),
    mk("72111111-5555-4111-8111-111111111111", DEMO_IDS.p2, "hackathon", DEMO_HACKATHON_IDS.sprint, "team_member", t(-49)),
    mk("72111111-6666-4111-8111-111111111111", DEMO_IDS.p3, "hackathon", DEMO_HACKATHON_IDS.sprint, "team_lead", t(-48)),
    mk("72111111-7777-4111-8111-111111111111", DEMO_IDS.p1, "hackathon", DEMO_HACKATHON_IDS.jam, "team_lead", t(-40)),
    mk("72111111-8888-4111-8111-111111111111", DEMO_IDS.p2, "hackathon", DEMO_HACKATHON_IDS.jam, "team_member", t(-39)),
  ];
  return rows;
}

function buildTeams(): TeamRecord[] {
  const mk = (id: string, hackathon_id: string, name: string, invite_code: string, status: TeamRecord["status"], at: string): TeamRecord => ({
    id, hackathon_id, name, invite_code, track_id: null, status, created_at: at, updated_at: at,
  });
  return [
    mk(DEMO_TEAM_IDS.sprint1, DEMO_HACKATHON_IDS.sprint, "Alpha Coders", "ALPHA001", "ready", t(-50)),
    mk(DEMO_TEAM_IDS.sprint2, DEMO_HACKATHON_IDS.sprint, "Byte Brigade", "BYTE0002", "ready", t(-49)),
    mk(DEMO_TEAM_IDS.sprint3, DEMO_HACKATHON_IDS.sprint, "Syntax Squad", "SYNTAX03", "ready", t(-48)),
    mk(DEMO_TEAM_IDS.sprint4, DEMO_HACKATHON_IDS.sprint, "Null Terminators", "NULLT004", "ready", t(-47)),
    mk(DEMO_TEAM_IDS.jam1, DEMO_HACKATHON_IDS.jam, "Jammin' Devs", "JAMMIN01", "submitted", t(-40)),
    mk(DEMO_TEAM_IDS.jam2, DEMO_HACKATHON_IDS.jam, "Pitch Perfect", "PITCH002", "submitted", t(-39)),
    mk(DEMO_TEAM_IDS.jam3, DEMO_HACKATHON_IDS.jam, "Loop Breakers", "LOOPBR03", "submitted", t(-38)),
    mk(DEMO_TEAM_IDS.archive1, DEMO_HACKATHON_IDS.archive, "Frost Bytes", "FROSTB01", "submitted", t(-89)),
    mk(DEMO_TEAM_IDS.archive2, DEMO_HACKATHON_IDS.archive, "Winterfell Coders", "WINTERF2", "submitted", t(-88)),
  ];
}

function buildTeamMembers(): TeamMemberRecord[] {
  const mk = (id: string, team_id: string, user_id: string, role: TeamMemberRecord["role"], at: string): TeamMemberRecord => ({
    id, team_id, user_id, role, joined_at: at,
  });
  return [
    mk("81111111-1111-4111-8111-111111111111", DEMO_TEAM_IDS.sprint1, DEMO_IDS.p1, "leader", t(-50)),
    mk("81111111-2222-4111-8111-111111111111", DEMO_TEAM_IDS.sprint1, DEMO_IDS.p2, "member", t(-49)),
    mk("81111111-3333-4111-8111-111111111111", DEMO_TEAM_IDS.sprint2, DEMO_IDS.p3, "leader", t(-49)),
    mk("81111111-4444-4111-8111-111111111111", DEMO_TEAM_IDS.sprint2, DEMO_IDS.p4, "member", t(-48)),
    mk("81111111-5555-4111-8111-111111111111", DEMO_TEAM_IDS.sprint3, DEMO_IDS.p5, "leader", t(-48)),
    mk("81111111-6666-4111-8111-111111111111", DEMO_TEAM_IDS.sprint3, DEMO_IDS.p6, "member", t(-47)),
    mk("81111111-7777-4111-8111-111111111111", DEMO_TEAM_IDS.sprint4, DEMO_IDS.p7, "leader", t(-47)),
    mk("81111111-8888-4111-8111-111111111111", DEMO_TEAM_IDS.sprint4, DEMO_IDS.p8, "member", t(-46)),
    mk("81111111-9999-4111-8111-111111111111", DEMO_TEAM_IDS.jam1, DEMO_IDS.p1, "leader", t(-40)),
    mk("82111111-1111-4111-8111-111111111111", DEMO_TEAM_IDS.jam1, DEMO_IDS.p2, "member", t(-39)),
    mk("82111111-2222-4111-8111-111111111111", DEMO_TEAM_IDS.jam2, DEMO_IDS.p3, "leader", t(-39)),
    mk("82111111-3333-4111-8111-111111111111", DEMO_TEAM_IDS.jam2, DEMO_IDS.p5, "member", t(-38)),
    mk("82111111-4444-4111-8111-111111111111", DEMO_TEAM_IDS.jam3, DEMO_IDS.p4, "leader", t(-38)),
    mk("82111111-5555-4111-8111-111111111111", DEMO_TEAM_IDS.jam3, DEMO_IDS.p6, "member", t(-37)),
    mk("82111111-6666-4111-8111-111111111111", DEMO_TEAM_IDS.archive1, DEMO_IDS.p8, "leader", t(-89)),
    mk("82111111-7777-4111-8111-111111111111", DEMO_TEAM_IDS.archive1, DEMO_IDS.p7, "member", t(-88)),
    mk("82111111-8888-4111-8111-111111111111", DEMO_TEAM_IDS.archive2, DEMO_IDS.p2, "leader", t(-88)),
    mk("82111111-9999-4111-8111-111111111111", DEMO_TEAM_IDS.archive2, DEMO_IDS.p3, "member", t(-87)),
  ];
}

function buildTeamRepos(): TeamRepoRecord[] {
  const mk = (id: string, team_id: string, repo_full_name: string, at: string): TeamRepoRecord => ({
    id, team_id, repo_full_name,
    repo_url: `https://github.com/${repo_full_name}`,
    linked_at: at,
  });
  return [
    mk("83111111-1111-4111-8111-111111111111", DEMO_TEAM_IDS.sprint1, "alpha-coders/sprint-app", t(-45)),
    mk("83111111-2222-4111-8111-111111111111", DEMO_TEAM_IDS.sprint2, "byte-brigade/hack-2026", t(-44)),
    mk("83111111-3333-4111-8111-111111111111", DEMO_TEAM_IDS.sprint3, "syntax-squad/portfolio", t(-43)),
    mk("83111111-4444-4111-8111-111111111111", DEMO_TEAM_IDS.sprint4, "null-terminators/ctf-tool", t(-42)),
    mk("83111111-5555-4111-8111-111111111111", DEMO_TEAM_IDS.jam1, "jammin-devs/weekend-jam", t(-35)),
    mk("83111111-6666-4111-8111-111111111111", DEMO_TEAM_IDS.jam2, "pitch-perfect/pitchdeck", t(-34)),
    mk("83111111-7777-4111-8111-111111111111", DEMO_TEAM_IDS.jam3, "loop-breakers/loop", t(-33)),
    mk("83111111-8888-4111-8111-111111111111", DEMO_TEAM_IDS.archive1, "frost-bytes/frost", t(-85)),
    mk("83111111-9999-4111-8111-111111111111", DEMO_TEAM_IDS.archive2, "winterfell/winter", t(-84)),
  ];
}

function buildSubmissions(): SubmissionRecord[] {
  const mk = (id: string, hackathon_id: string, team_id: string, round_id: string | null, tag: string, sha: string, at: string, isCurrent: number): SubmissionRecord => ({
    id, hackathon_id, team_id, round_id, tag_name: tag, commit_sha: sha,
    submitted_at: at, status: "validated", validated_at: at, is_current: isCurrent, created_at: at,
  });
  return [
    // CodeSprint (active) — round 1 submissions
    mk("84111111-1111-4111-8111-111111111111", DEMO_HACKATHON_IDS.sprint, DEMO_TEAM_IDS.sprint1, DEMO_ROUND_IDS.sprintR1, "submission_v1", "a1b2c3d4e5f60718293a4b5c6d7e8f90", t(-3, 4), 1),
    mk("84111111-2222-4111-8111-111111111111", DEMO_HACKATHON_IDS.sprint, DEMO_TEAM_IDS.sprint2, DEMO_ROUND_IDS.sprintR1, "submission_v1", "b2c3d4e5f60718293a4b5c6d7e8f90a1", t(-3, 5), 1),
    mk("84111111-3333-4111-8111-111111111111", DEMO_HACKATHON_IDS.sprint, DEMO_TEAM_IDS.sprint3, DEMO_ROUND_IDS.sprintR1, "submission_v1", "c3d4e5f60718293a4b5c6d7e8f90a1b2", t(-3, 6), 1),
    mk("84111111-4444-4111-8111-111111111111", DEMO_HACKATHON_IDS.sprint, DEMO_TEAM_IDS.sprint4, DEMO_ROUND_IDS.sprintR1, "submission_v1", "d4e5f60718293a4b5c6d7e8f90a1b2c3", t(-3, 7), 1),
    // Weekend Jam — round 1 (superseded) + round 2 (current)
    mk("84111111-5555-4111-8111-111111111111", DEMO_HACKATHON_IDS.jam, DEMO_TEAM_IDS.jam1, DEMO_ROUND_IDS.jamR1, "submission_v1", "e5f60718293a4b5c6d7e8f90a1b2c3d4", t(-3, 9), 0),
    mk("84111111-6666-4111-8111-111111111111", DEMO_HACKATHON_IDS.jam, DEMO_TEAM_IDS.jam2, DEMO_ROUND_IDS.jamR1, "submission_v1", "f60718293a4b5c6d7e8f90a1b2c3d4e5", t(-3, 10), 0),
    mk("84111111-7777-4111-8111-111111111111", DEMO_HACKATHON_IDS.jam, DEMO_TEAM_IDS.jam3, DEMO_ROUND_IDS.jamR1, "submission_v1", "0718293a4b5c6d7e8f90a1b2c3d4e5f6", t(-3, 11), 0),
    mk("84111111-8888-4111-8111-111111111111", DEMO_HACKATHON_IDS.jam, DEMO_TEAM_IDS.jam1, DEMO_ROUND_IDS.jamR2, "submission_v2", "18293a4b5c6d7e8f90a1b2c3d4e5f6071", t(-1, 9), 1),
    mk("84111111-9999-4111-8111-111111111111", DEMO_HACKATHON_IDS.jam, DEMO_TEAM_IDS.jam2, DEMO_ROUND_IDS.jamR2, "submission_v2", "293a4b5c6d7e8f90a1b2c3d4e5f607182", t(-1, 10), 1),
    mk("85111111-1111-4111-8111-111111111111", DEMO_HACKATHON_IDS.jam, DEMO_TEAM_IDS.jam3, DEMO_ROUND_IDS.jamR2, "submission_v2", "3a4b5c6d7e8f90a1b2c3d4e5f60718293", t(-1, 11), 1),
    // Winter Code Challenge — both rounds
    mk("85111111-2222-4111-8111-111111111111", DEMO_HACKATHON_IDS.archive, DEMO_TEAM_IDS.archive1, DEMO_ROUND_IDS.archiveR1, "submission_v1", "4b5c6d7e8f90a1b2c3d4e5f60718293a4", t(-85, 9), 0),
    mk("85111111-3333-4111-8111-111111111111", DEMO_HACKATHON_IDS.archive, DEMO_TEAM_IDS.archive2, DEMO_ROUND_IDS.archiveR1, "submission_v1", "5c6d7e8f90a1b2c3d4e5f60718293a4b", t(-85, 10), 0),
    mk("85111111-4444-4111-8111-111111111111", DEMO_HACKATHON_IDS.archive, DEMO_TEAM_IDS.archive1, DEMO_ROUND_IDS.archiveR2, "submission_v2", "6d7e8f90a1b2c3d4e5f60718293a4b5c", t(-82, 9), 1),
    mk("85111111-5555-4111-8111-111111111111", DEMO_HACKATHON_IDS.archive, DEMO_TEAM_IDS.archive2, DEMO_ROUND_IDS.archiveR2, "submission_v2", "7e8f90a1b2c3d4e5f60718293a4b5c6d", t(-82, 10), 1),
  ];
}

function buildRounds(): RoundRecord[] {
  const mk = (id: string, hackathon_id: string, name: string, round_number: number, status: RoundRecord["status"], deadline: string | null, isElimination: number, sort_order: number, at: string): RoundRecord => ({
    id, hackathon_id, name, description: null, round_number, status, submission_deadline: deadline,
    is_elimination: isElimination, sort_order, created_at: at, updated_at: at,
  });
  return [
    mk(DEMO_ROUND_IDS.sprintR1, DEMO_HACKATHON_IDS.sprint, "Submission Round", 1, "published", t(0, 18), 0, 0, t(-14)),
    mk(DEMO_ROUND_IDS.jamR1, DEMO_HACKATHON_IDS.jam, "Round 1", 1, "results", t(-2, 18), 0, 0, t(-20)),
    mk(DEMO_ROUND_IDS.jamR2, DEMO_HACKATHON_IDS.jam, "Round 2 — Finals", 2, "published", t(2, 18), 1, 1, t(-10)),
    mk(DEMO_ROUND_IDS.archiveR1, DEMO_HACKATHON_IDS.archive, "Round 1", 1, "completed", t(-88, 18), 0, 0, t(-95)),
    mk(DEMO_ROUND_IDS.archiveR2, DEMO_HACKATHON_IDS.archive, "Round 2 — Finals", 2, "completed", t(-84, 18), 1, 1, t(-90)),
  ];
}

function buildRoundResults(): RoundResultRecord[] {
  const mk = (id: string, round_id: string, team_id: string, rank: number, total_score: number, advanced: number, at: string): RoundResultRecord => ({
    id, round_id, team_id, rank, total_score, advanced, created_at: at,
  });
  return [
    // Weekend Jam round 1 results are computed from seeded scores in
    // buildJamRound1Scoring (normalized weighted totals, matching
    // computeLeaderboard). Archive results are stored as-published.
    mk("86111111-4444-4111-8111-111111111111", DEMO_ROUND_IDS.archiveR1, DEMO_TEAM_IDS.archive1, 1, 85, 1, t(-84, 8)),
    mk("86111111-5555-4111-8111-111111111111", DEMO_ROUND_IDS.archiveR1, DEMO_TEAM_IDS.archive2, 2, 78, 1, t(-84, 8)),
    mk("86111111-6666-4111-8111-111111111111", DEMO_ROUND_IDS.archiveR2, DEMO_TEAM_IDS.archive1, 1, 88, 1, t(-80, 8)),
    mk("86111111-7777-4111-8111-111111111111", DEMO_ROUND_IDS.archiveR2, DEMO_TEAM_IDS.archive2, 2, 80, 1, t(-80, 8)),
  ];
}

function buildRubrics(): RubricCriterionRecord[] {
  const mk = (id: string, hackathon_id: string, name: string, max_score: number, weight: number, sort_order: number, at: string): RubricCriterionRecord => ({
    id, hackathon_id, name, description: null, max_score, weight, track_id: null, sort_order, created_at: at,
  });
  return [
    mk(DEMO_CRITERIA_IDS.jamC1, DEMO_HACKATHON_IDS.jam, "Innovation", 10, 0.3, 0, t(-30)),
    mk(DEMO_CRITERIA_IDS.jamC2, DEMO_HACKATHON_IDS.jam, "Technical Execution", 10, 0.3, 1, t(-30)),
    mk(DEMO_CRITERIA_IDS.jamC3, DEMO_HACKATHON_IDS.jam, "Presentation", 5, 0.2, 2, t(-30)),
    mk(DEMO_CRITERIA_IDS.jamC4, DEMO_HACKATHON_IDS.jam, "Impact", 5, 0.2, 3, t(-30)),
    mk(DEMO_CRITERIA_IDS.sprintC1, DEMO_HACKATHON_IDS.sprint, "Code Quality", 10, 0.4, 0, t(-25)),
    mk(DEMO_CRITERIA_IDS.sprintC2, DEMO_HACKATHON_IDS.sprint, "Innovation", 10, 0.3, 1, t(-25)),
    mk(DEMO_CRITERIA_IDS.sprintC3, DEMO_HACKATHON_IDS.sprint, "Demo Quality", 5, 0.3, 2, t(-25)),
  ];
}

function buildJudges(): JudgeRecord[] {
  const mk = (id: string, hackathon_id: string, user_id: string, status: JudgeRecord["status"], invited: string, accepted: string | null): JudgeRecord => ({
    id, hackathon_id, user_id, status, invited_at: invited, accepted_at: accepted,
  });
  return [
    mk(DEMO_JUDGE_IDS.j1, DEMO_HACKATHON_IDS.jam, DEMO_IDS.judge1, "accepted", t(-30), t(-29)),
    mk(DEMO_JUDGE_IDS.j2, DEMO_HACKATHON_IDS.jam, DEMO_IDS.judge2, "accepted", t(-29), t(-28)),
    mk(DEMO_JUDGE_IDS.j3, DEMO_HACKATHON_IDS.jam, DEMO_IDS.judge3, "pending", t(-3), null),
    mk(DEMO_JUDGE_IDS.j4, DEMO_HACKATHON_IDS.sprint, DEMO_IDS.judge1, "accepted", t(-28), t(-27)),
  ];
}

/**
 * Deterministic score matrix for Weekend Jam round 1 (j1 + j2 per team).
 * Returns { assignments, scores, results }.
 */
function buildJamRound1Scoring() {
  const criteria = [DEMO_CRITERIA_IDS.jamC1, DEMO_CRITERIA_IDS.jamC2, DEMO_CRITERIA_IDS.jamC3, DEMO_CRITERIA_IDS.jamC4];
  const matrix: Record<string, { j1: number[]; j2: number[] }> = {
    [DEMO_TEAM_IDS.jam1]: { j1: [9, 9, 5, 4], j2: [8, 9, 4, 5] },
    [DEMO_TEAM_IDS.jam2]: { j1: [8, 8, 4, 4], j2: [8, 7, 4, 4] },
    [DEMO_TEAM_IDS.jam3]: { j1: [7, 7, 4, 3], j2: [7, 8, 3, 4] },
  };
  const submissions: Record<string, string> = {
    [DEMO_TEAM_IDS.jam1]: "84111111-5555-4111-8111-111111111111",
    [DEMO_TEAM_IDS.jam2]: "84111111-6666-4111-8111-111111111111",
    [DEMO_TEAM_IDS.jam3]: "84111111-7777-4111-8111-111111111111",
  };

  const assignments: JudgeAssignmentRecord[] = [];
  const scores: ScoreRecord[] = [];
  const results: RoundResultRecord[] = [];
  let seq = 0;

  for (const [teamId, rows] of Object.entries(matrix)) {
    const teamTotals: number[] = [];
    for (const [judgeIdx, judgeId] of [DEMO_JUDGE_IDS.j1, DEMO_JUDGE_IDS.j2].entries()) {
      const key = `${judgeIdx === 0 ? "j1" : "j2"}`;
      const assignmentId = `87111111-${String(seq + 1).padStart(4, "0")}-4111-8111-111111111111`;
      seq += 1;
      assignments.push({
        id: assignmentId,
        hackathon_id: DEMO_HACKATHON_IDS.jam,
        judge_id: judgeId,
        team_id: teamId,
        submission_id: submissions[teamId],
        round: 1,
        status: "scored",
        assigned_at: t(-10),
        completed_at: t(-2, 9),
      });
      let total = 0;
      criteria.forEach((criterionId, ci) => {
        const score = rows[key as "j1" | "j2"][ci];
        total += score;
        scores.push({
          id: `87111111-${String(seq).padStart(4, "0")}-4111-8111-111111111111`,
          assignment_id: assignmentId,
          judge_id: judgeId,
          submission_id: submissions[teamId],
          criterion_id: criterionId,
          round: 1,
          score,
          comment: null,
          created_at: t(-2, 9),
          updated_at: t(-2, 9),
        });
        seq += 1;
      });
      teamTotals.push(total);
    }
    // Normalized weighted total, identical to computeLeaderboard:
    // Σ_c (avg_c / max_c) * weight_c * 100.
    const avg = (teamTotals[0] + teamTotals[1]) / 2;
    const normalized =
      ((avg / 10) * 0.3 + (avg / 10) * 0.3 + (avg / 5) * 0.2 + (avg / 5) * 0.2) * 100;
    results.push({
      id: `87111111-${String(seq).padStart(4, "0")}-4111-8111-111111111111`,
      round_id: DEMO_ROUND_IDS.jamR1,
      team_id: teamId,
      rank: 0,
      total_score: normalized,
      advanced: 1,
      created_at: t(-1, 8),
    });
    seq += 1;
  }

  // Assign ranks by descending total score.
  results.sort((a, b) => (b.total_score as number) - (a.total_score as number));
  results.forEach((r, i) => {
    r.rank = i + 1;
  });

  return { assignments, scores, results };
}

function buildRound2Scoring() {
  const criteria = [DEMO_CRITERIA_IDS.jamC1, DEMO_CRITERIA_IDS.jamC2, DEMO_CRITERIA_IDS.jamC3, DEMO_CRITERIA_IDS.jamC4];
  const submissions: Record<string, string> = {
    [DEMO_TEAM_IDS.jam1]: "84111111-8888-4111-8111-111111111111",
    [DEMO_TEAM_IDS.jam2]: "84111111-9999-4111-8111-111111111111",
    [DEMO_TEAM_IDS.jam3]: "85111111-1111-4111-8111-111111111111",
  };

  const assignments: JudgeAssignmentRecord[] = [];
  const scores: ScoreRecord[] = [];
  let seq = 0;

  const plan: Array<{
    team: string; judge: string; status: JudgeAssignmentRecord["status"];
    values: number[] | null; conflict?: boolean;
  }> = [
    { team: DEMO_TEAM_IDS.jam1, judge: DEMO_JUDGE_IDS.j1, status: "scored", values: [9, 9, 5, 4] },
    { team: DEMO_TEAM_IDS.jam2, judge: DEMO_JUDGE_IDS.j1, status: "pending", values: null },
    { team: DEMO_TEAM_IDS.jam3, judge: DEMO_JUDGE_IDS.j1, status: "pending", values: null },
    { team: DEMO_TEAM_IDS.jam1, judge: DEMO_JUDGE_IDS.j2, status: "scored", values: [8, 9, 4, 5] },
    { team: DEMO_TEAM_IDS.jam2, judge: DEMO_JUDGE_IDS.j2, status: "pending", values: null },
    { team: DEMO_TEAM_IDS.jam3, judge: DEMO_JUDGE_IDS.j2, status: "skipped", values: null, conflict: true },
  ];

  for (const item of plan) {
    seq += 1;
    const assignmentId = `88111111-${String(seq).padStart(4, "0")}-4111-8111-111111111111`;
    assignments.push({
      id: assignmentId,
      hackathon_id: DEMO_HACKATHON_IDS.jam,
      judge_id: item.judge,
      team_id: item.team,
      submission_id: submissions[item.team],
      round: 2,
      status: item.status,
      assigned_at: t(-5),
      completed_at: item.status === "scored" ? t(-1, 9) : null,
    });
    if (item.values) {
      criteria.forEach((criterionId, ci) => {
        seq += 1;
        scores.push({
          id: `88111111-${String(seq).padStart(4, "0")}-4111-8111-111111111111`,
          assignment_id: assignmentId,
          judge_id: item.judge,
          submission_id: submissions[item.team],
          criterion_id: criterionId,
          round: 2,
          score: item.values![ci],
          comment: ci === 0 ? "Strong submission, clear problem framing." : null,
          created_at: t(-1, 9),
          updated_at: t(-1, 9),
        });
      });
    }
  }

  return { assignments, scores };
}

function buildConflicts(): ConflictRecord[] {
  return [
    {
      id: "89111111-1111-4111-8111-111111111111",
      assignment_id: "88111111-0006-4111-8111-111111111111",
      judge_id: DEMO_JUDGE_IDS.j2,
      submission_id: "85111111-1111-4111-8111-111111111111",
      status: "declared",
      reason: "I co-founded Loop Breakers with the team lead.",
      declared_at: t(-4),
    },
  ];
}

function buildAnnouncements(): AnnouncementRecord[] {
  const mk = (id: string, hackathon_id: string, title: string, body: string | null, by: string, at: string): AnnouncementRecord => ({
    id, hackathon_id, title, body, created_by: by, created_at: at, updated_at: at,
  });
  return [
    mk("91111111-1111-4111-8111-111111111111", DEMO_HACKATHON_IDS.sprint, "Welcome to CodeSprint 2026", "Opening ceremony at 9:00 AM. Check the schedule tab.", DEMO_IDS.owner, t(-14)),
    mk("91111111-2222-4111-8111-111111111111", DEMO_HACKATHON_IDS.sprint, "Submission deadline extended", "Deadline moved to 6:00 PM to accommodate the power outage.", DEMO_IDS.coorg, t(-2)),
    mk("91111111-3333-4111-8111-111111111111", DEMO_HACKATHON_IDS.jam, "Judging starts Monday", "Round 2 judging begins at 10:00 AM. Scores due by 6:00 PM.", DEMO_IDS.owner, t(-3)),
    mk("91111111-4444-4111-8111-111111111111", DEMO_HACKATHON_IDS.archive, "Results announced", "Congratulations to Frost Bytes!", DEMO_IDS.owner, t(-80)),
  ];
}

function buildNotifications(): NotificationRecord[] {
  const mk = (id: string, user_id: string, type: string, title: string, body: string | null, link: string | null, isRead: number, at: string): NotificationRecord => ({
    id, user_id, type, title, body, link, is_read: isRead, read_at: isRead ? at : null, created_at: at,
  });
  return [
    mk("92111111-1111-4111-8111-111111111111", DEMO_IDS.admin, "hackathon_request", "New hackathon request", "DevOps Days was submitted for review.", "/admin/hackathon-requests", 0, t(-2)),
    mk("92111111-2222-4111-8111-111111111111", DEMO_IDS.owner, "hackathon_approved", "CodeSprint approved", "IEEE CodeSprint 2026 was approved and is being built.", "/platform/hackathons/code-sprint", 1, t(-55)),
    mk("92111111-3333-4111-8111-111111111111", DEMO_IDS.owner, "judge_invite", "Judge accepted", "Ananya Iyer accepted the judge invite for Weekend Jam.", "/platform/hackathons/weekend-jam/judging", 0, t(-29)),
    mk("92111111-4444-4111-8111-111111111111", DEMO_IDS.coorg, "announcement", "Announcement published", "Submission deadline extended.", "/platform/hackathons/code-sprint/announcements", 1, t(-2)),
    mk("92111111-5555-4111-8111-111111111111", DEMO_IDS.judge1, "assignment", "New assignment", "Round 2: Jammin' Devs was assigned to you.", "/judge/hackathons/weekend-jam", 0, t(-5)),
    mk("92111111-6666-4111-8111-111111111111", DEMO_IDS.judge1, "round", "Round 2 scores open", "Scores are open for Weekend Jam Round 2.", "/judge/hackathons/weekend-jam", 1, t(-4)),
    mk("92111111-7777-4111-8111-111111111111", DEMO_IDS.judge2, "coi", "Conflict acknowledged", "Your conflict on Loop Breakers was recorded.", "/judge/hackathons/weekend-jam", 1, t(-4)),
    mk("92111111-8888-4111-8111-111111111111", DEMO_IDS.p1, "submission", "Submission validated", "Your CodeSprint submission was validated.", "/platform/hackathons/code-sprint/teams", 1, t(-3)),
    mk("92111111-9999-4111-8111-111111111111", DEMO_IDS.p1, "deadline", "Round 2 deadline approaching", "Weekend Jam Round 2 closes in 2 days.", "/platform/hackathons/weekend-jam/teams", 0, t(-1)),
    mk("93111111-1111-4111-8111-111111111111", DEMO_IDS.p3, "team", "Team invite accepted", "Sneha Reddy joined Pitch Perfect.", "/platform/hackathons/weekend-jam/teams", 1, t(-30)),
  ];
}

function buildActivity(): ActivityRecord[] {
  const mk = (id: string, hackathon_id: string | null, actor_id: string | null, action: string, entity_type: string, entity_id: string, at: string, metadata: Record<string, unknown> | null = null): ActivityRecord => ({
    id, hackathon_id, actor_id, action, entity_type, entity_id, metadata, created_at: at,
  });
  return [
    mk("94111111-1111-4111-8111-111111111111", DEMO_HACKATHON_IDS.sprint, DEMO_IDS.owner, "hackathon.created", "hackathon", DEMO_HACKATHON_IDS.sprint, t(-60)),
    mk("94111111-2222-4111-8111-111111111111", DEMO_HACKATHON_IDS.sprint, DEMO_IDS.owner, "hackathon.transitioned", "hackathon", DEMO_HACKATHON_IDS.sprint, t(-10), { from: "draft", to: "active" }),
    mk("94111111-3333-4111-8111-111111111111", DEMO_HACKATHON_IDS.jam, DEMO_IDS.owner, "round.results_published", "round", DEMO_ROUND_IDS.jamR1, t(-1, 8)),
    mk("94111111-4444-4111-8111-111111111111", DEMO_HACKATHON_IDS.jam, null, "submission.validated", "submission", "85111111-1111-4111-8111-111111111111", t(-1, 9)),
    mk("94111111-5555-4111-8111-111111111111", DEMO_HACKATHON_IDS.jam, DEMO_IDS.owner, "judge.invited", "judge", DEMO_JUDGE_IDS.j3, t(-3)),
    mk("94111111-6666-4111-8111-111111111111", DEMO_HACKATHON_IDS.jam, DEMO_IDS.judge1, "score.submitted", "assignment", "88111111-0001-4111-8111-111111111111", t(-1, 9)),
    mk("94111111-7777-4111-8111-111111111111", DEMO_HACKATHON_IDS.jam, DEMO_IDS.judge2, "conflict.declared", "assignment", "88111111-0006-4111-8111-111111111111", t(-4)),
    mk("94111111-8888-4111-8111-111111111111", DEMO_HACKATHON_IDS.fest, DEMO_IDS.owner, "hackathon.created", "hackathon", DEMO_HACKATHON_IDS.fest, t(-5)),
    mk("94111111-9999-4111-8111-111111111111", null, DEMO_IDS.admin, "request.reviewed", "hackathon_request", "95111111-1111-4111-8111-111111111111", t(-50), { from: "under_review", to: "approved" }),
  ];
}

function buildInvites(): {
  workspaceInvites: WorkspaceInviteRecord[];
  teamInvites: TeamInviteRecord[];
  adminInvites: AdminInviteRecord[];
} {
  const workspaceInvites: WorkspaceInviteRecord[] = [
    {
      id: "96111111-1111-4111-8111-111111111111",
      token: DEMO_TOKENS.workspaceInvite,
      workspace_id: DEMO_WORKSPACE_IDS.ieee,
      email: "invitee@devsage.org",
      role: "member",
      status: "pending",
      created_by: DEMO_IDS.owner,
      created_at: t(-2),
      expires_at: t(28),
      accepted_at: null,
    },
  ];
  const teamInvites: TeamInviteRecord[] = [
    {
      id: "96111111-2222-4111-8111-111111111111",
      token: DEMO_TOKENS.teamInvite,
      team_id: DEMO_TEAM_IDS.sprint1,
      email: "invitee@devsage.org",
      status: "pending",
      created_by: DEMO_IDS.p1,
      created_at: t(-2),
      expires_at: t(28),
    },
  ];
  const adminInvites: AdminInviteRecord[] = [
    {
      id: "96111111-3333-4111-8111-111111111111",
      email: "newadmin@devsage.org",
      token: DEMO_TOKENS.adminInvite,
      status: "pending",
      invited_by: DEMO_IDS.admin,
      created_at: t(-3),
      expires_at: t(27),
    },
  ];
  return { workspaceInvites, teamInvites, adminInvites };
}

function buildHackathonRequests(): HackathonRequestRecord[] {
  const mk = (id: string, workspace_id: string | null, requested_by: string, title: string, slug: string, status: HackathonRequestRecord["status"], created: string, review: { notes: string | null; by: string | null; at: string | null }): HackathonRequestRecord => ({
    id, workspace_id, requested_by, title, description: `${title} demo description.`,
    slug, status, review_notes: review.notes, reviewed_by: review.by, reviewed_at: review.at,
    starts_at: null, ends_at: null, num_events: null, expected_participants: null,
    team_min_size: null, team_max_size: null, additional_details: null,
    created_at: created, updated_at: review.at ?? created,
  });
  return [
    mk("95111111-1111-4111-8111-111111111111", DEMO_WORKSPACE_IDS.ieee, DEMO_IDS.owner, "DevOps Days", "devops-days", "under_review", t(-2), { notes: null, by: null, at: null }),
    mk("95111111-2222-4111-8111-111111111111", DEMO_WORKSPACE_IDS.ieee, DEMO_IDS.coorg, "Women in Tech Summit", "women-in-tech", "submitted", t(-1), { notes: null, by: null, at: null }),
    mk("95111111-3333-4111-8111-111111111111", DEMO_WORKSPACE_IDS.jam, DEMO_IDS.owner, "Game Jam Nights", "game-jam-nights", "submitted", t(-0, 6), { notes: null, by: null, at: null }),
    mk("95111111-4444-4111-8111-111111111111", DEMO_WORKSPACE_IDS.ieee, DEMO_IDS.owner, "Blockchain Basics", "blockchain-basics", "rejected", t(-30), { notes: "Scope too small for a full hackathon.", by: DEMO_IDS.admin, at: t(-28) }),
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function wipeDomainTables(): Promise<void> {
  await db.transaction("rw", DOMAIN_TABLES, async () => {
    await Promise.all(DOMAIN_TABLES.map((table) => db.table(table).clear()));
  });
}

async function writeSeed(): Promise<void> {
  const users = await buildUsers();
  const r1 = buildJamRound1Scoring();
  const r2 = buildRound2Scoring();
  const invites = buildInvites();

  await db.transaction(
    "rw",
    DOMAIN_TABLES,
    async () => {
      await Promise.all([
        db.users.bulkAdd(users),
        db.workspaces.bulkAdd(buildWorkspaces()),
        db.workspaceMembers.bulkAdd(buildWorkspaceMembers()),
        db.roles.bulkAdd(buildRoles()),
        db.hackathons.bulkAdd(buildHackathons()),
        db.teams.bulkAdd(buildTeams()),
        db.teamMembers.bulkAdd(buildTeamMembers()),
        db.teamRepos.bulkAdd(buildTeamRepos()),
        db.submissions.bulkAdd(buildSubmissions()),
        db.rounds.bulkAdd(buildRounds()),
        db.roundResults.bulkAdd([...buildRoundResults(), ...r1.results]),
        db.rubrics.bulkAdd(buildRubrics()),
        db.judges.bulkAdd(buildJudges()),
        db.judgeAssignments.bulkAdd([...r1.assignments, ...r2.assignments]),
        db.scores.bulkAdd([...r1.scores, ...r2.scores]),
        db.conflicts.bulkAdd(buildConflicts()),
        db.announcements.bulkAdd(buildAnnouncements()),
        db.notifications.bulkAdd(buildNotifications()),
        db.activity.bulkAdd(buildActivity()),
        db.workspaceInvites.bulkAdd(invites.workspaceInvites),
        db.teamInvites.bulkAdd(invites.teamInvites),
        db.adminInvites.bulkAdd(invites.adminInvites),
        db.hackathonRequests.bulkAdd(buildHackathonRequests()),
      ]);
    },
  );

  await db.meta.bulkPut([
    { key: META_KEYS.schemaVersion, value: SCHEMA_VERSION, updated_at: now() },
    { key: META_KEYS.seedVersion, value: SEED_VERSION, updated_at: now() },
    { key: META_KEYS.lastSeededAt, value: SEED_TIMESTAMP, updated_at: now() },
  ]);
}

export interface SeedStatus {
  seeded: boolean;
  seed_version: string;
  schema_version: number;
  last_seeded_at: string | null;
}

/**
 * Seed the database if the stored seed version is older than SEED_VERSION.
 * Does not wipe data when the seed is already up to date.
 */
export async function seedIfNeeded(): Promise<SeedStatus> {
  const storedVersion = (await db.meta.get(META_KEYS.seedVersion))?.value;
  const lastSeeded = (await db.meta.get(META_KEYS.lastSeededAt))?.value;

  if (typeof storedVersion === "string" && storedVersion === SEED_VERSION) {
    return {
      seeded: false,
      seed_version: SEED_VERSION,
      schema_version: SCHEMA_VERSION,
      last_seeded_at: typeof lastSeeded === "string" ? lastSeeded : null,
    };
  }

  // Older or missing seed: wipe seeded domain data and reseed deterministically.
  await wipeDomainTables();
  await writeSeed();

  return {
    seeded: true,
    seed_version: SEED_VERSION,
    schema_version: SCHEMA_VERSION,
    last_seeded_at: SEED_TIMESTAMP,
  };
}

/** Always clear and reseed the demo world. */
export async function resetDemoData(): Promise<SeedStatus> {
  await wipeDomainTables();
  await writeSeed();
  return {
    seeded: true,
    seed_version: SEED_VERSION,
    schema_version: SCHEMA_VERSION,
    last_seeded_at: SEED_TIMESTAMP,
  };
}

/** Clear all local data including meta. Use with care. */
export async function clearAllData(): Promise<void> {
  await wipeDomainTables();
  await db.meta.clear();
  try {
    localStorage.removeItem("devsage.active_session_id");
  } catch {
    // localStorage may be unavailable; IndexedDB state is still cleared.
  }
}