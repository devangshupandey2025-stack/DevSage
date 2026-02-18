# Webhooks API

Base path: `/webhooks`

Receives incoming webhooks from external services. Currently handles GitHub webhooks only.

---

## POST `/github`

Receive and process GitHub webhook events.

**Auth:** HMAC signature verification via `X-Hub-Signature-256` header (no user auth)

### Required Headers

| Header                 | Description                                         |
|------------------------|-----------------------------------------------------|
| `X-Hub-Signature-256`  | HMAC SHA-256 signature: `sha256=<hex_digest>`       |
| `X-GitHub-Event`       | GitHub event type (e.g., `push`, `create`, `delete`)|
| `X-GitHub-Delivery`    | Unique delivery UUID from GitHub                    |

### HMAC Verification

The signature is verified using a constant-time double-HMAC comparison to prevent timing attacks. Since Cloudflare Workers lack `timingSafeEqual`, both the expected and received signatures are HMACed with a random key, and the resulting digests are XOR-compared byte-by-byte.

The secret used is the `GITHUB_WEBHOOK_SECRET` environment binding.

### Supported Event Types

| GitHub Event               | Condition                    | Normalized Type               |
|----------------------------|------------------------------|-------------------------------|
| `push`                     | —                            | `github_push`                 |
| `create`                   | `ref_type === "tag"`         | `github_tag_created`          |
| `delete`                   | `ref_type === "tag"`         | `github_tag_deleted`          |
| `installation`             | —                            | `github_installation`         |
| `installation_repositories`| action `"added"`             | `github_installation_repos_added`   |
| `installation_repositories`| action `"removed"`           | `github_installation_repos_removed` |

Events not in this list (e.g., `pull_request`, `issues`, non-tag `create`) are acknowledged and ignored.

### Processing Pipeline

1. **Validate headers** — all three required headers must be present.
2. **Verify HMAC signature** — constant-time double-HMAC comparison.
3. **Normalize event** — `normalizeGitHubEvent()` parses the raw payload into a typed union.
4. **Enqueue** — if normalized, a `WebhookQueueMessage` is sent to the `WEBHOOK_QUEUE` binding for async processing.
5. **Record delivery** — non-blocking write to `webhook_deliveries` table (status: `queued` or `ignored`).

### Normalized Payload Shapes

#### Push Event

```json
{
  "ref": "refs/heads/main",
  "before": "abc1234...",
  "after": "def5678...",
  "forced": false,
  "pusher": { "login": "octocat", "email": "octocat@github.com" },
  "commits": [
    {
      "sha": "def5678...",
      "message": "feat: add dashboard",
      "author": { "username": "octocat", "email": "octocat@github.com" },
      "timestamp": "2026-02-15T10:30:00Z"
    }
  ],
  "repository": {
    "owner": "my-org",
    "name": "my-repo",
    "full_name": "my-org/my-repo"
  }
}
```

#### Tag Event (created/deleted)

```json
{
  "ref": "refs/tags/v1.0.0",
  "tag_name": "v1.0.0",
  "sha": "",
  "action": "created",
  "sender": { "login": "octocat" },
  "repository": {
    "owner": "my-org",
    "name": "my-repo",
    "full_name": "my-org/my-repo"
  }
}
```

> **Note:** The `sha` field is empty for tag create/delete events — the actual SHA is resolved downstream from the GitHub API.

#### Installation Event

```json
{
  "action": "created",
  "installation_id": 12345678,
  "sender": { "login": "octocat" },
  "repositories": [
    { "full_name": "my-org/my-repo", "name": "my-repo" }
  ]
}
```

#### Installation Repositories Event (added/removed)

```json
{
  "installation_id": 12345678,
  "sender": { "login": "octocat" },
  "repositories": [
    { "full_name": "my-org/new-repo", "name": "new-repo" }
  ]
}
```

### Queue Message Format

```json
{
  "type": "github_push",
  "payload": { "...normalized data..." },
  "received_at": "2026-02-15T10:30:00.000Z",
  "delivery_id": "d1a2b3c4-d5e6-7890-abcd-ef1234567890"
}
```

### Response — `200 OK` (queued)

```json
{
  "received": true,
  "action": "queued"
}
```

### Response — `200 OK` (ignored)

Returned when the event type is not handled (e.g., `pull_request`).

```json
{
  "received": true,
  "action": "ignored"
}
```

### Errors

| Status | Body                            | Cause                                        |
|--------|---------------------------------|----------------------------------------------|
| 400    | `{ "error": "Missing headers" }` | Missing `X-Hub-Signature-256`, `X-GitHub-Event`, or `X-GitHub-Delivery` |
| 401    | `{ "error": "Invalid signature" }` | HMAC verification failed                   |

> **Note:** Webhook error responses use raw `c.json()` rather than the standard `errorResponse()` envelope since the consumer is GitHub, not a frontend client.
