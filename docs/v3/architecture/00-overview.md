# 00 — System Overview

> DevSage is a GitHub-native hackathon management platform. Organizers configure hackathons declaratively. Participants connect GitHub repos. A GitHub App tracks commits, detects force pushes, captures tag-based submissions, and enforces deadlines — all without manual intervention.

**Related docs:** [Infrastructure](./12-infrastructure.md) | [Data Model](./10-data-model.md) | [API Design](./11-api-design.md) | [Frontend](./13-frontend.md)

---

## Architecture Principles

### Current (v2)

| ID | Principle | Implication |
|----|-----------|-------------|
| P1 | **Deterministic State Transitions** | All lifecycle mutations (phase transitions, submission acceptance, score finalization) go through Durable Objects — single-writer, no race conditions |
| P2 | **Bounded Execution** | Every Worker invocation completes within CPU/wall-clock limits. No unbounded loops or pagination without depth limits |
| P3 | **Idempotent Operations** | Webhook handlers and state mutations are keyed by delivery ID / commit SHA / tag name. Safe to retry |
| P4 | **Explicit Failure Modes** | Every external dependency has defined fail-open or fail-closed behavior. No silent failures |
| P5 | **Auditability** | Every state-changing operation produces an append-only audit event |
| P6 | **Graceful Degradation** | Non-critical features (AI summaries, email, activity feeds) degrade without blocking core submission/judging paths |
| P7 | **No External Compute** | Only Cloudflare first-party primitives + GitHub API + custom SMTP |

### New in v3

| ID | Principle | Implication |
|----|-----------|-------------|
| P8 | **Real-time First** | Every user-facing state change propagates to connected clients within 500ms via WebSocket/SSE through Durable Objects. Polling is a fallback, not the default |
| P9 | **Multi-tenant Isolation** | Organization-scoped resources with strict data boundaries. One org's hackathon data is never accessible to another org, enforced at the query layer |
| P10 | **Plugin Extensibility** | Core platform exposes an event bus and webhook system that external integrations consume without modifying platform code |
| P11 | **Offline Resilience** | Frontend caches critical data locally. Draft submissions, team notes, and form state survive network interruptions |

---

## High-Level Architecture (Current — v2)

```mermaid
graph TD
    subgraph Frontend
        WEB["devsage.org<br/>React SPA<br/>(Vite + Tailwind v4 + shadcn/ui)"]
    end

    WEB -->|"HTTPS REST<br/>/api/v1/*"| API

    subgraph CF["Cloudflare Workers"]
        API["API Worker<br/>(Hono)"]
        DO["HackathonStateMachine<br/>(Durable Object)"]
        Q_WH["WEBHOOK_QUEUE<br/>(github-webhooks)"]
        Q_NF["NOTIFICATION_QUEUE<br/>(devsage-notifications)"]
        CRON["Cron Trigger<br/>(hourly)"]
    end

    API -->|"stub.fetch()"| DO
    API -->|"enqueue"| Q_WH
    API -->|"enqueue"| Q_NF
    CRON -->|"check deadlines"| API

    subgraph Storage
        D1[("D1 / SQLite<br/>17 tables")]
        KV["KV<br/>OAuth state<br/>Session cache"]
    end

    API --> D1
    API --> KV
    DO --> D1

    subgraph External["External Services"]
        GH["GitHub API<br/>OAuth + Webhooks + Bot"]
        SMTP["Custom SMTP<br/>Transactional email"]
        AI["AI Provider<br/>Advisory reviews"]
    end

    Q_WH -->|"consume"| API
    Q_NF -->|"consume"| API
    API --> GH
    API --> SMTP
    API --> AI
```

---

## v3 Target Architecture

