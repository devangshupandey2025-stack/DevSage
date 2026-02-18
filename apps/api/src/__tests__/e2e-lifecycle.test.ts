/**
 * E2E: Full Hackathon Lifecycle
 *
 * Sequential integration test covering the entire lifecycle:
 *   register → admin → workspace → hackathon → organizers → rounds →
 *   rubric → judges → teams → repo → submission → judging → scoring →
 *   leaderboard → notifications → admin stats → cleanup verification
 */
import { SELF } from 'cloudflare:test';
import { describe, expect, it, beforeAll } from 'vitest';
import {
  ensureSchema, resetDb, authCookie,
  insertPlatformAdmin, insertSubmission,
  SEED, env,
} from './helpers.js';

// ── Shared state across ordered steps ─────────────────────────
let workspaceId: string;
let hackathonId: string;
let teamId: string;
let inviteCode: string;
let judgeRecordId: string;
let roundId: string;
let criterionIds: string[] = [];
let submissionId: string;
let assignmentId: string;

const HACK_SLUG = 'e2e-hack';
const WS_SLUG = 'e2e-ws';
const PASSWORD = 'e2eStrongPass1!';

/** POST JSON helper */
async function post(path: string, body: unknown, cookie?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  return SELF.fetch(`http://localhost${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/** GET helper */
async function get(path: string, cookie?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers['Cookie'] = cookie;
  return SELF.fetch(`http://localhost${path}`, { headers });
}

/** Extract auth cookie from Set-Cookie response header */
function extractAuthCookie(res: Response): string {
  const setCookie = res.headers.get('Set-Cookie') ?? '';
  const match = setCookie.match(/access_token=[^;]+/);
  return match ? match[0] : '';
}

// Store cookies obtained via register (real hashed passwords)
const cookies: Record<string, string> = {};

describe('E2E: Full Hackathon Lifecycle', () => {
  beforeAll(async () => {
    await ensureSchema();
    await resetDb();
  });

  // ── 1. Setup: Register all 7 users ──────────────────────────
  it('1. registers all 7 seed users via /auth/register', async () => {
    const users = [
      { key: 'srijan', ...SEED.srijan },
      { key: 'admin', ...SEED.admin },
      { key: 'organizer', ...SEED.organizer },
      { key: 'coOrganizer', ...SEED.coOrganizer },
      { key: 'judge', ...SEED.judge },
      { key: 'lead', ...SEED.lead },
      { key: 'participant', ...SEED.participant },
    ];

    for (const u of users) {
      const res = await post('/auth/register', {
        email: u.email,
        password: PASSWORD,
        name: u.name,
      });

      expect(res.status).toBe(201);
      const body = await res.json() as { ok: boolean; data: { id: string; email: string } };
      expect(body.ok).toBe(true);
      expect(body.data.email).toBe(u.email);

      // Save the real auth cookie from registration
      const cookie = extractAuthCookie(res);
      expect(cookie).toBeTruthy();
      cookies[u.key] = cookie;
    }

    // Insert platform_admin records for srijan and admin
    // We need their actual user IDs from DB
    const srijanRow = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(SEED.srijan.email).first<{ id: string }>();
    const adminRow = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(SEED.admin.email).first<{ id: string }>();
    expect(srijanRow).not.toBeNull();
    expect(adminRow).not.toBeNull();

    await insertPlatformAdmin(srijanRow!.id);
    await insertPlatformAdmin(adminRow!.id);
  });

  // ── 2. Platform Admin: verify stats, add organizer as admin ─
  it('2. platform admin verifies stats and manages admin list', async () => {
    const res = await get('/api/v1/admin/stats', cookies.admin);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { users: number } };
    expect(body.ok).toBe(true);
    expect(body.data.users).toBe(7);

    // Get organizer's actual ID for adding as admin
    const orgRow = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(SEED.organizer.email).first<{ id: string }>();

    const addRes = await post('/api/v1/admin/admins', { user_id: orgRow!.id }, cookies.admin);
    expect(addRes.status).toBe(201);
    const addBody = await addRes.json() as { ok: boolean; data: { id: string } };
    expect(addBody.ok).toBe(true);

    // Verify admin list now has 3 admins
    const listRes = await get('/api/v1/admin/admins', cookies.admin);
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json() as { ok: boolean; data: Array<{ user_id: string }> };
    expect(listBody.ok).toBe(true);
    expect(listBody.data.length).toBe(3);
  });

  // ── 3. Workspace Creation ───────────────────────────────────
  it('3. creates a workspace as srijan', async () => {
    const res = await post('/api/v1/workspaces', {
      name: 'E2E Workspace',
      slug: WS_SLUG,
      type: 'organization',
    }, cookies.srijan);

    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean; data: { id: string; slug: string; name: string } };
    expect(body.ok).toBe(true);
    expect(body.data.slug).toBe(WS_SLUG);
    expect(body.data.name).toBe('E2E Workspace');
    workspaceId = body.data.id;

    // Verify workspace appears in list
    const listRes = await get('/api/v1/workspaces', cookies.srijan);
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json() as { ok: boolean; data: Array<{ slug: string }> };
    expect(listBody.ok).toBe(true);
    expect(listBody.data.some(w => w.slug === WS_SLUG)).toBe(true);
  });

  // ── 4. Hackathon Creation ───────────────────────────────────
  it('4. creates a hackathon in the workspace', async () => {
    const res = await post(
      `/api/v1/hackathons/workspaces/${workspaceId}/hackathons`,
      { title: 'E2E Hackathon', slug: HACK_SLUG },
      cookies.srijan,
    );

    expect(res.status).toBe(201);
    const body = await res.json() as {
      ok: boolean;
      data: { id: string; slug: string; status: string };
    };
    expect(body.ok).toBe(true);
    expect(body.data.slug).toBe(HACK_SLUG);
    expect(body.data.status).toBe('draft');
    hackathonId = body.data.id;

    // Verify creator was added as organizer
    const orgRole = await env.DB.prepare(
      'SELECT role FROM organizer_roles WHERE hackathon_id = ? AND user_id = (SELECT id FROM users WHERE email = ?)'
    ).bind(hackathonId, SEED.srijan.email).first<{ role: string }>();
    expect(orgRole?.role).toBe('organizer');
  });

  // ── 5. Add Organizers ───────────────────────────────────────
  it('5. adds organizer and co-organizer roles', async () => {
    const orgRow = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(SEED.organizer.email).first<{ id: string }>();
    const coOrgRow = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(SEED.coOrganizer.email).first<{ id: string }>();

    // Add organizer user as 'organizer'
    const res1 = await post(
      `/api/v1/hackathons/${HACK_SLUG}/organizers`,
      { user_id: orgRow!.id, role: 'organizer' },
      cookies.srijan,
    );
    expect(res1.status).toBe(201);
    const body1 = await res1.json() as { ok: boolean; data: { role: string } };
    expect(body1.ok).toBe(true);
    expect(body1.data.role).toBe('organizer');

    // Add coOrganizer user as 'co_organizer'
    const res2 = await post(
      `/api/v1/hackathons/${HACK_SLUG}/organizers`,
      { user_id: coOrgRow!.id, role: 'co_organizer' },
      cookies.srijan,
    );
    expect(res2.status).toBe(201);
    const body2 = await res2.json() as { ok: boolean; data: { role: string } };
    expect(body2.ok).toBe(true);
    expect(body2.data.role).toBe('co_organizer');

    // Verify with GET
    const listRes = await get(
      `/api/v1/hackathons/${HACK_SLUG}/organizers`,
      cookies.srijan,
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json() as {
      ok: boolean;
      data: Array<{ user_id: string; role: string }>;
    };
    expect(listBody.ok).toBe(true);
    // srijan (creator) + organizer + co_organizer = 3
    expect(listBody.data.length).toBe(3);
  });

  // ── 6. Create Rounds ───────────────────────────────────────
  it('6. creates a round as organizer', async () => {
    const res = await post(
      `/api/v1/hackathons/${HACK_SLUG}/rounds`,
      { name: 'Final Round', round_number: 2, type: 'standard' },
      cookies.organizer,
    );

    expect(res.status).toBe(201);
    const body = await res.json() as {
      ok: boolean;
      data: { id: string; name: string; round_number: number; status: string };
    };
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe('Final Round');
    expect(body.data.round_number).toBe(2);
    roundId = body.data.id;

    // Verify with GET
    const listRes = await get(`/api/v1/hackathons/${HACK_SLUG}/rounds`);
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json() as {
      ok: boolean;
      data: Array<{ name: string; round_number: number }>;
    };
    expect(listBody.ok).toBe(true);
    expect(listBody.data.length).toBeGreaterThanOrEqual(1);
  });

  // ── 7. Create Rubric ───────────────────────────────────────
  it('7. creates rubric criteria', async () => {
    const criteria = [
      { name: 'Innovation', weight: 2.0, max_score: 10 },
      { name: 'Execution', weight: 1.5, max_score: 10 },
      { name: 'Design', weight: 1.0, max_score: 10 },
    ];

    criterionIds = [];
    for (const c of criteria) {
      const res = await post(
        `/api/v1/hackathons/${HACK_SLUG}/judging/rubric`,
        c,
        cookies.organizer,
      );
      expect(res.status).toBe(201);
      const body = await res.json() as { ok: boolean; data: { id: string; name: string } };
      expect(body.ok).toBe(true);
      expect(body.data.name).toBe(c.name);
      criterionIds.push(body.data.id);
    }

    // Verify with GET
    const listRes = await get(
      `/api/v1/hackathons/${HACK_SLUG}/judging/rubric`,
      cookies.organizer,
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json() as { ok: boolean; data: Array<{ name: string }> };
    expect(listBody.ok).toBe(true);
    expect(listBody.data.length).toBe(3);
  });

  // ── 8. Invite Judge ─────────────────────────────────────────
  it('8. invites a judge', async () => {
    const judgeRow = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(SEED.judge.email).first<{ id: string }>();

    const res = await post(
      `/api/v1/hackathons/${HACK_SLUG}/judging/judges`,
      { user_id: judgeRow!.id },
      cookies.organizer,
    );

    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean; data: { id: string; user_id: string } };
    expect(body.ok).toBe(true);
    expect(body.data.user_id).toBe(judgeRow!.id);
    judgeRecordId = body.data.id;

    // Verify with GET
    const listRes = await get(
      `/api/v1/hackathons/${HACK_SLUG}/judging/judges`,
      cookies.organizer,
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json() as { ok: boolean; data: Array<{ user_id: string }> };
    expect(listBody.ok).toBe(true);
    expect(listBody.data.length).toBe(1);
    expect(listBody.data[0].user_id).toBe(judgeRow!.id);
  });

  // ── 9. Set Hackathon Active (via DB) ────────────────────────
  it('9. sets hackathon to active status via DB', async () => {
    await env.DB.prepare(
      "UPDATE hackathons SET status = 'active' WHERE slug = ?"
    ).bind(HACK_SLUG).run();

    // Verify
    const hack = await env.DB.prepare(
      'SELECT status FROM hackathons WHERE slug = ?'
    ).bind(HACK_SLUG).first<{ status: string }>();
    expect(hack?.status).toBe('active');
  });

  // ── 10. Team Creation ──────────────────────────────────────
  it('10. creates a team as team lead', async () => {
    const res = await post(
      `/api/v1/hackathons/${HACK_SLUG}/teams`,
      { name: 'E2E Team' },
      cookies.lead,
    );

    expect(res.status).toBe(201);
    const body = await res.json() as {
      ok: boolean;
      data: { id: string; name: string; invite_code: string };
    };
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe('E2E Team');
    expect(body.data.invite_code).toBeTruthy();
    teamId = body.data.id;
    inviteCode = body.data.invite_code;
  });

  // ── 11. Join Team ──────────────────────────────────────────
  it('11. participant joins team via invite code', async () => {
    const res = await post(
      `/api/v1/hackathons/${HACK_SLUG}/teams/join`,
      { invite_code: inviteCode },
      cookies.participant,
    );

    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean; data: { joined: boolean; team_id: string } };
    expect(body.ok).toBe(true);
    expect(body.data.joined).toBe(true);
    expect(body.data.team_id).toBe(teamId);
  });

  // ── 12. List Teams ─────────────────────────────────────────
  it('12. lists teams and verifies member count', async () => {
    const res = await get(`/api/v1/hackathons/${HACK_SLUG}/teams`);

    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      data: Array<{ id: string; name: string; member_count?: number }>;
    };
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(teamId);
    expect(body.data[0].name).toBe('E2E Team');

    // Verify 2 members via member endpoint
    const memberRes = await get(`/api/v1/hackathons/${HACK_SLUG}/teams/${teamId}/members`);
    expect(memberRes.status).toBe(200);
    const memberBody = await memberRes.json() as {
      ok: boolean;
      data: Array<{ user_id: string; role: string }>;
    };
    expect(memberBody.ok).toBe(true);
    expect(memberBody.data.length).toBe(2);
    const roles = memberBody.data.map(m => m.role);
    expect(roles).toContain('leader');
    expect(roles).toContain('member');
  });

  // ── 13. Link Repo ──────────────────────────────────────────
  it('13. links a GitHub repo to the team', async () => {
    const res = await post(
      `/api/v1/hackathons/${HACK_SLUG}/teams/${teamId}/repo`,
      { github_repo_url: 'https://github.com/e2e-org/e2e-repo' },
      cookies.lead,
    );

    expect(res.status).toBe(201);
    const body = await res.json() as {
      ok: boolean;
      data: { id: string; github_owner: string; github_repo: string };
    };
    expect(body.ok).toBe(true);
    expect(body.data.github_owner).toBe('e2e-org');
    expect(body.data.github_repo).toBe('e2e-repo');

    // Verify with GET
    const getRes = await get(
      `/api/v1/hackathons/${HACK_SLUG}/teams/${teamId}/repo`,
    );
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json() as {
      ok: boolean;
      data: { github_repo_url: string };
    };
    expect(getBody.ok).toBe(true);
    expect(getBody.data.github_repo_url).toBe('https://github.com/e2e-org/e2e-repo');
  });

  // ── 14. Create Submission (via DB) ─────────────────────────
  it('14. inserts a final submission via DB', async () => {
    submissionId = crypto.randomUUID();
    await insertSubmission({
      id: submissionId,
      teamId,
      hackathonId,
      roundId,
      tagName: 'submission_v1',
      commitSha: 'abc123def456'.padEnd(40, '0'),
      repoFullName: 'e2e-org/e2e-repo',
      isFinal: true,
    });
    // Mark as validated for auto-assign
    await env.DB.prepare(
      "UPDATE submissions SET status = 'validated' WHERE id = ?"
    ).bind(submissionId).run();

    // Verify it exists
    const row = await env.DB.prepare(
      'SELECT is_final, status FROM submissions WHERE id = ?'
    ).bind(submissionId).first<{ is_final: number; status: string }>();
    expect(row?.is_final).toBe(1);
    expect(row?.status).toBe('validated');
  });

  // ── 15. Set Hackathon Judging (via DB) ─────────────────────
  it('15. transitions hackathon to judging status via DB', async () => {
    await env.DB.prepare(
      "UPDATE hackathons SET status = 'judging' WHERE slug = ?"
    ).bind(HACK_SLUG).run();

    const hack = await env.DB.prepare(
      'SELECT status FROM hackathons WHERE slug = ?'
    ).bind(HACK_SLUG).first<{ status: string }>();
    expect(hack?.status).toBe('judging');
  });

  // ── 16. Judge Accepts Invite ───────────────────────────────
  it('16. judge accepts the invite', async () => {
    const res = await post(
      `/api/v1/invites/judge/${judgeRecordId}`,
      {},
      cookies.judge,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { accepted: boolean } };
    expect(body.ok).toBe(true);
    expect(body.data.accepted).toBe(true);

    // Verify status in DB
    const judge = await env.DB.prepare(
      'SELECT invite_status FROM judges WHERE id = ?'
    ).bind(judgeRecordId).first<{ invite_status: string }>();
    expect(judge?.invite_status).toBe('accepted');
  });

  // ── 17. Auto-assign Judges ─────────────────────────────────
  it('17. auto-assigns judges to submissions', async () => {
    const res = await post(
      `/api/v1/hackathons/${HACK_SLUG}/judging/assign`,
      {},
      cookies.organizer,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { assigned: number } };
    expect(body.ok).toBe(true);
    expect(body.data.assigned).toBeGreaterThanOrEqual(1);

    // Get the assignment ID for scoring
    const assignment = await env.DB.prepare(
      'SELECT id FROM judge_assignments WHERE hackathon_id = ? AND judge_id = ?'
    ).bind(hackathonId, judgeRecordId).first<{ id: string }>();
    expect(assignment).not.toBeNull();
    assignmentId = assignment!.id;
  });

  // ── 18. Score Submission ───────────────────────────────────
  it('18. judge scores the submission', async () => {
    const scores = criterionIds.map((criteriaId, i) => ({
      criteria_id: criteriaId,
      score: 7 + i, // 7, 8, 9
      comment: `E2E score for criterion ${i + 1}`,
      assignment_id: assignmentId,
      round: 1,
    }));

    const res = await post(
      `/api/v1/hackathons/${HACK_SLUG}/judging/submissions/${submissionId}/scores`,
      { scores },
      cookies.judge,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { scored: boolean } };
    expect(body.ok).toBe(true);
    expect(body.data.scored).toBe(true);

    // Verify scores in DB
    const dbScores = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM scores WHERE submission_id = ?'
    ).bind(submissionId).first<{ cnt: number }>();
    expect(dbScores?.cnt).toBe(3);
  });

  // ── 19. View Leaderboard ───────────────────────────────────
  it('19. views the leaderboard', async () => {
    const res = await get(`/api/v1/hackathons/${HACK_SLUG}/judging/leaderboard`);

    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      data: Array<{ team_id: string; rank: number; total_score: number }>;
    };
    expect(body.ok).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].team_id).toBe(teamId);
    expect(body.data[0].rank).toBe(1);
    expect(body.data[0].total_score).toBeGreaterThan(0);
  });

  // ── 20. View Submissions ───────────────────────────────────
  it('20. views submissions for the hackathon', async () => {
    const res = await get(
      `/api/v1/hackathons/${HACK_SLUG}/submissions`,
      cookies.lead,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: Array<{ id: string; is_final: number }> };
    expect(body.ok).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const finalSub = body.data.find(s => s.id === submissionId);
    expect(finalSub).toBeDefined();
    expect(finalSub!.is_final).toBe(1);
  });

  // ── 21. Notifications ──────────────────────────────────────
  it('21. checks notifications for users', async () => {
    // Notifications may or may not be generated by the routes above depending
    // on queue processing; verify the endpoint works for each user
    const res = await get('/api/v1/notifications', cookies.lead);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: unknown[] };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    // Unread count endpoint
    const countRes = await get('/api/v1/notifications/unread-count', cookies.judge);
    expect(countRes.status).toBe(200);
    const countBody = await countRes.json() as { ok: boolean; data: { count: number } };
    expect(countBody.ok).toBe(true);
    expect(typeof countBody.data.count).toBe('number');
  });

  // ── 22. Admin Overview ─────────────────────────────────────
  it('22. admin stats reflect the E2E data', async () => {
    const res = await get('/api/v1/admin/stats', cookies.admin);

    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      data: { users: number; hackathons: number; teams: number; submissions: number };
    };
    expect(body.ok).toBe(true);
    expect(body.data.users).toBe(7);
    expect(body.data.hackathons).toBe(1);
    expect(body.data.teams).toBe(1);
    expect(body.data.submissions).toBe(1);
  });

  // ── 23. Cleanup / Verification ─────────────────────────────
  it('23. verifies full lifecycle state is consistent', async () => {
    // Hackathon details
    const hackRes = await get(`/api/v1/hackathons/${HACK_SLUG}`);
    expect(hackRes.status).toBe(200);
    const hackBody = await hackRes.json() as {
      ok: boolean;
      data: { slug: string; title: string; status: string };
    };
    expect(hackBody.ok).toBe(true);
    expect(hackBody.data.slug).toBe(HACK_SLUG);
    expect(hackBody.data.title).toBe('E2E Hackathon');
    expect(hackBody.data.status).toBe('judging');

    // Team details
    const teamRes = await get(`/api/v1/hackathons/${HACK_SLUG}/teams/${teamId}`);
    expect(teamRes.status).toBe(200);
    const teamBody = await teamRes.json() as {
      ok: boolean;
      data: { id: string; name: string };
    };
    expect(teamBody.ok).toBe(true);
    expect(teamBody.data.name).toBe('E2E Team');

    // Rounds (default + Final Round)
    const roundsRes = await get(`/api/v1/hackathons/${HACK_SLUG}/rounds`);
    expect(roundsRes.status).toBe(200);
    const roundsBody = await roundsRes.json() as {
      ok: boolean;
      data: Array<{ name: string }>;
    };
    expect(roundsBody.ok).toBe(true);
    expect(roundsBody.data.length).toBeGreaterThanOrEqual(1);

    // Rubric criteria
    const rubricRes = await get(
      `/api/v1/hackathons/${HACK_SLUG}/judging/rubric`,
      cookies.organizer,
    );
    expect(rubricRes.status).toBe(200);
    const rubricBody = await rubricRes.json() as {
      ok: boolean;
      data: Array<{ name: string }>;
    };
    expect(rubricBody.ok).toBe(true);
    expect(rubricBody.data.length).toBe(3);
    const names = rubricBody.data.map(c => c.name);
    expect(names).toContain('Innovation');
    expect(names).toContain('Execution');
    expect(names).toContain('Design');

    // Organizers
    const orgRes = await get(
      `/api/v1/hackathons/${HACK_SLUG}/organizers`,
      cookies.srijan,
    );
    expect(orgRes.status).toBe(200);
    const orgBody = await orgRes.json() as {
      ok: boolean;
      data: Array<{ role: string }>;
    };
    expect(orgBody.ok).toBe(true);
    expect(orgBody.data.length).toBe(3);

    // Judges
    const judgeRes = await get(
      `/api/v1/hackathons/${HACK_SLUG}/judging/judges`,
      cookies.organizer,
    );
    expect(judgeRes.status).toBe(200);
    const judgeBody = await judgeRes.json() as {
      ok: boolean;
      data: Array<{ invite_status: string }>;
    };
    expect(judgeBody.ok).toBe(true);
    expect(judgeBody.data.length).toBe(1);
    expect(judgeBody.data[0].invite_status).toBe('accepted');

    // Scores exist
    const scoresCount = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM scores WHERE submission_id = ?'
    ).bind(submissionId).first<{ cnt: number }>();
    expect(scoresCount?.cnt).toBe(3);

    // Workspace still exists
    const wsRes = await get(`/api/v1/workspaces/${workspaceId}`, cookies.srijan);
    expect(wsRes.status).toBe(200);
    const wsBody = await wsRes.json() as { ok: boolean; data: { slug: string } };
    expect(wsBody.ok).toBe(true);
    expect(wsBody.data.slug).toBe(WS_SLUG);
  });
});
