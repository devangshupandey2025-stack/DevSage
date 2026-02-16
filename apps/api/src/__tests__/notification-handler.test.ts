import { env as rawEnv } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleNotification } from '../queue/notification-handler.js';
import type { Env } from '../types/env.js';
import type { NotificationMessage } from '../queue/notification-handler.js';

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
    `CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY NOT NULL, team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member' NOT NULL, joined_at TEXT NOT NULL, FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_user_unique ON team_members (team_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS organizer_roles (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'admin' NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS organizer_roles_hackathon_user_unique ON organizer_roles (hackathon_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS judges (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, user_id TEXT NOT NULL, invite_status TEXT DEFAULT 'pending' NOT NULL, invited_at TEXT NOT NULL, accepted_at TEXT, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS judges_hackathon_user_unique ON judges (hackathon_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY NOT NULL, team_id TEXT NOT NULL, hackathon_id TEXT NOT NULL, tag_name TEXT NOT NULL, commit_sha TEXT NOT NULL, commit_message TEXT, commit_author TEXT, branch TEXT DEFAULT 'main', submitted_at TEXT NOT NULL, received_at TEXT NOT NULL, is_late INTEGER DEFAULT 0 NOT NULL, is_final INTEGER DEFAULT 0 NOT NULL, version INTEGER NOT NULL, status TEXT DEFAULT 'received' NOT NULL, validation_errors TEXT, locked_at TEXT, webhook_delivery_id TEXT UNIQUE, FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT, team_id TEXT, actor_id TEXT, actor_type TEXT NOT NULL, event_type TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, metadata TEXT, ip_address TEXT, created_at TEXT NOT NULL)`,
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