```mermaid
graph TD
    subgraph Frontend
        WEB["devsage.org<br/>React SPA<br/>(Vite + TanStack Query + Tailwind v4)"]
    end

    WEB -->|"HTTPS REST<br/>/api/v1/* + /api/v2/*"| API
    WEB <-->|"WebSocket<br/>/ws"| WSDO

    subgraph CF["Cloudflare Workers"]
        API["API Worker<br/>(Hono)"]
        DO["HackathonStateMachine<br/>(Durable Object)"]
        WSDO["RealtimeGateway<br/>(Durable Object — WebSocket)"]
        Q_WH["WEBHOOK_QUEUE<br/>(github-webhooks)"]
        Q_NF["NOTIFICATION_QUEUE<br/>(devsage-notifications)"]
        Q_DL["DELETION_QUEUE<br/>(account-deletions)"]
        CRON["Cron Trigger<br/>(hourly + daily)"]
        AE["Analytics Engine<br/>(metrics pipeline)"]
    end

    API -->|"stub.fetch()"| DO
    API -->|"stub.fetch()"| WSDO
    API -->|"enqueue"| Q_WH
    API -->|"enqueue"| Q_NF
    API -->|"enqueue"| Q_DL
    CRON -->|"check deadlines<br/>compute analytics"| API
    API -->|"writeDataPoint()"| AE

    subgraph Storage
        D1[("D1 / SQLite<br/>28 tables<br/>+ read replicas")]
        KV["KV<br/>OAuth state<br/>Rate limit counters<br/>Session cache"]
        R2["R2 Object Storage<br/>Logos, banners<br/>Submission artifacts<br/>Data exports"]
    end

    API --> D1
    API --> KV
    API --> R2
    DO --> D1
    WSDO -.->|"broadcast"| WEB

    subgraph External["External Services"]
        GH["GitHub API<br/>OAuth + Webhooks + Bot"]
        GL["GitLab API<br/>(v3)"]
        BB["Bitbucket API<br/>(v3)"]
        SMTP["Custom SMTP<br/>Transactional email"]
        AI["AI Provider<br/>Advisory reviews"]
        SLACK["Slack / Discord<br/>Notifications"]
        PUSH["Web Push API<br/>Browser notifications"]
    end

    Q_WH -->|"consume"| API
    Q_NF -->|"consume"| API
    Q_DL -->|"consume"| API
    API --> GH
    API --> GL
    API --> BB
    API --> SMTP
    API --> AI
    API --> SLACK
    API --> PUSH
```

### Key Differences from v2

| Component | v2 | v3 |
|-----------|----|----|
| Real-time | Polling only | WebSocket via `RealtimeGateway` Durable Object |
| VCS providers | GitHub only | GitHub + GitLab + Bitbucket |
| Notifications | Email only | Email + in-app + push + Slack/Discord |
| File storage | R2 for logos only | R2 for all artifacts (videos, decks, exports) |
| API versions | `/api/v1/` | `/api/v1/` (maintained) + `/api/v2/` (new endpoints) |
| Analytics | None | Analytics Engine + pre-computed snapshots |
| Data model | 17 tables | 28 tables |
| Account management | Login/logout only | Deletion, GDPR export, MFA, session management |
| Auth | Long-lived JWT | Short-lived access + rotating refresh tokens |
| Queues | 2 (webhooks, notifications) | 3 (+ account deletions) |
| Multi-org | Single-tenant | Organization-scoped multi-tenancy |

---

## Business Domains

### Current (v2) — 8 Domains

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#e8e8ff', 'primaryTextColor': '#1a1a2e', 'primaryBorderColor': '#6366f1', 'lineColor': '#6366f1', 'secondaryColor': '#f0fdf4', 'secondaryTextColor': '#1a1a2e', 'tertiaryColor': '#fef3c7', 'tertiaryTextColor': '#1a1a2e'}}}%%
mindmap
  root((DevSage))
    **Authentication**
      GitHub OAuth
      Google OAuth
      JWT Sessions
      Account Linking
    **Hackathon Lifecycle**
      7-State Machine
      Phase Transitions
      Deadline Enforcement
      Durable Objects
    **Team Management**
      Registration
      Invite Codes
      Repo Linking
      Member Roles
    **Submissions**
      Tag-Based Capture
      Exactly-Once Locking
      Version Tracking
      Late Detection
    **Judging**
      Judge Invitations
      Rubric Criteria
      Round-Robin Assignment
      Weighted Scoring
      Leaderboard
    **GitHub Integration**
      Webhook Pipeline
      Commit Tracking
      Force Push Detection
      Bot Status Posting
    **Notifications**
      Email via SMTP
      9 Event Types
      Deadline Reminders
      Recipient Resolution
    **Audit & Compliance**
      Append-Only Log
      4 Actor Types
      Decision Traceability
      AI Review Provenance
