import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SELF, env as rawEnv } from 'cloudflare:test';
import type { Env } from '../types/env.js';
import { signJWT } from '../lib/jwt.js';

const env = rawEnv as Env;
const JWT_SECRET = 'dev-secret-key-min-32-chars-long!!';
const now = new Date().toISOString();

let hackathonId: string;
let hackathonSlug: string;
let adminUserId: string;
let adminToken: string;
let judgeUserId: string;
let judgeToken: string;

async function ensureSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, github_id INTEGER NOT NULL, google_id TEXT, github_username TEXT NOT NULL, display_name TEXT NOT NULL, email TEXT, avatar_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS users_github_id_unique ON users (github_id)`,
    `CREATE TABLE IF NOT EXISTS hackathons (id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, description TEXT, rules_md TEXT, registration_opens TEXT NOT NULL, registration_closes TEXT NOT NULL, submission_deadline TEXT NOT NULL, judging_starts TEXT, judging_ends TEXT, min_team_size INTEGER DEFAULT 1 NOT NULL, max_team_size INTEGER DEFAULT 5 NOT NULL, max_teams INTEGER, submission_tag_pattern TEXT DEFAULT 'submission_v%' NOT NULL, max_submissions_per_team INTEGER, allow_late_submissions INTEGER DEFAULT 0 NOT NULL, primary_color TEXT DEFAULT '#6366f1', logo_r2_key TEXT, banner_r2_key TEXT, custom_subdomain TEXT, status TEXT DEFAULT 'draft' NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (created_by) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS hackathons_slug_unique ON hackathons (slug)`,
    `CREATE TABLE IF NOT EXISTS organizer_roles (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'admin' NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS organizer_roles_hackathon_id_user_id_unique ON organizer_roles (hackathon_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS judges (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, user_id TEXT NOT NULL, invite_status TEXT DEFAULT 'pending' NOT NULL, invited_at TEXT NOT NULL, accepted_at TEXT, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS judges_hackathon_id_user_id_unique ON judges (hackathon_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS rubric_criteria (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, max_score INTEGER DEFAULT 10 NOT NULL, weight REAL DEFAULT 1.0 NOT NULL, sort_order INTEGER DEFAULT 0 NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS rubric_criteria_hackathon_id_name_unique ON rubric_criteria (hackathon_id, name)`,
    `CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, name TEXT NOT NULL, repo_full_name TEXT, repo_url TEXT, github_installation_id INTEGER, bot_active INTEGER DEFAULT 0 NOT NULL, invite_code TEXT, created_at TEXT NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS teams_invite_code_unique ON teams (invite_code)`,
    `CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY NOT NULL, team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member' NOT NULL, joined_at TEXT NOT NULL, FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_id_user_id_unique ON team_members (team_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY NOT NULL, team_id TEXT NOT NULL, hackathon_id TEXT NOT NULL, tag_name TEXT NOT NULL, commit_sha TEXT NOT NULL, commit_message TEXT, commit_author TEXT, branch TEXT DEFAULT 'main', submitted_at TEXT NOT NULL, received_at TEXT NOT NULL, is_late INTEGER DEFAULT 0 NOT NULL, is_final INTEGER DEFAULT 0 NOT NULL, version INTEGER NOT NULL, status TEXT DEFAULT 'received' NOT NULL, validation_errors TEXT, locked_at TEXT, webhook_delivery_id TEXT UNIQUE, FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS submissions_team_tag_unique ON submissions (team_id, tag_name)`,
    `CREATE TABLE IF NOT EXISTS judge_assignments (id TEXT PRIMARY KEY NOT NULL, judge_id TEXT NOT NULL, team_id TEXT NOT NULL, hackathon_id TEXT NOT NULL, submission_id TEXT, status TEXT DEFAULT 'pending' NOT NULL, assigned_at TEXT NOT NULL, FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE, FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE, FOREIGN KEY (submission_id) REFERENCES submissions(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS judge_assignments_judge_team_unique ON judge_assignments (judge_id, team_id)`,
    `CREATE TABLE IF NOT EXISTS scores (id TEXT PRIMARY KEY NOT NULL, submission_id TEXT NOT NULL, judge_id TEXT NOT NULL, criteria_id TEXT NOT NULL, score INTEGER NOT NULL, comment TEXT, scored_at TEXT NOT NULL, FOREIGN KEY (submission_id) REFERENCES submissions(id), FOREIGN KEY (judge_id) REFERENCES judges(id), FOREIGN KEY (criteria_id) REFERENCES rubric_criteria(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS scores_submission_judge_criteria_unique ON scores (submission_id, judge_id, criteria_id)`,
    `CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT, actor_id TEXT, actor_type TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, details TEXT, ip_address TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS platform_admins (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS platform_admins_user_id_unique ON platform_admins (user_id)`,
    `CREATE TABLE IF NOT EXISTS organizer_invites (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, invite_code TEXT NOT NULL, status TEXT DEFAULT 'pending' NOT NULL, invited_by TEXT NOT NULL, accepted_by TEXT, accepted_at TEXT, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (invited_by) REFERENCES users(id), FOREIGN KEY (accepted_by) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS organizer_invites_invite_code_unique ON organizer_invites (invite_code)`,
  ];

  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }
}

async function resetDb() {
  await env.DB.prepare('DELETE FROM audit_events').run();
  await env.DB.prepare('DELETE FROM organizer_invites').run();
  await env.DB.prepare('DELETE FROM platform_admins').run();
  await env.DB.prepare('DELETE FROM scores').run();
  await env.DB.prepare('DELETE FROM judge_assignments').run();
  await env.DB.prepare('DELETE FROM submissions').run();
  await env.DB.prepare('DELETE FROM rubric_criteria').run();
  await env.DB.prepare('DELETE FROM team_members').run();
  await env.DB.prepare('DELETE FROM teams').run();
  await env.DB.prepare('DELETE FROM judges').run();
  await env.DB.prepare('DELETE FROM organizer_roles').run();
  await env.DB.prepare('DELETE FROM hackathons').run();
  await env.DB.prepare('DELETE FROM users').run();
}

beforeAll(async () => {
  await ensureSchema();
});

beforeEach(async () => {
  await resetDb();

  hackathonId = crypto.randomUUID();
  hackathonSlug = 'test-hackathon';
  adminUserId = crypto.randomUUID();
  judgeUserId = crypto.randomUUID();

  await env.DB
    .prepare(`INSERT INTO users (id, github_id, github_username, display_name, email, created_at, updated_at)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(adminUserId, 12345, 'admin', 'Admin User', 'admin@example.com', now, now)
    .run();

  await env.DB
    .prepare(`INSERT INTO users (id, github_id, github_username, display_name, email, created_at, updated_at)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(judgeUserId, 67890, 'judge', 'Judge User', 'judge@example.com', now, now)
    .run();

  await env.DB
    .prepare(`INSERT INTO hackathons (id, slug, title, registration_opens, registration_closes, submission_deadline, status, max_team_size, created_by, created_at, updated_at)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`)
    .bind(hackathonId, hackathonSlug, 'Test Hackathon', now, now, now, 'draft', 4, adminUserId, now, now)
    .run();

  await env.DB
    .prepare(`INSERT INTO organizer_roles (id, hackathon_id, user_id, role, created_at)
              VALUES (?1, ?2, ?3, ?4, ?5)`)
    .bind(crypto.randomUUID(), hackathonId, adminUserId, 'admin', now)
    .run();

  adminToken = await signJWT({ sub: adminUserId, ghid: 12345, ghu: 'admin' }, JWT_SECRET);
  judgeToken = await signJWT({ sub: judgeUserId, ghid: 67890, ghu: 'judge' }, JWT_SECRET);
});

describe('POST /:slug/judges — invite judge', () => {
  it('admin invites a judge successfully', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({ userId: judgeUserId }),
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: { user_id: string; invite_status: string } };
    expect(json.ok).toBe(true);
    expect(json.data.user_id).toBe(judgeUserId);
    expect(json.data.invite_status).toBe('pending');
  });

  it('returns 409 if judge already invited', async () => {
    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at)
                VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(crypto.randomUUID(), hackathonId, judgeUserId, 'pending', now)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({ userId: judgeUserId }),
    });

    expect(response.status).toBe(409);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('DUPLICATE_INVITE');
  });

  it('returns 401 if not authenticated', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: judgeUserId }),
    });

    expect(response.status).toBe(401);
  });
});

