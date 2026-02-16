# Infrastructure

> Cloudflare Workers topology, bindings, and runtime architecture.

## Architecture

Single Worker (`@devsage/api`) handles all API traffic, queue consumption, and cron triggers. No separate Workers for different concerns — the same Worker is both producer and consumer for queues.

## Bindings Summary

| Type | Binding Name | Resource | Purpose |
|------|-------------|----------|---------|
| D1 | `DB` | `devsage-db` | Primary SQLite database |
| KV | `KV` | `devsage-kv` | Rate limits, OAuth state, ephemeral data |
| DO | `HACKATHON_SM` | `HackathonStateMachine` | Per-hackathon state coordination |
| Queue (producer) | `WEBHOOK_QUEUE` | `github-webhooks` | Enqueue inbound GitHub events |
| Queue (producer) | `NOTIFICATION_QUEUE` | `devsage-notifications` | Enqueue notification tasks |
| Queue (consumer) | — | Both queues | Same Worker consumes via `queue()` handler |
| Cron | — | `0 * * * *` | Hourly deadline checks |
| R2 | `UPLOADS` | `devsage-uploads` | File uploads (Phase 2) |

## Files

| File | Description |
|------|-------------|
| [01-cloudflare-bindings.md](01-cloudflare-bindings.md) | D1, KV, DO, Queue, R2 binding config |
| [02-queue-system.md](02-queue-system.md) | Queue architecture, retry, batch processing |
| [03-cron-triggers.md](03-cron-triggers.md) | Scheduled handlers, deadline checks |
| [04-environments.md](04-environments.md) | Dev/staging/prod config |
| [05-cost-model.md](05-cost-model.md) | Resource limits, pricing estimates |
