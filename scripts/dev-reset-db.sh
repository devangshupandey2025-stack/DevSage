#!/usr/bin/env bash
# Resets local D1 database and applies all migrations + seed data.
# Used automatically by `pnpm dev` in the API package.
set -euo pipefail

API_DIR="$(cd "$(dirname "$0")/../apps/api" && pwd)"
D1_STATE="$API_DIR/.wrangler/state/v3/d1/miniflare-D1DatabaseObject"

echo "🗑️  Clearing local D1 database..."
rm -rf "$D1_STATE"

echo "🔄  Applying all migrations + seed..."
cd "$API_DIR"
echo "y" | npx wrangler d1 migrations apply devsage-db --local

echo "✅  Local DB ready with seed accounts"
echo ""
echo "Test accounts (password = {prefix}shikdd):"
echo "  srijan.guchhait@gmail.com  (super_admin)"
echo "  admin@devsage.org          (platform_admin)"
echo "  organizer@devsage.org      (organizer)"
echo "  coorganizer@devsage.org    (co_organizer)"
echo "  judge@devsage.org          (judge)"
echo "  lead@devsage.org           (team_lead)"
echo "  participant@devsage.org    (participant)"