async function insertUser(id: string, githubId: number, email: string) {
  await env.DB
    .prepare(
      `INSERT INTO users (id, github_id, github_username, display_name, email, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
    .bind(id, githubId, `user-${githubId}`, `User ${githubId}`, email, now, now)
    .run();
}

async function insertHackathon(id: string, slug: string, title: string, createdBy: string) {
  await env.DB
    .prepare(
      `INSERT INTO hackathons (id, slug, title, registration_opens, registration_closes, submission_deadline, status, created_by, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    )
    .bind(id, slug, title, now, now, now, 'active', createdBy, now, now)
    .run();
}

async function insertTeam(id: string, hackathonId: string, name: string) {
  await env.DB
    .prepare(
      `INSERT INTO teams (id, hackathon_id, name, created_at)
       VALUES (?1, ?2, ?3, ?4)`
    )
    .bind(id, hackathonId, name, now)
    .run();
}

async function insertTeamMember(teamId: string, userId: string, role: 'leader' | 'member') {
  await env.DB
    .prepare(
      `INSERT INTO team_members (id, team_id, user_id, role, joined_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    )
    .bind(crypto.randomUUID(), teamId, userId, role, now)
    .run();
}

async function insertOrganizerRole(hackathonId: string, userId: string, role: 'owner' | 'admin' | 'moderator') {
  await env.DB
    .prepare(
      `INSERT INTO organizer_roles (id, hackathon_id, user_id, role, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    )
    .bind(crypto.randomUUID(), hackathonId, userId, role, now)
    .run();
}

async function insertJudge(id: string, hackathonId: string, userId: string, inviteStatus: 'pending' | 'accepted' | 'declined') {
  await env.DB
    .prepare(
      `INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    )
    .bind(id, hackathonId, userId, inviteStatus, now)
    .run();
}

describe('notification queue consumer', () => {
  let mockSendEmail: ReturnType<typeof vi.fn>;
  let testEnv: Env;

  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetDb();
    
    // Mock sendEmail function
    mockSendEmail = vi.fn().mockResolvedValue({ success: true });
    
    // Setup test environment with mocked SMTP
    testEnv = {
      ...env,
      FRONTEND_URL: 'https://devsage.org',
      PLATFORM_URL: 'https://platform.devsage.org',
      ADMIN_URL: 'https://shikdd.devsage.org',
      SMTP_URL: 'https://smtp.example.com',
      SMTP_USERNAME: 'test',
      SMTP_PASSWORD: 'test',
      SMTP_EMAIL_ADDR: 'noreply@devsage.org',
    };
  });

  describe('submission_received', () => {
    it('sends email to all team members', async () => {
      // Setup: create hackathon, team with 3 members
      await insertUser('user-1', 1001, 'alice@example.com');
      await insertUser('user-2', 1002, 'bob@example.com');
      await insertUser('user-3', 1003, 'charlie@example.com');
      await insertHackathon('hack-1', 'test-hack', 'Test Hackathon', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha');
      await insertTeamMember('team-1', 'user-1', 'leader');
      await insertTeamMember('team-1', 'user-2', 'member');
      await insertTeamMember('team-1', 'user-3', 'member');

      const message: NotificationMessage = {
        type: 'submission_received',
        hackathonId: 'hack-1',
        teamId: 'team-1',
        tagName: 'submission_v1',
        commitSha: 'a'.repeat(40),
      };

      // Mock sendEmail by replacing the module
      const module = await import('../services/smtp.js');
      vi.spyOn(module, 'sendEmail').mockResolvedValue({ success: true });

      await handleNotification(message, testEnv);

      // Assert: sendEmail called 3 times (once per team member)
      expect(module.sendEmail).toHaveBeenCalledTimes(3);
      
      // Assert: emails sent to all team members
      const calls = (module.sendEmail as any).mock.calls;
      const recipients = calls.map((call: any) => call[1].to);
      expect(recipients).toContain('alice@example.com');
      expect(recipients).toContain('bob@example.com');
      expect(recipients).toContain('charlie@example.com');

      // Assert: email content contains team name and tag
      const firstCall = calls[0][1];
      expect(firstCall.subject).toContain('Submission Received');
      expect(firstCall.body).toContain('Team Alpha');
      expect(firstCall.body).toContain('submission_v1');

      // Assert: audit events logged for each send
      const audits = await env.DB.prepare(
        "SELECT * FROM audit_events WHERE event_type = 'notification.sent'"
      ).all();
      expect(audits.results).toHaveLength(3);

      vi.restoreAllMocks();
    });

    it('skips team members without email addresses', async () => {
      await insertUser('user-1', 1001, 'alice@example.com');
      await insertUser('user-2', 1002, ''); // No email
      await insertHackathon('hack-1', 'test-hack', 'Test Hackathon', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha');
      await insertTeamMember('team-1', 'user-1', 'leader');
      await insertTeamMember('team-1', 'user-2', 'member');

      const message: NotificationMessage = {
        type: 'submission_received',
        hackathonId: 'hack-1',
        teamId: 'team-1',
        tagName: 'submission_v1',
        commitSha: 'a'.repeat(40),
      };

      const module = await import('../services/smtp.js');
      vi.spyOn(module, 'sendEmail').mockResolvedValue({ success: true });

      await handleNotification(message, testEnv);

      // Assert: only 1 email sent (to user with email)
      expect(module.sendEmail).toHaveBeenCalledTimes(1);
      expect((module.sendEmail as any).mock.calls[0][1].to).toBe('alice@example.com');

      vi.restoreAllMocks();
    });
  });

  describe('submission_invalid', () => {
    it('sends email only to team leader', async () => {
      await insertUser('user-1', 1001, 'leader@example.com');
      await insertUser('user-2', 1002, 'member@example.com');
      await insertHackathon('hack-1', 'test-hack', 'Test Hackathon', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha');
      await insertTeamMember('team-1', 'user-1', 'leader');
      await insertTeamMember('team-1', 'user-2', 'member');

      const message: NotificationMessage = {
        type: 'submission_invalid',
        hackathonId: 'hack-1',
        teamId: 'team-1',
        tagName: 'submission_v1',
        reason: 'Missing required files',
      };

      const module = await import('../services/smtp.js');
      vi.spyOn(module, 'sendEmail').mockResolvedValue({ success: true });

      await handleNotification(message, testEnv);

      // Assert: only 1 email sent (to leader only)
      expect(module.sendEmail).toHaveBeenCalledTimes(1);
      expect((module.sendEmail as any).mock.calls[0][1].to).toBe('leader@example.com');
      
      // Assert: email contains reason
      expect((module.sendEmail as any).mock.calls[0][1].body).toContain('Missing required files');

      vi.restoreAllMocks();
    });
  });

  describe('force_push_alert', () => {
    it('sends email to all moderator+ organizers', async () => {
      await insertUser('owner-user', 1001, 'owner@example.com');
      await insertUser('admin-user', 1002, 'admin@example.com');
      await insertUser('moderator-user', 1003, 'moderator@example.com');
      await insertUser('judge-user', 1004, 'judge@example.com'); // Should NOT receive alert
      await insertHackathon('hack-1', 'test-hack', 'Test Hackathon', 'owner-user');
      
      await insertOrganizerRole('hack-1', 'owner-user', 'owner');
      await insertOrganizerRole('hack-1', 'admin-user', 'admin');
      await insertOrganizerRole('hack-1', 'moderator-user', 'moderator');
      await insertJudge('judge-1', 'hack-1', 'judge-user', 'accepted');

      await insertTeam('team-1', 'hack-1', 'Team Alpha');

      const message: NotificationMessage = {
        type: 'force_push_alert',
        hackathonId: 'hack-1',
        teamId: 'team-1',
        forcePushId: 'force-1',
        affectedSubmissionCount: 2,
      };

      const module = await import('../services/smtp.js');
      vi.spyOn(module, 'sendEmail').mockResolvedValue({ success: true });

      await handleNotification(message, testEnv);

      // Assert: 3 emails sent (owner, admin, moderator - NOT judge)
      expect(module.sendEmail).toHaveBeenCalledTimes(3);
      
      const recipients = (module.sendEmail as any).mock.calls.map((call: any) => call[1].to);
      expect(recipients).toContain('owner@example.com');
      expect(recipients).toContain('admin@example.com');
      expect(recipients).toContain('moderator@example.com');
      expect(recipients).not.toContain('judge@example.com');

      vi.restoreAllMocks();
    });
  });

  describe('phase_transition', () => {
    it('sends email to all hackathon participants', async () => {
      await insertUser('user-1', 1001, 'user1@example.com');
      await insertUser('user-2', 1002, 'user2@example.com');
      await insertUser('user-3', 1003, 'user3@example.com');
      await insertUser('user-4', 1004, 'user4@example.com');
      await insertHackathon('hack-1', 'test-hack', 'Test Hackathon', 'user-1');
      
      // Two teams with different members
      await insertTeam('team-1', 'hack-1', 'Team Alpha');
      await insertTeamMember('team-1', 'user-1', 'leader');
      await insertTeamMember('team-1', 'user-2', 'member');
      
      await insertTeam('team-2', 'hack-1', 'Team Beta');
      await insertTeamMember('team-2', 'user-3', 'leader');
      await insertTeamMember('team-2', 'user-4', 'member');

      const message: NotificationMessage = {
        type: 'phase_transition',
        hackathonId: 'hack-1',
        fromPhase: 'active',
        toPhase: 'judging',
      };

      const module = await import('../services/smtp.js');
      vi.spyOn(module, 'sendEmail').mockResolvedValue({ success: true });

      await handleNotification(message, testEnv);

      // Assert: 4 emails sent (all participants across both teams)
      expect(module.sendEmail).toHaveBeenCalledTimes(4);

      const recipients = (module.sendEmail as any).mock.calls.map((call: any) => call[1].to);
      expect(recipients).toContain('user1@example.com');
      expect(recipients).toContain('user2@example.com');
      expect(recipients).toContain('user3@example.com');
      expect(recipients).toContain('user4@example.com');

      vi.restoreAllMocks();
    });
  });

  describe('judge_invited', () => {
    it('sends email to invited judge', async () => {
      await insertUser('judge-user', 1001, 'judge@example.com');
      await insertUser('organizer', 1002, 'organizer@example.com');
      await insertHackathon('hack-1', 'test-hack', 'Test Hackathon', 'organizer');
      await insertJudge('judge-1', 'hack-1', 'judge-user', 'pending');

      const message: NotificationMessage = {
        type: 'judge_invited',
        hackathonId: 'hack-1',
        judgeId: 'judge-1',
      };

      const module = await import('../services/smtp.js');
      vi.spyOn(module, 'sendEmail').mockResolvedValue({ success: true });

      await handleNotification(message, testEnv);

      // Assert: 1 email sent to judge
      expect(module.sendEmail).toHaveBeenCalledTimes(1);
      expect((module.sendEmail as any).mock.calls[0][1].to).toBe('judge@example.com');
      expect((module.sendEmail as any).mock.calls[0][1].subject).toContain('Judge Invitation');

      vi.restoreAllMocks();
    });
  });

  describe('judge_assignment', () => {
    it('sends email to assigned judge', async () => {
      await insertUser('judge-user', 1001, 'judge@example.com');
      await insertUser('organizer', 1002, 'organizer@example.com');
      await insertHackathon('hack-1', 'test-hack', 'Test Hackathon', 'organizer');
      await insertJudge('judge-1', 'hack-1', 'judge-user', 'accepted');
      await insertTeam('team-1', 'hack-1', 'Team Alpha');

      const message: NotificationMessage = {
        type: 'judge_assignment',
        hackathonId: 'hack-1',
        judgeId: 'judge-1',
        submissionCount: 5,
      };

      const module = await import('../services/smtp.js');
      vi.spyOn(module, 'sendEmail').mockResolvedValue({ success: true });

      await handleNotification(message, testEnv);

      // Assert: 1 email sent to judge
      expect(module.sendEmail).toHaveBeenCalledTimes(1);
      expect((module.sendEmail as any).mock.calls[0][1].to).toBe('judge@example.com');
      expect((module.sendEmail as any).mock.calls[0][1].body).toContain('5');

      vi.restoreAllMocks();
    });
  });

  describe('scores_finalized', () => {
    it('sends email to all team members', async () => {
      await insertUser('user-1', 1001, 'user1@example.com');
      await insertUser('user-2', 1002, 'user2@example.com');
      await insertUser('organizer', 1003, 'organizer@example.com');
      await insertHackathon('hack-1', 'test-hack', 'Test Hackathon', 'organizer');
      await insertTeam('team-1', 'hack-1', 'Team Alpha');
      await insertTeamMember('team-1', 'user-1', 'leader');
      await insertTeamMember('team-1', 'user-2', 'member');

      const message: NotificationMessage = {
        type: 'scores_finalized',
        hackathonId: 'hack-1',
        teamId: 'team-1',
      };

      const module = await import('../services/smtp.js');
      vi.spyOn(module, 'sendEmail').mockResolvedValue({ success: true });

      await handleNotification(message, testEnv);

      // Assert: 2 emails sent to all team members
      expect(module.sendEmail).toHaveBeenCalledTimes(2);
      
      const recipients = (module.sendEmail as any).mock.calls.map((call: any) => call[1].to);
      expect(recipients).toContain('user1@example.com');
      expect(recipients).toContain('user2@example.com');

      vi.restoreAllMocks();
    });
  });

  describe('deadline_reminder', () => {
    it('sends email to team leaders with no final submission', async () => {
      await insertUser('leader-1', 1001, 'leader1@example.com');
      await insertUser('member-1', 1002, 'member1@example.com');
      await insertUser('leader-2', 1003, 'leader2@example.com');
      await insertUser('organizer', 1004, 'organizer@example.com');
      await insertHackathon('hack-1', 'test-hack', 'Test Hackathon', 'organizer');
      
      // Team 1: has non-final submission
      await insertTeam('team-1', 'hack-1', 'Team Alpha');
      await insertTeamMember('team-1', 'leader-1', 'leader');
      await insertTeamMember('team-1', 'member-1', 'member');
      await env.DB.prepare(
        `INSERT INTO submissions (id, team_id, hackathon_id, tag_name, commit_sha, submitted_at, received_at, is_late, is_final, version, status, webhook_delivery_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
      ).bind('sub-1', 'team-1', 'hack-1', 'submission_v1', 'a'.repeat(40), now, now, 0, 0, 1, 'validated', 'delivery-1').run();
      
      // Team 2: no submission at all
      await insertTeam('team-2', 'hack-1', 'Team Beta');
      await insertTeamMember('team-2', 'leader-2', 'leader');

      const message: NotificationMessage = {
        type: 'deadline_reminder',
        hackathonId: 'hack-1',
        hoursRemaining: 24,
      };

      const module = await import('../services/smtp.js');
      vi.spyOn(module, 'sendEmail').mockResolvedValue({ success: true });

      await handleNotification(message, testEnv);

      // Assert: 2 emails sent (to both team leaders with no final submission)
      expect(module.sendEmail).toHaveBeenCalledTimes(2);
      
      const recipients = (module.sendEmail as any).mock.calls.map((call: any) => call[1].to);
      expect(recipients).toContain('leader1@example.com');
      expect(recipients).toContain('leader2@example.com');
      
      // Assert: email mentions hours remaining
      expect((module.sendEmail as any).mock.calls[0][1].body).toContain('24');

      vi.restoreAllMocks();
    });
  });

  describe('error handling', () => {
    it('logs failed send attempts to audit_events', async () => {
      await insertUser('user-1', 1001, 'user1@example.com');
      await insertHackathon('hack-1', 'test-hack', 'Test Hackathon', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha');
      await insertTeamMember('team-1', 'user-1', 'leader');

      const message: NotificationMessage = {
        type: 'submission_received',
        hackathonId: 'hack-1',
        teamId: 'team-1',
        tagName: 'submission_v1',
        commitSha: 'a'.repeat(40),
      };

      const module = await import('../services/smtp.js');
      vi.spyOn(module, 'sendEmail').mockResolvedValue({ 
        success: false, 
        error: 'SMTP server unavailable' 
      });

      await handleNotification(message, testEnv);

      // Assert: audit event logged with failure
      const audits = await env.DB.prepare(
        "SELECT * FROM audit_events WHERE event_type = 'notification.failed'"
      ).all();
      expect(audits.results).toHaveLength(1);
      
      const details = JSON.parse(audits.results[0].metadata as string);
      expect(details.error).toBe('SMTP server unavailable');

      vi.restoreAllMocks();
    });

    it('continues sending to remaining recipients after one failure', async () => {
      await insertUser('user-1', 1001, 'user1@example.com');
      await insertUser('user-2', 1002, 'user2@example.com');
      await insertHackathon('hack-1', 'test-hack', 'Test Hackathon', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha');
      await insertTeamMember('team-1', 'user-1', 'leader');
      await insertTeamMember('team-1', 'user-2', 'member');

      const message: NotificationMessage = {
        type: 'submission_received',
        hackathonId: 'hack-1',
        teamId: 'team-1',
        tagName: 'submission_v1',
        commitSha: 'a'.repeat(40),
      };

      const module = await import('../services/smtp.js');
      const mockSend = vi.spyOn(module, 'sendEmail')
        .mockResolvedValueOnce({ success: false, error: 'Failed' })
        .mockResolvedValueOnce({ success: true });

      await handleNotification(message, testEnv);

      // Assert: both sends attempted
      expect(mockSend).toHaveBeenCalledTimes(2);
      
      // Assert: one success, one failure logged
      const successAudits = await env.DB.prepare(
        "SELECT * FROM audit_events WHERE event_type = 'notification.sent'"
      ).all();
      const failureAudits = await env.DB.prepare(
        "SELECT * FROM audit_events WHERE event_type = 'notification.failed'"
      ).all();
      
      expect(successAudits.results).toHaveLength(1);
      expect(failureAudits.results).toHaveLength(1);

      vi.restoreAllMocks();
    });
  });

  describe('serialized SMTP calls', () => {
    it('sends emails one at a time (not concurrently)', async () => {
      await insertUser('user-1', 1001, 'user1@example.com');
      await insertUser('user-2', 1002, 'user2@example.com');
      await insertUser('user-3', 1003, 'user3@example.com');
      await insertHackathon('hack-1', 'test-hack', 'Test Hackathon', 'user-1');
      await insertTeam('team-1', 'hack-1', 'Team Alpha');
      await insertTeamMember('team-1', 'user-1', 'leader');
      await insertTeamMember('team-1', 'user-2', 'member');
      await insertTeamMember('team-1', 'user-3', 'member');

      const message: NotificationMessage = {
        type: 'submission_received',
        hackathonId: 'hack-1',
        teamId: 'team-1',
        tagName: 'submission_v1',
        commitSha: 'a'.repeat(40),
      };

      const callOrder: number[] = [];
      let callCounter = 0;
      const module = await import('../services/smtp.js');
      vi.spyOn(module, 'sendEmail').mockImplementation(async () => {
        const myCallNumber = ++callCounter;
        callOrder.push(myCallNumber);
        await new Promise(resolve => setTimeout(resolve, 10));
        return { success: true };
      });

      await handleNotification(message, testEnv);

      // Assert: calls were made sequentially
      expect(callOrder).toHaveLength(3);
      // Assert: call numbers are sequential (1, 2, 3), proving serialization
      expect(callOrder).toEqual([1, 2, 3]);

      vi.restoreAllMocks();
    });
  });
});
