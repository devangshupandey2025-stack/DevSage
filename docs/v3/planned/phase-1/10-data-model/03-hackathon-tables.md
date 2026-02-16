# Hackathon Tables

> Hackathon lifecycle, tracks, multi-round structure, custom phases, and reusable templates.

## Tables

### hackathons

Central entity. Lifecycle managed by `HackathonStateMachine` Durable Object.

```sql
CREATE TABLE hackathons (
  id                  TEXT PRIMARY KEY,
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','active','judging','completed','archived')),
  start_date          TEXT,
  end_date            TEXT,
  submission_deadline TEXT,
  max_team_size       INTEGER NOT NULL DEFAULT 5,
  min_team_size       INTEGER NOT NULL DEFAULT 1,
  max_teams           INTEGER,                    -- NULL = unlimited
  settings            TEXT,                       -- JSON blob for flexible config
  created_by          TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_hackathons_workspace ON hackathons(workspace_id);
CREATE INDEX idx_hackathons_status    ON hackathons(status);
```

### organizer_roles

Tracks organizer and co-organizer assignments per hackathon. Referenced by role resolution queries.

```sql
CREATE TABLE organizer_roles (
  id TEXT PRIMARY KEY,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('organizer', 'co_organizer')),
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(hackathon_id, user_id)
);

CREATE INDEX idx_organizer_roles_user ON organizer_roles(user_id);
```

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | TEXT | PK | UUID |
| hackathon_id | TEXT | FK → hackathons, NOT NULL | CASCADE on delete |
| user_id | TEXT | FK → users, NOT NULL | CASCADE on delete |
| role | TEXT | CHECK (organizer, co_organizer) | Role level |
| invited_by | TEXT | FK → users, nullable | SET NULL on delete |
| created_at | TEXT | NOT NULL, DEFAULT now | ISO-8601 |

### hackathon_tracks

Optional thematic tracks within a hackathon (e.g. "AI/ML", "Web3").

```sql
CREATE TABLE hackathon_tracks (
  id            TEXT PRIMARY KEY,
  hackathon_id  TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  max_teams     INTEGER,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_hackathon_tracks_hackathon ON hackathon_tracks(hackathon_id);
```

### hackathon_rounds

Multi-round hackathons with per-round deadlines and optional elimination.

```sql
CREATE TABLE hackathon_rounds (
  id                  TEXT PRIMARY KEY,
  hackathon_id        TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  round_number        INTEGER NOT NULL,
  submission_deadline TEXT,
  is_elimination      INTEGER NOT NULL DEFAULT 0, -- SQLite boolean
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (hackathon_id, round_number)
);
```

### custom_phases

Organizer-defined sub-phases within a hackathon status (e.g. "Ideation" within `active`).

```sql
CREATE TABLE custom_phases (
  id            TEXT PRIMARY KEY,
  hackathon_id  TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  parent_status TEXT NOT NULL CHECK (parent_status IN ('draft','active','judging','completed','archived')),
  name          TEXT NOT NULL,
  description   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  start_date    TEXT,
  end_date      TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_custom_phases_hackathon ON custom_phases(hackathon_id);
```

### hackathon_templates

Reusable configuration snapshots for quick hackathon creation.

```sql
CREATE TABLE hackathon_templates (
  id                  TEXT PRIMARY KEY,
  workspace_id        TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  settings            TEXT NOT NULL DEFAULT '{}',   -- JSON: team sizes, deadlines config
  tracks              TEXT NOT NULL DEFAULT '[]',   -- JSON array of track definitions
  rounds              TEXT NOT NULL DEFAULT '[]',   -- JSON array of round definitions
  rubric              TEXT NOT NULL DEFAULT '[]',   -- JSON array of rubric criteria
  is_platform_default INTEGER NOT NULL DEFAULT 0,
  created_by          TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_hackathon_templates_workspace ON hackathon_templates(workspace_id);
```

## Schema Files

- `packages/db/src/schema/hackathons.ts`
- `packages/db/src/schema/hackathon-tracks.ts`
- `packages/db/src/schema/hackathon-rounds.ts`
- `packages/db/src/schema/custom-phases.ts`
- `packages/db/src/schema/hackathon-templates.ts`

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `hackathons.slug` | hackathons | `(slug)` | URL resolution (UNIQUE) |
| `idx_hackathons_workspace` | hackathons | `(workspace_id)` | List hackathons for a workspace |
| `idx_hackathons_status` | hackathons | `(status)` | Filter by lifecycle state |
| `UNIQUE(hackathon_id, round_number)` | hackathon_rounds | composite | Enforce unique round ordering |
| `idx_custom_phases_hackathon` | custom_phases | `(hackathon_id)` | Load phases for timeline display |
| `idx_hackathon_templates_workspace` | hackathon_templates | `(workspace_id)` | List templates per workspace |

## Notes

- State transitions are forward-only: `draft → active → judging → completed → archived`. The only exception is `archived → completed` for score corrections.
- `settings` JSON blob holds feature flags (e.g. `allow_late_submissions`, `require_repo`, `public_leaderboard`).
- `hackathon_templates` with `is_platform_default = 1` and `workspace_id = NULL` are system-level templates.