```

### v3 — 13 Domains (+5 New)

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#e8e8ff', 'primaryTextColor': '#1a1a2e', 'primaryBorderColor': '#6366f1', 'lineColor': '#6366f1', 'secondaryColor': '#f0fdf4', 'secondaryTextColor': '#1a1a2e', 'tertiaryColor': '#fef3c7', 'tertiaryTextColor': '#1a1a2e'}}}%%
mindmap
  root((DevSage v3))
    **Authentication** _enhanced_
      Passkeys / WebAuthn
      Refresh Token Rotation
      MFA via TOTP
      Session Management
      GDPR Compliance
    **Hackathon Lifecycle** _enhanced_
      Templates and Cloning
      Multi-Track Events
      Custom Phases
      Preview Mode
      Recurring Schedules
    **Team Management** _enhanced_
      Skill-Based Matching
      Team Discovery
      Team Chat via DO
      Cross-Event Profiles
    **Submissions** _enhanced_
      Multi-Artifact Upload
      Automated Validation
      Submission Preview
      Branch-Based Alternative
      Diff Viewer
    **Judging** _enhanced_
      Multi-Round Judging
      Blind Mode
      Audience Voting
      Judge Calibration
      Live Presentations
      Export and Certificates
    **Real-time** _NEW_
      WebSocket Gateway DO
      Live Activity Feeds
      Real-time Leaderboard
      Submission Notifications
      Presence Indicators
    **Analytics and Insights** _NEW_
      Analytics Engine Pipeline
      Organizer Dashboard
      Participation Metrics
      Commit Activity Graphs
      Export to CSV and PDF
    **Sponsor Portal** _NEW_
      Sponsor Profiles
      Prize Management
      Branding Integration
      Engagement Metrics
    **Mentorship** _NEW_
      Mentor Registration
      Team-Mentor Matching
      Office Hours Scheduling
      Feedback Tracking
    **Multi-Org Federation** _NEW_
      Organization Accounts
      Org-Level Roles
      Cross-Org Hackathons
      Shared Judge Pools
      Unified Analytics
    **VCS Integration** _enhanced_
      GitHub plus GitLab plus Bitbucket
      Event Bus Architecture
      Outbound Webhooks
      Integration Marketplace
    **Notifications** _enhanced_
      In-App plus Push plus Slack and Discord
      Notification Preferences
      Digest Batching
      Template Customization
    **Audit and Compliance** _enhanced_
      REST API for Queries
      Hash Chain Integrity
      GDPR Anonymization
      Retention Policies
      Real-time Audit Stream
```

---

## Request Lifecycle

```mermaid
sequenceDiagram
    participant B as Browser
    participant W as API Worker
    participant MW as Middleware
    participant R as Route Handler
    participant DB as D1 Database
    participant DO as Durable Object
    participant Q as Queue

    B->>W: HTTPS Request
    W->>MW: CORS → Error Handler
    MW->>MW: authMiddleware (JWT from cookie)
    MW->>MW: requireRole(minRole) → resolveRole()
    MW->>DB: Query organizer_roles / judges / team_members
    DB-->>MW: Role resolved
    MW->>R: Authorized request
    R->>DB: Read/Write data
    R->>DO: State mutations (if needed)
    R->>Q: Enqueue notifications (if needed)
    R-->>B: JSON Response { ok, data, meta }
```

### v3 Real-time Request Lifecycle

```mermaid
sequenceDiagram
    participant B as Browser
    participant WS as RealtimeGateway DO
    participant W as API Worker
    participant DB as D1 Database
    participant AE as Analytics Engine

    B->>WS: WebSocket connect (JWT in query param)
    WS->>WS: Verify JWT, register connection
    WS->>WS: Subscribe to hackathon channel

    Note over B,WS: Connection established

    par Mutation triggers broadcast
        W->>DB: INSERT submission
        W->>WS: broadcast("submission.received", payload)
        WS->>B: WebSocket message (JSON)
        W->>AE: writeDataPoint(submission_event)
    end

    par Client receives real-time update
        B->>B: TanStack Query invalidation
        B->>B: UI updates instantly
    end
```

---

## Monorepo Structure

### Current (v2)

```
DevSage/
├── apps/
│   ├── api/              # Cloudflare Worker — Hono API + DO + Queue + Cron
│   └── web/              # React SPA — Vite + React Router v7 + Tailwind v4
├── packages/
│   ├── config/           # Shared tsconfig (base, react, worker) + ESLint flat config
│   ├── db/               # Drizzle ORM schemas (17 tables) + D1 migrations
│   └── shared/           # Zod schemas, types, constants (only dep: zod)
└── docs/
    └── v2/
        ├── architecture/ # This documentation
        ├── setup.md
        ├── deployment.md
        ├── secrets.md
        └── contributing.md
```

### v3 — Planned Additions

