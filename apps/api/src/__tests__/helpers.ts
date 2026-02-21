/**
 * Shared test helpers for v3 schema tests.
 * Uses Bearer token auth via JWT verification.
 */
import { env as rawEnv } from 'cloudflare:test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = rawEnv as any;
export { env };

export const JWT_SECRET = 'dev-secret-key-min-32-chars-long!!';
const now = new Date().toISOString();

// ── Inline JWT signing (Web Crypto API) ──────────────────────
function base64urlEncode(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = base64urlEncode(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: nowSec, exp: nowSec + 900 };
  const body = base64urlEncode(encoder.encode(JSON.stringify(fullPayload)));
  const signingInput = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput)));
  return `${signingInput}.${base64urlEncode(sig)}`;
}

// ── Seed account IDs ──────────────────────────────────────────
export const SEED = {
  srijan:       { id: 'seed-0000-0000-0000-000000000001', email: 'srijan.guchhait@gmail.com', name: 'Srijan Guchhait' },
  admin:        { id: 'seed-0000-0000-0000-000000000002', email: 'admin@devsage.org',          name: 'Platform Admin' },
  organizer:    { id: 'seed-0000-0000-0000-000000000003', email: 'organizer@devsage.org',      name: 'Test Organizer' },
  coOrganizer:  { id: 'seed-0000-0000-0000-000000000004', email: 'coorganizer@devsage.org',    name: 'Test Co-Organizer' },
  judge:        { id: 'seed-0000-0000-0000-000000000005', email: 'judge@devsage.org',          name: 'Test Judge' },
  lead:         { id: 'seed-0000-0000-0000-000000000006', email: 'lead@devsage.org',           name: 'Test Team Lead' },
  participant:  { id: 'seed-0000-0000-0000-000000000007', email: 'participant@devsage.org',    name: 'Test Participant' },
  workspace:    'ws-seed-0000-0000-000000000001',
  hackathon:    'seed-hack-0000-0000-000000000001',
  hackathonSlug:'seed-hack001',
  round:        'round-seed-0000-0000-000000000001',
  team:         'team-seed-0000-0000-000000000001',
} as const;

// ── Auth helpers ──────────────────────────────────────────────
/**
 * Returns a Bearer token string for use in Authorization headers.
 * The JWT payload matches the new UserContext shape expected by the API middleware.
 * Pass optional overrides to set platformAdmin, hackathonRoles, or workspaceRoles.
 */
export async function authCookie(
  userId: string,
  overrides?: {
    platformAdmin?: boolean;
    hackathonRoles?: Record<string, string[]>;
    workspaceRoles?: Record<string, string>;
  },
): Promise<string> {
  // Look up seed user info for richer JWT payload
  const seedUsers = [SEED.srijan, SEED.admin, SEED.organizer, SEED.coOrganizer, SEED.judge, SEED.lead, SEED.participant];
  const seedUser = seedUsers.find((u) => u.id === userId);

  const token = await signJWT(
    {
      sub: userId,
      email: seedUser?.email ?? `${userId}@test.local`,
      name: seedUser?.name ?? 'Test User',
      image: null,
      platformAdmin: overrides?.platformAdmin ?? false,
      hackathonRoles: overrides?.hackathonRoles ?? {},
      workspaceRoles: overrides?.workspaceRoles ?? {},
    },
    JWT_SECRET,
  );
  return `Bearer ${token}`;
}

