# Sponsor Management

> Hackathon sponsor tiers, branding, and asset management.

## Overview

Organizers can add sponsors to hackathons with tier-based visibility. Sponsor logos and details appear on the hackathon site and platform.

## Tiers

| Tier | Display | Features |
|------|---------|----------|
| `title` | Largest logo, top placement | Custom track, named prize |
| `gold` | Large logo, prominent | Logo on submission page |
| `silver` | Medium logo | Logo on sponsors section |
| `bronze` | Small logo | Logo on sponsors section |

## Existing Table

```sql
-- packages/db/src/schema/hackathon-sponsors.ts (already exists)
CREATE TABLE hackathon_sponsors (
  id TEXT PRIMARY KEY,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id),
  name TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  tier TEXT NOT NULL DEFAULT 'bronze',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

## Endpoints

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/hackathons/:slug/sponsors` | opt | — | List sponsors (public) |
| POST | `/hackathons/:slug/sponsors` | ✅ | co_organizer | Add sponsor |
| PATCH | `/hackathons/:slug/sponsors/:id` | ✅ | co_organizer | Update sponsor |
| DELETE | `/hackathons/:slug/sponsors/:id` | ✅ | co_organizer | Remove sponsor |

## Logo Upload

Sponsor logos stored in R2:

```ts
const key = `sponsors/${hackathonId}/${sponsorId}/logo.png`;
await env.UPLOADS.put(key, logoFile);
const logoUrl = `https://uploads.devsage.org/${key}`;
```

## Prerequisites

- Hackathon CRUD (Phase 1)
- R2 binding for logo uploads
- Frontend sponsor management UI in platform app

## Notes

- Simplest Phase 2 feature — standalone CRUD with no complex dependencies
- `display_order` controls ordering within a tier
- Public endpoint (no auth) so hackathon sites can fetch sponsor data
- Schema table already exists — only need routes and UI
