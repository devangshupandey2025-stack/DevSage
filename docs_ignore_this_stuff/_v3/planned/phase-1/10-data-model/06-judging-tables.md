# Judging Tables

> Judge management, assignment, rubric criteria, scoring, and per-round results.

## Tables

### judges

Invited judges for a hackathon. May be invited before they have a user account.

```sql
CREATE TABLE judges (
  id            TEXT PRIMARY KEY,
  hackathon_id  TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  user_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  email         TEXT NOT NULL,
  invite_status TEXT NOT NULL DEFAULT 'pending'
                  CHECK (invite_status IN ('pending','accepted','declined')),
  invite_token  TEXT NOT NULL UNIQUE,
  invited_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  accepted_at   TEXT,
  UNIQUE (hackathon_id, email)
);
```

### judge_assignments

Maps judges to specific submissions for scoring.

```sql
CREATE TABLE judge_assignments (
  id            TEXT PRIMARY KEY,
  judge_id      TEXT NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  hackathon_id  TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','scored','skipped')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (judge_id, submission_id)
);

CREATE INDEX idx_judge_assignments_submission ON judge_assignments(submission_id);
CREATE INDEX idx_judge_assignments_hackathon  ON judge_assignments(hackathon_id);
```

### judge_tracks

Constrains a judge to specific tracks. If no rows exist, the judge scores all tracks.

```sql
CREATE TABLE judge_tracks (
  id        TEXT PRIMARY KEY,
  judge_id  TEXT NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  track_id  TEXT NOT NULL REFERENCES hackathon_tracks(id) ON DELETE CASCADE,
  UNIQUE (judge_id, track_id)
);
```

### rubric_criteria

Scoring rubric definition. Criteria may be global or scoped to a track.

```sql
CREATE TABLE rubric_criteria (
  id            TEXT PRIMARY KEY,
  hackathon_id  TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  max_score     INTEGER NOT NULL DEFAULT 10,
  weight        REAL NOT NULL DEFAULT 1.0,
  track_id      TEXT REFERENCES hackathon_tracks(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_rubric_criteria_hackathon ON rubric_criteria(hackathon_id);
```

### scores

Individual judge scores per criterion per submission.

```sql
CREATE TABLE scores (
  id            TEXT PRIMARY KEY,
  hackathon_id  TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  judge_id      TEXT NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  criterion_id  TEXT NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
  score         REAL NOT NULL,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (judge_id, submission_id, criterion_id)
);

CREATE INDEX idx_scores_submission ON scores(submission_id);
CREATE INDEX idx_scores_judge      ON scores(judge_id);
```

### round_results

Aggregated results after a round completes. Used for elimination advancement.

```sql
CREATE TABLE round_results (
  id          TEXT PRIMARY KEY,
  round_id    TEXT NOT NULL REFERENCES hackathon_rounds(id) ON DELETE CASCADE,
  team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  rank        INTEGER NOT NULL,
  total_score REAL NOT NULL,
  advanced    INTEGER NOT NULL DEFAULT 0,  -- SQLite boolean
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (round_id, team_id)
);

CREATE INDEX idx_round_results_round ON round_results(round_id);
```

## Schema Files

- `packages/db/src/schema/judges.ts`
- `packages/db/src/schema/judge-assignments.ts`
- `packages/db/src/schema/judge-tracks.ts`
- `packages/db/src/schema/rubric-criteria.ts`
- `packages/db/src/schema/scores.ts`
- `packages/db/src/schema/round-results.ts`

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `UNIQUE(hackathon_id, email)` | judges | composite | One invite per email per hackathon |
| `UNIQUE(judge_id, submission_id)` | judge_assignments | composite | Prevent duplicate assignments |
| `idx_judge_assignments_submission` | judge_assignments | `(submission_id)` | List judges for a submission |
| `idx_rubric_criteria_hackathon` | rubric_criteria | `(hackathon_id)` | Load rubric for scoring UI |
| `idx_scores_submission` | scores | `(submission_id)` | Aggregate scores for leaderboard |
| `idx_scores_judge` | scores | `(judge_id)` | Judge's scoring progress |
| `UNIQUE(judge_id, submission_id, criterion_id)` | scores | composite | One score per criterion per judge |
| `idx_round_results_round` | round_results | `(round_id)` | Round leaderboard / advancement |

## Notes

- Judges may be invited by email before they sign up. `user_id` is linked when they accept.
- `weight` on rubric criteria allows weighted scoring (e.g. "Innovation" counts 2× more than "Presentation").
- `round_results` are computed and frozen when a round is finalized — they are not live aggregates.
