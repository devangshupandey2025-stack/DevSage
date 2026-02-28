# Status Page (status.devsage.org)

**Status: NEW — not built yet.**

Self-contained application (backend + frontend in one folder) that monitors all DevSage services and displays their health.

## Purpose

Public-facing status page showing:
- Current status of all services (API, web, app, platform, admin, judge)
- Uptime history (last 90 days)
- Incident history and ongoing incidents
- Scheduled maintenance windows
- Response time metrics

## Architecture

Unlike other apps, `status` is **self-contained** — it has its own backend that performs health checks and its own frontend that displays results. It should be independently deployable and NOT depend on the main API being up.

```
apps/status/
├── backend/
│   ├── src/
│   │   ├── index.ts          — Hono app entry point
│   │   ├── health-checker.ts — Service health check logic
│   │   ├── incident.ts       — Incident CRUD
│   │   ├── metrics.ts        — Uptime calculation, response times
│   │   └── store.ts          — D1 storage for history
│   ├── wrangler.jsonc        — Own Worker config (separate from main API)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ServiceStatus.tsx
│   │   │   ├── UptimeBar.tsx
│   │   │   ├── IncidentTimeline.tsx
│   │   │   ├── ResponseTimeChart.tsx
│   │   │   └── StatusHeader.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx       — Overall status dashboard
│   │   │   └── History.tsx    — Full incident history
│   │   ├── lib/
│   │   │   └── api.ts         — Fetch from status backend
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
└── README.md
```

## Backend: Health Checker

### Services to Monitor

| Service | URL | Check Method |
|---------|-----|-------------|
| API | `api.devsage.org/health` | HTTP GET, expect 200 |
| Web | `devsage.org` | HTTP GET, expect 200 |
| App | `app.devsage.org` | HTTP GET, expect 200 |
| Platform | `platform.devsage.org` | HTTP GET, expect 200 |
| Admin | `shikdd.devsage.org` | HTTP GET, expect 200 |
| Judge | `judge.devsage.org` | HTTP GET, expect 200 |
| GitHub Webhooks | `api.devsage.org/webhooks/health` | HTTP GET, expect 200 |

### Health Check Logic

```typescript
interface HealthCheck {
  service: string;
  url: string;
  status: 'operational' | 'degraded' | 'down' | 'maintenance';
  responseTimeMs: number;
  checkedAt: string;
}

async function checkService(service: string, url: string): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10_000); // 10s timeout

    const res = await fetch(url, { signal: controller.signal });
    const responseTimeMs = Date.now() - start;

    return {
      service,
      url,
      status: res.ok ? (responseTimeMs > 3000 ? 'degraded' : 'operational') : 'down',
      responseTimeMs,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      service, url,
      status: 'down',
      responseTimeMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
    };
  }
}
```

### Cron Schedule

Run health checks every 5 minutes via Cloudflare Worker cron:
```jsonc
// wrangler.jsonc
{
  "triggers": {
    "crons": ["*/5 * * * *"]
  }
}
```

### Storage

Use D1 (SQLite) — not KV. Health checks run every 5 minutes (288 writes/day per service × 7 services = ~2,000 writes/day), which exceeds KV's free-plan limit of 1,000 writes/day.

```sql
-- Status DB schema (separate D1 database from main API)
CREATE TABLE health_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service TEXT NOT NULL,
  status TEXT NOT NULL,           -- 'operational', 'degraded', 'down', 'maintenance'
  response_time_ms INTEGER NOT NULL,
  checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_health_checks_service_date ON health_checks(service, checked_at);

CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'investigating',  -- investigating, identified, monitoring, resolved
  severity TEXT NOT NULL DEFAULT 'minor',        -- minor, major, critical
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resolved_at TEXT
);

CREATE TABLE incident_updates (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id),
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

**Cleanup**: Cron deletes health checks older than 90 days: `DELETE FROM health_checks WHERE checked_at < datetime('now', '-90 days')`

**Current status query**: `SELECT DISTINCT ON (service) * FROM health_checks ORDER BY service, checked_at DESC` (or use a subquery for SQLite compatibility)

### API Endpoints

```
GET  /api/status              — Current status of all services
GET  /api/status/history      — Uptime data for last N days
GET  /api/incidents           — Active + recent incidents
POST /api/incidents           — Create incident (admin auth required)
PATCH /api/incidents/:id      — Update incident status
GET  /api/metrics/:service    — Response time history for a service
```

Admin auth for incident management: simple shared secret in `Authorization` header (no need for full JWT — this is a separate system).

## Frontend: Status Dashboard

### Pages

**Home (`/`)** — Main status page:
- Overall status banner: "All Systems Operational" / "Partial Outage" / "Major Outage"
- Per-service status cards with colored indicators
- 90-day uptime bars per service (green/yellow/red segments)
- Active incidents (if any) with live updates
- Response time sparklines

**History (`/history`)** — Incident archive:
- Month-by-month incident history
- Expandable incident details (timeline of updates)

### Components

| Component | Purpose |
|-----------|---------|
| `StatusHeader` | Overall status banner with color |
| `ServiceCard` | Single service: name, status, response time |
| `UptimeBar` | 90-day horizontal bar (each day = green/yellow/red segment) |
| `IncidentCard` | Active incident with title, status, updates |
| `IncidentTimeline` | Chronological list of incident updates |
| `ResponseTimeChart` | Sparkline or line chart of response times |
| `MaintenanceNotice` | Upcoming maintenance banner |

### Design

- Light theme (status pages are typically light for readability)
- Minimal branding — just the DevSage logo and name
- Color coding: green (operational), yellow (degraded), red (down), blue (maintenance)
- Auto-refresh every 60 seconds (poll `/api/status`)
- Mobile-responsive single-column layout

## Tech Stack

**Backend**:
- Cloudflare Worker (Hono) — separate from main API
- D1 for storage (own database, separate from main API's D1)
- Cron trigger for health checks

**Frontend**:
- React + Vite (same as other apps for consistency)
- Tailwind CSS v4 (but light theme, minimal shadcn)
- No auth required (public page)
- No React Query needed (simple polling with `setInterval`)

## Scaffolding Steps

1. Create `apps/status/backend/` with Hono Worker
2. Create `apps/status/frontend/` with Vite React-TS
3. Add to `pnpm-workspace.yaml` and `turbo.json`
4. Add `wrangler.jsonc` for the status Worker (own D1 database)
5. Implement health checker + cron
6. Build frontend components
7. Add `GET /health` endpoint to main API (if it doesn't exist)
8. Deploy status Worker independently

## Operational Notes

- The status page MUST be independently deployable — if the main API is down, status should still work
- Use a separate Cloudflare account or at minimum a separate D1 database
- Consider adding email/webhook notifications when a service goes down (stretch goal)
- The status Worker should have its own domain and DNS (not routed through the main API)