// ── Schema bootstrapping ──────────────────────────────────────
// Creates all v3 tables needed for tests (subset — only what routes actually query)
export async function ensureSchema() {
  const statements = [
    // user (Better Auth)
    `CREATE TABLE IF NOT EXISTS user (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      email text NOT NULL,
      email_verified integer NOT NULL DEFAULT 0,
      image text,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique ON user (email)`,

    // users (custom auth)
    `CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY NOT NULL,
      email text NOT NULL,
      name text,
      display_name text,
      password_hash text,
      github_id integer,
      github_username text,
      google_id text,
      avatar_url text,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      last_login_at text
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)`,

    // account (Better Auth)
    `CREATE TABLE IF NOT EXISTS account (
      id text PRIMARY KEY NOT NULL,
      account_id text NOT NULL,
      provider_id text NOT NULL,
      user_id text NOT NULL,
      access_token text,
      refresh_token text,
      id_token text,
      access_token_expires_at integer,
      refresh_token_expires_at integer,
      scope text,
      password text,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id)
    )`,

    // session (Better Auth)
    `CREATE TABLE IF NOT EXISTS session (
      id text PRIMARY KEY NOT NULL,
      expires_at integer NOT NULL,
      token text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      ip_address text,
      user_agent text,
      user_id text NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS session_token_unique ON session (token)`,

    // platform_admins
    `CREATE TABLE IF NOT EXISTS platform_admins (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      role text DEFAULT 'platform_admin' NOT NULL,
      created_by text,
      created_at text NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS platform_admins_user_id_unique ON platform_admins (user_id)`,

    // workspaces
    `CREATE TABLE IF NOT EXISTS workspaces (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      slug text NOT NULL,
      description text,
      type text NOT NULL,
      created_by text,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (created_by) REFERENCES user(id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS workspaces_slug_unique ON workspaces (slug)`,

    // workspace_members
    `CREATE TABLE IF NOT EXISTS workspace_members (
      id text PRIMARY KEY NOT NULL,
      workspace_id text NOT NULL,
      user_id text NOT NULL,
      role text NOT NULL,
      invited_by text,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES user(id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_ws_user_idx ON workspace_members (workspace_id, user_id)`,

    // workspace_invites
    `CREATE TABLE IF NOT EXISTS workspace_invites (
      id text PRIMARY KEY NOT NULL,
      workspace_id text NOT NULL,
      email text NOT NULL,
      role text NOT NULL,
      invite_token text NOT NULL,
      invited_by text,
      status text DEFAULT 'pending' NOT NULL,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      expires_at text NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS workspace_invites_token_unique ON workspace_invites (invite_token)`,

    // hackathons
    `CREATE TABLE IF NOT EXISTS hackathons (
      id text PRIMARY KEY NOT NULL,
      workspace_id text NOT NULL,
      slug text NOT NULL,
      title text NOT NULL,
      tagline text,
      description text,
      rules_md text,
      status text DEFAULT 'draft' NOT NULL,
      starts_at text,
      judging_starts text,
      judging_ends text,
      min_team_size integer DEFAULT 1 NOT NULL,
      max_team_size integer DEFAULT 5 NOT NULL,
      max_teams integer,
      submission_tag_pattern text DEFAULT 'submission_v%' NOT NULL,
      allow_resubmission integer DEFAULT 0 NOT NULL,
      allow_registration_during_active integer DEFAULT 0 NOT NULL,
      notify_all_on_deadline integer DEFAULT 0 NOT NULL,
      show_judge_comments_to_participants integer DEFAULT 0 NOT NULL,
      registration_mode text DEFAULT 'open' NOT NULL,
      allowed_email_domains text DEFAULT '[]' NOT NULL,
      require_repo integer DEFAULT 1 NOT NULL,
      timezone text DEFAULT 'UTC' NOT NULL,
      template_id text,
      tracks text DEFAULT '[]' NOT NULL,
      prizes text DEFAULT '[]' NOT NULL,
      settings text DEFAULT '{}' NOT NULL,
      created_by text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (created_by) REFERENCES user(id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS hackathons_slug_unique ON hackathons (slug)`,

    // hackathon_rounds
    `CREATE TABLE IF NOT EXISTS hackathon_rounds (
      id text PRIMARY KEY NOT NULL,
      hackathon_id text NOT NULL,
      round_number integer DEFAULT 1 NOT NULL,
      name text NOT NULL,
      type text DEFAULT 'standard' NOT NULL,
      status text DEFAULT 'upcoming' NOT NULL,
      submission_deadline text,
      started_at text,
      completed_at text,
      is_initialized integer DEFAULT 0 NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE
    )`,

    // organizer_roles
    `CREATE TABLE IF NOT EXISTS organizer_roles (
      id text PRIMARY KEY NOT NULL,
      hackathon_id text NOT NULL,
      user_id text NOT NULL,
      role text NOT NULL,
      invited_by text,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES user(id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS organizer_roles_hackathon_id_user_id_unique ON organizer_roles (hackathon_id, user_id)`,

    // teams
    `CREATE TABLE IF NOT EXISTS teams (
      id text PRIMARY KEY NOT NULL,
      hackathon_id text NOT NULL,
      name text NOT NULL,
      description text DEFAULT '' NOT NULL,
      invite_code text,
      track_id text,
      ready integer DEFAULT 0 NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS teams_invite_code_unique ON teams (invite_code)`,

    // team_members
    `CREATE TABLE IF NOT EXISTS team_members (
      id text PRIMARY KEY NOT NULL,
      team_id text NOT NULL,
      user_id text NOT NULL,
      role text DEFAULT 'member' NOT NULL,
      joined_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES user(id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_id_user_id_unique ON team_members (team_id, user_id)`,

    // team_invites
    `CREATE TABLE IF NOT EXISTS team_invites (
      id text PRIMARY KEY NOT NULL,
      team_id text NOT NULL,
      email text NOT NULL,
      invite_token text NOT NULL,
      status text DEFAULT 'pending' NOT NULL,
      invited_by text NOT NULL,
      expires_at text NOT NULL,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )`,

    // team_repos
    `CREATE TABLE IF NOT EXISTS team_repos (
      id text PRIMARY KEY NOT NULL,
      team_id text NOT NULL,
      github_repo_url text NOT NULL,
      github_owner text NOT NULL,
      github_repo text NOT NULL,
      installation_id text,
      bot_active integer DEFAULT 0 NOT NULL,
      linked_by text NOT NULL,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )`,

    // judges
    `CREATE TABLE IF NOT EXISTS judges (
      id text PRIMARY KEY NOT NULL,
      hackathon_id text NOT NULL,
      user_id text NOT NULL,
      invite_status text DEFAULT 'pending' NOT NULL,
      track_id text,
      invited_by text NOT NULL,
      invited_at text NOT NULL,
      responded_at text,
      FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES user(id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS judges_hackathon_id_user_id_unique ON judges (hackathon_id, user_id)`,

    // rubric_criteria
    `CREATE TABLE IF NOT EXISTS rubric_criteria (
      id text PRIMARY KEY NOT NULL,
      hackathon_id text NOT NULL,
      track_id text,
      round integer DEFAULT 1 NOT NULL,
      name text NOT NULL,
      description text DEFAULT '' NOT NULL,
      max_score integer DEFAULT 10 NOT NULL,
      weight real DEFAULT 1 NOT NULL,
      sort_order integer DEFAULT 0 NOT NULL,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE
    )`,

    // submissions
    `CREATE TABLE IF NOT EXISTS submissions (
      id text PRIMARY KEY NOT NULL,
      team_id text NOT NULL,
      hackathon_id text NOT NULL,
      tag_name text NOT NULL,
      commit_sha text NOT NULL,
      commit_message text,
      commit_author text,
      branch text DEFAULT 'main',
      provider text DEFAULT 'github' NOT NULL,
      repo_full_name text NOT NULL,
      round_id text NOT NULL,
      status text DEFAULT 'received' NOT NULL,
      is_late integer DEFAULT 0 NOT NULL,
      is_final integer DEFAULT 0 NOT NULL,
      validation_results text,
      locked_at text,
      finalized_at text,
      submitted_at text NOT NULL,
      received_at text NOT NULL,
      webhook_delivery_id text,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS submissions_team_id_tag_name_unique ON submissions (team_id, tag_name)`,

    // judge_assignments
    `CREATE TABLE IF NOT EXISTS judge_assignments (
      id text PRIMARY KEY NOT NULL,
      hackathon_id text NOT NULL,
      judge_id text NOT NULL,
      team_id text NOT NULL,
      submission_id text,
      round integer DEFAULT 1 NOT NULL,
      status text DEFAULT 'pending' NOT NULL,
      assigned_at text NOT NULL,
      completed_at text,
      FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE,
      FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS judge_assignments_judge_id_team_id_round_unique ON judge_assignments (judge_id, team_id, round)`,

    // scores
    `CREATE TABLE IF NOT EXISTS scores (
      id text PRIMARY KEY NOT NULL,
      submission_id text NOT NULL,
      judge_id text NOT NULL,
      criteria_id text NOT NULL,
      assignment_id text NOT NULL,
      score integer NOT NULL,
      comment text,
      round integer DEFAULT 1 NOT NULL,
      scored_at text NOT NULL,
      FOREIGN KEY (submission_id) REFERENCES submissions(id),
      FOREIGN KEY (judge_id) REFERENCES judges(id),
      FOREIGN KEY (criteria_id) REFERENCES rubric_criteria(id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS scores_unique ON scores (submission_id, judge_id, criteria_id, round)`,

    // round_results
    `CREATE TABLE IF NOT EXISTS round_results (
      id text PRIMARY KEY NOT NULL,
      hackathon_id text NOT NULL,
      round_id text NOT NULL,
      team_id text NOT NULL,
      status text NOT NULL,
      rank integer,
      total_score real,
      decided_by text,
      created_at text NOT NULL,
      FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS round_results_round_team_idx ON round_results (round_id, team_id)`,

    // audit_events
    `CREATE TABLE IF NOT EXISTS audit_events (
      id text PRIMARY KEY NOT NULL,
      sequence integer NOT NULL,
      hackathon_id text,
      actor_id text,
      actor_type text NOT NULL,
      actor_ip text,
      actor_user_agent text,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      details text DEFAULT '{}' NOT NULL,
      changes text,
      hash text NOT NULL,
      prev_hash text,
      anonymized_at text,
      created_at text NOT NULL
    )`,

    // in_app_notifications
    `CREATE TABLE IF NOT EXISTS in_app_notifications (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      hackathon_id text,
      type text NOT NULL,
      title text NOT NULL,
      body text,
      link text,
      read_at text,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (user_id) REFERENCES user(id)
    )`,

    // notification_idempotency
    `CREATE TABLE IF NOT EXISTS notification_idempotency (
      id text PRIMARY KEY NOT NULL,
      idempotency_key text NOT NULL,
      created_at text NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS notification_idempotency_key_unique ON notification_idempotency (idempotency_key)`,

    // notification_deliveries
    `CREATE TABLE IF NOT EXISTS notification_deliveries (
      id text PRIMARY KEY NOT NULL,
      event_id text NOT NULL,
      user_id text NOT NULL,
      channel text NOT NULL,
      notification_type text NOT NULL,
      status text DEFAULT 'pending' NOT NULL,
      error_message text,
      attempts integer DEFAULT 0 NOT NULL,
      delivered_at text,
      created_at text NOT NULL
    )`,

    // webhook_deliveries
    `CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id text PRIMARY KEY NOT NULL,
      delivery_id text NOT NULL,
      hackathon_id text,
      team_repo_id text,
      event_type text NOT NULL,
      action text,
      payload_summary text,
      status text DEFAULT 'received' NOT NULL,
      error_message text,
      received_at text NOT NULL,
      processed_at text
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS webhook_deliveries_delivery_id_unique ON webhook_deliveries (delivery_id)`,

    // commit_log
    `CREATE TABLE IF NOT EXISTS commit_log (
      id text PRIMARY KEY NOT NULL,
      team_repo_id text NOT NULL,
      commit_sha text NOT NULL,
      message text,
      author_login text,
      author_email text,
      committed_at text,
      pushed_at text,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`,

    // force_push_events
    `CREATE TABLE IF NOT EXISTS force_push_events (
      id text PRIMARY KEY NOT NULL,
      team_repo_id text NOT NULL,
      before_sha text NOT NULL,
      after_sha text NOT NULL,
      ref text NOT NULL,
      pusher_login text NOT NULL,
      detected_at text NOT NULL,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`,

    // pending_installations
    `CREATE TABLE IF NOT EXISTS pending_installations (
      id text PRIMARY KEY NOT NULL,
      team_id text NOT NULL,
      github_owner text NOT NULL,
      github_repo text NOT NULL,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )`,

    // deletion_requests
    `CREATE TABLE IF NOT EXISTS deletion_requests (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      confirmation_token text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      confirmed_at text,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    )`,

    // hackathon_tracks
    `CREATE TABLE IF NOT EXISTS hackathon_tracks (
      id text PRIMARY KEY NOT NULL,
      hackathon_id text NOT NULL,
      name text NOT NULL,
      description text DEFAULT '' NOT NULL,
      color text,
      sort_order integer DEFAULT 0 NOT NULL,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`,

    // judge_tracks
    `CREATE TABLE IF NOT EXISTS judge_tracks (
      id text PRIMARY KEY NOT NULL,
      judge_id text NOT NULL,
      track_id text NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS judge_tracks_judge_track_idx ON judge_tracks (judge_id, track_id)`,

    // team_messages
    `CREATE TABLE IF NOT EXISTS team_messages (
      id text PRIMARY KEY NOT NULL,
      team_id text NOT NULL,
      user_id text NOT NULL,
      content text NOT NULL,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`,

    // hackathon_templates
    `CREATE TABLE IF NOT EXISTS hackathon_templates (
      id text PRIMARY KEY NOT NULL,
      workspace_id text,
      name text NOT NULL,
      description text DEFAULT '' NOT NULL,
      config_snapshot text NOT NULL DEFAULT '{}',
      rubric_snapshot text DEFAULT '[]' NOT NULL,
      created_by text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )`,
  ];

  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }
}

