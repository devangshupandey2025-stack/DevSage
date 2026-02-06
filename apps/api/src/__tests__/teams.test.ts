import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { signJWT } from '../lib/jwt.js';

const JWT_SECRET = 'dev-secret-key-min-32-chars-long!!';

async function ensureSchema() {
  const statements = [
    'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, avatar_url TEXT, provider TEXT NOT NULL, provider_id TEXT NOT NULL, role TEXT DEFAULT "participant" NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)',
    'CREATE UNIQUE INDEX IF NOT EXISTS users_email_provider_unique ON users (email, provider)',
    'CREATE TABLE IF NOT EXISTS hackathons (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, organiser_id TEXT NOT NULL, status TEXT DEFAULT "DRAFT" NOT NULL, max_team_size INTEGER DEFAULT 4 NOT NULL, registration_start_date TEXT NOT NULL, hacking_start_date TEXT NOT NULL, submission_deadline TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (organiser_id) REFERENCES users(id))',
    'CREATE TABLE IF NOT EXISTS registrations (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, user_id TEXT NOT NULL, registered_at TEXT NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id), FOREIGN KEY (user_id) REFERENCES users(id))',
    'CREATE UNIQUE INDEX IF NOT EXISTS registrations_hackathon_id_user_id_unique ON registrations (hackathon_id, user_id)',
    'CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, name TEXT NOT NULL, join_code TEXT NOT NULL, captain_id TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id), FOREIGN KEY (captain_id) REFERENCES users(id))',
    'CREATE UNIQUE INDEX IF NOT EXISTS teams_join_code_unique ON teams (join_code)',
    'CREATE TABLE IF NOT EXISTS team_members (team_id TEXT NOT NULL, user_id TEXT NOT NULL, joined_at TEXT NOT NULL, PRIMARY KEY (team_id, user_id), FOREIGN KEY (team_id) REFERENCES teams(id), FOREIGN KEY (user_id) REFERENCES users(id))',
    'CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, team_id TEXT NOT NULL, repo_full_name TEXT NOT NULL, commit_sha TEXT NOT NULL, submitted_at TEXT NOT NULL, status TEXT DEFAULT "pending" NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id), FOREIGN KEY (team_id) REFERENCES teams(id))',
    'CREATE UNIQUE INDEX IF NOT EXISTS submissions_hackathon_id_team_id_unique ON submissions (hackathon_id, team_id)',
  ];

  for (const statement of statements) {
    await env.DB.exec(statement);
  }
}

async function resetDb() {
  await env.DB.exec('DELETE FROM team_members;');
  await env.DB.exec('DELETE FROM submissions;');
  await env.DB.exec('DELETE FROM teams;');
  await env.DB.exec('DELETE FROM registrations;');
  await env.DB.exec('DELETE FROM hackathons;');
  await env.DB.exec('DELETE FROM users;');
}

async function insertUser(id: string, email: string, role: 'organiser' | 'participant') {
  const now = new Date().toISOString();
  await env.DB
    .prepare(
      `INSERT INTO users (id, email, name, avatar_url, provider, provider_id, role, created_at, updated_at)
       VALUES (?1, ?2, ?3, NULL, 'github', ?4, ?5, ?6, ?7)`
    )
    .bind(id, email, email.split('@')[0], `provider-${id}`, role, now, now)
    .run();
}

