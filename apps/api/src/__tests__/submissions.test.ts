import { SELF } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureSchema, resetDb, authCookie,
  insertUser, insertWorkspace, insertWorkspaceMember,
  insertHackathon, insertOrganizerRole, insertTeam,
  insertTeamMember, insertSubmission, insertRound,
  SEED, env,
} from './helpers.js';
import type { ApiResponse } from './helpers.js';

const BASE = `http://localhost/api/v1/hackathons/${SEED.hackathonSlug}/submissions`;

async function seedScenario() {
  await insertUser(SEED.organizer.id, SEED.organizer.email, SEED.organizer.name);
  await insertUser(SEED.lead.id, SEED.lead.email, SEED.lead.name);
  await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
  await insertWorkspace(SEED.workspace, 'devsage', SEED.organizer.id);
  await insertWorkspaceMember(SEED.workspace, SEED.organizer.id, 'owner');
  await insertHackathon({
    id: SEED.hackathon, workspaceId: SEED.workspace,
    slug: SEED.hackathonSlug, createdBy: SEED.organizer.id, status: 'active',
  });
  await insertRound({ id: SEED.round, hackathonId: SEED.hackathon });
  await insertOrganizerRole(SEED.hackathon, SEED.organizer.id, 'organizer');
  await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Alpha' });
  await insertTeamMember(SEED.team, SEED.lead.id, 'leader');
  await insertTeamMember(SEED.team, SEED.participant.id, 'member');
}

describe('submission routes', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); });

  describe('GET /submissions — list', () => {
    it('lists submissions for hackathon', async () => {
      await seedScenario();
      await insertSubmission({ id: 'sub-1', teamId: SEED.team, hackathonId: SEED.hackathon, roundId: SEED.round, isFinal: true });
      await insertSubmission({ id: 'sub-2', teamId: SEED.team, hackathonId: SEED.hackathon, roundId: SEED.round, tagName: 'submission_v2', isFinal: true });

      const res = await SELF.fetch(BASE, {
        headers: { Cookie: await authCookie(SEED.lead.id) },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<unknown[]>;
      expect(body.ok).toBe(true);
      expect(body.data.length).toBe(2);
    });

    it('filters submissions by team_id', async () => {
      await seedScenario();
      const team2 = 'team-other-001';
      await insertTeam({ id: team2, hackathonId: SEED.hackathon, name: 'Beta' });
      await insertSubmission({ id: 'sub-a', teamId: SEED.team, hackathonId: SEED.hackathon, roundId: SEED.round, isFinal: true });
      await insertSubmission({ id: 'sub-b', teamId: team2, hackathonId: SEED.hackathon, roundId: SEED.round, tagName: 'submission_v2', isFinal: true });

      const res = await SELF.fetch(`${BASE}?team_id=${SEED.team}`, {
        headers: { Cookie: await authCookie(SEED.lead.id) },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<unknown[]>;
      expect(body.data.length).toBe(1);
    });

    it('paginates with limit and offset', async () => {
      await seedScenario();
      for (let i = 0; i < 5; i++) {
        await insertSubmission({ id: `sub-pg-${i}`, teamId: SEED.team, hackathonId: SEED.hackathon, roundId: SEED.round, tagName: `submission_v${i + 1}`, isFinal: true });
      }

      const res = await SELF.fetch(`${BASE}?limit=2&offset=0`, {
        headers: { Cookie: await authCookie(SEED.lead.id) },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<unknown[]> & { meta: { total: number } };
      expect(body.data.length).toBe(2);
      expect(body.meta.total).toBe(5);
    });

    it('returns 404 for nonexistent hackathon', async () => {
      await seedScenario();
      const res = await SELF.fetch('http://localhost/api/v1/hackathons/nonexistent-slug/submissions', {
        headers: { Cookie: await authCookie(SEED.lead.id) },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /submissions/:submissionId — single', () => {
    it('returns a single submission', async () => {
      await seedScenario();
      await insertSubmission({ id: 'sub-single', teamId: SEED.team, hackathonId: SEED.hackathon, roundId: SEED.round, isFinal: true });

      const res = await SELF.fetch(`${BASE}/sub-single`, {
        headers: { Cookie: await authCookie(SEED.lead.id) },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<{ id: string }>;
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe('sub-single');
    });

    it('returns 404 for nonexistent submission', async () => {
      await seedScenario();
      const res = await SELF.fetch(`${BASE}/does-not-exist`, {
        headers: { Cookie: await authCookie(SEED.lead.id) },
      });
      expect(res.status).toBe(404);
      const body = await res.json() as ApiResponse;
      expect(body.ok).toBe(false);
      expect(body.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /submissions/team/:teamId/current — current submission', () => {
    it('returns the current (is_final) submission for a team', async () => {
      await seedScenario();
      await insertSubmission({ id: 'sub-old', teamId: SEED.team, hackathonId: SEED.hackathon, roundId: SEED.round, tagName: 'submission_v1', isFinal: false });
      await insertSubmission({ id: 'sub-final', teamId: SEED.team, hackathonId: SEED.hackathon, roundId: SEED.round, tagName: 'submission_v2', isFinal: true });

      const res = await SELF.fetch(`${BASE}/team/${SEED.team}/current`, {
        headers: { Cookie: await authCookie(SEED.lead.id) },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<{ id: string; is_final: number }>;
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe('sub-final');
      expect(body.data.is_final).toBe(1);
    });

    it('returns 404 when team has no final submission', async () => {
      await seedScenario();
      await insertSubmission({ id: 'sub-nonfinal', teamId: SEED.team, hackathonId: SEED.hackathon, roundId: SEED.round, isFinal: false });

      const res = await SELF.fetch(`${BASE}/team/${SEED.team}/current`, {
        headers: { Cookie: await authCookie(SEED.lead.id) },
      });

      expect(res.status).toBe(404);
    });
  });
});
