# DevSage Implementation Guide

Structured implementation plan derived from role-based product specs in `plan/role-*.md`.

## Directory Layout

```
guide/
  backend/
    00-overview.md              — Current state, architecture, debt summary
    01-security-hardening.md    — CRITICAL + HIGH security fixes
    02-performance.md           — Auth query batching, N+1, batch inserts
    03-service-layer.md         — Fat controller → service extraction
    04-github-integration.md    — Installation tokens, webhook pipeline
    05-judging-system.md        — Scoring windows, multi-round, guidelines
    06-notifications.md         — Preference enforcement, email templates, targeted announcements
    07-workspace-billing.md     — Owner limits, deletion, ownership transfer, Stripe billing
    08-remaining-gaps.md        — Registration, elimination, account deletion, analytics + migration 0004
  frontend/
    00-overview.md              — Current state across 7 apps
    01-web.md                   — Marketing site (static, no backend)
    02-platform.md              — Organizer dashboard features
    03-admin.md                 — Admin panel features
    04-judge.md                 — Judge portal features
    05-app.md                   — Participant portal (app.devsage.org)
    06-status.md                — Status page (status.devsage.org)
    07-shared-patterns.md       — Design system, API client, auth
    08-testing.md               — Frontend testing strategy
```

## App Topology

```
devsage.org            → apps/web/       — Marketing site (static, no auth, no API)
app.devsage.org        → apps/app/       — Participant portal (login, teams, submissions)
platform.devsage.org   → apps/platform/  — Organizer dashboard
shikdd.devsage.org     → apps/admin/     — Platform admin panel
judge.devsage.org      → apps/judge/     — Judge scoring portal
status.devsage.org     → apps/status/    — Service status page (self-contained: backend + frontend)
api.devsage.org        → apps/api/       — Cloudflare Worker API
```

## Priority Order

### Phase 1 — Security & Stability
1. `backend/01-security-hardening.md` — Block deploys until CRITICAL fixes resolved
2. `backend/02-performance.md` — Auth middleware 6 queries → 1 batched round-trip

### Phase 2 — Core Feature Completion
3. `backend/04-github-integration.md` — Unblocks submission pipeline (includes SEC-001)
4. `backend/05-judging-system.md` — Scoring windows, multi-round, conflicts
5. `backend/06-notifications.md` — Judging depends on this (promoted from Phase 3)
6. `backend/08-remaining-gaps.md` (CRITICAL only) — Registration endpoint (CG-06), elimination (CG-07), forced password reset (CG-01)
7. `frontend/05-app.md` — Participant portal (new app, core user flow)
8. `frontend/02-platform.md` — Organizer dashboard gaps
9. `frontend/04-judge.md` — Judge portal gaps

### Phase 3 — Architecture & Polish
10. `backend/03-service-layer.md` — Fat controller → service extraction
11. `backend/07-workspace-billing.md` — Workspace deletion, ownership transfer (billing deferred to Phase 4)
12. `frontend/08-testing.md` — Zero tests across all apps
13. `frontend/06-status.md` — Status page

### Phase 4 — New Features & Billing
14. `backend/07-workspace-billing.md` (billing only) — Stripe integration
15. `backend/08-remaining-gaps.md` (MEDIUM + LOW) — Analytics, data export, custom domains, seeding
16. `frontend/01-web.md` — Marketing site enhancements
17. `frontend/03-admin.md` — Admin panel features

## Cross-References

| Role Doc | Backend Files | Frontend Files |
|----------|--------------|----------------|
| `role-judge.md` | `01-security` (CG-01), `05-judging-system.md`, `06-notifications.md` | `04-judge.md` |
| `role-event-lead.md` | `04-github-integration.md`, `05-judging-system.md`, `06-notifications.md`, `08-remaining-gaps.md` (CG-07) | `02-platform.md` |
| `role-participant.md` | `04-github-integration.md`, `08-remaining-gaps.md` (CG-06) | `05-app.md` |
| `role-workspace-managers.md` | `07-workspace-billing.md`, `08-remaining-gaps.md` (CG-02) | `02-platform.md`, `03-admin.md` |
| `role-devsage-team.md` | `01-security-hardening.md`, `08-remaining-gaps.md` (CG-03, CG-04) | `03-admin.md`, `06-status.md` |

## Migration 0004

All schema changes are collected in `backend/08-remaining-gaps.md` § "Migration 0004 Summary". Individual plan files reference specific columns but 08 has the consolidated SQL.