async function insertHackathon(id: string, organiserId: string) {
  const now = new Date().toISOString();
  await env.DB
    .prepare(
      `INSERT INTO hackathons (
        id, title, description, organiser_id, status, max_team_size,
        registration_start_date, hacking_start_date, submission_deadline,
        created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    )
    .bind(
      id,
      'Team Hackathon',
      'Hackathon used for testing team create and join flows.',
      organiserId,
      'REGISTRATION_OPEN',
      4,
      now,
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      now,
      now
    )
    .run();
}

async function insertRegistration(hackathonId: string, userId: string) {
  await env.DB
    .prepare('INSERT INTO registrations (id, hackathon_id, user_id, registered_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(crypto.randomUUID(), hackathonId, userId, new Date().toISOString())
    .run();
}

async function authCookie(userId: string, email: string, role: 'organiser' | 'participant') {
  const token = await signJWT({ sub: userId, email, role }, JWT_SECRET);
  return `session=${token}`;
}

describe('team routes critical paths', () => {
  beforeEach(async () => {
    await ensureSchema();
    await resetDb();
  });

  it('creates team and returns join code', async () => {
    const organiserId = crypto.randomUUID();
    const participantId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();

    await insertUser(organiserId, 'org@example.com', 'organiser');
    await insertUser(participantId, 'captain@example.com', 'participant');
    await insertHackathon(hackathonId, organiserId);
    await insertRegistration(hackathonId, participantId);

    const response = await SELF.fetch(`http://localhost/api/teams/${hackathonId}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(participantId, 'captain@example.com', 'participant'),
      },
      body: JSON.stringify({
        name: 'Builders',
        hackathonId,
      }),
    });
    const body = await response.json<{ join_code?: string }>();

    expect(response.status).toBe(201);
    expect(typeof body.join_code).toBe('string');
    expect(body.join_code?.length).toBe(8);
  });

  it('joins team by join code', async () => {
    const organiserId = crypto.randomUUID();
    const captainId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();

    await insertUser(organiserId, 'org2@example.com', 'organiser');
    await insertUser(captainId, 'captain2@example.com', 'participant');
    await insertUser(memberId, 'member2@example.com', 'participant');
    await insertHackathon(hackathonId, organiserId);
    await insertRegistration(hackathonId, captainId);
    await insertRegistration(hackathonId, memberId);

    const createTeamResponse = await SELF.fetch(`http://localhost/api/teams/${hackathonId}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(captainId, 'captain2@example.com', 'participant'),
      },
      body: JSON.stringify({ name: 'Joinables', hackathonId }),
    });
    const created = await createTeamResponse.json<{ join_code: string }>();

    const joinResponse = await SELF.fetch(`http://localhost/api/teams/${hackathonId}/teams/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(memberId, 'member2@example.com', 'participant'),
      },
      body: JSON.stringify({ joinCode: created.join_code }),
    });

    expect(joinResponse.status).toBe(200);
  });

  it('returns 409 when user is already on a team', async () => {
    const organiserId = crypto.randomUUID();
    const captainId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();

    await insertUser(organiserId, 'org3@example.com', 'organiser');
    await insertUser(captainId, 'captain3@example.com', 'participant');
    await insertHackathon(hackathonId, organiserId);
    await insertRegistration(hackathonId, captainId);

    const createTeamResponse = await SELF.fetch(`http://localhost/api/teams/${hackathonId}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(captainId, 'captain3@example.com', 'participant'),
      },
      body: JSON.stringify({ name: 'Conflict Team', hackathonId }),
    });
    const created = await createTeamResponse.json<{ join_code: string }>();

    const joinAgain = await SELF.fetch(`http://localhost/api/teams/${hackathonId}/teams/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(captainId, 'captain3@example.com', 'participant'),
      },
      body: JSON.stringify({ joinCode: created.join_code }),
    });

    expect(joinAgain.status).toBe(409);
  });

  it('allows a user to leave team', async () => {
    const organiserId = crypto.randomUUID();
    const captainId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();

    await insertUser(organiserId, 'org4@example.com', 'organiser');
    await insertUser(captainId, 'captain4@example.com', 'participant');
    await insertUser(memberId, 'member4@example.com', 'participant');
    await insertHackathon(hackathonId, organiserId);
    await insertRegistration(hackathonId, captainId);
    await insertRegistration(hackathonId, memberId);

    const createTeamResponse = await SELF.fetch(`http://localhost/api/teams/${hackathonId}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(captainId, 'captain4@example.com', 'participant'),
      },
      body: JSON.stringify({ name: 'Leavers', hackathonId }),
    });
    const team = await createTeamResponse.json<{ id: string; join_code: string }>();

    const joinResponse = await SELF.fetch(`http://localhost/api/teams/${hackathonId}/teams/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(memberId, 'member4@example.com', 'participant'),
      },
      body: JSON.stringify({ joinCode: team.join_code }),
    });
    expect(joinResponse.status).toBe(200);

    const leaveResponse = await SELF.fetch(`http://localhost/api/teams/${hackathonId}/teams/${team.id}/leave`, {
      method: 'POST',
      headers: {
        Cookie: await authCookie(memberId, 'member4@example.com', 'participant'),
      },
    });

    expect(leaveResponse.status).toBe(200);
  });
});
