import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { env as rawEnv } from 'cloudflare:test';
import type { Env } from '../types/env.js';
import type { ScheduledEvent } from '@cloudflare/workers-types';
import worker from '../index.js';

const env = rawEnv as Env;

async function ensureSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, github_id INTEGER NOT NULL, google_id TEXT, github_username TEXT NOT NULL, display_name TEXT NOT NULL, email TEXT, avatar_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS users_github_id_unique ON users (github_id)`,
    `CREATE TABLE IF NOT EXISTS hackathons (id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, description TEXT, rules_md TEXT, registration_opens TEXT NOT NULL, registration_closes TEXT NOT NULL, submission_deadline TEXT NOT NULL, judging_starts TEXT, judging_ends TEXT, min_team_size INTEGER DEFAULT 1 NOT NULL, max_team_size INTEGER DEFAULT 5 NOT NULL, max_teams INTEGER, submission_tag_pattern TEXT DEFAULT 'submission_v%' NOT NULL, max_submissions_per_team INTEGER, allow_late_submissions INTEGER DEFAULT 0 NOT NULL, primary_color TEXT DEFAULT '#6366f1', logo_r2_key TEXT, banner_r2_key TEXT, custom_subdomain TEXT, status TEXT DEFAULT 'draft' NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (created_by) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS hackathons_slug_unique ON hackathons (slug)`,
    `CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT, actor_id TEXT, actor_type TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, details TEXT, ip_address TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS organizer_roles (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'admin' NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS organizer_roles_hackathon_id_user_id_unique ON organizer_roles (hackathon_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, name TEXT NOT NULL, repo_full_name TEXT, repo_url TEXT, github_installation_id INTEGER, bot_active INTEGER DEFAULT 0 NOT NULL, invite_code TEXT, created_at TEXT NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS teams_invite_code_unique ON teams (invite_code)`,
    `CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY NOT NULL, team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member' NOT NULL, joined_at TEXT NOT NULL, FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_id_user_id_unique ON team_members (team_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS judges (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, user_id TEXT NOT NULL, invite_status TEXT DEFAULT 'pending' NOT NULL, invited_at TEXT NOT NULL, accepted_at TEXT, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS judges_hackathon_id_user_id_unique ON judges (hackathon_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY NOT NULL, team_id TEXT NOT NULL, hackathon_id TEXT NOT NULL, tag_name TEXT NOT NULL, commit_sha TEXT NOT NULL, commit_message TEXT, commit_author TEXT, branch TEXT DEFAULT 'main', submitted_at TEXT NOT NULL, received_at TEXT NOT NULL, is_late INTEGER DEFAULT 0 NOT NULL, is_final INTEGER DEFAULT 0 NOT NULL, version INTEGER NOT NULL, status TEXT DEFAULT 'received' NOT NULL, validation_errors TEXT, locked_at TEXT, webhook_delivery_id TEXT UNIQUE, FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS submissions_team_tag_unique ON submissions (team_id, tag_name)`,
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
  await env.DB.prepare('DELETE FROM submissions').run();
  await env.DB.prepare('DELETE FROM judges').run();
  await env.DB.prepare('DELETE FROM organizer_roles').run();
  await env.DB.prepare('DELETE FROM team_members').run();
  await env.DB.prepare('DELETE FROM teams').run();
  await env.DB.prepare('DELETE FROM hackathons').run();
  await env.DB.prepare('DELETE FROM users').run();
}

describe('scheduled cron handler', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('sends T-24h reminder for hackathon with deadline in 24 hours', async () => {
    const now = new Date();
    const deadlineIn24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Create user first (FK requirement)
    await env.DB.prepare(
      'INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind('user1', 1, 'user1', 'User 1', now.toISOString(), now.toISOString()).run();

    // Create hackathon with deadline in 24h
    await env.DB.prepare(
      'INSERT INTO hackathons (id, slug, title, status, submission_deadline, registration_opens, registration_closes, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind('h1', 'test-hack', 'Test Hackathon', 'active', deadlineIn24h.toISOString(), now.toISOString(), now.toISOString(), now.toISOString(), now.toISOString(), 'user1').run();

    // Mock NOTIFICATION_QUEUE.send
    const queueSpy = vi.spyOn(env.NOTIFICATION_QUEUE, 'send');

    // Trigger cron handler
    const mockEvent = {
      cron: '0 * * * *',
      scheduledTime: now.getTime(),
    } as ScheduledEvent;
    await worker.scheduled(mockEvent, env, { waitUntil: () => {} } as any);

    // Verify queue was called
    expect(queueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'deadline_reminder',
        hackathonId: 'h1',
        hoursRemaining: expect.any(Number),
      })
    );

    // Verify audit event was recorded
    const auditEventResult = await env.DB.prepare('SELECT * FROM audit_events WHERE hackathon_id = ?').bind('h1').all();
    expect(auditEventResult.results).toContainEqual(
      expect.objectContaining({
        hackathon_id: 'h1',
        action: 'deadline_reminder_24h',
      })
    );
  });

  it('sends T-1h reminder for hackathon with deadline in 1 hour', async () => {
    const now = new Date();
    const deadlineIn1h = new Date(now.getTime() + 60 * 60 * 1000);

    // Create user first (FK requirement)
    await env.DB.prepare(
      'INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind('user2', 2, 'user2', 'User 2', now.toISOString(), now.toISOString()).run();

    // Create hackathon with deadline in 1h
    await env.DB.prepare(
      'INSERT INTO hackathons (id, slug, title, status, submission_deadline, registration_opens, registration_closes, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind('h2', 'test-hack-2', 'Test Hackathon 2', 'active', deadlineIn1h.toISOString(), now.toISOString(), now.toISOString(), now.toISOString(), now.toISOString(), 'user2').run();

    // Mock NOTIFICATION_QUEUE.send
    const queueSpy = vi.spyOn(env.NOTIFICATION_QUEUE, 'send');

    // Trigger cron handler
    const mockEvent = {
      cron: '0 * * * *',
      scheduledTime: now.getTime(),
    } as ScheduledEvent;
    await worker.scheduled(mockEvent, env, { waitUntil: () => {} } as any);

    // Verify queue was called
    expect(queueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'deadline_reminder',
        hackathonId: 'h2',
        hoursRemaining: expect.any(Number),
      })
    );

    // Verify audit event was recorded
    const auditEventResult = await env.DB.prepare('SELECT * FROM audit_events WHERE hackathon_id = ?').bind('h2').all();
    expect(auditEventResult.results).toContainEqual(
      expect.objectContaining({
        hackathon_id: 'h2',
        action: 'deadline_reminder_1h',
      })
    );
  });

  it('does not send duplicate reminders', async () => {
    const now = new Date();
    const deadlineIn24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Create user first (FK requirement)
    await env.DB.prepare(
      'INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind('user3', 3, 'user3', 'User 3', now.toISOString(), now.toISOString()).run();

    // Create hackathon
    await env.DB.prepare(
      'INSERT INTO hackathons (id, slug, title, status, submission_deadline, registration_opens, registration_closes, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind('h3', 'test-hack-3', 'Test Hackathon 3', 'active', deadlineIn24h.toISOString(), now.toISOString(), now.toISOString(), now.toISOString(), now.toISOString(), 'user3').run();

    // Pre-insert audit event to simulate already sent reminder
    await env.DB.prepare(
      'INSERT INTO audit_events (id, hackathon_id, actor_type, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind('audit1', 'h3', 'cron', 'deadline_reminder_24h', 'hackathon', 'h3', now.toISOString()).run();

    // Mock NOTIFICATION_QUEUE.send
    const queueSpy = vi.spyOn(env.NOTIFICATION_QUEUE, 'send');

    // Trigger cron handler
    const mockEvent = {
      cron: '0 * * * *',
      scheduledTime: now.getTime(),
    } as ScheduledEvent;
    await worker.scheduled(mockEvent, env, { waitUntil: () => {} } as any);

    // Verify queue was NOT called
    expect(queueSpy).not.toHaveBeenCalled();
  });

  it('only checks active hackathons', async () => {
    const now = new Date();
    const deadlineIn24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Create user first (FK requirement)
    await env.DB.prepare(
      'INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind('user4', 4, 'user4', 'User 4', now.toISOString(), now.toISOString()).run();

    // Create completed hackathon with deadline in 24h
    await env.DB.prepare(
      'INSERT INTO hackathons (id, slug, title, status, submission_deadline, registration_opens, registration_closes, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind('h4', 'test-hack-4', 'Test Hackathon 4', 'completed', deadlineIn24h.toISOString(), now.toISOString(), now.toISOString(), now.toISOString(), now.toISOString(), 'user4').run();

    // Mock NOTIFICATION_QUEUE.send
    const queueSpy = vi.spyOn(env.NOTIFICATION_QUEUE, 'send');

    // Trigger cron handler
    const mockEvent = {
      cron: '0 * * * *',
      scheduledTime: now.getTime(),
    } as ScheduledEvent;
    await worker.scheduled(mockEvent, env, { waitUntil: () => {} } as any);

    // Verify queue was NOT called
    expect(queueSpy).not.toHaveBeenCalled();
  });

  it('records audit event with correct action type', async () => {
    const now = new Date();
    const deadlineIn1h = new Date(now.getTime() + 60 * 60 * 1000);

    // Create user first (FK requirement)
    await env.DB.prepare(
      'INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind('user5', 5, 'user5', 'User 5', now.toISOString(), now.toISOString()).run();

    // Create hackathon
    await env.DB.prepare(
      'INSERT INTO hackathons (id, slug, title, status, submission_deadline, registration_opens, registration_closes, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind('h5', 'test-hack-5', 'Test Hackathon 5', 'active', deadlineIn1h.toISOString(), now.toISOString(), now.toISOString(), now.toISOString(), now.toISOString(), 'user5').run();

    // Trigger cron handler
    const mockEvent = {
      cron: '0 * * * *',
      scheduledTime: now.getTime(),
    } as ScheduledEvent;
    await worker.scheduled(mockEvent, env, { waitUntil: () => {} } as any);

    // Verify audit event has correct action
    const auditEventResult = await env.DB.prepare('SELECT * FROM audit_events WHERE hackathon_id = ?').bind('h5').all();
    const event = auditEventResult.results?.[0];
    expect(event?.action).toBe('deadline_reminder_1h');
    expect(event?.actor_type).toBe('cron');
    expect(event?.entity_type).toBe('hackathon');
  });
});
