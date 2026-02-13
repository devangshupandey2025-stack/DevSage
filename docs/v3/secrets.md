# Secrets Safety

This repo is configured to reduce the chance of committing or pushing secrets.

## What is protected

- Git ignores common secret files: `.env*` (with an exception for `apps/web/.env.production`), `.dev.vars`, and Wrangler state (`.wrangler/`).
- A local Git hook scans staged files for likely secrets on commit.
- CI runs a secret scan on every PR and on pushes to `master`.

## Local workflow

- Install hooks (happens automatically after `pnpm install` via the root `prepare` script).
- Scan staged changes:

```bash
pnpm secrets:staged
```

- Scan the whole repo:

```bash
pnpm secrets:scan
```

## Where to put secrets

- API local dev secrets: `apps/api/.dev.vars` (gitignored)
- API production secrets: `apps/api/.env.production` (gitignored; pushed to Cloudflare via `pnpm deploy:api:secrets`)
- Web env vars: only `VITE_*` values (client-visible; do not put secrets in the web app)

## If you accidentally committed a secret

1. Rotate/revoke it immediately (assume it is compromised).
2. Remove it from the repo and force a new secret value in your secret store.
3. If it was pushed, also remove it from Git history (coordinate with maintainers; history rewrite affects everyone).

## v3 Secrets Management

v3 extends the existing secret safety practices with rotation automation, versioning, stricter environment isolation, and audit capabilities.

### Secret Rotation Automation

Long-lived secrets are a liability. v3 introduces scheduled rotation for critical secrets, starting with `JWT_SECRET`:

1. A new secret value is generated and uploaded to Cloudflare as the **next** version.
2. A grace period begins (default: 24 hours) during which both the current and next values are accepted for JWT verification.
3. After the grace period, the old value is removed and the next value becomes current.

Rotation is triggered manually via a CLI command or automatically on a configurable schedule:

```bash
# Rotate JWT_SECRET with a 24-hour grace period
pnpm --filter @devsage/api rotate-secret JWT_SECRET --grace 24h
```

### Secret Versioning

During a rotation window, multiple versions of a secret coexist. The API worker resolves secrets by version:

- `JWT_SECRET` -- the current active signing key.
- `JWT_SECRET_NEXT` -- the upcoming key (used for verification only during the grace period).
- `JWT_SECRET_PREV` -- the outgoing key (accepted for verification until the grace period ends).

This ensures that tokens signed with the old key remain valid during the transition, and no user sessions are interrupted.

### Vault Integration Consideration

For teams that need centralized secret management, v3 documents integration paths for two providers:

- **HashiCorp Vault** -- pull secrets at deploy time via the Vault CLI. Secrets are injected into Cloudflare via `wrangler secret put` as part of the CI/CD pipeline.
- **1Password Connect** -- use the 1Password CLI (`op`) to resolve secret references in `.env.production` templates before uploading to Cloudflare.

Neither integration is required. The default workflow (manual `wrangler secret put` or bulk upload) continues to work for smaller teams.

### Audit Trail for Secret Access

Every Worker invocation that reads a secret from the `env` object is logged with:

- The secret name accessed (never the value).
- The request ID and timestamp.
- The route handler that triggered the access.

Audit logs are written to a dedicated D1 table (`secret_access_log`) and retained for 90 days. This provides traceability for security reviews and incident response.

### Per-Environment Secret Isolation

v3 enforces strict isolation between environments:

| Environment | Secret source | Shared with other envs |
|-------------|---------------|------------------------|
| Local dev | `apps/api/.dev.vars` | Never |
| Staging | Cloudflare secrets (`--env staging`) | Never |
| Production | Cloudflare secrets (top-level) | Never |

Secrets are never copied between environments. Each environment has independently generated values. The `rotate-secret` command operates on a single environment at a time and requires an explicit `--env` flag for non-production targets.

### New Secrets for v3 Features

v3 introduces additional secrets for new platform capabilities:

| Secret | Purpose | Required |
|--------|---------|----------|
| `PUSH_VAPID_KEY` | VAPID key pair for Web Push notifications | Yes (if push enabled) |
| `ANALYTICS_API_KEY` | API key for the analytics provider | No (analytics is optional) |
| `SLACK_WEBHOOK_URL` | Incoming webhook URL for Slack deploy notifications | No |
| `DISCORD_WEBHOOK_URL` | Incoming webhook URL for Discord deploy notifications | No |

Optional secrets that are not set are silently skipped at runtime. The environment variable validation schema (see [setup.md](./setup.md)) marks these as optional with sensible defaults or disabled behavior.
