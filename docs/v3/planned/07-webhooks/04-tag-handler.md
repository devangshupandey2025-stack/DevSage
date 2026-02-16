# Tag Handler

> `apps/api/src/queue/tag-create-handler.ts` + `tag-delete-handler.ts` — Tag events trigger submission capture.

## Tag Created

See [05-submissions/01-tag-based-capture.md](../05-submissions/01-tag-based-capture.md) for the full pipeline. Summary:

```ts
async function handleTagCreated(event: TagCreatedEvent, env: Env) {
  // 1. Match repo → team
  // 2. Check tag matches pattern
  // 3. Lock in DO (accept-submission)
  // 4. Insert submission in D1
  // 5. Run validation
  // 6. Post commit status
  // 7. Notify team
}
```

This handler is the bridge between the webhook system and the submission system.

## Tag Deleted

```ts
async function handleTagDeleted(event: TagDeletedEvent, env: Env) {
  // 1. Match repo → team
  const teamRepo = await findTeamRepo(env.DB, event.repository.owner, event.repository.name);
  if (!teamRepo) return;

  // 2. Find submission by tag name
  const submission = await env.DB.prepare(`
    SELECT id, status FROM submissions
    WHERE team_id = ? AND tag_name = ?
  `).bind(teamRepo.team_id, event.tag.name).first();

  if (!submission) return;

  // 3. Mark submission as deleted (soft delete)
  await env.DB.prepare(`
    UPDATE submissions SET status = 'tag_deleted', updated_at = datetime('now')
    WHERE id = ?
  `).bind(submission.id).run();

  // 4. Audit
  await insertAuditEvent(env.DB, {
    hackathon_id: teamRepo.hackathon_id,
    actor_type: 'bot',
    event_type: 'submission.tag_deleted',
    entity_type: 'submission',
    entity_id: submission.id,
    metadata: { tag_name: event.tag.name },
  });

  // 5. Notify organizers
  await env.NOTIFICATION_QUEUE.send({
    type: 'submission.tag_deleted',
    hackathon_id: teamRepo.hackathon_id,
    team_id: teamRepo.team_id,
  });
}
```

## Queue Dispatch

Both handlers are called from the queue dispatcher:

```ts
// apps/api/src/queue/index.ts
async function processWebhookBatch(batch: MessageBatch<NormalizedEvent>, env: Env) {
  for (const message of batch.messages) {
    try {
      switch (message.body.type) {
        case 'push':
          await handlePush(message.body, env);
          break;
        case 'tag_created':
          await handleTagCreated(message.body, env);
          break;
        case 'tag_deleted':
          await handleTagDeleted(message.body, env);
          break;
        case 'installation':
          await handleInstallation(message.body, env);
          break;
      }
      message.ack();
    } catch (error) {
      console.error(`Webhook processing failed: ${error}`);
      message.retry();
    }
  }
}
```

## Implementation Notes

- Tag deletion doesn't remove the submission row — it soft-deletes (status = `tag_deleted`)
- If a deleted tag is re-created, the tag-create handler creates a new submission
- Queue retries: 3 attempts with exponential backoff
- After max retries: dead-letter logging to audit_events
