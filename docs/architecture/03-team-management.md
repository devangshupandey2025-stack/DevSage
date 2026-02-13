# 03 — Team Management

> Participants register teams during the registration phase, join via invite codes, link GitHub repos, and manage membership. Team size is enforced by hackathon configuration.

**Related docs:** [Hackathon Lifecycle](./02-hackathon-lifecycle.md) | [Submissions](./04-submissions.md) | [Roles & Permissions](./06-roles-permissions.md)

---

## Team Lifecycle

```mermaid
flowchart TD
    A["Hackathon in registration_open"] --> B["Participant creates team"]
    B --> C["Team created with:<br/>- random invite_code<br/>- creator as team_leader"]
    C --> D["Share invite code<br/>with teammates"]
    D --> E["Teammates join<br/>via POST .../join"]
    E --> F{Team full?}
    F -->|No| D
    F -->|Yes| G["Team finalized"]
    G --> H["Link GitHub repo<br/>(team_leader only)"]
    H --> I["Bot activated<br/>when GitHub App installed"]
    I --> J["Ready for<br/>submissions"]
```

---

## Core Operations

### Create Team

```mermaid
sequenceDiagram
    participant U as Participant
    participant W as API Worker
    participant D1 as D1 Database

    U->>W: POST /api/v1/hackathons/:slug/teams<br/>{ name: "Team Alpha" }
    W->>W: Verify: hackathon status = registration_open
    W->>W: Verify: user not already on a team
    W->>W: Verify: max_teams not exceeded
    W->>D1: INSERT teams (name, hackathon_id, invite_code)
    W->>D1: INSERT team_members (user_id, role='leader')
    W->>D1: INSERT audit_events (team_created)
    W-->>U: 201 { ok: true, data: { team, inviteCode } }
```

**Constraints:**
- Team name must be 2-50 characters, unique per hackathon
- User can only be on one team per hackathon
- `max_teams` limit checked before creation
- Invite code: 8-character random alphanumeric string

### Join Team

```mermaid
sequenceDiagram
    participant U as Participant
    participant W as API Worker
    participant D1 as D1 Database

    U->>W: POST /api/v1/hackathons/:slug/teams/:id/join<br/>{ inviteCode: "AB12CD34" }
    W->>W: Verify: hackathon status = registration_open
    W->>W: Verify: invite code matches team
    W->>W: Verify: user not already on a team
    W->>D1: Count team_members for this team
    W->>W: Verify: count < max_team_size
    W->>D1: INSERT team_members (user_id, role='member')
    W->>D1: INSERT audit_events (team_joined)
    W-->>U: 200 { ok: true, data: team }
```

### Connect GitHub Repo

```mermaid
sequenceDiagram
    participant L as Team Leader
    participant W as API Worker
    participant D1 as D1 Database

    L->>W: POST /api/v1/hackathons/:slug/teams/:id/repo<br/>{ repoFullName: "owner/repo" }
    W->>W: Verify: user is team_leader
    W->>W: Verify: repo not already linked to another team
    W->>D1: UPDATE teams SET repo_full_name, repo_url
    W->>D1: INSERT audit_events (team_repo_connected)
    W-->>L: 200 { ok: true, data: team }

    Note over D1: Bot activates when<br/>GitHub App installation<br/>event arrives for this repo
```

### Remove Member

```mermaid
sequenceDiagram
    participant L as Team Leader
    participant W as API Worker
    participant D1 as D1 Database

    L->>W: DELETE /api/v1/hackathons/:slug/teams/:id/members/:userId
    W->>W: Verify: requester is team_leader or admin+
    W->>W: Verify: not removing self if leader
    W->>D1: DELETE FROM team_members WHERE team_id AND user_id
    W->>D1: INSERT audit_events (member_removed)
    W-->>L: 200 { ok: true }
```

---

## Data Model

