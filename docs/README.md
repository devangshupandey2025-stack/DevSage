# DevSage Documentation

## Current Version: v2

All documentation lives under the versioned folder for the current release.

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

### Guides

| Document | Description |
|----------|-------------|
| [Developer Setup](./v2/setup.md) | Local environment setup |
| [Deployment](./v2/deployment.md) | Production deployment to Cloudflare |
| [Secrets](./v2/secrets.md) | Secret management conventions |
| [Contributing](./v2/contributing.md) | Code style, PR checklist, anti-patterns |

## Version History

| Version | Status | Description |
|---------|--------|-------------|
| v2 | **Current** | Edge-native rewrite. Modular architecture docs, Cloudflare Workers + D1 + DO |
