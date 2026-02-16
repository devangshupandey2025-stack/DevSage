# Hackathon Configuration

> Settings, tracks, prizes, branding, and deadlines stored in the hackathons table and related tables.

## Hackathon Settings

The `settings` column (JSON) stores optional configuration:

```ts
interface HackathonSettings {
  // Team rules
  allow_individual_participation?: boolean;  // default: false
  require_github_repo?: boolean;             // default: true

  // Submission rules
  max_submissions_per_team?: number;         // default: 1
  tag_pattern?: string;                      // default: 'submission-v*'
  allow_resubmission?: boolean;              // default: true

  // Judging
  blind_judging?: boolean;                   // default: false
  results_published?: boolean;               // default: false

  // Branding
  logo_url?: string;
  banner_url?: string;
  theme_color?: string;                      // hex color
  custom_css?: string;                       // for participant site
}
```

## Tracks

Multi-track hackathons use the `hackathon_tracks` table:

```sql
CREATE TABLE hackathon_tracks (
  id TEXT PRIMARY KEY,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  max_teams INTEGER,           -- per-track limit (null = unlimited)
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

**Endpoints:**
```
GET    /api/v1/hackathons/:slug/tracks
POST   /api/v1/hackathons/:slug/tracks          # organizer/co_organizer
PATCH  /api/v1/hackathons/:slug/tracks/:trackId  # organizer/co_organizer
DELETE /api/v1/hackathons/:slug/tracks/:trackId  # organizer/co_organizer
```

Teams select a track on creation. If no tracks are configured, the hackathon is single-track.

## Rounds

Hackathons can have multiple rounds (e.g., preliminary + final):

```sql
CREATE TABLE hackathon_rounds (
  id TEXT PRIMARY KEY,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  round_number INTEGER NOT NULL,
  submission_deadline TEXT,    -- per-round deadline (optional)
  is_elimination INTEGER NOT NULL DEFAULT 0,  -- SQLite boolean
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(hackathon_id, round_number)
);
```

**Endpoints:**
```
GET    /api/v1/hackathons/:slug/rounds
POST   /api/v1/hackathons/:slug/rounds          # organizer
PATCH  /api/v1/hackathons/:slug/rounds/:roundId  # organizer
DELETE /api/v1/hackathons/:slug/rounds/:roundId  # organizer
```

If no rounds are configured, there's a single implicit "default" round.

## Prizes

Prizes are stored in the hackathon `settings` JSON:

```ts
interface Prize {
  name: string;          // "Best Overall", "Best UI"
  description?: string;
  value?: string;        // "$500", "AWS Credits"
  track_id?: string;     // optional — track-specific prize
  sort_order: number;
}
```

## Deadlines

| Deadline | Stored In | Purpose |
|----------|-----------|---------|
| `start_date` | `hackathons` table | Display only — when hackathon opens |
| `end_date` | `hackathons` table | Display only — when hackathon ends |
| `submission_deadline` | `hackathons` table + DO state | Hard enforcement — submissions locked after |
| `judging_deadline` | `hackathons` table + DO state | Optional — auto-transition judging→completed |
| Per-round deadline | `hackathon_rounds` table | Optional — round-specific submission cutoff |

## Update Endpoint

```
PATCH /api/v1/hackathons/:slug
Auth: organizer or co_organizer
```

```ts
// Only allowed in draft and active states
// Some fields locked after teams exist (slug, tracks)
const updateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(5000).optional(),
  start_date: z.string().datetime().nullable().optional(),
  end_date: z.string().datetime().nullable().optional(),
  submission_deadline: z.string().datetime().nullable().optional(),
  max_team_size: z.number().int().min(1).max(20).optional(),
  min_team_size: z.number().int().min(1).max(10).optional(),
  max_teams: z.number().int().min(1).max(500).nullable().optional(),
  settings: z.record(z.unknown()).optional(),
});
```

## Implementation Notes

- Settings are merged (not replaced) on update — send only changed fields
- Track changes are blocked after hackathon is `active` if teams reference them
- The DO config is synced with the D1 row — DO is authoritative for state, D1 for reads
