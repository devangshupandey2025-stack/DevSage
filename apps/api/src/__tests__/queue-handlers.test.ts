import { env as rawEnv } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { handlePush } from '../queue/push-handler.js';
import { handleTagCreate } from '../queue/tag-create-handler.js';
import { handleTagDelete } from '../queue/tag-delete-handler.js';
import { handleInstallation } from '../queue/installation-handler.js';
import type { Env } from '../types/env.js';
import type {
  NormalizedPushEvent,
  NormalizedTagCreateEvent,
  NormalizedTagDeleteEvent,
  NormalizedInstallationEvent,
} from '../lib/webhook-normalize.js';

const env = rawEnv as Env;
const now = new Date().toISOString();

async function ensureSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, github_id INTEGER NOT NULL, google_id TEXT, github_username TEXT NOT NULL, display_name TEXT NOT NULL, email TEXT, avatar_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS users_github_id_unique ON users (github_id)`,
    `CREATE TABLE IF NOT EXISTS hackathons (id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, description TEXT, rules_md TEXT, registration_opens TEXT NOT NULL, registration_closes TEXT NOT NULL, submission_deadline TEXT NOT NULL, judging_starts TEXT, judging_ends TEXT, min_team_size INTEGER DEFAULT 1 NOT NULL, max_team_size INTEGER DEFAULT 5 NOT NULL, max_teams INTEGER, submission_tag_pattern TEXT DEFAULT 'submission_v%' NOT NULL, max_submissions_per_team INTEGER, allow_late_submissions INTEGER DEFAULT 0 NOT NULL, primary_color TEXT DEFAULT '#6366f1', logo_r2_key TEXT, banner_r2_key TEXT, custom_subdomain TEXT, status TEXT DEFAULT 'draft' NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (created_by) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS hackathons_slug_unique ON hackathons (slug)`,
    `CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, name TEXT NOT NULL, repo_full_name TEXT, repo_url TEXT, github_installation_id INTEGER, bot_active INTEGER DEFAULT 0 NOT NULL, invite_code TEXT, created_at TEXT NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS teams_invite_code_unique ON teams (invite_code)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS teams_hackathon_name_unique ON teams (hackathon_id, name)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS teams_hackathon_repo_unique ON teams (hackathon_id, repo_full_name)`,
    `CREATE INDEX IF NOT EXISTS idx_teams_hackathon ON teams (hackathon_id)`,
    `CREATE INDEX IF NOT EXISTS idx_teams_repo ON teams (repo_full_name)`,
    `CREATE TABLE IF NOT EXISTS commit_log (id TEXT PRIMARY KEY NOT NULL, team_id TEXT NOT NULL, hackathon_id TEXT NOT NULL, commit_sha TEXT NOT NULL, message TEXT, author_username TEXT, branch TEXT DEFAULT 'main', pushed_at TEXT NOT NULL, is_force_push INTEGER DEFAULT 0 NOT NULL, commits_in_push INTEGER DEFAULT 1, webhook_delivery_id TEXT, created_at TEXT NOT NULL, FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE)`,
    `CREATE INDEX IF NOT EXISTS idx_commit_log_team ON commit_log (team_id, pushed_at)`,
    `CREATE INDEX IF NOT EXISTS idx_commit_log_hackathon ON commit_log (hackathon_id, pushed_at)`,
    `CREATE TABLE IF NOT EXISTS force_push_events (id TEXT PRIMARY KEY NOT NULL, team_id TEXT NOT NULL, hackathon_id TEXT NOT NULL, before_sha TEXT NOT NULL, after_sha TEXT NOT NULL, branch TEXT NOT NULL, commits_lost_shas TEXT, commits_lost_count INTEGER DEFAULT 0, detected_at TEXT NOT NULL, notified_organizer INTEGER DEFAULT 0 NOT NULL, action_taken TEXT DEFAULT 'logged', submissions_invalidated TEXT, webhook_delivery_id TEXT, FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE)`,
    `CREATE INDEX IF NOT EXISTS idx_force_push_team ON force_push_events (team_id)`,
    `CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY NOT NULL, team_id TEXT NOT NULL, hackathon_id TEXT NOT NULL, tag_name TEXT NOT NULL, commit_sha TEXT NOT NULL, commit_message TEXT, commit_author TEXT, branch TEXT DEFAULT 'main', submitted_at TEXT NOT NULL, received_at TEXT NOT NULL, is_late INTEGER DEFAULT 0 NOT NULL, is_final INTEGER DEFAULT 0 NOT NULL, version INTEGER NOT NULL, status TEXT DEFAULT 'received' NOT NULL, validation_errors TEXT, locked_at TEXT, webhook_delivery_id TEXT UNIQUE, FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS submissions_team_tag_unique ON submissions (team_id, tag_name)`,
    `CREATE INDEX IF NOT EXISTS idx_submissions_team ON submissions (team_id)`,
    `CREATE INDEX IF NOT EXISTS idx_submissions_hackathon ON submissions (hackathon_id)`,
    `CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (hackathon_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_submissions_webhook ON submissions (webhook_delivery_id)`,
    `CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT, actor_id TEXT, actor_type TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, details TEXT, ip_address TEXT, created_at TEXT NOT NULL)`,
  ];

  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }
}

async function resetDb() {
  await env.DB.prepare('DELETE FROM audit_events').run();
  await env.DB.prepare('DELETE FROM submissions').run();
  await env.DB.prepare('DELETE FROM force_push_events').run();
  await env.DB.prepare('DELETE FROM commit_log').run();
  await env.DB.prepare('DELETE FROM teams').run();
  await env.DB.prepare('DELETE FROM hackathons').run();
  await env.DB.prepare('DELETE FROM users').run();
}

async function insertUser(id: string, githubId: number) {
  await env.DB
    .prepare(
      `INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(id, githubId, `user-${githubId}`, `User ${githubId}`, now, now)
    .run();
}

