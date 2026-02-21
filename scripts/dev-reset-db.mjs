#!/usr/bin/env node
// Resets local D1 database and applies all migrations + seed data.
// Used automatically by `pnpm dev` in the API package.
// Cross-platform (no bash required).

import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(__dirname, "..", "apps", "api");
const d1State = resolve(
  apiDir,
  ".wrangler",
  "state",
  "v3",
  "d1",
  "miniflare-D1DatabaseObject"
);

console.log("Clearing local D1 database...");
rmSync(d1State, { recursive: true, force: true });

console.log("Applying all migrations + seed...");
execSync("npx wrangler d1 migrations apply devsage-db --local", {
  cwd: apiDir,
  stdio: "inherit",
  input: "y\n",
});

console.log("Local DB ready with seed accounts");
console.log("");
console.log("Test accounts (password = {prefix}shikdd):");
console.log("  srijan.guchhait@gmail.com  (super_admin)");
console.log("  admin@devsage.org          (platform_admin)");
console.log("  organizer@devsage.org      (organizer)");
console.log("  coorganizer@devsage.org    (co_organizer)");
console.log("  judge@devsage.org          (judge)");
console.log("  lead@devsage.org           (team_lead)");
console.log("  participant@devsage.org    (participant)");
