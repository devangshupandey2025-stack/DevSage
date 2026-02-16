# Team Tables

> Team formation, membership, invitations, GitHub repo linking, and team chat.

## Tables

### teams

A team competing in a hackathon. Lifecycle: `forming → ready → submitted → dissolved`.

```sql
CREATE TABLE teams (
  id            TEXT PRIMARY KEY,
  hackathon_id  TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  invite_code   TEXT NOT NULL UNIQUE,     -- shareable join code
  track_id      TEXT REFERENCES hackathon_tracks(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'forming'
                  CHECK (status IN ('forming','ready','submitted','dissolved')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_teams_hackathon ON teams(hackathon_id);
CREATE INDEX idx_teams_invite_code ON teams(invite_code);
```

### team_members

Associates users with teams. One user per team per hackathon (enforced at application level).

```sql
CREATE TABLE team_members (
  id        TEXT PRIMARY KEY,
  team_id   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('team_lead', 'team_member')),
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (team_id, user_id)
);

CREATE INDEX idx_team_members_user ON team_members(user_id);
```

### team_invites

Email-based invitations to join a specific team.

```sql
CREATE TABLE team_invites (
  id            TEXT PRIMARY KEY,
  team_id       TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  invite_token  TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','declined','expired')),
  invited_by    TEXT NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at    TEXT NOT NULL,
  UNIQUE (team_id, email)
);

CREATE INDEX idx_team_invites_email ON team_invites(email);
```

### team_repos

Links a team to its GitHub repository. One repo per team.

```sql
CREATE TABLE team_repos (
  id                      TEXT PRIMARY KEY,
  team_id                 TEXT NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  github_repo_url         TEXT NOT NULL,
  github_owner            TEXT NOT NULL,
  github_repo             TEXT NOT NULL,
  github_installation_id  INTEGER NOT NULL,
  bot_active              INTEGER NOT NULL DEFAULT 0,  -- SQLite boolean
  linked_by               TEXT NOT NULL REFERENCES users(id),
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_team_repos_github ON team_repos(github_owner, github_repo);
```

### team_messages _(Phase 2)_

Simple per-team chat. Append-only, cursor-paginated.

```sql
CREATE TABLE team_messages (
  id          TEXT PRIMARY KEY,
  team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_team_messages_team ON team_messages(team_id, created_at);
```

## Schema Files

- `packages/db/src/schema/teams.ts`
- `packages/db/src/schema/team-members.ts`
- `packages/db/src/schema/team-invites.ts`
- `packages/db/src/schema/team-repos.ts`
- `packages/db/src/schema/team-messages.ts`

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_teams_hackathon` | teams | `(hackathon_id)` | List teams in a hackathon |
| `idx_teams_invite_code` | teams | `(invite_code)` | Join-by-code lookup |
| `idx_team_members_user` | team_members | `(user_id)` | "My teams" across hackathons |
| `UNIQUE(team_id, user_id)` | team_members | composite | Prevent duplicate membership |
| `idx_team_invites_email` | team_invites | `(email)` | Pending invites for a user |
| `idx_team_repos_github` | team_repos | `(github_owner, github_repo)` | Webhook → team resolution |
| `idx_team_messages_team` | team_messages | `(team_id, created_at)` | Cursor-paginated chat history |

## Notes

- A user may only belong to one team per hackathon — enforced at the application layer, not DB constraint.
- `team_repos.bot_active` indicates whether the GitHub App bot is posting commit summaries.
- `team_messages` is Phase 2 — table is defined but endpoints are not yet implemented.
