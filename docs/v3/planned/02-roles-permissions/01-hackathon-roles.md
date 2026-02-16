# Hackathon Roles

> Six per-hackathon roles stored across three tables. Each role has distinct capabilities.

## Role Definitions

### organizer
- **Stored in:** `organizer_roles` (role = `organizer`)
- **Who:** Person who created the hackathon or was assigned organizer role
- **Can do:** Everything — create/delete hackathon, manage phases, configure judging, invite judges, manage all teams, publish results
- **Limit:** Typically 1 per hackathon

### co_organizer
- **Stored in:** `organizer_roles` (role = `co_organizer`)
- **Who:** Invited by organizer to help manage the hackathon
- **Can do:** Everything except delete hackathon and transfer ownership
- **Limit:** No limit

### judge
- **Stored in:** `judges` (invite_status = `accepted`)
- **Who:** Invited by organizer/co_organizer via email or link
- **Can do:** View submissions, score teams, view leaderboard, access judge dashboard
- **Cannot do:** Manage teams, change hackathon settings, view other judges' scores (blind mode)

### team_lead
- **Stored in:** `team_members` (role = `team_lead`)
- **Who:** First member of a team or transferred leadership
- **Can do:** Manage team members, link GitHub repo, trigger submissions, view own team's scores
- **Limit:** Exactly 1 per team

### team_member
- **Stored in:** `team_members` (role = `team_member`)
- **Who:** Invited by team lead or joined via invite code
- **Can do:** View own team, view hackathon info, view own scores

### anonymous
- **Stored in:** Not stored (default)
- **Who:** Authenticated user with no role in this hackathon, or unauthenticated user
- **Can do:** View public hackathon info only

## DB Tables

### organizer_roles
```sql
CREATE TABLE organizer_roles (
  id TEXT PRIMARY KEY,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('organizer', 'co_organizer')),
  invited_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(hackathon_id, user_id)
);
```

### judges
```sql
CREATE TABLE judges (
  id TEXT PRIMARY KEY,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  email TEXT NOT NULL,
  invite_status TEXT NOT NULL DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'declined')),
  invite_token TEXT,
  invited_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  UNIQUE(hackathon_id, email)
);
```

### team_members
```sql
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'team_member' CHECK (role IN ('team_lead', 'team_member')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(team_id, user_id)
);
```

## Assignment Rules

| Action | Who Can Do It | Notes |
|--------|--------------|-------|
| Assign organizer | Platform admin or workspace owner | On hackathon creation |
| Invite co_organizer | Organizer | Via email invite |
| Invite judge | Organizer, co_organizer | Via email or bulk invite |
| Add team_lead | System | First member of team becomes lead |
| Add team_member | Team lead (via invite) | Or join via invite code |
| Transfer team_lead | Current team_lead | Explicit transfer to another member |

## One User, Multiple Hackathons

A user can be:
- Organizer of hackathon A
- Judge in hackathon B
- Team member in hackathon C

Roles are resolved per-hackathon, per-request. No ambient authority.