```
DevSage/
├── apps/
│   ├── api/              # Cloudflare Worker — Hono API + DO + Queue + Cron
│   └── web/              # React SPA — Vite + React Router v7 + Tailwind v4
├── packages/
│   ├── config/           # Shared tsconfig (base, react, worker) + ESLint flat config
│   ├── db/               # Drizzle ORM schemas (28 tables) + D1 migrations
│   ├── shared/           # Zod schemas, types, constants (only dep: zod)
│   ├── ui/               # (NEW) Shared component library — extracted from apps/web
│   └── sdk/              # (NEW) @devsage/sdk — TypeScript API client, auto-generated from Zod
├── docs/
│   ├── v2/               # Frozen — previous version docs
│   ├── v3/               # Current planning docs
│   └── adr/              # (NEW) Architecture Decision Records
└── .github/
    └── workflows/        # (NEW) CI/CD: lint, test, deploy, secret scan, Lighthouse
```

### v3 Dependency Graph

```mermaid
graph LR
    API["apps/api"] --> SHARED["packages/shared"]
    API --> DB["packages/db"]
    API --> CONFIG["packages/config"]
    WEB["apps/web"] --> SHARED
    WEB --> UI["packages/ui (NEW)"]
    UI --> SHARED
    SDK["packages/sdk (NEW)"] --> SHARED
    DB --> CONFIG
```

---

## Scale Targets

### v2 (Current)

- 3 concurrent hackathons, ~500 total users, 2-5 member teams
- Infrastructure cost: $0/month on Workers Free plan at initial scale
- D1 storage: ~17 MB estimated (5 GB limit = effectively infinite)

### v3 (Target)

| Metric | v2 | v3 Target | Growth |
|--------|----|-----------|----- |
| Concurrent hackathons | 3 | 50+ | 17x |
| Total users | 500 | 10,000+ | 20x |
| Teams per hackathon | ~50 | 200+ | 4x |
| Submissions per hackathon | ~150 | 500+ | 3x |
| Concurrent WebSocket connections | 0 | 2,000 | -- |
| D1 storage | 17 MB | ~500 MB | 30x |
| D1 rows read/day | 200k | 2M | 10x |
| D1 rows written/day | 20k | 150k | 7.5x |

### Cost Projections

| Scale | Plan | Estimated Monthly Cost |
|-------|------|----------------------|
| 500 users, 3 hackathons | Workers Free | $0 |
| 2,000 users, 15 hackathons | Workers Paid | $5 |
| 5,000 users, 30 hackathons | Workers Paid | $10-15 |
| 10,000 users, 50+ hackathons | Workers Paid | $20-25 |
| 25,000 users, 100+ hackathons | Workers Paid + D1 scaling | $50-75 |

All costs are Cloudflare-only. External services (SMTP, AI provider) are billed separately.

---

## v3 Roadmap

### Phase 1 — Real-time and Auth Hardening (Q2 2026)

| Deliverable | Domain | Complexity |
|-------------|--------|------------|
| `RealtimeGateway` Durable Object | Real-time | High |
| WebSocket integration in frontend | Frontend / Real-time | Medium |
| Refresh token rotation | Authentication | Medium |
| Rate limiting on auth endpoints | Authentication | Low |
| TanStack Query migration | Frontend | Medium |
| In-app notification system | Notifications | Medium |
| Health check endpoint | Infrastructure | Low |

### Phase 2 — Multi-artifact and Advanced Judging (Q3 2026)

| Deliverable | Domain | Complexity |
|-------------|--------|------------|
| R2 file upload for submissions | Submissions | Medium |
| Submission preview rendering | Submissions | Medium |
| Multi-round judging | Judging | High |
| Blind judging mode | Judging | Low |
| Audience voting | Judging | Medium |
| Hackathon templates | Hackathon Lifecycle | Medium |
| Team discovery and matching | Team Management | High |
| OpenAPI spec generation | API Design | Medium |

### Phase 3 — Analytics and Integrations (Q4 2026)

| Deliverable | Domain | Complexity |
|-------------|--------|------------|
| Analytics Engine pipeline | Analytics | High |
| Organizer analytics dashboard | Analytics / Frontend | High |
| GitLab + Bitbucket support | VCS Integration | High |
| Outbound webhooks (Slack, Discord) | Webhooks | Medium |
| Event bus architecture | Webhooks | High |
| Push notifications (Web Push API) | Notifications | Medium |
| Notification preferences UI | Notifications / Frontend | Medium |
| TypeScript SDK (`@devsage/sdk`) | API Design | Medium |

