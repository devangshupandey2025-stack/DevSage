import { SELF } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureSchema, resetDb, authCookie,
  insertUser, insertWorkspace, insertWorkspaceMember,
  insertHackathon, insertOrganizerRole, insertTeam,
  insertTeamMember, insertJudge,
  SEED, env,
} from './helpers.js';
import type { ApiResponse } from './helpers.js';

const now = new Date().toISOString();
const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

async function seedBase() {
  await insertUser(SEED.organizer.id, SEED.organizer.email, SEED.organizer.name);
  await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
  await insertUser(SEED.judge.id, SEED.judge.email, SEED.judge.name);
  await insertWorkspace(SEED.workspace, 'devsage', SEED.organizer.id);
  await insertHackathon({
    id: SEED.hackathon, workspaceId: SEED.workspace,
    slug: SEED.hackathonSlug, createdBy: SEED.organizer.id, status: 'active',
  });
  await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Alpha' });
}

async function insertTeamInvite(params: {
  id: string; teamId: string; email: string; token: string; invitedBy: string;
  status?: string; expiresAt?: string;
}) {
  await env.DB.prepare(
    `INSERT INTO team_invites (id, team_id, email, invite_token, status, invited_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    params.id, params.teamId, params.email, params.token,
    params.status ?? 'pending', params.invitedBy, params.expiresAt ?? future,
  ).run();
}

describe('invite routes', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); });

  describe('POST /api/v1/invites/team/:token — accept team invite', () => {
    it('accepts a valid team invite', async () => {
      await seedBase();
      await insertTeamInvite({
        id: 'ti-1', teamId: SEED.team, email: SEED.participant.email,
        token: 'valid-token-abc', invitedBy: SEED.organizer.id,
      });

      const res = await SELF.fetch('http://localhost/api/v1/invites/team/valid-token-abc', {
        method: 'POST',
        headers: { Cookie: await authCookie(SEED.participant.id) },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<{ accepted: boolean; team_id: string }>;
      expect(body.ok).toBe(true);
      expect(body.data.accepted).toBe(true);
      expect(body.data.team_id).toBe(SEED.team);

      // Verify membership created
      const member = await env.DB.prepare(
        'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
      ).bind(SEED.team, SEED.participant.id).first();
      expect(member?.role).toBe('member');
    });

    it('returns 404 for invalid token', async () => {
      await seedBase();

      const res = await SELF.fetch('http://localhost/api/v1/invites/team/nonexistent-token', {
        method: 'POST',
        headers: { Cookie: await authCookie(SEED.participant.id) },
      });

      expect(res.status).toBe(404);
      const body = await res.json() as ApiResponse;
      expect(body.error?.code).toBe('NOT_FOUND');
    });

    it('returns error when user already on a team in same hackathon', async () => {
      await seedBase();
      await insertTeamMember(SEED.team, SEED.participant.id, 'member');
      await insertTeamInvite({
        id: 'ti-dup', teamId: SEED.team, email: SEED.participant.email,
        token: 'dup-token', invitedBy: SEED.organizer.id,
      });

      const res = await SELF.fetch('http://localhost/api/v1/invites/team/dup-token', {
        method: 'POST',
        headers: { Cookie: await authCookie(SEED.participant.id) },
      });

      expect(res.status).toBe(409);
      const body = await res.json() as ApiResponse;
      expect(body.error?.code).toBe('ALREADY_ON_TEAM');
    });

    it('returns 401 without auth', async () => {
      await seedBase();
      await insertTeamInvite({
        id: 'ti-noauth', teamId: SEED.team, email: 'noauth@test.com',
        token: 'noauth-token', invitedBy: SEED.organizer.id,
      });

      const res = await SELF.fetch('http://localhost/api/v1/invites/team/noauth-token', {
        method: 'POST',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/invites/judge/:id — accept judge invite', () => {
    it('accepts a pending judge invite', async () => {
      await seedBase();
      await insertJudge({
        id: 'judge-inv-1', hackathonId: SEED.hackathon,
        userId: SEED.judge.id, inviteStatus: 'pending', invitedBy: SEED.organizer.id,
      });

      const res = await SELF.fetch('http://localhost/api/v1/invites/judge/judge-inv-1', {
        method: 'POST',
        headers: { Cookie: await authCookie(SEED.judge.id) },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<{ accepted: boolean }>;
      expect(body.ok).toBe(true);
      expect(body.data.accepted).toBe(true);

      // Verify status updated
      const judge = await env.DB.prepare('SELECT invite_status FROM judges WHERE id = ?')
        .bind('judge-inv-1').first<{ invite_status: string }>();
      expect(judge?.invite_status).toBe('accepted');
    });

    it('rejects already-responded judge invite', async () => {
      await seedBase();
      await insertJudge({
        id: 'judge-inv-2', hackathonId: SEED.hackathon,
        userId: SEED.judge.id, inviteStatus: 'accepted', invitedBy: SEED.organizer.id,
      });

      const res = await SELF.fetch('http://localhost/api/v1/invites/judge/judge-inv-2', {
        method: 'POST',
        headers: { Cookie: await authCookie(SEED.judge.id) },
      });

      expect(res.status).toBe(409);
      const body = await res.json() as ApiResponse;
      expect(body.error?.code).toBe('INVITE_USED');
    });
  });

  describe('POST /api/v1/invites/judge/:id/decline — decline judge invite', () => {
    it('declines a pending judge invite (no auth needed)', async () => {
      await seedBase();
      await insertJudge({
        id: 'judge-dec-1', hackathonId: SEED.hackathon,
        userId: SEED.judge.id, inviteStatus: 'pending', invitedBy: SEED.organizer.id,
      });

      const res = await SELF.fetch('http://localhost/api/v1/invites/judge/judge-dec-1/decline', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<{ declined: boolean }>;
      expect(body.ok).toBe(true);
      expect(body.data.declined).toBe(true);

      const judge = await env.DB.prepare('SELECT invite_status FROM judges WHERE id = ?')
        .bind('judge-dec-1').first<{ invite_status: string }>();
      expect(judge?.invite_status).toBe('declined');
    });

    it('rejects decline on already-responded invite', async () => {
      await seedBase();
      await insertJudge({
        id: 'judge-dec-2', hackathonId: SEED.hackathon,
        userId: SEED.judge.id, inviteStatus: 'accepted', invitedBy: SEED.organizer.id,
      });

      const res = await SELF.fetch('http://localhost/api/v1/invites/judge/judge-dec-2/decline', {
        method: 'POST',
      });

      expect(res.status).toBe(409);
    });
  });
});