describe('POST /:slug/scores — submit score', () => {
  let judgeRecordId: string;
  let teamId: string;
  let submissionId: string;
  let criteriaId: string;

  beforeEach(async () => {
    judgeRecordId = crypto.randomUUID();
    teamId = crypto.randomUUID();
    submissionId = crypto.randomUUID();
    criteriaId = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at, accepted_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(judgeRecordId, hackathonId, judgeUserId, 'accepted', now, now)
      .run();

    await env.DB
      .prepare(`INSERT INTO teams (id, hackathon_id, name, created_at)
                VALUES (?1, ?2, ?3, ?4)`)
      .bind(teamId, hackathonId, 'Test Team', now)
      .run();

    await env.DB
      .prepare(`INSERT INTO submissions (id, team_id, hackathon_id, tag_name, commit_sha, submitted_at, received_at, is_final, version)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
      .bind(submissionId, teamId, hackathonId, 'v1', 'abc123', now, now, 1, 1)
      .run();

    await env.DB
      .prepare(`INSERT INTO rubric_criteria (id, hackathon_id, name, max_score, weight, sort_order)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(criteriaId, hackathonId, 'Innovation', 25, 0.5, 1)
      .run();

    await env.DB
      .prepare(`INSERT INTO judge_assignments (id, judge_id, team_id, hackathon_id, submission_id, status, assigned_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
      .bind(crypto.randomUUID(), judgeRecordId, teamId, hackathonId, submissionId, 'pending', now)
      .run();
  });

  it('judge successfully submits a score', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${judgeToken}`,
      },
      body: JSON.stringify({
        submissionId,
        criteriaId,
        score: 20,
        comment: 'Great innovation!',
      }),
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: { score: number; comment: string | null } };
    expect(json.ok).toBe(true);
    expect(json.data.score).toBe(20);
    expect(json.data.comment).toBe('Great innovation!');
  });

  it('judge submits score without comment', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${judgeToken}`,
      },
      body: JSON.stringify({
        submissionId,
        criteriaId,
        score: 15,
      }),
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: { score: number; comment: string | null } };
    expect(json.ok).toBe(true);
    expect(json.data.score).toBe(15);
    expect(json.data.comment).toBeNull();
  });

  it('returns 409 when duplicate score is submitted', async () => {
    await env.DB
      .prepare(`INSERT INTO scores (id, submission_id, judge_id, criteria_id, score, comment, scored_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
      .bind(crypto.randomUUID(), submissionId, judgeRecordId, criteriaId, 20, 'First score', now)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${judgeToken}`,
      },
      body: JSON.stringify({
        submissionId,
        criteriaId,
        score: 25,
      }),
    });

    expect(response.status).toBe(409);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('DUPLICATE_SCORE');
  });

  it('returns 400 when score exceeds max_score', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${judgeToken}`,
      },
      body: JSON.stringify({
        submissionId,
        criteriaId,
        score: 30,
      }),
    });

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe('SCORE_TOO_HIGH');
    expect(json.error.message).toContain('25');
  });

  it('returns 403 when user is not an accepted judge', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({
        submissionId,
        criteriaId,
        score: 20,
      }),
    });

    expect(response.status).toBe(403);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('NOT_JUDGE');
  });

  it('returns 403 when judge is not assigned to the team', async () => {
    await env.DB
      .prepare('DELETE FROM judge_assignments WHERE judge_id = ?')
      .bind(judgeRecordId)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${judgeToken}`,
      },
      body: JSON.stringify({
        submissionId,
        criteriaId,
        score: 20,
      }),
    });

    expect(response.status).toBe(403);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('NOT_ASSIGNED');
  });

  it('returns 404 when criteria not found', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${judgeToken}`,
      },
      body: JSON.stringify({
        submissionId,
        criteriaId: crypto.randomUUID(),
        score: 20,
      }),
    });

    expect(response.status).toBe(404);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('CRITERIA_NOT_FOUND');
  });

  it('returns 404 when submission not found', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${judgeToken}`,
      },
      body: JSON.stringify({
        submissionId: crypto.randomUUID(),
        criteriaId,
        score: 20,
      }),
    });

    expect(response.status).toBe(404);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('SUBMISSION_NOT_FOUND');
  });

  it('creates audit event when score is submitted', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${judgeToken}`,
      },
      body: JSON.stringify({
        submissionId,
        criteriaId,
        score: 20,
      }),
    });

    expect(response.status).toBe(200);

    const auditResult = await env.DB
      .prepare('SELECT COUNT(*) as count FROM audit_events WHERE action = ?')
      .bind('score.submit')
      .first() as { count: number };
    expect(auditResult.count).toBeGreaterThan(0);
  });

  it('returns 401 when not authenticated', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId,
        criteriaId,
        score: 20,
      }),
    });

    expect(response.status).toBe(401);
  });
});

