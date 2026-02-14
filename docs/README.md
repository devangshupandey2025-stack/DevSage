# DevSage Documentation

## Current Version: v2 | Planning Version: v3

The v2 docs describe the current production system. The v3 docs document the current system with expanded coverage -- per-surface architecture docs, CLI tooling, and the judging pipeline.

---

## v3 — Architecture Docs

| # | Document | Description |
|---|----------|-------------|
| 00 | [System Overview](./v3/architecture/00-overview.md) | System topology, surfaces, domain map, dependency graph |
| 01 | [Authentication & Sessions](./v3/architecture/01-authentication.md) | Cross-subdomain OAuth 2.0 (GitHub + Google), JWT in HttpOnly cookie, `crypto.subtle` |
| 02 | [Hackathon Lifecycle](./v3/architecture/02-hackathon-lifecycle.md) | 7-state Durable Object, forward-only transitions, submission locking, deadline alarms |
| 03 | [Data Model & Schema](./v3/architecture/03-data-model.md) | 16 D1 tables, Drizzle ORM, TEXT UUIDs, ISO-8601 timestamps, ERD |
| 04 | [API Design](./v3/architecture/04-api-design.md) | Hono routes, response envelope, error codes, middleware chain, pagination |
| 05 | [Hackathon Site Template](./v3/architecture/05-hackathon-site.md) | Per-hackathon sites at `{slug}.devsage.org`, shared template, CLI deployment |
| 06 | [CLI Tool](./v3/architecture/06-cli.md) | Creates and deploys hackathon sites from template in a single command |
| 07 | [Organizer Platform](./v3/architecture/07-organizer-platform.md) | `platform.devsage.org` -- hackathon management, judges, rubric, phase transitions |
| 08 | [Admin Dashboard & Main Site](./v3/architecture/08-admin-and-web.md) | `admin.devsage.org` (invite management) + `devsage.org` (landing + participant hub) |
| 09 | [Judging System](./v3/architecture/09-judging.md) | Judge invitations, rubric criteria, round-robin assignment, scoring, leaderboard |
| 10 | [Roles & Permissions](./v3/architecture/10-roles-permissions.md) | 7-tier per-hackathon hierarchy, per-request resolution, platform admin |
| 11 | [Webhooks & GitHub](./v3/architecture/11-webhooks.md) | GitHub App webhooks, HMAC verification, event normalization, queue processing |
| 12 | [Notifications](./v3/architecture/12-notifications.md) | Queue-backed email, 9 notification types, fail-open delivery |
| 13 | [Infrastructure & Deployment](./v3/architecture/13-infrastructure.md) | Cloudflare Workers, D1, KV, DO, Queues, Turborepo, pnpm workspaces |

### v3 Guides

| Document | Description |
|----------|-------------|
| [Developer Setup](./v3/setup.md) | Local environment setup |
| [Deployment](./v3/deployment.md) | Production deployment to Cloudflare |
| [Secrets](./v3/secrets.md) | Secret management conventions |
| [Contributing](./v3/contributing.md) | Code style, PR checklist, anti-patterns |

---

## v2 — Current Production Docs

| Document | Description |
|----------|-------------|
| [Architecture Overview](./v2/architecture/00-overview.md) | System topology, principles, domain map |
| [Authentication](./v2/architecture/01-authentication.md) | OAuth 2.0, JWT, cookie config |
| [Hackathon Lifecycle](./v2/architecture/02-hackathon-lifecycle.md) | 7-state machine, transitions, alarms |
| [Team Management](./v2/architecture/03-team-management.md) | Registration, invite codes, repo linking |
| [Submissions](./v2/architecture/04-submissions.md) | Tag-based capture, exactly-once locking |
| [Judging](./v2/architecture/05-judging.md) | Rubric, scoring, leaderboard, AI reviews |
| [Roles & Permissions](./v2/architecture/06-roles-permissions.md) | 7-tier hierarchy, per-request resolution |
| [Webhooks & GitHub](./v2/architecture/07-webhooks-integrations.md) | Webhook pipeline, event normalization |
| [Notifications](./v2/architecture/08-notifications.md) | Email via SMTP, 9 event types |
| [Audit Trail](./v2/architecture/09-audit-trail.md) | Append-only events, decision traceability |
| [Data Model](./v2/architecture/10-data-model.md) | 17 tables, ERD, conventions |
| [API Design](./v2/architecture/11-api-design.md) | Routes, envelope, error codes |
| [Infrastructure](./v2/architecture/12-infrastructure.md) | Cloudflare Workers, deployment, failure modes |

### v2 Guides

| Document | Description |
|----------|-------------|
| [Developer Setup](./v2/setup.md) | Local environment setup |
| [Deployment](./v2/deployment.md) | Production deployment to Cloudflare |
| [Secrets](./v2/secrets.md) | Secret management conventions |
| [Contributing](./v2/contributing.md) | Code style, PR checklist, anti-patterns |

---

## Version History

| Version | Status | Description |
|---------|--------|-------------|
| v3 | **Planning** | 14 architecture docs (per-surface coverage), CLI, judging pipeline, admin + web docs |
| v2 | **Current** | Edge-native rewrite. Modular architecture docs, Cloudflare Workers + D1 + DO |
