# Workspace Tables

> Organizational units that own hackathons — clubs, companies, or individuals.

## Tables

### workspaces

A workspace is the top-level container for hackathons. Clubs and individuals each get one.

```sql
CREATE TABLE workspaces (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,        -- URL-safe identifier
  description TEXT,
  type        TEXT NOT NULL CHECK (type IN ('club', 'individual')),
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_workspaces_created_by ON workspaces(created_by);
```

### workspace_members

Membership and role within a workspace. Roles control who can create/manage hackathons.

```sql
CREATE TABLE workspace_members (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  invited_by   TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
```

### workspace_invites

Email-based invitations to join a workspace. Tokens are single-use.

```sql
CREATE TABLE workspace_invites (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  invite_token  TEXT NOT NULL UNIQUE,
  invited_by    TEXT NOT NULL REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at    TEXT NOT NULL
);

CREATE INDEX idx_workspace_invites_email ON workspace_invites(email);
```

## Schema Files

- `packages/db/src/schema/workspaces.ts`
- `packages/db/src/schema/workspace-members.ts`
- `packages/db/src/schema/workspace-invites.ts`

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `workspaces.slug` | workspaces | `(slug)` | URL resolution (UNIQUE) |
| `idx_workspaces_created_by` | workspaces | `(created_by)` | "My workspaces" query |
| `idx_workspace_members_user` | workspace_members | `(user_id)` | "Workspaces I belong to" |
| `UNIQUE(workspace_id, user_id)` | workspace_members | composite | Prevent duplicate membership |
| `idx_workspace_invites_email` | workspace_invites | `(email)` | Pending invites for a user |

## Notes

- `individual` workspaces are auto-created on first hackathon creation by a solo user.
- Workspace `owner` role cannot be removed — ownership must be transferred first.
- Invite tokens expire; a cron job or query-time check marks expired invites.