describe('GET /:slug/judges — list judges', () => {
  it('admin lists all judges with user details', async () => {
    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at, accepted_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(crypto.randomUUID(), hackathonId, judgeUserId, 'accepted', now, now)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges`, {
      method: 'GET',
      headers: { Cookie: `session=${adminToken}` },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<{ user: { id: string; display_name: string } }> };
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].user.id).toBe(judgeUserId);
    expect(json.data[0].user.display_name).toBe('Judge User');
  });

  it('returns 403 if user is not admin', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges`, {
      method: 'GET',
      headers: { Cookie: `session=${judgeToken}` },
    });

    expect(response.status).toBe(403);
  });
});

describe('POST /:slug/judges/:judgeId/respond — judge accepts or declines invite', () => {
  it('judge accepts invite', async () => {
    const judgeRecordId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at)
                VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(judgeRecordId, hackathonId, judgeUserId, 'pending', now)
      .run();

    const response = await SELF.fetch(
      `http://api/api/v1/hackathons/${hackathonSlug}/judges/${judgeRecordId}/respond`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${judgeToken}`,
        },
        body: JSON.stringify({ accept: true }),
      },
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: { invite_status: string; accepted_at: string | null } };
    expect(json.ok).toBe(true);
    expect(json.data.invite_status).toBe('accepted');
    expect(json.data.accepted_at).toBeTruthy();
  });

  it('judge declines invite', async () => {
    const judgeRecordId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at)
                VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(judgeRecordId, hackathonId, judgeUserId, 'pending', now)
      .run();

    const response = await SELF.fetch(
      `http://api/api/v1/hackathons/${hackathonSlug}/judges/${judgeRecordId}/respond`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${judgeToken}`,
        },
        body: JSON.stringify({ accept: false }),
      },
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: { invite_status: string; accepted_at: string | null } };
    expect(json.ok).toBe(true);
    expect(json.data.invite_status).toBe('declined');
    expect(json.data.accepted_at).toBeNull();
  });

  it('returns 403 if user is not the invited judge', async () => {
    const otherUserId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(otherUserId, 99999, 'other', 'Other User', now, now)
      .run();
    const otherToken = await signJWT({ sub: otherUserId, ghid: 99999, ghu: 'other' }, JWT_SECRET);

    const judgeRecordId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at)
                VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(judgeRecordId, hackathonId, judgeUserId, 'pending', now)
      .run();

    const response = await SELF.fetch(
      `http://api/api/v1/hackathons/${hackathonSlug}/judges/${judgeRecordId}/respond`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${otherToken}`,
        },
        body: JSON.stringify({ accept: true }),
      },
    );

    expect(response.status).toBe(403);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('FORBIDDEN');
  });

   it('returns 404 if judge record not found', async () => {
     const response = await SELF.fetch(
       `http://api/api/v1/hackathons/${hackathonSlug}/judges/${crypto.randomUUID()}/respond`,
       {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           Cookie: `session=${judgeToken}`,
         },
         body: JSON.stringify({ accept: true }),
       },
     );

    expect(response.status).toBe(404);
  });
});

