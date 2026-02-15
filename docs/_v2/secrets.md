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
