# 07 — Webhooks

> GitHub App webhook pipeline: synchronous ingestion, queue-based processing, event normalization.

## Architecture

```
GitHub → POST /webhooks/github
  → HMAC-SHA256 verify (< 5ms)
  → Normalize event
  → Enqueue to WEBHOOK_QUEUE
  → Return 200 immediately

WEBHOOK_QUEUE consumer:
  → Route by event type
  → push → push-handler (commit logging)
  → tag_created → tag-create-handler (submission capture)
  → tag_deleted → tag-delete-handler (cleanup)
  → installation → installation-handler (bot activation)
```

## Key Principle

**Synchronous path is fast and minimal.** All processing happens asynchronously via the queue. GitHub expects a response within 10 seconds — our target is < 50ms.

## Files in This Section

| File | What to Build |
|------|---------------|
| [01-ingest-pipeline.md](./01-ingest-pipeline.md) | POST /webhooks/github, HMAC verify, enqueue |
| [02-event-normalization.md](./02-event-normalization.md) | normalizeGitHubEvent() typed union |
| [03-push-handler.md](./03-push-handler.md) | Commit logging, activity tracking |
| [04-tag-handler.md](./04-tag-handler.md) | Tag→submission pipeline |
| [05-installation-handler.md](./05-installation-handler.md) | App install/uninstall |
| [06-commit-status.md](./06-commit-status.md) | Posting check statuses to GitHub |

## Dependencies

- `apps/api/src/routes/webhooks.ts`
- `apps/api/src/queue/index.ts` — queue dispatcher
- `apps/api/src/queue/push-handler.ts`
- `apps/api/src/queue/tag-create-handler.ts`
- `apps/api/src/queue/tag-delete-handler.ts`
- `apps/api/src/queue/installation-handler.ts`
- `apps/api/src/lib/webhook-normalize.ts`
- `packages/db/src/schema/webhook-deliveries.ts`
- **WEBHOOK_QUEUE** binding (queue: `github-webhooks`, batch: 10, retries: 3)
