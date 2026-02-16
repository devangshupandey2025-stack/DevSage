# Sponsor Tables (Phase 2)

> Hackathon sponsor management with tiered display ordering. **This is a Phase 2 feature — not yet implemented.**

## Tables

### hackathon_sponsors

Sponsors displayed on hackathon pages, organized by tier with custom ordering.

```sql
CREATE TABLE hackathon_sponsors (
  id            TEXT PRIMARY KEY,
  hackathon_id  TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  tier          TEXT NOT NULL CHECK (tier IN ('platinum','gold','silver','bronze')),
  logo_url      TEXT,
  website_url   TEXT,
  description   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_sponsors_hackathon ON hackathon_sponsors(hackathon_id);
```

## Schema Files

- `packages/db/src/schema/hackathon-sponsors.ts`

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_sponsors_hackathon` | hackathon_sponsors | `(hackathon_id)` | List all sponsors for a hackathon |

## Notes

- **Phase 2**: Schema is defined for forward compatibility, but API endpoints and UI are not yet implemented.
- Sponsors are displayed grouped by tier (`platinum` first → `bronze` last), then ordered by `sort_order` within each tier.
- `logo_url` points to an externally hosted image — no R2 upload in Phase 1.
- Organizers manage sponsors through the platform dashboard (`apps/platform`).