// ── Data reset ────────────────────────────────────────────────
export async function resetDb() {
  const tables = [
    'deletion_requests', 'notification_deliveries', 'notification_idempotency',
    'in_app_notifications', 'audit_events', 'round_results', 'scores',
    'judge_assignments', 'judge_tracks', 'rubric_criteria', 'judges',
    'force_push_events', 'commit_log', 'webhook_deliveries', 'submissions',
    'team_repos', 'pending_installations', 'team_invites', 'team_messages',
    'team_members', 'teams', 'organizer_roles', 'hackathon_rounds',
    'hackathons', 'hackathon_templates', 'workspace_invites',
    'workspace_members', 'workspaces', 'platform_admins', 'session', 'account', 'users', 'user',
  ];
  for (const table of tables) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
}

// ── Insert helpers ────────────────────────────────────────────

export async function insertUser(id: string, email: string, name: string = `User ${email}`) {
  const ts = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    'INSERT INTO user (id, email, name, email_verified, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)'
  ).bind(id, email, name, ts, ts).run();
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, display_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, email, name, name, now, now).run();
}

export async function insertWorkspace(id: string, slug: string, createdBy: string, name: string = 'Test Workspace') {
  await env.DB.prepare(
    `INSERT INTO workspaces (id, name, slug, type, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, name, slug, 'organization', createdBy, now, now).run();
}

export async function insertWorkspaceMember(workspaceId: string, userId: string, role: string = 'workspace_member') {
  await env.DB.prepare(
    `INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), workspaceId, userId, role, now).run();
}

