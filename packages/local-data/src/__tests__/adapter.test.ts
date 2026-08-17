import { describe, it, expect } from 'vitest';
import { localApiRequest, type LocalResult } from '../adapter.js';
import { DEMO_EMAILS, DEMO_PASSWORD, DEMO_SLUGS, DEMO_TOKENS } from '../seed/demo-data.js';
import { db } from '../db/database.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function call<T = unknown>(endpoint: string, options?: RequestInit): Promise<LocalResult<T>> {
  return localApiRequest<T>(endpoint, options);
}

function failDetail(res: LocalResult<unknown>): string {
  return res.ok ? "" : JSON.stringify(res.error);
}

async function login(email: string): Promise<void> {
  const res = await call('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
  expect(res.ok).toBe(true);
}

// ---------------------------------------------------------------------------
// Row shapes the apps actually consume
// ---------------------------------------------------------------------------

interface MeShape {
  user: { avatar_url: string | null; image: string | null };
  isPlatformAdmin: boolean;
  isOrganizer: boolean;
  isJudge: boolean;
  workspaceRoles: Record<string, string>;
}

interface HackathonRow {
  id: string;
  slug: string;
  title: string;
  status: string;
}

interface WebViewRow extends HackathonRow {
  name: string;
  min_team_size: number;
  max_team_size: number;
  max_teams: number | null;
  registration_mode: string;
  rules_md: string | null;
}

interface PlatformRow extends HackathonRow {
  organizers: { user_id: string; role: string; name: string | null }[];
  teams_count: number;
  submissions_count: number;
  rounds_count: number;
}

interface WorkspaceRow {
  id: string;
  name: string;
  member_role: string;
}

interface TeamRow {
  id: string;
  name: string;
  repo_url: string | null;
}

interface AnnouncementRow {
  id: string;
  title: string;
  content: string | null;
  author_name: string | null;
}

interface StatsRow {
  total_users: number;
  total_workspaces: number;
  total_hackathons: number;
  active_hackathons: number;
}

interface AdminHackathonRow {
  id: string;
  title: string;
  status: string;
}

interface AdminDetailRow {
  hackathon_id: string;
  title: string;
  team_count: number;
  submission_count: number;
  round_count: number;
}

interface RoundRow {
  id: string;
  name: string;
  status: string;
}

interface JudgeHackathonRow {
  hackathon_id: string;
  invite_status: string;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe('auth routes', () => {
  it('logs in with demo credentials and exposes /auth/me with image + workspaceRoles', async () => {
    await login(DEMO_EMAILS.admin);
    const me = await call<MeShape>('/api/v1/auth/me');
    expect(me.ok).toBe(true);
    if (!me.ok) return;
    expect(me.data.user.image).toEqual(me.data.user.avatar_url);
    expect(typeof me.data.workspaceRoles).toBe('object');
    expect(Object.values(me.data.workspaceRoles).every((r) => typeof r === 'string')).toBe(true);
    expect(me.data.isPlatformAdmin).toBe(true);
  });

  it('rejects a wrong password with a 401 envelope', async () => {
    const res = await call('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: DEMO_EMAILS.owner, password: 'not-the-password' }),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('UNAUTHORIZED');
    expect(res.error.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

describe('workspace routes', () => {
  it('lists workspaces as a bare array with member_role', async () => {
    await login(DEMO_EMAILS.owner);
    const res = await call<WorkspaceRow[]>('/api/v1/workspaces');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    expect(typeof res.data[0].member_role).toBe('string');
  });

  it('exposes a public workspace invite by token', async () => {
    const res = await call<{ id: string; workspace_id: string; workspace_slug: string | null }>(
      `/api/v1/workspaces/invites/token/${DEMO_TOKENS.workspaceInvite}`,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(typeof res.data.id).toBe('string');
    expect(typeof res.data.workspace_id).toBe('string');
  });

  it('accepts a workspace invite', async () => {
    await login(DEMO_EMAILS.p1);
    const res = await call('/api/v1/workspaces/invites/token/' + DEMO_TOKENS.workspaceInvite + '/accept', {
      method: 'POST',
    });
    expect(res.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Hackathons
// ---------------------------------------------------------------------------

describe('hackathon routes', () => {
  it('lists hackathons as a bare array', async () => {
    await login(DEMO_EMAILS.owner);
    const res = await call<HackathonRow[]>('/api/v1/hackathons');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('returns the webView shape for a non-privileged user', async () => {
    await login(DEMO_EMAILS.p1);
    const res = await call<WebViewRow>(`/api/v1/hackathons/${DEMO_SLUGS.sprint}`);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.name).toBe(res.data.title);
    expect(typeof res.data.min_team_size).toBe('number');
    expect(typeof res.data.max_team_size).toBe('number');
    expect(['open', 'closed']).toContain(res.data.registration_mode);
  });

  it('returns the platform shape (with counts) for an organizer', async () => {
    await login(DEMO_EMAILS.owner);
    const res = await call<PlatformRow>(`/api/v1/hackathons/${DEMO_SLUGS.sprint}`);
    expect(res.ok, failDetail(res)).toBe(true);
    if (!res.ok) return;
    expect(Array.isArray(res.data.organizers)).toBe(true);
    expect(typeof res.data.teams_count).toBe('number');
    expect(typeof res.data.submissions_count).toBe('number');
    expect(typeof res.data.rounds_count).toBe('number');
  });

  it('transitions a hackathon via target_status', async () => {
    await login(DEMO_EMAILS.owner);
    const archive = await db.hackathons.where('slug').equals(DEMO_SLUGS.archive).first();
    expect(archive).toBeDefined();
    if (!archive) return;
    const target = archive.status === 'completed' ? 'archived' : 'completed';
    const res = await call<{ status: string }>(`/api/v1/hackathons/${archive.id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ target_status: target }),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.status).toBe(target);
  });
});

// ---------------------------------------------------------------------------
// Teams / submissions / rounds / announcements / audit
// ---------------------------------------------------------------------------

describe('hackathon child collections', () => {
  it('lists teams as a bare array with repo_url', async () => {
    await login(DEMO_EMAILS.owner);
    const res = await call<TeamRow[]>(`/api/v1/hackathons/${DEMO_SLUGS.sprint}/teams`);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Array.isArray(res.data)).toBe(true);
    for (const team of res.data) {
      expect('repo_url' in team).toBe(true);
    }
  });

  it('lists submissions as a bare array', async () => {
    await login(DEMO_EMAILS.owner);
    const res = await call<{ id: string }[]>(`/api/v1/hackathons/${DEMO_SLUGS.sprint}/submissions`);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('lists rounds as a bare array', async () => {
    await login(DEMO_EMAILS.owner);
    const res = await call<RoundRow[]>(`/api/v1/hackathons/${DEMO_SLUGS.sprint}/rounds`);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    expect(typeof res.data[0].status).toBe('string');
  });

  it('lists announcements as a bare array with content + author_name', async () => {
    await login(DEMO_EMAILS.owner);
    const res = await call<AnnouncementRow[]>(`/api/v1/hackathons/${DEMO_SLUGS.sprint}/announcements`);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Array.isArray(res.data)).toBe(true);
    for (const ann of res.data) {
      expect('content' in ann).toBe(true);
      expect('author_name' in ann).toBe(true);
    }
  });

  it('lists audit events as a bare array', async () => {
    await login(DEMO_EMAILS.owner);
    const res = await call<{ id: string; actor_type: string }[]>(
      `/api/v1/hackathons/${DEMO_SLUGS.sprint}/audit`,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Array.isArray(res.data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Notifications + requests
// ---------------------------------------------------------------------------

describe('notifications and requests', () => {
  it('lists notifications as a bare array and exposes unread-count', async () => {
    await login(DEMO_EMAILS.p1);
    const list = await call<{ id: string }[]>('/api/v1/notifications');
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(Array.isArray(list.data)).toBe(true);

    const count = await call<{ count: number }>('/api/v1/notifications/unread-count');
    expect(count.ok).toBe(true);
    if (!count.ok) return;
    expect(typeof count.data.count).toBe('number');
  });

  it('lists hackathon requests as a bare array', async () => {
    await login(DEMO_EMAILS.admin);
    const res = await call<{ id: string }[]>('/api/v1/hackathon-requests');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('resubmits a hackathon request', async () => {
    await login(DEMO_EMAILS.owner);
    const req = await db.hackathonRequests.orderBy('created_at').reverse().first();
    expect(req).toBeDefined();
    if (!req) return;
    const res = await call<{ id: string; title: string; status: string }>(
      `/api/v1/hackathon-requests/${req.id}/resubmit`,
      { method: 'PUT', body: JSON.stringify({ title: `${req.title} (updated)` }) },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.id).toBe(req.id);
  });
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

describe('admin routes', () => {
  it('returns stats including active_hackathons', async () => {
    await login(DEMO_EMAILS.admin);
    const res = await call<StatsRow>('/api/v1/admin/stats');
    expect(res.ok, failDetail(res)).toBe(true);
    if (!res.ok) return;
    expect(typeof res.data.total_users).toBe('number');
    expect(typeof res.data.total_workspaces).toBe('number');
    expect(typeof res.data.total_hackathons).toBe('number');
    expect(typeof res.data.active_hackathons).toBe('number');
  });

  it('lists admin collections as bare arrays', async () => {
    await login(DEMO_EMAILS.admin);
    const paths: [string, string][] = [
      ['/api/v1/admin/hackathons', 'hackathons'],
      ['/api/v1/admin/workspaces', 'workspaces'],
      ['/api/v1/admin/users', 'users'],
      ['/api/v1/admin/invites', 'invites'],
      ['/api/v1/admin/admins', 'admins'],
    ];
    for (const [path, label] of paths) {
      const res = await call<unknown[]>(path);
      expect(res.ok, `${path} should resolve: ${failDetail(res)}`).toBe(true);
      if (!res.ok) continue;
      expect(Array.isArray(res.data), `${label} list should be a bare array`).toBe(true);
    }
  });

  it('returns admin hackathon detail with hackathon_id + counts', async () => {
    await login(DEMO_EMAILS.admin);
    const list = await call<AdminHackathonRow[]>('/api/v1/admin/hackathons');
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.length).toBeGreaterThan(0);
    const detail = await call<AdminDetailRow>(`/api/v1/admin/hackathons/${list.data[0].id}`);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.data.hackathon_id).toBe(list.data[0].id);
    expect(typeof detail.data.team_count).toBe('number');
    expect(typeof detail.data.submission_count).toBe('number');
    expect(typeof detail.data.round_count).toBe('number');
  });

  it('returns hackathon-request admin stats', async () => {
    await login(DEMO_EMAILS.admin);
    const res = await call<Record<string, number>>('/api/v1/hackathon-requests/admin/stats');
    expect(res.ok, failDetail(res)).toBe(true);
    if (!res.ok) return;
    expect(typeof res.data.total).toBe('number');
    for (const key of ['submitted', 'under_review', 'approved', 'building', 'ready', 'rejected', 'changes_requested']) {
      expect(typeof res.data[key], `${key} should be a number`).toBe('number');
    }
  });

  it('lists all hackathon requests for admin with joined names', async () => {
    await login(DEMO_EMAILS.admin);
    const res = await call<
      { id: string; workspace_name: string | null; workspace_slug: string | null; requester_name: string | null; requester_email: string | null }[]
    >('/api/v1/hackathon-requests/admin/all?limit=20&offset=0');
    expect(res.ok, failDetail(res)).toBe(true);
    if (!res.ok) return;
    expect(Array.isArray(res.data)).toBe(true);
    if (res.data.length > 0) {
      expect('workspace_name' in res.data[0]).toBe(true);
      expect('workspace_slug' in res.data[0]).toBe(true);
      expect('requester_name' in res.data[0]).toBe(true);
      expect('requester_email' in res.data[0]).toBe(true);
    }
  });

  it('filters admin request list by status', async () => {
    await login(DEMO_EMAILS.admin);
    const res = await call<{ status: string }[]>('/api/v1/hackathon-requests/admin/all?status=submitted');
    expect(res.ok, failDetail(res)).toBe(true);
    if (!res.ok) return;
    for (const r of res.data) {
      expect(r.status).toBe('submitted');
    }
  });

  it('updates a request status via admin PATCH', async () => {
    await login(DEMO_EMAILS.admin);
    const req = await db.hackathonRequests.orderBy('created_at').reverse().first();
    expect(req).toBeDefined();
    if (!req) return;
    const res = await call<{ id: string; status: string; admin_notes: string | null }>(
      `/api/v1/hackathon-requests/admin/${req.id}`,
      { method: 'PATCH', body: JSON.stringify({ status: 'under_review', admin_notes: 'Verified locally' }) },
    );
    expect(res.ok, failDetail(res)).toBe(true);
    if (!res.ok) return;
    expect(res.data.id).toBe(req.id);
    expect(res.data.status).toBe('under_review');
    expect(res.data.admin_notes).toBe('Verified locally');
  });
});

// ---------------------------------------------------------------------------
// Judging
// ---------------------------------------------------------------------------

describe('judging routes', () => {
  it('lists judging collections as bare arrays for a judge', async () => {
    await login(DEMO_EMAILS.judge1);
    const paths: [string, string][] = [
      [`/api/v1/hackathons/${DEMO_SLUGS.sprint}/judging/judges`, 'judges'],
      [`/api/v1/hackathons/${DEMO_SLUGS.sprint}/judging/rubric`, 'rubric'],
      [`/api/v1/hackathons/${DEMO_SLUGS.sprint}/judging/leaderboard`, 'leaderboard'],
      [`/api/v1/hackathons/${DEMO_SLUGS.sprint}/judging/my-assignments`, 'my-assignments'],
    ];
    for (const [path, label] of paths) {
      const res = await call<unknown[]>(path);
      expect(res.ok, `${path} should resolve`).toBe(true);
      if (!res.ok) continue;
      expect(Array.isArray(res.data), `${label} should be a bare array`).toBe(true);
    }
  });

  it('lists judge-portal hackathons as a bare array', async () => {
    await login(DEMO_EMAILS.judge1);
    const res = await call<JudgeHackathonRow[]>('/api/v1/judge/hackathons');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Array.isArray(res.data)).toBe(true);
    for (const h of res.data) {
      expect('hackathon_id' in h).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Invites (team)
// ---------------------------------------------------------------------------

describe('team invite routes', () => {
  it('resolves a team invite by code (public)', async () => {
    const res = await call<{ invite_code: string; team: { id: string } | null }>(
      `/api/v1/invites/${DEMO_TOKENS.teamInvite}`,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.invite_code).toBe(DEMO_TOKENS.teamInvite);
  });
});

// ---------------------------------------------------------------------------
// Fallbacks
// ---------------------------------------------------------------------------

describe('fallbacks', () => {
  it('returns UNSUPPORTED_ROUTE for unknown endpoints', async () => {
    const res = await call('/api/v1/does/not/exist');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('UNSUPPORTED_ROUTE');
  });
});