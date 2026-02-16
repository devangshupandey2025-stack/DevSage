# Event Normalization

> `apps/api/src/lib/webhook-normalize.ts` — Parse GitHub webhook payloads into typed union.

## Function

```ts
function normalizeGitHubEvent(
  eventType: string,
  payload: unknown,
  deliveryId: string
): NormalizedEvent | null {
  switch (eventType) {
    case 'push':
      return normalizePush(payload, deliveryId);
    case 'create':
      if (payload.ref_type === 'tag') return normalizeTagCreated(payload, deliveryId);
      return null;
    case 'delete':
      if (payload.ref_type === 'tag') return normalizeTagDeleted(payload, deliveryId);
      return null;
    case 'installation':
      return normalizeInstallation(payload, deliveryId);
    default:
      return null; // ignored event type
  }
}
```

## Normalized Types

```ts
type NormalizedEvent =
  | PushEvent
  | TagCreatedEvent
  | TagDeletedEvent
  | InstallationEvent;

interface PushEvent {
  type: 'push';
  delivery_id: string;
  installation_id: number;
  repository: { owner: string; name: string; full_name: string };
  ref: string;            // e.g., 'refs/heads/main'
  before: string;         // SHA before push
  after: string;          // SHA after push
  commits: Array<{
    sha: string;
    message: string;
    author: { name: string; email: string; username: string };
    timestamp: string;
    added: string[];
    modified: string[];
    removed: string[];
  }>;
  forced: boolean;        // force push detection
  sender: { login: string; id: number };
  timestamp: string;
}

interface TagCreatedEvent {
  type: 'tag_created';
  delivery_id: string;
  installation_id: number;
  repository: { owner: string; name: string; full_name: string };
  tag: { name: string; sha: string };
  sender: { login: string; id: number };
  timestamp: string;
}

interface TagDeletedEvent {
  type: 'tag_deleted';
  delivery_id: string;
  installation_id: number;
  repository: { owner: string; name: string; full_name: string };
  tag: { name: string };
  sender: { login: string; id: number };
  timestamp: string;
}

interface InstallationEvent {
  type: 'installation';
  delivery_id: string;
  action: 'created' | 'deleted';
  installation_id: number;
  repositories: Array<{ full_name: string; name: string }>;
  sender: { login: string; id: number };
  timestamp: string;
}
```

## Force Push Detection

Detected from the `push` event payload:

```ts
function normalizePush(payload: any, deliveryId: string): PushEvent {
  return {
    type: 'push',
    // ...
    forced: payload.forced === true,
    // ...
  };
}
```

If `forced === true`, the push handler records a `force_push_events` entry and notifies organizers.

## Implementation Notes

- Only 4 event types are processed; everything else returns `null` and is ignored
- The `installation_id` is critical — it's used to match webhooks to team repos
- `delivery_id` comes from the `X-GitHub-Delivery` header — used for idempotency
- Tag SHA: for `create` events, the SHA is in `payload.ref` or requires an API call to resolve
- All timestamps normalized to ISO-8601 UTC