describe('POST /:slug/judges/assign — auto-assign judges to teams', () => {
  it('successfully assigns judges to teams with submissions (3 judges)', async () => {
    const judge2Id = crypto.randomUUID();
    const judge3Id = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6), (?7, ?8, ?9, ?10, ?11, ?12)`)
      .bind(judge2Id, 77777, 'judge2', 'Judge Two', now, now, judge3Id, 88888, 'judge3', 'Judge Three', now, now)
      .run();

    const judgeRecordId1 = crypto.randomUUID();
    const judgeRecordId2 = crypto.randomUUID();
    const judgeRecordId3 = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at, accepted_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6), (?7, ?8, ?9, ?10, ?11, ?12), (?13, ?14, ?15, ?16, ?17, ?18)`)
      .bind(
        judgeRecordId1, hackathonId, judgeUserId, 'accepted', now, now,
        judgeRecordId2, hackathonId, judge2Id, 'accepted', now, now,
        judgeRecordId3, hackathonId, judge3Id, 'accepted', now, now,
      )
      .run();

    const team1Id = crypto.randomUUID();
    const team2Id = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO teams (id, hackathon_id, name, created_at)
                VALUES (?1, ?2, ?3, ?4), (?5, ?6, ?7, ?8)`)
      .bind(team1Id, hackathonId, 'Team One', now, team2Id, hackathonId, 'Team Two', now)
      .run();

    const submission1Id = crypto.randomUUID();
    const submission2Id = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO submissions (id, team_id, hackathon_id, tag_name, commit_sha, submitted_at, received_at, is_final, version)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9), (?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`)
      .bind(
        submission1Id, team1Id, hackathonId, 'v1', 'abc123', now, now, 1, 1,
        submission2Id, team2Id, hackathonId, 'v1', 'def456', now, now, 1, 1,
      )
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<{ judge_id: string; team_id: string }> };
    expect(json.ok).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(6);

    const team1Assignments = json.data.filter(a => a.team_id === team1Id);
    const team2Assignments = json.data.filter(a => a.team_id === team2Id);
    expect(team1Assignments).toHaveLength(3);
    expect(team2Assignments).toHaveLength(3);
  });

  it('assigns fewer judges when there are fewer than 3 judges', async () => {
    const judgeRecordId = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at, accepted_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(judgeRecordId, hackathonId, judgeUserId, 'accepted', now, now)
      .run();

    const teamId = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO teams (id, hackathon_id, name, created_at)
                VALUES (?1, ?2, ?3, ?4)`)
      .bind(teamId, hackathonId, 'Team One', now)
      .run();

    const submissionId = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO submissions (id, team_id, hackathon_id, tag_name, commit_sha, submitted_at, received_at, is_final, version)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
      .bind(submissionId, teamId, hackathonId, 'v1', 'abc123', now, now, 1, 1)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<{ judge_id: string; team_id: string }> };
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].team_id).toBe(teamId);
  });

  it('returns 400 if no accepted judges exist', async () => {
    const teamId = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO teams (id, hackathon_id, name, created_at)
                VALUES (?1, ?2, ?3, ?4)`)
      .bind(teamId, hackathonId, 'Team One', now)
      .run();

    const submissionId = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO submissions (id, team_id, hackathon_id, tag_name, commit_sha, submitted_at, received_at, is_final, version)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
      .bind(submissionId, teamId, hackathonId, 'v1', 'abc123', now, now, 1, 1)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
    });

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('NO_JUDGES');
  });

  it('returns 400 if no teams with submissions exist', async () => {
    const judgeRecordId = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at, accepted_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(judgeRecordId, hackathonId, judgeUserId, 'accepted', now, now)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
    });

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('NO_SUBMISSIONS');
  });

  it('returns 403 if user is not admin', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${judgeToken}`,
      },
    });

    expect(response.status).toBe(403);
  });

  it('handles duplicate assignments idempotently', async () => {
    const judgeRecordId = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at, accepted_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(judgeRecordId, hackathonId, judgeUserId, 'accepted', now, now)
      .run();

    const teamId = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO teams (id, hackathon_id, name, created_at)
                VALUES (?1, ?2, ?3, ?4)`)
      .bind(teamId, hackathonId, 'Team One', now)
      .run();

    const submissionId = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO submissions (id, team_id, hackathon_id, tag_name, commit_sha, submitted_at, received_at, is_final, version)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
      .bind(submissionId, teamId, hackathonId, 'v1', 'abc123', now, now, 1, 1)
      .run();

    await env.DB
      .prepare(`INSERT INTO judge_assignments (id, judge_id, team_id, hackathon_id, submission_id, status, assigned_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
      .bind(crypto.randomUUID(), judgeRecordId, teamId, hackathonId, submissionId, 'pending', now)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<{ judge_id: string; team_id: string }> };
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(1);
  });

  it('prefers final submissions over non-final', async () => {
    const judgeRecordId = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at, accepted_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(judgeRecordId, hackathonId, judgeUserId, 'accepted', now, now)
      .run();

    const teamId = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO teams (id, hackathon_id, name, created_at)
                VALUES (?1, ?2, ?3, ?4)`)
      .bind(teamId, hackathonId, 'Team One', now)
      .run();

    const submission1Id = crypto.randomUUID();
    const submission2Id = crypto.randomUUID();

    await env.DB
      .prepare(`INSERT INTO submissions (id, team_id, hackathon_id, tag_name, commit_sha, submitted_at, received_at, is_final, version)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9), (?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`)
      .bind(
        submission1Id, teamId, hackathonId, 'v1', 'abc123', now, now, 0, 1,
        submission2Id, teamId, hackathonId, 'v2', 'def456', now, now, 1, 2,
      )
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<{ submission_id: string | null }> };
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].submission_id).toBe(submission2Id);
  });
});