async function insertHackathon(id: string, slug: string, createdBy: string, status = 'active') {
  await env.DB
    .prepare(
      `INSERT INTO hackathons (id, slug, title, registration_opens, registration_closes, submission_deadline, status, created_by, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    )
    .bind(id, slug, 'Test Hackathon', now, now, now, status, createdBy, now, now)
    .run();
}

async function insertTeam(
  id: string,
  hackathonId: string,
  name: string,
  repoFullName: string | null = null,
  botActive = 1
) {
  await env.DB
    .prepare(
      `INSERT INTO teams (id, hackathon_id, name, repo_full_name, bot_active, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(id, hackathonId, name, repoFullName, botActive, now)
    .run();
}

describe('queue handlers', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetDb();
  });

  describe('push handler', () => {
    it('inserts commits into commit_log table', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 1);

      const event: NormalizedPushEvent = {
        type: 'push',
        deliveryId: 'delivery-push-1',
        timestamp: now,
        repoFullName: 'org/repo',
        branch: 'main',
        forced: false,
        commits: [
          { sha: 'a'.repeat(40), message: 'First commit', author: 'alice', timestamp: now },
          { sha: 'b'.repeat(40), message: 'Second commit', author: 'bob', timestamp: now },
        ],
        headSha: 'a'.repeat(40),
        beforeSha: 'c'.repeat(40),
        pusherName: 'alice',
      };

      await handlePush(event, env);

      const rows = await env.DB.prepare('SELECT * FROM commit_log ORDER BY commit_sha').all();
      expect(rows.results).toHaveLength(2);
      expect(rows.results[0].commit_sha).toBe('a'.repeat(40));
      expect(rows.results[0].team_id).toBe('team-1');
      expect(rows.results[0].hackathon_id).toBe('hack-1');
      expect(rows.results[0].webhook_delivery_id).toBe('delivery-push-1');
      expect(rows.results[0].is_force_push).toBe(0);
      expect(rows.results[0].commits_in_push).toBe(2);
    });

    it('bounds commits to 20 max', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 1);

      const commits = Array.from({ length: 25 }, (_, i) => ({
        sha: i.toString(16).padStart(40, '0'),
        message: `Commit ${i}`,
        author: 'bot',
        timestamp: now,
      }));

      const event: NormalizedPushEvent = {
        type: 'push',
        deliveryId: 'delivery-push-bound',
        timestamp: now,
        repoFullName: 'org/repo',
        branch: 'main',
        forced: false,
        commits,
        headSha: commits[0].sha,
        beforeSha: 'f'.repeat(40),
        pusherName: 'bot',
      };

      await handlePush(event, env);

      const rows = await env.DB.prepare('SELECT COUNT(*) as cnt FROM commit_log').first();
      expect(rows?.cnt).toBe(20);
    });

    it('detects force push and records to force_push_events', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 1);

      const event: NormalizedPushEvent = {
        type: 'push',
        deliveryId: 'delivery-force-1',
        timestamp: now,
        repoFullName: 'org/repo',
        branch: 'main',
        forced: true,
        commits: [{ sha: 'a'.repeat(40), message: 'Force pushed', author: 'alice', timestamp: now }],
        headSha: 'a'.repeat(40),
        beforeSha: 'b'.repeat(40),
        pusherName: 'alice',
      };

      await handlePush(event, env);

      const forceEvents = await env.DB.prepare('SELECT * FROM force_push_events').all();
      expect(forceEvents.results).toHaveLength(1);
      expect(forceEvents.results[0].before_sha).toBe('b'.repeat(40));
      expect(forceEvents.results[0].after_sha).toBe('a'.repeat(40));
      expect(forceEvents.results[0].branch).toBe('main');
      expect(forceEvents.results[0].webhook_delivery_id).toBe('delivery-force-1');

      const audits = await env.DB.prepare(
        "SELECT * FROM audit_events WHERE action = 'force_push.detected'"
      ).all();
      expect(audits.results).toHaveLength(1);
    });

    it('is idempotent — skips duplicate delivery_id', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 1);

      const event: NormalizedPushEvent = {
        type: 'push',
        deliveryId: 'delivery-idempotent',
        timestamp: now,
        repoFullName: 'org/repo',
        branch: 'main',
        forced: false,
        commits: [{ sha: 'a'.repeat(40), message: 'Commit', author: 'alice', timestamp: now }],
        headSha: 'a'.repeat(40),
        beforeSha: 'b'.repeat(40),
        pusherName: 'alice',
      };

      await handlePush(event, env);
      await handlePush(event, env);

      const rows = await env.DB.prepare('SELECT COUNT(*) as cnt FROM commit_log').first();
      expect(rows?.cnt).toBe(1);
    });

    it('skips push for untracked repo', async () => {
      const event: NormalizedPushEvent = {
        type: 'push',
        deliveryId: 'delivery-unknown-repo',
        timestamp: now,
        repoFullName: 'unknown/repo',
        branch: 'main',
        forced: false,
        commits: [{ sha: 'a'.repeat(40), message: 'Commit', author: 'alice', timestamp: now }],
        headSha: 'a'.repeat(40),
        beforeSha: 'b'.repeat(40),
        pusherName: 'alice',
      };

      await handlePush(event, env);

      const rows = await env.DB.prepare('SELECT COUNT(*) as cnt FROM commit_log').first();
      expect(rows?.cnt).toBe(0);
    });

    it('skips push for team with bot_active = 0', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 0);

      const event: NormalizedPushEvent = {
        type: 'push',
        deliveryId: 'delivery-inactive',
        timestamp: now,
        repoFullName: 'org/repo',
        branch: 'main',
        forced: false,
        commits: [{ sha: 'a'.repeat(40), message: 'Commit', author: 'alice', timestamp: now }],
        headSha: 'a'.repeat(40),
        beforeSha: 'b'.repeat(40),
        pusherName: 'alice',
      };

      await handlePush(event, env);

      const rows = await env.DB.prepare('SELECT COUNT(*) as cnt FROM commit_log').first();
      expect(rows?.cnt).toBe(0);
    });

    it('force push with affected submissions flags them for review', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 1);

      await env.DB.prepare(
        `INSERT INTO submissions (id, team_id, hackathon_id, tag_name, commit_sha, submitted_at, received_at, is_late, is_final, version, status, webhook_delivery_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
      ).bind('sub-1', 'team-1', 'hack-1', 'submission_v1', 'a'.repeat(40), now, now, 0, 0, 1, 'received', 'delivery-sub-1').run();
      
      await env.DB.prepare(
        `INSERT INTO submissions (id, team_id, hackathon_id, tag_name, commit_sha, submitted_at, received_at, is_late, is_final, version, status, webhook_delivery_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
      ).bind('sub-2', 'team-1', 'hack-1', 'submission_v2', 'b'.repeat(40), now, now, 0, 0, 2, 'validated', 'delivery-sub-2').run();

      const mockQueue = { send: async () => {} };
      const mockEnv = { ...env, NOTIFICATION_QUEUE: mockQueue };

      const event: NormalizedPushEvent = {
        type: 'push',
        deliveryId: 'delivery-force-flagged',
        timestamp: now,
        repoFullName: 'org/repo',
        branch: 'main',
        forced: true,
        commits: [{ sha: 'c'.repeat(40), message: 'Force push', author: 'alice', timestamp: now }],
        headSha: 'c'.repeat(40),
        beforeSha: 'b'.repeat(40),
        pusherName: 'alice',
        size: 10,
      };

      await handlePush(event, mockEnv);

      const forceEvents = await env.DB.prepare('SELECT * FROM force_push_events').all();
      expect(forceEvents.results).toHaveLength(1);
      expect(forceEvents.results[0].action_taken).toBe('flagged');
      expect(forceEvents.results[0].commits_lost_count).toBe(9);
      
      const submissionsInvalidated = JSON.parse(forceEvents.results[0].submissions_invalidated as string);
      expect(submissionsInvalidated).toHaveLength(2);
      expect(submissionsInvalidated).toContain('sub-1');
      expect(submissionsInvalidated).toContain('sub-2');
    });

    it('force push without affected submissions keeps default action_taken', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 1);

      const mockQueue = { send: async () => {} };
      const mockEnv = { ...env, NOTIFICATION_QUEUE: mockQueue };

      const event: NormalizedPushEvent = {
        type: 'push',
        deliveryId: 'delivery-force-no-subs',
        timestamp: now,
        repoFullName: 'org/repo',
        branch: 'main',
        forced: true,
        commits: [{ sha: 'd'.repeat(40), message: 'Force push', author: 'bob', timestamp: now }],
        headSha: 'd'.repeat(40),
        beforeSha: 'e'.repeat(40),
        pusherName: 'bob',
        size: 5,
      };

      await handlePush(event, mockEnv);

      const forceEvents = await env.DB.prepare('SELECT * FROM force_push_events').all();
      expect(forceEvents.results).toHaveLength(1);
      expect(forceEvents.results[0].action_taken).toBe('logged');
      expect(forceEvents.results[0].commits_lost_count).toBe(4);
      expect(forceEvents.results[0].submissions_invalidated).toBeNull();
    });

    it('force push enqueues notification to NOTIFICATION_QUEUE', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 1);

      await env.DB.prepare(
        `INSERT INTO submissions (id, team_id, hackathon_id, tag_name, commit_sha, submitted_at, received_at, is_late, is_final, version, status, webhook_delivery_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
      ).bind('sub-1', 'team-1', 'hack-1', 'submission_v1', 'a'.repeat(40), now, now, 0, 0, 1, 'locked', 'delivery-sub-1').run();

      let queuedMessage: unknown = null;
      const mockQueue = { 
        send: async (msg: unknown) => { 
          queuedMessage = msg; 
        } 
      };
      const mockEnv = { ...env, NOTIFICATION_QUEUE: mockQueue };

      const event: NormalizedPushEvent = {
        type: 'push',
        deliveryId: 'delivery-force-notif',
        timestamp: now,
        repoFullName: 'org/repo',
        branch: 'main',
        forced: true,
        commits: [{ sha: 'f'.repeat(40), message: 'Force', author: 'alice', timestamp: now }],
        headSha: 'f'.repeat(40),
        beforeSha: 'g'.repeat(40),
        pusherName: 'alice',
        size: 3,
      };

      await handlePush(event, mockEnv);

      expect(queuedMessage).toBeDefined();
      const msg = queuedMessage as Record<string, unknown>;
      expect(msg.type).toBe('force_push_alert');
      expect(msg.hackathonId).toBe('hack-1');
      expect(msg.teamId).toBe('team-1');
      expect(msg.affectedSubmissionCount).toBe(1);
      expect(typeof msg.forcePushId).toBe('string');
    });
  });

  describe('tag create handler', () => {
    function makeMockEnv(doResponse: { status: number; body: Record<string, unknown> }): Env {
      const mockStub = {
        fetch: async () => Response.json(doResponse.body, { status: doResponse.status }),
      };
      return {
        ...env,
        HACKATHON_SM: {
          idFromName: () => ({ toString: () => 'mock-do-id' }),
          get: () => mockStub,
        } as unknown as DurableObjectNamespace,
      };
    }

    it('creates submission via DO and writes to D1', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 1);

      await env.KV.put('repo:org/repo', JSON.stringify({ hackathonId: 'hack-1', teamId: 'team-1' }));

      const event: NormalizedTagCreateEvent = {
        type: 'tag_created',
        deliveryId: 'delivery-tag-1',
        timestamp: now,
        repoFullName: 'org/repo',
        tagName: 'submission_v1',
        sha: 'a'.repeat(40),
        senderLogin: 'alice',
      };

      const mockEnv = makeMockEnv({ status: 201, body: { accepted: true, submissionId: 'mock-sub-id' } });
      await handleTagCreate(event, mockEnv);

      const subs = await env.DB.prepare('SELECT * FROM submissions').all();
      expect(subs.results).toHaveLength(1);
      expect(subs.results[0].team_id).toBe('team-1');
      expect(subs.results[0].hackathon_id).toBe('hack-1');
      expect(subs.results[0].tag_name).toBe('submission_v1');
      expect(subs.results[0].commit_sha).toBe('a'.repeat(40));
      expect(subs.results[0].webhook_delivery_id).toBe('delivery-tag-1');
      expect(subs.results[0].status).toBe('received');

      const audits = await env.DB.prepare(
        "SELECT * FROM audit_events WHERE action = 'submission.received'"
      ).all();
      expect(audits.results).toHaveLength(1);
    });

    it('skips tag create for unmapped repo (no KV entry)', async () => {
      const event: NormalizedTagCreateEvent = {
        type: 'tag_created',
        deliveryId: 'delivery-tag-unmapped',
        timestamp: now,
        repoFullName: 'unknown/repo',
        tagName: 'submission_v1',
        sha: 'a'.repeat(40),
        senderLogin: 'alice',
      };

      await handleTagCreate(event, env);

      const subs = await env.DB.prepare('SELECT COUNT(*) as cnt FROM submissions').first();
      expect(subs?.cnt).toBe(0);
    });

    it('is idempotent — duplicate delivery_id does not create duplicate', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 1);
      await env.KV.put('repo:org/repo', JSON.stringify({ hackathonId: 'hack-1', teamId: 'team-1' }));

      const event: NormalizedTagCreateEvent = {
        type: 'tag_created',
        deliveryId: 'delivery-tag-dup',
        timestamp: now,
        repoFullName: 'org/repo',
        tagName: 'submission_v1',
        sha: 'a'.repeat(40),
        senderLogin: 'alice',
      };

      const mockEnv = makeMockEnv({ status: 201, body: { accepted: true, submissionId: 'mock-sub-id' } });
      await handleTagCreate(event, mockEnv);
      await handleTagCreate(event, mockEnv);

      const subs = await env.DB.prepare('SELECT COUNT(*) as cnt FROM submissions').first();
      expect(subs?.cnt).toBe(1);
    });

    it('records rejection audit when DO rejects submission', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 1);
      await env.KV.put('repo:org/repo', JSON.stringify({ hackathonId: 'hack-1', teamId: 'team-1' }));

      const event: NormalizedTagCreateEvent = {
        type: 'tag_created',
        deliveryId: 'delivery-tag-rejected',
        timestamp: now,
        repoFullName: 'org/repo',
        tagName: 'submission_v1',
        sha: 'a'.repeat(40),
        senderLogin: 'alice',
      };

      const mockEnv = makeMockEnv({ status: 400, body: { accepted: false, reason: 'Submission deadline has passed' } });
      await handleTagCreate(event, mockEnv);

      const subs = await env.DB.prepare('SELECT COUNT(*) as cnt FROM submissions').first();
      expect(subs?.cnt).toBe(0);

      const audits = await env.DB.prepare(
        "SELECT * FROM audit_events WHERE action = 'submission.rejected'"
      ).all();
      expect(audits.results).toHaveLength(1);
    });
  });

  describe('tag delete handler', () => {
    it('inserts audit event but does NOT invalidate submissions', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 1);

      await env.DB.prepare(
        `INSERT INTO submissions (id, team_id, hackathon_id, tag_name, commit_sha, submitted_at, received_at, is_late, is_final, version, status, webhook_delivery_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
      ).bind('sub-1', 'team-1', 'hack-1', 'submission_v1', 'a'.repeat(40), now, now, 0, 0, 1, 'received', 'delivery-original').run();

      const event: NormalizedTagDeleteEvent = {
        type: 'tag_deleted',
        deliveryId: 'delivery-tagdel-1',
        timestamp: now,
        repoFullName: 'org/repo',
        tagName: 'submission_v1',
        senderLogin: 'alice',
      };

      await handleTagDelete(event, env);

      const audits = await env.DB.prepare(
        "SELECT * FROM audit_events WHERE action = 'tag.deleted'"
      ).all();
      expect(audits.results).toHaveLength(1);

      const subs = await env.DB.prepare('SELECT status FROM submissions WHERE id = ?1').bind('sub-1').first();
      expect(subs?.status).toBe('received');
    });
  });

  describe('installation handler', () => {
    it('sets bot_active = 1 on install (created)', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 0);

      const event: NormalizedInstallationEvent = {
        type: 'installation',
        deliveryId: 'delivery-install-1',
        timestamp: now,
        action: 'created',
        installationId: 12345,
        senderLogin: 'alice',
        repositories: [{ fullName: 'org/repo' }],
      };

      await handleInstallation(event, env);

      const team = await env.DB.prepare('SELECT bot_active FROM teams WHERE id = ?1').bind('team-1').first();
      expect(team?.bot_active).toBe(1);

      const audits = await env.DB.prepare(
        "SELECT * FROM audit_events WHERE action = 'installation.created'"
      ).all();
      expect(audits.results).toHaveLength(1);
    });

    it('sets bot_active = 1 on install (added)', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 0);

      const event: NormalizedInstallationEvent = {
        type: 'installation',
        deliveryId: 'delivery-install-added',
        timestamp: now,
        action: 'added',
        installationId: 12345,
        senderLogin: 'alice',
        repositories: [{ fullName: 'org/repo' }],
      };

      await handleInstallation(event, env);

      const team = await env.DB.prepare('SELECT bot_active FROM teams WHERE id = ?1').bind('team-1').first();
      expect(team?.bot_active).toBe(1);
    });

    it('sets bot_active = 0 on uninstall (deleted)', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 1);

      const event: NormalizedInstallationEvent = {
        type: 'installation',
        deliveryId: 'delivery-uninstall-1',
        timestamp: now,
        action: 'deleted',
        installationId: 12345,
        senderLogin: 'alice',
        repositories: [{ fullName: 'org/repo' }],
      };

      await handleInstallation(event, env);

      const team = await env.DB.prepare('SELECT bot_active FROM teams WHERE id = ?1').bind('team-1').first();
      expect(team?.bot_active).toBe(0);
    });

    it('sets bot_active = 0 on uninstall (removed)', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo', 1);

      const event: NormalizedInstallationEvent = {
        type: 'installation',
        deliveryId: 'delivery-uninstall-removed',
        timestamp: now,
        action: 'removed',
        installationId: 12345,
        senderLogin: 'alice',
        repositories: [{ fullName: 'org/repo' }],
      };

      await handleInstallation(event, env);

      const team = await env.DB.prepare('SELECT bot_active FROM teams WHERE id = ?1').bind('team-1').first();
      expect(team?.bot_active).toBe(0);
    });

    it('handles multiple repos in a single installation event', async () => {
      await insertUser('user-1', 1001);
      await insertHackathon('hack-1', 'test-hack', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha', 'org/repo1', 0);
      await insertTeam('team-2', 'hack-1', 'Team Beta', 'org/repo2', 0);

      const event: NormalizedInstallationEvent = {
        type: 'installation',
        deliveryId: 'delivery-multi-install',
        timestamp: now,
        action: 'created',
        installationId: 12345,
        senderLogin: 'alice',
        repositories: [{ fullName: 'org/repo1' }, { fullName: 'org/repo2' }],
      };

      await handleInstallation(event, env);

      const team1 = await env.DB.prepare('SELECT bot_active FROM teams WHERE id = ?1').bind('team-1').first();
      const team2 = await env.DB.prepare('SELECT bot_active FROM teams WHERE id = ?1').bind('team-2').first();
      expect(team1?.bot_active).toBe(1);
      expect(team2?.bot_active).toBe(1);
    });

    it('ignores repos that are not tracked', async () => {
      const event: NormalizedInstallationEvent = {
        type: 'installation',
        deliveryId: 'delivery-install-unknown',
        timestamp: now,
        action: 'created',
        installationId: 12345,
        senderLogin: 'alice',
        repositories: [{ fullName: 'unknown/repo' }],
      };

      await handleInstallation(event, env);

      const audits = await env.DB.prepare(
        "SELECT * FROM audit_events WHERE action = 'installation.created'"
      ).all();
      expect(audits.results).toHaveLength(1);
    });
  });
});