export async function insertHackathon(params: {
  id: string;
  workspaceId: string;
  slug: string;
  createdBy: string;
  status?: string;
  title?: string;
}) {
  await env.DB.prepare(
    `INSERT INTO hackathons (id, workspace_id, slug, title, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    params.id, params.workspaceId, params.slug,
    params.title ?? 'Test Hackathon',
    params.status ?? 'draft',
    params.createdBy, now, now
  ).run();
}

export async function insertRound(params: {
  id: string;
  hackathonId: string;
  name?: string;
  roundNumber?: number;
  status?: string;
  submissionDeadline?: string;
}) {
  await env.DB.prepare(
    `INSERT INTO hackathon_rounds (id, hackathon_id, round_number, name, status, submission_deadline, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    params.id, params.hackathonId,
    params.roundNumber ?? 1,
    params.name ?? 'Round 1',
    params.status ?? 'active',
    params.submissionDeadline ?? null,
    now, now
  ).run();
}

export async function insertOrganizerRole(hackathonId: string, userId: string, role: string = 'organizer') {
  await env.DB.prepare(
    'INSERT INTO organizer_roles (id, hackathon_id, user_id, role) VALUES (?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), hackathonId, userId, role).run();
}

export async function insertPlatformAdmin(userId: string) {
  await env.DB.prepare(
    'INSERT INTO platform_admins (id, user_id, role, created_at) VALUES (?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), userId, 'platform_admin', now).run();
}

export async function insertTeam(params: {
  id: string;
  hackathonId: string;
  name: string;
  inviteCode?: string;
}) {
  await env.DB.prepare(
    `INSERT INTO teams (id, hackathon_id, name, invite_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(params.id, params.hackathonId, params.name, params.inviteCode ?? crypto.randomUUID().slice(0, 8), now, now).run();
}

export async function insertTeamMember(teamId: string, userId: string, role: string = 'member') {
  await env.DB.prepare(
    'INSERT INTO team_members (id, team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), teamId, userId, role, now).run();
}

export async function insertJudge(params: {
  id: string;
  hackathonId: string;
  userId: string;
  inviteStatus?: string;
  invitedBy: string;
}) {
  await env.DB.prepare(
    `INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_by, invited_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(params.id, params.hackathonId, params.userId, params.inviteStatus ?? 'pending', params.invitedBy, now).run();
}

export async function insertSubmission(params: {
  id: string;
  teamId: string;
  hackathonId: string;
  roundId: string;
  tagName?: string;
  commitSha?: string;
  repoFullName?: string;
  isFinal?: boolean;
}) {
  await env.DB.prepare(
    `INSERT INTO submissions (id, team_id, hackathon_id, round_id, tag_name, commit_sha, repo_full_name, is_final, submitted_at, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    params.id, params.teamId, params.hackathonId, params.roundId,
    params.tagName ?? 'submission_v1',
    params.commitSha ?? 'a'.repeat(40),
    params.repoFullName ?? 'test-org/test-repo',
    params.isFinal ? 1 : 0,
    now, now
  ).run();
}

export async function insertRubricCriterion(params: {
  id: string;
  hackathonId: string;
  name: string;
  maxScore?: number;
  weight?: number;
}) {
  await env.DB.prepare(
    `INSERT INTO rubric_criteria (id, hackathon_id, name, max_score, weight, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(params.id, params.hackathonId, params.name, params.maxScore ?? 10, params.weight ?? 1.0, now).run();
}

export async function insertJudgeAssignment(params: {
  id: string;
  hackathonId: string;
  judgeId: string;
  teamId: string;
  submissionId?: string;
}) {
  await env.DB.prepare(
    `INSERT INTO judge_assignments (id, hackathon_id, judge_id, team_id, submission_id, assigned_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(params.id, params.hackathonId, params.judgeId, params.teamId, params.submissionId ?? null, now).run();
}

export async function insertNotification(params: {
  id: string;
  userId: string;
  hackathonId?: string;
  type: string;
  title: string;
  body?: string;
  readAt?: string;
}) {
  await env.DB.prepare(
    `INSERT INTO in_app_notifications (id, user_id, hackathon_id, type, title, body, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(params.id, params.userId, params.hackathonId ?? null, params.type, params.title, params.body ?? '', params.readAt ?? null, now).run();
}

export async function insertTeamRepo(params: {
  id: string;
  teamId: string;
  owner: string;
  repo: string;
  linkedBy: string;
}) {
  await env.DB.prepare(
    `INSERT INTO team_repos (id, team_id, github_repo_url, github_owner, github_repo, linked_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(params.id, params.teamId, `https://github.com/${params.owner}/${params.repo}`, params.owner, params.repo, params.linkedBy).run();
}

// ── Seed the full test scenario ───────────────────────────────
// Creates users, workspace, hackathon, roles, team with all seeded data
export async function seedFullScenario() {
  // Users
  for (const key of ['srijan', 'admin', 'organizer', 'coOrganizer', 'judge', 'lead', 'participant'] as const) {
    const u = SEED[key];
    await insertUser(u.id, u.email, u.name);
  }

  // Platform admins
  await insertPlatformAdmin(SEED.srijan.id);
  await insertPlatformAdmin(SEED.admin.id);

  // Workspace
  await insertWorkspace(SEED.workspace, 'devsage', SEED.srijan.id, 'DevSage');
  await insertWorkspaceMember(SEED.workspace, SEED.srijan.id, 'owner');
  await insertWorkspaceMember(SEED.workspace, SEED.organizer.id, 'workspace_member');

  // Hackathon
  await insertHackathon({
    id: SEED.hackathon,
    workspaceId: SEED.workspace,
    slug: SEED.hackathonSlug,
    createdBy: SEED.organizer.id,
    status: 'active',
    title: 'Seed Hackathon',
  });

  // Round
  await insertRound({ id: SEED.round, hackathonId: SEED.hackathon, name: 'Round 1', status: 'active' });

  // Organizer roles
  await insertOrganizerRole(SEED.hackathon, SEED.organizer.id, 'organizer');
  await insertOrganizerRole(SEED.hackathon, SEED.coOrganizer.id, 'co_organizer');

  // Judge
  await insertJudge({
    id: 'judge-seed-0000-0000-000000000005',
    hackathonId: SEED.hackathon,
    userId: SEED.judge.id,
    inviteStatus: 'accepted',
    invitedBy: SEED.organizer.id,
  });

  // Team + members
  await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Seed Team', inviteCode: 'SEEDTEAM' });
  await insertTeamMember(SEED.team, SEED.lead.id, 'leader');
  await insertTeamMember(SEED.team, SEED.participant.id, 'member');
}

// ── Response type helpers ─────────────────────────────────────
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data: T;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string };
}