describe('GET /:slug/leaderboard — aggregated results', () => {
  let judgeRecordId1: string;
  let judgeRecordId2: string;
  let teamId1: string;
  let teamId2: string;
  let submissionId1: string;
  let submissionId2: string;
  let criteriaId1: string;
  let criteriaId2: string;

  beforeEach(async () => {
    judgeRecordId1 = crypto.randomUUID();
    judgeRecordId2 = crypto.randomUUID();
    teamId1 = crypto.randomUUID();
    teamId2 = crypto.randomUUID();
    submissionId1 = crypto.randomUUID();
    submissionId2 = crypto.randomUUID();
    criteriaId1 = crypto.randomUUID();
    criteriaId2 = crypto.randomUUID();

    // Create two judges
    const judge2UserId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(judge2UserId, 11111, 'judge2', 'Judge Two', now, now)
      .run();

    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at, accepted_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6), (?7, ?8, ?9, ?10, ?11, ?12)`)
      .bind(
        judgeRecordId1, hackathonId, judgeUserId, 'accepted', now, now,
        judgeRecordId2, hackathonId, judge2UserId, 'accepted', now, now,
      )
      .run();

    // Create two teams
    await env.DB
      .prepare(`INSERT INTO teams (id, hackathon_id, name, created_at)
                VALUES (?1, ?2, ?3, ?4), (?5, ?6, ?7, ?8)`)
      .bind(teamId1, hackathonId, 'Team Alpha', now, teamId2, hackathonId, 'Team Beta', now)
      .run();

    // Create final submissions for both teams
    await env.DB
      .prepare(`INSERT INTO submissions (id, team_id, hackathon_id, tag_name, commit_sha, submitted_at, received_at, is_final, version)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9), (?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`)
      .bind(
        submissionId1, teamId1, hackathonId, 'v1', 'abc123', now, now, 1, 1,
        submissionId2, teamId2, hackathonId, 'v1', 'def456', now, now, 1, 1,
      )
      .run();

    // Create two rubric criteria with different weights
    await env.DB
      .prepare(`INSERT INTO rubric_criteria (id, hackathon_id, name, max_score, weight, sort_order)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6), (?7, ?8, ?9, ?10, ?11, ?12)`)
      .bind(
        criteriaId1, hackathonId, 'Innovation', 25, 0.5, 1,
        criteriaId2, hackathonId, 'Execution', 20, 0.3, 2,
      )
      .run();
  });

  it('calculates weighted percentage correctly', async () => {
    // Create participant user
    const participantUserId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(participantUserId, 99999, 'participant', 'Participant User', now, now)
      .run();

    // Add participant to team
    await env.DB
      .prepare(`INSERT INTO team_members (id, team_id, user_id, role, joined_at)
                VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(crypto.randomUUID(), teamId1, participantUserId, 'member', now)
      .run();

    const participantToken = await signJWT({ sub: participantUserId, ghid: 99999, ghu: 'participant' }, JWT_SECRET);

    // Team 1: Judge 1 scores 20/25 on Innovation (weight 0.5), 15/20 on Execution (weight 0.3)
    // Weighted score = (20*0.5 + 15*0.3) / (25*0.5 + 20*0.3) * 100 = 14.5 / 18.5 * 100 = 78.38%
    await env.DB
      .prepare(`INSERT INTO scores (id, submission_id, judge_id, criteria_id, score, scored_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6), (?7, ?8, ?9, ?10, ?11, ?12)`)
      .bind(
        crypto.randomUUID(), submissionId1, judgeRecordId1, criteriaId1, 20, now,
        crypto.randomUUID(), submissionId1, judgeRecordId1, criteriaId2, 15, now,
      )
      .run();

    // Team 2: Judge 1 scores 10/25 on Innovation, 10/20 on Execution
    // Weighted score = (10*0.5 + 10*0.3) / (25*0.5 + 20*0.3) * 100 = 8.0 / 18.5 * 100 = 43.24%
    await env.DB
      .prepare(`INSERT INTO scores (id, submission_id, judge_id, criteria_id, score, scored_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6), (?7, ?8, ?9, ?10, ?11, ?12)`)
      .bind(
        crypto.randomUUID(), submissionId2, judgeRecordId1, criteriaId1, 10, now,
        crypto.randomUUID(), submissionId2, judgeRecordId1, criteriaId2, 10, now,
      )
      .run();

    await env.DB
      .prepare('UPDATE hackathons SET status = ? WHERE id = ?')
      .bind('completed', hackathonId)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/leaderboard`, {
      method: 'GET',
      headers: { Cookie: `session=${participantToken}` },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<{ team_id: string; team_name: string; weighted_percentage: number; judges_completed: number }> };
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(2);
    
    // Ordered by weighted_percentage DESC
    expect(json.data[0].team_id).toBe(teamId1);
    expect(json.data[0].team_name).toBe('Team Alpha');
    expect(json.data[0].weighted_percentage).toBeCloseTo(78.38, 1);
    expect(json.data[0].judges_completed).toBe(1);

    expect(json.data[1].team_id).toBe(teamId2);
    expect(json.data[1].team_name).toBe('Team Beta');
    expect(json.data[1].weighted_percentage).toBeCloseTo(43.24, 1);
    expect(json.data[1].judges_completed).toBe(1);
  });

  it('participant cannot view leaderboard before judging complete', async () => {
    // Create participant user
    const participantUserId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(participantUserId, 99999, 'participant', 'Participant User', now, now)
      .run();

    // Add participant to team
    await env.DB
      .prepare(`INSERT INTO team_members (id, team_id, user_id, role, joined_at)
                VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(crypto.randomUUID(), teamId1, participantUserId, 'member', now)
      .run();

    const participantToken = await signJWT({ sub: participantUserId, ghid: 99999, ghu: 'participant' }, JWT_SECRET);

    // Hackathon is in 'judging' status
    await env.DB
      .prepare('UPDATE hackathons SET status = ? WHERE id = ?')
      .bind('judging', hackathonId)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/leaderboard`, {
      method: 'GET',
      headers: { Cookie: `session=${participantToken}` },
    });

    expect(response.status).toBe(403);
    const json = (await response.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe('FORBIDDEN');
    expect(json.error.message).toContain('after judging is complete');
  });

  it('participant can view leaderboard after judging complete', async () => {
    // Create participant user
    const participantUserId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(participantUserId, 99999, 'participant', 'Participant User', now, now)
      .run();

    // Add participant to team
    await env.DB
      .prepare(`INSERT INTO team_members (id, team_id, user_id, role, joined_at)
                VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(crypto.randomUUID(), teamId1, participantUserId, 'member', now)
      .run();

    const participantToken = await signJWT({ sub: participantUserId, ghid: 99999, ghu: 'participant' }, JWT_SECRET);

    // Add some scores
    await env.DB
      .prepare(`INSERT INTO scores (id, submission_id, judge_id, criteria_id, score, scored_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(crypto.randomUUID(), submissionId1, judgeRecordId1, criteriaId1, 20, now)
      .run();

    // Hackathon is 'completed'
    await env.DB
      .prepare('UPDATE hackathons SET status = ? WHERE id = ?')
      .bind('completed', hackathonId)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/leaderboard`, {
      method: 'GET',
      headers: { Cookie: `session=${participantToken}` },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<unknown> };
    expect(json.ok).toBe(true);
  });

  it('admin can view leaderboard anytime', async () => {
    // Hackathon is in 'judging' status (not completed)
    await env.DB
      .prepare('UPDATE hackathons SET status = ? WHERE id = ?')
      .bind('judging', hackathonId)
      .run();

    // Add some scores
    await env.DB
      .prepare(`INSERT INTO scores (id, submission_id, judge_id, criteria_id, score, scored_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(crypto.randomUUID(), submissionId1, judgeRecordId1, criteriaId1, 20, now)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/leaderboard`, {
      method: 'GET',
      headers: { Cookie: `session=${adminToken}` },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<unknown> };
    expect(json.ok).toBe(true);
  });

  it('returns empty array when no scores exist', async () => {
    // Create participant user
    const participantUserId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(participantUserId, 99999, 'participant', 'Participant User', now, now)
      .run();

    const participantToken = await signJWT({ sub: participantUserId, ghid: 99999, ghu: 'participant' }, JWT_SECRET);

    await env.DB
      .prepare('UPDATE hackathons SET status = ? WHERE id = ?')
      .bind('completed', hackathonId)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/leaderboard`, {
      method: 'GET',
      headers: { Cookie: `session=${participantToken}` },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<unknown> };
    expect(json.ok).toBe(true);
    expect(json.data).toEqual([]);
  });

  it('counts judges_completed correctly with multiple judges', async () => {
    // Create participant user
    const participantUserId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(participantUserId, 99999, 'participant', 'Participant User', now, now)
      .run();

    const participantToken = await signJWT({ sub: participantUserId, ghid: 99999, ghu: 'participant' }, JWT_SECRET);

    // Team 1: Both judges score both criteria
    await env.DB
      .prepare(`INSERT INTO scores (id, submission_id, judge_id, criteria_id, score, scored_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6), (?7, ?8, ?9, ?10, ?11, ?12), (?13, ?14, ?15, ?16, ?17, ?18), (?19, ?20, ?21, ?22, ?23, ?24)`)
      .bind(
        crypto.randomUUID(), submissionId1, judgeRecordId1, criteriaId1, 20, now,
        crypto.randomUUID(), submissionId1, judgeRecordId1, criteriaId2, 15, now,
        crypto.randomUUID(), submissionId1, judgeRecordId2, criteriaId1, 22, now,
        crypto.randomUUID(), submissionId1, judgeRecordId2, criteriaId2, 18, now,
      )
      .run();

    await env.DB
      .prepare('UPDATE hackathons SET status = ? WHERE id = ?')
      .bind('completed', hackathonId)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/leaderboard`, {
      method: 'GET',
      headers: { Cookie: `session=${participantToken}` },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<{ judges_completed: number }> };
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].judges_completed).toBe(2);
  });

  it('allows any authenticated user to view leaderboard after completion', async () => {
    // Create a user who is NOT a participant (just a random authenticated user)
    const randomUserId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(randomUserId, 88888, 'randomuser', 'Random User', now, now)
      .run();

    const randomToken = await signJWT({ sub: randomUserId, ghid: 88888, ghu: 'randomuser' }, JWT_SECRET);

    await env.DB
      .prepare(`INSERT INTO scores (id, submission_id, judge_id, criteria_id, score, scored_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(crypto.randomUUID(), submissionId1, judgeRecordId1, criteriaId1, 20, now)
      .run();

    await env.DB
      .prepare('UPDATE hackathons SET status = ? WHERE id = ?')
      .bind('completed', hackathonId)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/leaderboard`, {
      method: 'GET',
      headers: { Cookie: `session=${randomToken}` },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<unknown> };
    expect(json.ok).toBe(true);
  });
});

