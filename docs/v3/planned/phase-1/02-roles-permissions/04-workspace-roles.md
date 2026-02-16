# Workspace Roles

> Workspace-level membership and how workspace roles cascade into hackathon roles.

## Workspace Model

A workspace represents a club or organization. Platform admins create workspaces and invite organizers.

```
Platform Admin → creates Workspace → invites Organizer
                                          ↓
                              Organizer creates Hackathons in Workspace
```

## Workspace Roles

| Role | Who Assigns | Capabilities |
|------|-------------|-------------|
| `owner` | Platform admin (on workspace creation) | Full workspace control, billing, invite organizers |
| `admin` | Workspace owner | Manage hackathons, invite members |
| `member` | Owner or admin | View workspace hackathons, participate |

### `workspace_members` Table

```sql
CREATE TABLE workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(workspace_id, user_id)
);
```

### `workspace_invites` Table

```sql
CREATE TABLE workspace_invites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invite_token TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL
);
```

> **Token Generation:** All invite tokens MUST use `crypto.randomUUID()` (Web Crypto API). Never use `Math.random()` — it is not cryptographically secure.

## Role Cascading

When resolving a user's role for a hackathon, if no direct hackathon role exists, workspace membership is checked:

| Workspace Role | → Hackathon Role | Priority |
|---------------|-----------------|----------|
| `owner` | `organizer` | 6 |
| `admin` | `organizer` | 6 |
| `member` | `co_organizer` | 7 |

Workspace-cascaded roles always have lower priority than direct hackathon role assignments (priorities 1–5). This prevents workspace membership from shadowing explicit per-hackathon roles like judge or team_lead.

This cascading happens in step 4 of the `resolveRole()` algorithm (see [02-role-resolution.md](./02-role-resolution.md)).

## Workspace Endpoints

```
POST   /api/v1/workspaces                    # Create (platform admin only)
GET    /api/v1/workspaces                     # List user's workspaces
GET    /api/v1/workspaces/:id                 # Get workspace details
PATCH  /api/v1/workspaces/:id                 # Update workspace
POST   /api/v1/workspaces/:id/members         # Invite member
GET    /api/v1/workspaces/:id/members         # List members
DELETE /api/v1/workspaces/:id/members/:userId  # Remove member
GET    /api/v1/workspaces/:id/hackathons      # List hackathons in workspace
```

## Joined Workspaces (Phase 3)

Multiple workspaces can form "joined workspaces" to co-host events. This is deferred to Phase 3.

## Implementation Notes

- Every hackathon belongs to exactly one workspace (`hackathons.workspace_id`)
- Workspace deletion cascades to all hackathons within it
- Workspace role cascading is a fallback — explicit hackathon roles always take precedence
