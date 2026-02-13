/**
 * Hackathon Site Generator CLI
 *
 * Usage:
 *   pnpm generate:site --config '<base64-encoded-json>'
 *
 * The config JSON must include at minimum: slug, title
 * All other fields have sensible defaults.
 *
 * Prerequisites:
 *   - gh CLI authenticated (for GitHub repo creation)
 *   - wrangler authenticated (for Cloudflare deployment)
 *   - pnpm available
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates', 'hackathon-site');
const CF_ACCOUNT_ID = 'cf3386ad6d48a38a199781a39b2324ad';
const GITHUB_ORG = 'SHIKDD-org';
const API_ORIGIN = 'https://api.devsage.org';

function log(step, msg) {
  console.log(`\n[${'='.repeat(3)}] Step ${step}: ${msg}`);
}

function fail(msg) {
  console.error(`\n[ERROR] ${msg}`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const configIdx = args.indexOf('--config');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Hackathon Site Generator

Usage:
  pnpm generate:site --config '<base64-encoded-json>'

Config JSON fields:
  slug              (required) Hackathon slug (e.g., "hack001")
  title             (required) Hackathon title
  description       (optional) Description text
  accentColor       (optional) Hex color, default "#2DD4BF"
  registrationStart (optional) ISO date string
  hackingStart      (optional) ISO date string
  submissionDeadline(optional) ISO date string
  maxTeamSize       (optional) Number, default 4
  prizePool         (optional) String, default "$10,000"
  logoUrl           (optional) URL to logo image
  bannerUrl         (optional) URL to banner image
  rules             (optional) Rules text

Example:
  pnpm generate:site --config "$(echo '{"slug":"hack001","title":"Hack 001"}' | base64)"
`);
    process.exit(0);
  }

  if (configIdx === -1 || !args[configIdx + 1]) {
    fail('Missing --config argument. Run with --help for usage.');
  }

  const raw = args[configIdx + 1];
  let config;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    config = JSON.parse(decoded);
  } catch {
    fail('Invalid --config value. Must be base64-encoded JSON.');
  }

  if (!config.slug || typeof config.slug !== 'string') {
    fail('Config must include "slug" (string).');
  }
  if (!config.title || typeof config.title !== 'string') {
    fail('Config must include "title" (string).');
  }

  // Apply defaults
  return {
    slug: config.slug,
    title: config.title,
    description: config.description || '',
    accentColor: config.accentColor || '#2DD4BF',
    registrationStart: config.registrationStart || new Date().toISOString(),
    hackingStart: config.hackingStart || new Date().toISOString(),
    submissionDeadline: config.submissionDeadline || new Date().toISOString(),
    maxTeamSize: config.maxTeamSize || 4,
    prizePool: config.prizePool || '$10,000',
    apiOrigin: config.apiOrigin || API_ORIGIN,
    logoUrl: config.logoUrl || null,
    bannerUrl: config.bannerUrl || null,
    rules: config.rules || null,
  };
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.wrangler') {
      continue; // Skip build artifacts
    }
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function run(cmd, cwd) {
  console.log(`  > ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function main() {
  const config = parseArgs();
  const repoName = `${config.slug}-site`;
  const workDir = path.join(os.tmpdir(), `hackathon-site-${config.slug}-${Date.now()}`);

  console.log('');
  console.log('='.repeat(60));
  console.log(`  Hackathon Site Generator`);
  console.log(`  Slug:  ${config.slug}`);
  console.log(`  Title: ${config.title}`);
  console.log(`  Repo:  ${GITHUB_ORG}/${repoName}`);
  console.log('='.repeat(60));

  // Step 1: Verify prerequisites
  log(1, 'Verifying prerequisites...');
  try {
    execSync('gh auth status', { stdio: 'pipe' });
    console.log('  gh CLI: authenticated');
  } catch {
    fail('gh CLI not authenticated. Run "gh auth login" first.');
  }
  try {
    execSync('wrangler whoami', { stdio: 'pipe' });
    console.log('  wrangler: authenticated');
  } catch {
    fail('wrangler not authenticated. Run "wrangler login" first.');
  }

  // Step 2: Copy template
  log(2, `Copying template to ${workDir}...`);
  if (!fs.existsSync(TEMPLATE_DIR)) {
    fail(`Template directory not found: ${TEMPLATE_DIR}`);
  }
  copyDirSync(TEMPLATE_DIR, workDir);
  console.log('  Template copied.');

  // Step 3: Write site.config.json
  log(3, 'Writing site.config.json...');
  const siteConfig = {
    slug: config.slug,
    title: config.title,
    description: config.description,
    accentColor: config.accentColor,
    registrationStart: config.registrationStart,
    hackingStart: config.hackingStart,
    submissionDeadline: config.submissionDeadline,
    maxTeamSize: config.maxTeamSize,
    prizePool: config.prizePool,
    apiOrigin: config.apiOrigin,
    logoUrl: config.logoUrl,
    bannerUrl: config.bannerUrl,
    rules: config.rules,
  };
  fs.writeFileSync(
    path.join(workDir, 'site.config.json'),
    JSON.stringify(siteConfig, null, 2),
    'utf8'
  );
  console.log('  site.config.json written.');

  // Step 4: Write wrangler.jsonc
  log(4, 'Writing wrangler.jsonc...');
  const wranglerConfig = {
    $schema: 'node_modules/wrangler/config-schema.json',
    name: `hackathon-${config.slug}`,
    account_id: CF_ACCOUNT_ID,
    compatibility_date: '2025-12-01',
    assets: {
      directory: './dist',
      not_found_handling: 'single-page-application',
    },
  };
  fs.writeFileSync(
    path.join(workDir, 'wrangler.jsonc'),
    JSON.stringify(wranglerConfig, null, 2),
    'utf8'
  );
  console.log('  wrangler.jsonc written.');

  // Step 5: Write .env.production
  log(5, 'Writing .env.production...');
  fs.writeFileSync(
    path.join(workDir, '.env.production'),
    `VITE_API_ORIGIN=${config.apiOrigin}\n`,
    'utf8'
  );
  console.log('  .env.production written.');

  // Step 6: Update index.html title
  log(6, 'Updating index.html title...');
  const indexPath = path.join(workDir, 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf8');
  indexHtml = indexHtml.replace('<title>Hackathon</title>', `<title>${config.title}</title>`);
  fs.writeFileSync(indexPath, indexHtml, 'utf8');
  console.log(`  Title set to "${config.title}".`);

  // Step 7: Install dependencies
  log(7, 'Installing dependencies (pnpm install)...');
  run('pnpm install', workDir);

  // Step 8: Build
  log(8, 'Building site (pnpm build)...');
  run('pnpm build', workDir);

  // Step 9: Initialize git and create GitHub repo
  log(9, `Creating GitHub repo ${GITHUB_ORG}/${repoName}...`);
  run('git init', workDir);
  run('git add -A', workDir);
  run(`git commit -m "Initial hackathon site for ${config.title}"`, workDir);
  run(
    `gh repo create ${GITHUB_ORG}/${repoName} --public --source=. --remote=origin --push`,
    workDir
  );
  console.log(`  Repo created: https://github.com/${GITHUB_ORG}/${repoName}`);

  // Step 10: Deploy to Cloudflare Workers
  log(10, 'Deploying to Cloudflare Workers...');
  run('npx wrangler deploy', workDir);

  // Done!
  console.log('');
  console.log('='.repeat(60));
  console.log('  DONE!');
  console.log(`  GitHub:     https://github.com/${GITHUB_ORG}/${repoName}`);
  console.log(`  Deployed:   https://hackathon-${config.slug}.devsage.workers.dev`);
  console.log(`  Work dir:   ${workDir}`);
  console.log('='.repeat(60));
  console.log('');
}

main();