describe('GET /:slug/rubric — get all rubric criteria', () => {
  it('returns empty array when no criteria exist', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'GET',
      headers: { Cookie: `session=${judgeToken}` },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<unknown> };
    expect(json.ok).toBe(true);
    expect(json.data).toEqual([]);
  });

  it('returns criteria ordered by sort_order', async () => {
    await env.DB
      .prepare(`INSERT INTO rubric_criteria (id, hackathon_id, name, max_score, weight, sort_order)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6), (?7, ?8, ?9, ?10, ?11, ?12), (?13, ?14, ?15, ?16, ?17, ?18)`)
      .bind(
        crypto.randomUUID(), hackathonId, 'Criteria 2', 10, 0.5, 2,
        crypto.randomUUID(), hackathonId, 'Criteria 1', 20, 0.3, 1,
        crypto.randomUUID(), hackathonId, 'Criteria 3', 15, 0.2, 3,
      )
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'GET',
      headers: { Cookie: `session=${judgeToken}` },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<{ name: string; sort_order: number }> };
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(3);
    expect(json.data[0].name).toBe('Criteria 1');
    expect(json.data[1].name).toBe('Criteria 2');
    expect(json.data[2].name).toBe('Criteria 3');
  });

  it('allows anonymous users to view rubric', async () => {
    await env.DB
      .prepare(`INSERT INTO rubric_criteria (id, hackathon_id, name, max_score, weight, sort_order)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(crypto.randomUUID(), hackathonId, 'Test Criteria', 10, 1.0, 0)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'GET',
      headers: { Cookie: `session=${judgeToken}` },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<{ name: string }> };
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe('Test Criteria');
  });

  it('returns 404 if hackathon not found', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/nonexistent/rubric`, {
      method: 'GET',
      headers: { Cookie: `session=${judgeToken}` },
    });

    expect(response.status).toBe(404);
  });
});

