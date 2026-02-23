#!/usr/bin/env node

/**
 * DevSage Hackathon Site Generator CLI
 *
 * Clones SHIKDD-org/hackathon-template from GitHub, brands it with
 * organizer details, creates a new repo, and deploys to Cloudflare Workers.
 *
 * Usage:
 *   node scripts/generate-hackathon-site.js --config '<base64-encoded-json>'
 *   node scripts/generate-hackathon-site.js --interactive
 *   node scripts/generate-hackathon-site.js --generate-command
 *
 * Admin UI generates the --config command automatically.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// ── Constants ──────────────────────────────────────────────────────

const TEMPLATE_REPO = 'SHIKDD-org/hackathon-template';
const CF_ACCOUNT_ID = 'cf3386ad6d48a38a199781a39b2324ad';
const GITHUB_ORG = 'SHIKDD-org';
const API_ORIGIN = 'https://api.devsage.org';
const DOMAIN_SUFFIX = 'devsage.org';

// ── Helpers ────────────────────────────────────────────────────────

function log(step, msg) {
  console.log(`\n\x1b[36m[${'='.repeat(3)}] Step ${step}:\x1b[0m ${msg}`);
}

function success(msg) {
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}

function warn(msg) {
  console.warn(`  \x1b[33m⚠\x1b[0m ${msg}`);
}

function fail(msg) {
  console.error(`\n\x1b[31m[ERROR]\x1b[0m ${msg}`);
  process.exit(1);
}

function run(cmd, cwd, opts = {}) {
  if (!opts.silent) console.log(`  \x1b[90m> ${cmd}\x1b[0m`);
  return execSync(cmd, { cwd, stdio: opts.silent ? 'pipe' : 'inherit', encoding: 'utf8', timeout: opts.timeout || 120000 });
}

function runCapture(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8', timeout: 30000 }).trim();
  } catch { return null; }
}

// ── Config Parsing ─────────────────────────────────────────────────

function showHelp() {
  console.log(`
\x1b[1mDevSage Hackathon Site Generator (devsage-cli)\x1b[0m

\x1b[36mUsage:\x1b[0m
  devsage-cli deploy-hackathon --hackathon-slug <slug> [--workspace-slug <slug>] [--title <title>]
  devsage-cli deploy-hackathon --config '<base64-json>'
  devsage-cli --config '<base64-json>'
  devsage-cli --interactive
  devsage-cli --generate-command  (explains admin UI integration)

\x1b[36mSubcommands:\x1b[0m
  deploy-hackathon   Clone template, brand, push to GitHub, deploy to Cloudflare Workers

\x1b[36mConfig JSON fields:\x1b[0m
  slug              \x1b[33m(required)\x1b[0m  URL-safe hackathon slug (e.g., "code-sprint")
  title             \x1b[33m(required)\x1b[0m  Display title (e.g., "Code Sprint 2026")
  workspaceSlug     \x1b[90m(optional)\x1b[0m  Workspace slug → {slug}.{workspaceSlug}.devsage.org
  description       \x1b[90m(optional)\x1b[0m  Short description / tagline
  accentColor       \x1b[90m(optional)\x1b[0m  Hex accent color (default: "#2DD4BF")
  registrationStart \x1b[90m(optional)\x1b[0m  ISO date for registration open
  hackingStart      \x1b[90m(optional)\x1b[0m  ISO date for hacking start
  submissionDeadline\x1b[90m(optional)\x1b[0m  ISO date for submission deadline
  maxTeamSize       \x1b[90m(optional)\x1b[0m  Max members per team (default: 4)
  prizePool         \x1b[90m(optional)\x1b[0m  Prize pool text (default: "$10,000")
  rules             \x1b[90m(optional)\x1b[0m  Rules markdown text
  logoUrl           \x1b[90m(optional)\x1b[0m  URL to logo image
  bannerUrl         \x1b[90m(optional)\x1b[0m  URL to banner image

\x1b[36mExamples:\x1b[0m
  devsage-cli deploy-hackathon --hackathon-slug code-sprint --workspace-slug ieee-vit --title "Code Sprint 2026"
  echo '{"slug":"code-sprint","title":"Code Sprint 2026","workspaceSlug":"ieee-vit"}' | base64 | xargs -I{} devsage-cli --config {}

\x1b[36mWhat it does:\x1b[0m
  1. Clones ${TEMPLATE_REPO} from GitHub
  2. Applies text-based branding (title, colors, config, meta tags)
  3. Creates a new repo: ${GITHUB_ORG}/{slug}-site
  4. Builds and deploys to Cloudflare Workers
  5. Outputs the live URL and next steps
`);
  process.exit(0);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) showHelp();

  if (args.includes('--generate-command')) {
    console.log(`\n\x1b[1mAdmin UI Integration\x1b[0m\n`);
    console.log(`When marking a request as "building", the admin UI should:`);
    console.log(`1. Encode the request data as base64 JSON`);
    console.log(`2. Display a copyable CLI command\n`);
    console.log(`  \x1b[36mdevsage-cli deploy-hackathon --config "<BASE64>"\x1b[0m\n`);
    console.log(`The admin copies and runs it. That's it — site gets deployed.\n`);
    process.exit(0);
  }

  // Support `deploy-hackathon` subcommand (plan-compatible interface)
  if (args[0] === 'deploy-hackathon') {
    const slugIdx = args.indexOf('--hackathon-slug');
    const wsIdx = args.indexOf('--workspace-slug');
    const titleIdx = args.indexOf('--title');
    const configIdx = args.indexOf('--config');

    if (configIdx !== -1 && args[configIdx + 1]) {
      const raw = args[configIdx + 1];
      try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        return normalizeConfig(JSON.parse(decoded));
      } catch {
        fail('Invalid --config value. Must be base64-encoded JSON.');
      }
    }

    if (slugIdx === -1 || !args[slugIdx + 1]) {
      fail('deploy-hackathon requires --hackathon-slug <slug> (and optionally --workspace-slug <slug> --title <title>)');
    }

    const slug = args[slugIdx + 1];
    const workspaceSlug = wsIdx !== -1 ? args[wsIdx + 1] : null;
    const title = titleIdx !== -1 ? args[titleIdx + 1] : slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return normalizeConfig({ slug, title, workspaceSlug });
  }

  if (args.includes('--interactive')) {
    return null;
  }

  const configIdx = args.indexOf('--config');
  if (configIdx === -1 || !args[configIdx + 1]) {
    fail('Missing --config argument. Run with --help for usage, or use --interactive.');
  }

  const raw = args[configIdx + 1];
  let config;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    config = JSON.parse(decoded);
  } catch {
    fail('Invalid --config value. Must be base64-encoded JSON.');
  }

  return normalizeConfig(config);
}

function normalizeConfig(config) {
  if (!config.slug || typeof config.slug !== 'string') fail('Config must include "slug" (string).');
  if (!config.title || typeof config.title !== 'string') fail('Config must include "title" (string).');

  config.slug = config.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  return {
    slug: config.slug,
    title: config.title,
    workspaceSlug: config.workspaceSlug || null,
    description: config.description || `Welcome to ${config.title}`,
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

// ── Interactive Mode ───────────────────────────────────────────────

async function interactiveMode() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(`  ${q}: `, resolve));

  console.log('\n\x1b[1m🚀 DevSage Hackathon Site Generator — Interactive Mode\x1b[0m\n');

  const slug = (await ask('Hackathon slug (url-safe, e.g., "code-sprint")')).trim();
  const title = (await ask('Hackathon title (e.g., "Code Sprint 2026")')).trim();
  const workspaceSlug = (await ask('Workspace slug (leave empty for individual)')).trim() || null;
  const description = (await ask('Description (optional)')).trim() || null;
  const accentColor = (await ask('Accent color hex (default: #2DD4BF)')).trim() || '#2DD4BF';
  const maxTeamSize = parseInt((await ask('Max team size (default: 4)')).trim()) || 4;
  const prizePool = (await ask('Prize pool (default: "$10,000")')).trim() || '$10,000';

  rl.close();

  const config = normalizeConfig({ slug, title, workspaceSlug, description, accentColor, maxTeamSize, prizePool });

  // Print equivalent command for reuse
  const b64 = Buffer.from(JSON.stringify(config)).toString('base64');
  console.log(`\n  \x1b[90mReproducible command:\x1b[0m`);
  console.log(`  node scripts/generate-hackathon-site.js --config "${b64}"\n`);

  return config;
}

// ── Text-Based Branding ────────────────────────────────────────────

function applyBranding(workDir, config) {
  // 1. site.config.json
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
  fs.writeFileSync(path.join(workDir, 'site.config.json'), JSON.stringify(siteConfig, null, 2), 'utf8');
  success('site.config.json');

  // 2. index.html — title + meta + OG tags
  const indexPath = path.join(workDir, 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf8');
  indexHtml = indexHtml.replace(/<title>[^<]*<\/title>/, `<title>${config.title}</title>`);
  if (!indexHtml.includes('meta name="description"')) {
    indexHtml = indexHtml.replace('</head>', `    <meta name="description" content="${config.description}" />\n  </head>`);
  }
  if (!indexHtml.includes('og:title')) {
    const ogTags = [
      `    <meta property="og:title" content="${config.title}" />`,
      `    <meta property="og:description" content="${config.description}" />`,
      `    <meta property="og:type" content="website" />`,
      config.bannerUrl ? `    <meta property="og:image" content="${config.bannerUrl}" />` : '',
    ].filter(Boolean).join('\n');
    indexHtml = indexHtml.replace('</head>', `${ogTags}\n  </head>`);
  }
  fs.writeFileSync(indexPath, indexHtml, 'utf8');
  success('index.html (title + meta + OG)');

  // 3. Accent color replacement across all source files
  if (config.accentColor !== '#2DD4BF') {
    replaceInFilesRecursive(path.join(workDir, 'src'), /\.(tsx?|jsx?|css)$/, '#2DD4BF', config.accentColor);
    success(`Accent color → ${config.accentColor}`);
  }

  // 4. wrangler.jsonc
  const wranglerConfig = {
    $schema: 'node_modules/wrangler/config-schema.json',
    name: `hackathon-${config.slug}`,
    account_id: CF_ACCOUNT_ID,
    compatibility_date: '2025-12-01',
    assets: { directory: './dist', not_found_handling: 'single-page-application' },
  };
  fs.writeFileSync(path.join(workDir, 'wrangler.jsonc'), JSON.stringify(wranglerConfig, null, 2), 'utf8');
  success('wrangler.jsonc');

  // 5. .env.production
  const domain = config.workspaceSlug
    ? `${config.slug}.${config.workspaceSlug}.${DOMAIN_SUFFIX}`
    : `${config.slug}.hackathon.${DOMAIN_SUFFIX}`;
  fs.writeFileSync(
    path.join(workDir, '.env.production'),
    `VITE_API_ORIGIN=${config.apiOrigin}\nVITE_HACKATHON_SLUG=${config.slug}\nVITE_SITE_URL=https://${domain}\n`,
    'utf8'
  );
  success('.env.production');

  // 6. package.json name
  const pkgPath = path.join(workDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.name = `@devsage/hackathon-${config.slug}`;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
    success('package.json name');
  }

  // 7. README.md
  fs.writeFileSync(path.join(workDir, 'README.md'), `# ${config.title}\n\n${config.description || ''}\n\n**Live:** https://${domain}\n\n## Dev\n\n\`\`\`bash\npnpm install && pnpm dev\n\`\`\`\n\n---\nGenerated by [DevSage](https://devsage.org)\n`, 'utf8');
  success('README.md');
}

function replaceInFilesRecursive(dir, extRegex, search, replace) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    if (entry.isDirectory()) {
      replaceInFilesRecursive(fullPath, extRegex, search, replace);
    } else if (extRegex.test(entry.name)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const updated = content.replace(re, replace);
      if (updated !== content) fs.writeFileSync(fullPath, updated, 'utf8');
    }
  }
}

// ── API Seeding ────────────────────────────────────────────────────

function seedHackathonViaApi(config) {
  const body = JSON.stringify({
    slug: config.slug,
    title: config.title,
    description: config.description,
    max_team_size: config.maxTeamSize,
    starts_at: config.hackingStart,
  });

  try {
    const result = execSync(
      `curl -s -X POST "${config.apiOrigin}/api/v1/hackathons" -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\\''")}'`,
      { encoding: 'utf8', timeout: 15000 }
    );
    const parsed = JSON.parse(result);
    if (parsed.ok) success(`Hackathon seeded: ${parsed.data?.id || config.slug}`);
    else warn(`API: ${parsed.error?.message || 'may already exist'}`);
  } catch {
    warn('Could not seed via API (may already exist or API unreachable)');
  }
}

// ── Main Pipeline ──────────────────────────────────────────────────

async function main() {
  let config = parseArgs();
  if (!config) config = await interactiveMode();

  const repoName = `${config.slug}-site`;
  const workDir = path.resolve(process.cwd(), '..', config.slug);
  const domain = config.workspaceSlug
    ? `${config.slug}.${config.workspaceSlug}.${DOMAIN_SUFFIX}`
    : `${config.slug}.hackathon.${DOMAIN_SUFFIX}`;

  console.log('');
  console.log('\x1b[1m' + '='.repeat(60) + '\x1b[0m');
  console.log(`  \x1b[1m🚀 Hackathon Site Generator\x1b[0m`);
  console.log(`  Slug:      \x1b[36m${config.slug}\x1b[0m`);
  console.log(`  Title:     \x1b[36m${config.title}\x1b[0m`);
  console.log(`  Workspace: \x1b[36m${config.workspaceSlug || '(individual)'}\x1b[0m`);
  console.log(`  Accent:    \x1b[36m${config.accentColor}\x1b[0m`);
  console.log(`  Repo:      \x1b[36m${GITHUB_ORG}/${repoName}\x1b[0m`);
  console.log(`  Domain:    \x1b[36mhttps://${domain}\x1b[0m`);
  console.log('\x1b[1m' + '='.repeat(60) + '\x1b[0m');

  if (fs.existsSync(workDir)) fail(`Directory exists: ${workDir}\nRemove it or choose a different slug.`);

  // 1. Prerequisites
  log(1, 'Verifying prerequisites...');
  if (runCapture('gh auth status', '.') === null) fail('gh CLI not authenticated. Run "gh auth login".');
  success('gh CLI OK');

  // 2. Clone template from GitHub
  log(2, `Cloning ${TEMPLATE_REPO}...`);
  run(`gh repo clone ${TEMPLATE_REPO} "${workDir}" -- --depth=1`, '.', { timeout: 60000 });
  fs.rmSync(path.join(workDir, '.git'), { recursive: true, force: true });
  success('Template cloned');

  // 3. Brand
  log(3, 'Applying branding...');
  applyBranding(workDir, config);

  // 4. Install
  log(4, 'Installing dependencies...');
  run('pnpm install', workDir, { timeout: 120000 });

  // 5. Build
  log(5, 'Building...');
  run('pnpm build', workDir, { timeout: 120000 });

  // 6. Git + GitHub
  log(6, `Creating ${GITHUB_ORG}/${repoName}...`);
  run('git init', workDir);
  run('git add -A', workDir);
  run(`git commit -m "🚀 ${config.title}"`, workDir);
  try {
    run(`gh repo create ${GITHUB_ORG}/${repoName} --public --source=. --remote=origin --push`, workDir, { timeout: 60000 });
    success(`https://github.com/${GITHUB_ORG}/${repoName}`);
  } catch {
    warn('Repo may already exist, trying push...');
    try {
      run(`git remote add origin https://github.com/${GITHUB_ORG}/${repoName}.git`, workDir);
      run('git push -u origin main --force', workDir, { timeout: 60000 });
    } catch { warn('Push failed — deploy manually'); }
  }

  // 7. Deploy
  log(7, 'Deploying to Cloudflare...');
  try {
    run('npx wrangler deploy', workDir, { timeout: 120000 });
    success('Deployed');
  } catch {
    warn('Deploy failed. Run manually: cd ' + workDir + ' && npx wrangler deploy');
  }

  // 8. Seed API
  log(8, 'Seeding API...');
  seedHackathonViaApi(config);

  // Done
  console.log('\n\x1b[32m' + '='.repeat(60) + '\x1b[0m');
  console.log('  \x1b[32m\x1b[1m✅ DONE!\x1b[0m');
  console.log(`  GitHub:  https://github.com/${GITHUB_ORG}/${repoName}`);
  console.log(`  Workers: https://hackathon-${config.slug}.devsage-org.workers.dev`);
  console.log(`  Domain:  https://${domain}`);
  console.log('');
  console.log('  \x1b[33mNext:\x1b[0m Add custom domain in Cloudflare Dashboard');
  console.log(`  Workers > hackathon-${config.slug} > Domains > ${domain}`);
  console.log('\x1b[32m' + '='.repeat(60) + '\x1b[0m\n');
}

main().catch((err) => fail(err.message || String(err)));