### Phase 4 — Federation and Scale (Q1 2027)

| Deliverable | Domain | Complexity |
|-------------|--------|------------|
| Organization accounts | Multi-Org Federation | High |
| Org-level roles and permissions | Multi-Org / Roles | High |
| Sponsor portal | Sponsor Portal | High |
| Mentor matching system | Mentorship | Medium |
| Multi-track hackathons | Hackathon Lifecycle | Medium |
| Custom roles with granular permissions | Roles & Permissions | High |
| Account deletion / GDPR compliance | Authentication | High |
| Passkey / WebAuthn support | Authentication | High |
| Staging environment | Infrastructure | Medium |
| CI/CD automation | Infrastructure | Medium |

---

## Migration Path: v2 to v3

### Strategy: Additive, Non-Breaking

v3 is an evolution, not a rewrite. All changes are additive:

1. **Database**: New tables added via Drizzle migrations. No existing columns are removed or renamed. New columns on existing tables use defaults or are nullable.
2. **API**: New endpoints go under `/api/v2/`. All `/api/v1/` endpoints remain functional with no breaking changes. `/api/v1/` routes receive a `Sunset` header when a v2 replacement exists.
3. **Frontend**: New features are lazy-loaded. Existing pages are enhanced incrementally. TanStack Query replaces raw `apiRequest()` calls gradually, page by page.
4. **Durable Objects**: `RealtimeGateway` is a new DO class alongside the existing `HackathonStateMachine`. No changes to existing DO state.
5. **Queues**: New `DELETION_QUEUE` is added. Existing queues are unchanged.

### Migration Sequence

```mermaid
flowchart LR
    A["v2 Stable<br/>(current)"] --> B["v2.1<br/>Auth hardening<br/>+ refresh tokens"]
    B --> C["v2.2<br/>Real-time DO<br/>+ in-app notifications"]
    C --> D["v3.0-beta<br/>Multi-artifact<br/>+ analytics"]
    D --> E["v3.0<br/>Full release<br/>+ org federation"]

    style A fill:#10b981,color:#fff
    style B fill:#6366f1,color:#fff
    style C fill:#6366f1,color:#fff
    style D fill:#f59e0b,color:#fff
    style E fill:#7c3aed,color:#fff
```

---

## Document Index

### Architecture (v2 + v3)

| # | Document | Domain | v3 Changes |
|---|----------|--------|------------|
| [00](./00-overview.md) | System Overview | Architecture | v3 vision, roadmap, scale targets |
| [01](./01-authentication.md) | Authentication & Sessions | Identity | Passkeys, refresh tokens, MFA, GDPR |
| [02](./02-hackathon-lifecycle.md) | Hackathon Lifecycle | Core Logic | Templates, multi-track, custom phases |
| [03](./03-team-management.md) | Team Management | Participation | Discovery, matching, chat |
| [04](./04-submissions.md) | Submissions & Locking | Core Logic | Multi-artifact, automated validation |
| [05](./05-judging.md) | Judging & Scoring | Evaluation | Multi-round, blind mode, audience voting |
| [06](./06-roles-permissions.md) | Roles & Permissions | Access Control | Custom roles, org-level hierarchy |
| [07](./07-webhooks-integrations.md) | Webhooks & Integrations | Integration | Multi-provider VCS, event bus |
| [08](./08-notifications.md) | Notification System | Communication | In-app, push, Slack/Discord, preferences |
| [09](./09-audit-trail.md) | Audit Trail | Compliance | REST API, hash chain, GDPR |
| [10](./10-data-model.md) | Data Model & Schema | Storage | 28 tables, updated ERD, migration plan |
| [11](./11-api-design.md) | API Design & Conventions | Interface | v2 endpoints, SSE, rate limiting, SDK |
| [12](./12-infrastructure.md) | Infrastructure & Deployment | Operations | Multi-region, CI/CD, monitoring |
| [13](./13-frontend.md) | Frontend Architecture | Frontend | **NEW** — Full frontend architecture doc |

### Guides

| Document | v3 Changes |
|----------|------------|
| [Developer Setup](../setup.md) | Docker Compose, seed data, VS Code config |
| [Deployment](../deployment.md) | CI/CD pipeline, staging, preview deploys |
| [Secrets](../secrets.md) | Rotation automation, new v3 secrets |
| [Contributing](../contributing.md) | ADRs, RFC process, perf budgets, a11y CI |
