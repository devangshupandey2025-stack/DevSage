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
    case 'installation_repositories': {
      // Fired when repos are added/removed from an existing installation
      const p = payload as any;
      return {
        type: p.action === 'added' ? 'installation_repos_added' : 'installation_repos_removed',
        action: p.action, // 'added' | 'removed'
        installation_id: p.installation.id,
        repositories: (p.action === 'added' ? p.repositories_added : p.repositories_removed)
          ?.map((r: any) => ({ id: r.id, full_name: r.full_name, private: r.private })),
        sender: p.sender,
        timestamp: new Date().toISOString(),
      };
    }
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
  | InstallationEvent
  | InstallationReposEvent;

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
  tag: {
    name: string;
    sha?: string; // Not available in `create` event — resolved via GitHub API in tag-create handler
  };
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
  action: 'created' | 'deleted' | 'suspend' | 'unsuspend';
  installation_id: number;
  repositories?: Array<{ id: number; full_name: string; private: boolean }>;
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

- Only 5 event types are processed; everything else returns `null` and is ignored
- The `installation_id` is critical — it's used to match webhooks to team repos
- `delivery_id` comes from the `X-GitHub-Delivery` header — used for idempotency
- Tag SHA: for `create` events, `payload.ref` contains the tag name (not a SHA). The SHA must be resolved via GitHub API: `GET /repos/{owner}/{repo}/git/ref/tags/{name}` — resolved lazily in the tag-create handler using the installation token
- All timestamps normalized to ISO-8601 UTC
