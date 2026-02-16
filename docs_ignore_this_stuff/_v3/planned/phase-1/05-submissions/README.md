# 05 — Submissions

> Tag-based submission capture from GitHub repos with exactly-once locking via Durable Objects.

## How Submissions Work

```
Participant pushes git tag (e.g., submission-v1)
  → GitHub sends tag webhook to /webhooks/github
  → Worker verifies HMAC, enqueues to WEBHOOK_QUEUE
  → tag-create-handler processes:
    1. Match tag to team's repo
    2. Validate tag pattern
    3. Lock submission in DO (exactly-once)
    4. Create submission row in D1
    5. Run validation pipeline
    6. Post commit status on GitHub
    7. Notify team
```

Participants stay in their git workflow — no web form for code submission.

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Tag pattern** | Configurable (default: `submission-v*`), matched via glob |
| **Exactly-once** | DO locks submission by `{teamId}:{tagName}` key |
| **Rounds** | Submissions scoped to rounds (if configured) |
| **Validation** | Automated checks: README exists, demo URL in README, repo accessible |
| **Supplementary** | Non-code uploads (pitch decks, screenshots) via R2 — Phase 2 |

## Files in This Section

| File | What to Build |
|------|---------------|
| [01-tag-based-capture.md](./01-tag-based-capture.md) | Tag pattern matching, webhook→submission pipeline |
| [02-submission-locking.md](./02-submission-locking.md) | DO-based exactly-once locking |
| [03-rounds-system.md](./03-rounds-system.md) | Round-scoped submissions |
| [04-validation-pipeline.md](./04-validation-pipeline.md) | Automated submission checks |
| [05-deadline-enforcement.md](./05-deadline-enforcement.md) | Deadline rules, late handling |
| [06-supplementary-uploads.md](./06-supplementary-uploads.md) | R2 file uploads (Phase 2) |
| [07-submission-queries.md](./07-submission-queries.md) | List/get/diff endpoints |

## Dependencies

- `apps/api/src/routes/submissions.ts`
- `apps/api/src/queue/tag-create-handler.ts`
- `apps/api/src/lib/submission-tag.ts`
- `apps/api/src/durable-objects/hackathon-state-machine.ts` (accept-submission)
- `packages/db/src/schema/submissions.ts`
- `packages/db/src/schema/commit-log.ts`