```mermaid
erDiagram
    hackathons ||--o{ teams : has
    teams ||--o{ team_members : contains
    users ||--o{ team_members : belongs_to

    teams {
        TEXT id PK
        TEXT hackathon_id FK
        TEXT name "UNIQUE per hackathon"
        TEXT repo_full_name "owner/repo"
        TEXT repo_url
        INT github_installation_id
        INT bot_active "0 or 1"
        TEXT invite_code UK
        TEXT created_at
    }

    team_members {
        TEXT id PK
        TEXT team_id FK
        TEXT user_id FK
        TEXT role "leader or member"
        TEXT joined_at
    }
```

### Constraints

| Constraint | Columns | Purpose |
|------------|---------|---------|
| `UNIQUE(hackathon_id, name)` | teams | No duplicate team names per hackathon |
| `UNIQUE(hackathon_id, repo_full_name)` | teams | One repo per hackathon |
| `UNIQUE(invite_code)` | teams | Global invite code uniqueness |
| `UNIQUE(team_id, user_id)` | team_members | User can't join same team twice |

---

## Invite Code System

```mermaid
flowchart LR
    A["Team created"] --> B["Generate 8-char<br/>alphanumeric code"]
    B --> C["Code stored in<br/>teams.invite_code"]
    C --> D["Leader shares<br/>code with teammates"]
    D --> E["Teammate submits<br/>code via /join endpoint"]
    E --> F["Code verified<br/>against team"]
    F --> G["Member added<br/>to team"]
```

- Length: 8 characters (configurable via `JOIN_CODE_LENGTH`)
- Character set: alphanumeric
- Globally unique across all teams
- No expiration (valid until hackathon leaves registration phase)

---

## Bot Activation Flow

When a team links a GitHub repo, the bot becomes active only after the GitHub App is installed:

```mermaid
sequenceDiagram
    participant L as Team Leader
    participant W as API Worker
    participant GH as GitHub

    L->>W: Link repo "owner/repo"
    W->>W: Store repo_full_name on team

    Note over L,GH: Team leader must install<br/>the DevSage GitHub App<br/>on their repository

    GH->>W: POST /webhooks/github<br/>(installation event)
    W->>W: Enqueue to WEBHOOK_QUEUE
    W->>W: installation-handler processes event
    W->>W: UPDATE teams SET bot_active = 1<br/>WHERE repo_full_name IN (installed repos)

    Note over W: Bot now tracks commits,<br/>detects force pushes,<br/>captures tag submissions
```

---

## Team Member Roles

| Role | Permissions |
|------|-------------|
| `leader` | Create team, link repo, remove members, finalize submission |
| `member` | View team, push code, create tags |

The `leader` role maps to `team_leader` in the hackathon role hierarchy. The `member` role maps to `participant`.

---

## Validation Rules

| Rule | Enforcement |
|------|-------------|
| Team creation only during `registration_open` | Checked in route handler |
| Team join only during `registration_open` | Checked in route handler |
| User can only be on one team per hackathon | Checked via DB query before insert |
| Team name 2-50 chars | Zod schema validation |
| Team name unique per hackathon | DB UNIQUE constraint |
| Team size ≤ `max_team_size` | Count check before join |
| Repo not already linked to another team | DB UNIQUE constraint on `(hackathon_id, repo_full_name)` |
| Solo participation allowed | `min_team_size` defaults to 1 (team of one) |

---

## File References

| File | Purpose |
|------|---------|
| `apps/api/src/routes/teams.ts` | Team CRUD routes |
| `apps/api/src/queue/installation-handler.ts` | Bot activation on GitHub App install |
| `packages/shared/src/schemas/team.ts` | `TeamSchema`, `CreateTeamRequestSchema`, `JoinTeamRequestSchema` |
| `packages/shared/src/schemas/team-member.ts` | `TeamMemberSchema` |
| `packages/db/src/schema/teams.ts` | Teams table definition |
| `packages/db/src/schema/team-members.ts` | Team members table definition |
| `apps/web/src/pages/hackathon-detail.tsx` | Team creation/joining UI |
| `apps/web/src/pages/team-management.tsx` | Team member management UI |
