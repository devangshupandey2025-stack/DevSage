# DevSage Documentation

## Current Version: v2 | Planning Version: v3

The v2 docs describe the current production system. The v3 docs are forward-looking planning docs that include all v2 content plus future architecture, features, and scaling plans.

---

## v3 — Future Planning Docs

| Document | Description | What v3 Adds |
|----------|-------------|--------------|
| [Architecture Overview](./v3/architecture/00-overview.md) | System topology, principles, domain map | v3 vision, 13 domains, roadmap, scale targets |
| [Authentication](./v3/architecture/01-authentication.md) | OAuth 2.0, JWT, cookie config | Passkeys, refresh tokens, MFA, GDPR |
| [Hackathon Lifecycle](./v3/architecture/02-hackathon-lifecycle.md) | 7-state machine, transitions, alarms | Templates, multi-track, custom phases |
| [Team Management](./v3/architecture/03-team-management.md) | Registration, invite codes, repo linking | Discovery, skill matching, team chat |
| [Submissions](./v3/architecture/04-submissions.md) | Tag-based capture, exactly-once locking | Multi-artifact, automated validation, diff viewer |
| [Judging](./v3/architecture/05-judging.md) | Rubric, scoring, leaderboard, AI reviews | Multi-round, blind mode, audience voting |
| [Roles & Permissions](./v3/architecture/06-roles-permissions.md) | 7-tier hierarchy, per-request resolution | Custom roles, org-level hierarchy, API keys |
| [Webhooks & Integrations](./v3/architecture/07-webhooks-integrations.md) | Webhook pipeline, event normalization | Multi-provider VCS, event bus, marketplace |
| [Notifications](./v3/architecture/08-notifications.md) | Email via SMTP, 9 event types | In-app, push, Slack/Discord, preferences |
| [Audit Trail](./v3/architecture/09-audit-trail.md) | Append-only events, decision traceability | REST API, hash chain, GDPR anonymization |
| [Data Model](./v3/architecture/10-data-model.md) | 17 tables, ERD, conventions | 28 tables, migration strategy, partitioning |
| [API Design](./v3/architecture/11-api-design.md) | Routes, envelope, error codes | v2 endpoints, SSE, rate limiting, SDK |
| [Infrastructure](./v3/architecture/12-infrastructure.md) | Cloudflare Workers, deployment, failure modes | Multi-region, CI/CD, monitoring, cost projections |
| [Frontend Architecture](./v3/architecture/13-frontend.md) | **NEW** — Full frontend architecture | Component tree, data flow, real-time, a11y, perf budget |

### v3 Guides

| Document | Description | What v3 Adds |
|----------|-------------|--------------|
| [Developer Setup](./v3/setup.md) | Local environment setup | Docker Compose, seed data, VS Code config |
| [Deployment](./v3/deployment.md) | Production deployment to Cloudflare | CI/CD pipeline, staging, preview deploys |
| [Secrets](./v3/secrets.md) | Secret management conventions | Rotation automation, new v3 secrets |
| [Contributing](./v3/contributing.md) | Code style, PR checklist, anti-patterns | ADRs, RFC process, perf budgets, a11y CI |

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
| v3 | **Planning** | Future architecture: real-time, analytics, multi-org, frontend doc, 28 tables, 13 domains |
| v2 | **Current** | Edge-native rewrite. Modular architecture docs, Cloudflare Workers + D1 + DO |
