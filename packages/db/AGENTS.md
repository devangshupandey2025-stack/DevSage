# packages/db — Drizzle ORM + D1

Drizzle SQLite schema for Cloudflare D1. 35 tables, barrel export, typed client factory.

## STRUCTURE

```
src/
├── index.ts              # Barrel: re-exports schema + client
├── client.ts             # createDb(d1) → typed DrizzleD1Database<typeof schema>
└── schema/
    ├── index.ts           # Re-exports all 35 tables (explicit .js extensions)
    │
    │  # Core
    ├── users.ts           # users (UUID PK, email UNIQUE, github_id, google_id)
    ├── refresh-tokens.ts  # refresh_tokens (family-based rotation, 30-day expiry)
    ├── platform-admins.ts # platform_admins (user FK, shikdd admin access)
    ├── deletion-requests.ts # deletion_requests (GDPR account deletion)
    │
    │  # Workspaces
    ├── workspaces.ts      # workspaces (slug UNIQUE, type: club/individual)
    ├── workspace-members.ts # workspace_members (workspace+user, role: owner/admin/member)
    ├── workspace-invites.ts # workspace_invites (email-based, status)
    │
    │  # Hackathons
    ├── hackathons.ts      # hackathons (slug UNIQUE, 5-state status, workspace FK)
    ├── organizer-roles.ts # organizer_roles (hackathon+user, role: organizer/co_organizer)
    ├── hackathon-tracks.ts # hackathon_tracks (hackathon FK, name, description)
    ├── hackathon-rounds.ts # hackathon_rounds (hackathon FK, round ordering)
    ├── custom-phases.ts   # custom_phases (hackathon FK, custom lifecycle phases)
    ├── hackathon-templates.ts # hackathon_templates (reusable hackathon configs)
    ├── hackathon-sponsors.ts # hackathon_sponsors (tier: platinum/gold/silver/bronze)
    ├── hackathon-notification-config.ts # per-hackathon notification settings
    │
    │  # Teams
    ├── teams.ts           # teams (invite_code UNIQUE, hackathon FK)
    ├── team-members.ts    # team_members (team+user, role: team_lead/team_member)
    ├── team-invites.ts    # team_invites (team FK, status)
    ├── team-repos.ts      # team_repos (team FK, repo_full_name)
    ├── team-messages.ts   # team_messages (team FK, message content)
    │
    │  # Submissions
    ├── submissions.ts     # submissions (hackathon+team+round, tag_name, is_final)
    ├── commit-log.ts      # commit_log (submission FK, SHA, author, timestamp)
    ├── force-push-events.ts # force_push_events (submission FK, before/after SHA)
    │
    │  # Judging
    ├── judges.ts          # judges (hackathon+user UNIQUE, invite_status)
    ├── judge-assignments.ts # judge_assignments (judge+submission, status)
    ├── judge-tracks.ts    # judge_tracks (judge FK, track assignments)
    ├── rubric-criteria.ts # rubric_criteria (hackathon FK, name, weight, max_score, sort_order)
    ├── scores.ts          # scores (assignment+criterion UNIQUE, score, comment)
    ├── round-results.ts   # round_results (round FK, aggregated results)
    │
    │  # Webhooks & Notifications
    ├── webhook-deliveries.ts # webhook_deliveries (delivery_id UNIQUE, status, payload)
    ├── pending-installations.ts # pending_installations (GitHub App install tracking)
    ├── in-app-notifications.ts # in_app_notifications (user FK, type, read status)
    ├── notification-deliveries.ts # notification_deliveries (channel, status)
    ├── notification-idempotency.ts # notification_idempotency (dedup key UNIQUE)
    │
    │  # Audit
    └── audit-events.ts    # audit_events (hackathon FK, actor_type, action, entity, details JSON)
drizzle.config.ts          # dialect: sqlite, driver: d1-http, schema: ./dist/schema/*.js
migrations/                # Generated SQL migrations (wrangler.jsonc points here)
```

## CONVENTIONS

- **All timestamps**: TEXT columns, UTC ISO-8601 strings (`new Date().toISOString()`)
- **All IDs**: TEXT columns, `crypto.randomUUID()` at insert time
- **Column naming**: snake_case in SQL (`created_at`), camelCase in Drizzle schema references
- **Migrations**: `drizzle-kit generate` from `packages/db/`. Wrangler picks up from `../../packages/db/migrations`
- **Client**: `createDb(c.env.DB)` in API routes. Returns typed `DrizzleD1Database<typeof schema>`
- **Adding a table**: Create file in `schema/`, re-export from `schema/index.ts` with `.js` extension, run `drizzle-kit generate`
- **Barrel exports**: Explicit `.js` extensions required (ESM strict)

## ANTI-PATTERNS

- Using Prisma (incompatible with D1/Workers)
- Forgetting to re-export new tables from `schema/index.ts`
- Running `drizzle-kit generate` from wrong directory (must be `packages/db/`)
- Accessing D1 directly instead of through Drizzle client
- Omitting `.js` extension in barrel re-exports