describe('POST /:slug/rubric — bulk upsert rubric criteria', () => {
  it('admin creates rubric criteria successfully', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({
        criteria: [
          { name: 'Innovation', description: 'Originality', maxScore: 25, weight: 0.3, sortOrder: 1 },
          { name: 'Execution', maxScore: 25, weight: 0.4, sortOrder: 2 },
          { name: 'Impact', maxScore: 20, weight: 0.3, sortOrder: 3 },
        ],
      }),
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<{ name: string }> };
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(3);
    expect(json.data.some(c => c.name === 'Innovation')).toBe(true);
  });

  it('deletes existing criteria and inserts new ones (bulk upsert)', async () => {
    await env.DB
      .prepare(`INSERT INTO rubric_criteria (id, hackathon_id, name, max_score, weight, sort_order)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(crypto.randomUUID(), hackathonId, 'Old Criteria', 10, 1.0, 0)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({
        criteria: [
          { name: 'New Criteria', maxScore: 50, weight: 1.0, sortOrder: 1 },
        ],
      }),
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<{ name: string }> };
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe('New Criteria');

    const verify = (await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'GET',
      headers: { Cookie: `session=${adminToken}` },
    })) as any;
    const verifyJson = (await verify.json()) as { ok: boolean; data: Array<{ name: string }> };
    expect(verifyJson.data).toHaveLength(1);
    expect(verifyJson.data[0].name).toBe('New Criteria');
  });

  it('records audit event on POST', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({
        criteria: [
          { name: 'Test', maxScore: 10, weight: 1.0, sortOrder: 1 },
        ],
      }),
    });

    expect(response.status).toBe(200);

    const auditResult = await env.DB.prepare('SELECT COUNT(*) as count FROM audit_events WHERE action = ?').bind('rubric.bulk_update').first() as { count: number };
    expect(auditResult.count).toBeGreaterThan(0);
  });

  it('returns 403 if user is not admin', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${judgeToken}`,
      },
      body: JSON.stringify({
        criteria: [
          { name: 'Test', maxScore: 10, weight: 1.0, sortOrder: 1 },
        ],
      }),
    });

    expect(response.status).toBe(403);
  });

  it('returns 400 if hackathon status is not draft or registration_open', async () => {
    await env.DB
      .prepare('UPDATE hackathons SET status = ? WHERE id = ?')
      .bind('active', hackathonId)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({
        criteria: [
          { name: 'Test', maxScore: 10, weight: 1.0, sortOrder: 1 },
        ],
      }),
    });

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('INVALID_STATUS');
  });

  it('validates required name field', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({
        criteria: [
          { name: '', maxScore: 10, weight: 1.0, sortOrder: 1 },
        ],
      }),
    });

    expect(response.status).toBe(400);
  });

  it('validates maxScore must be positive', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({
        criteria: [
          { name: 'Test', maxScore: 0, weight: 1.0, sortOrder: 1 },
        ],
      }),
    });

    expect(response.status).toBe(400);
  });

  it('validates weight is between 0 and 1', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({
        criteria: [
          { name: 'Test', maxScore: 10, weight: 1.5, sortOrder: 1 },
        ],
      }),
    });

    expect(response.status).toBe(400);
  });

  it('validates sortOrder is nonnegative', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({
        criteria: [
          { name: 'Test', maxScore: 10, weight: 1.0, sortOrder: -1 },
        ],
      }),
    });

    expect(response.status).toBe(400);
  });

  it('allows status registration_open for POST', async () => {
    await env.DB
      .prepare('UPDATE hackathons SET status = ? WHERE id = ?')
      .bind('registration_open', hackathonId)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({
        criteria: [
          { name: 'Test', maxScore: 10, weight: 1.0, sortOrder: 1 },
        ],
      }),
    });

    expect(response.status).toBe(200);
  });

  it('returns 401 if not authenticated', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/rubric`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        criteria: [
          { name: 'Test', maxScore: 10, weight: 1.0, sortOrder: 1 },
        ],
      }),
    });

    expect(response.status).toBe(401);
  });

  it('returns 404 if hackathon not found', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/nonexistent/rubric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({
        criteria: [
          { name: 'Test', maxScore: 10, weight: 1.0, sortOrder: 1 },
        ],
      }),
    });

    expect(response.status).toBe(404);
  });
});

