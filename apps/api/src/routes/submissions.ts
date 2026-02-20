import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { hackathonContext } from '../middleware/hackathon.js';
import { authMiddleware } from '../middleware/auth.js';
import { insertAuditEvent } from '../lib/audit.js';

const submissions = new Hono<AppEnv>();
submissions.use('/*', hackathonContext);

// Get current user's GitHub repos (public repos via GitHub API)
submissions.get('/github/repos', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const username = user.github_username;

  if (!username) {
    return errorResponse(c, 400, 'NO_GITHUB', 'No GitHub username linked to your account');
  }

  try {
    const ghRes = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated&type=owner`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'DevSage-Bot',
      },
    });

    if (!ghRes.ok) {
      return errorResponse(c, 502, 'GITHUB_ERROR', 'Failed to fetch repos from GitHub');
    }

    const repos = await ghRes.json() as Array<{
      id: number; name: string; full_name: string; html_url: string;
      description: string | null; language: string | null; private: boolean;
      updated_at: string; stargazers_count: number; default_branch: string;
    }>;

    const mapped = repos.map(r => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      url: r.html_url,
      description: r.description,
      language: r.language,
      private: r.private,
      updated_at: r.updated_at,
      stars: r.stargazers_count,
      default_branch: r.default_branch,
    }));

    return successResponse(c, { github_username: username, repos: mapped });
  } catch {
    return errorResponse(c, 502, 'GITHUB_ERROR', 'Failed to connect to GitHub');
  }
});

// ─── Bot: Analyze a GitHub repo ─────────────────────────────
submissions.post('/github/analyze', authMiddleware, async (c) => {
  const { owner, repo } = await c.req.json<{ owner: string; repo: string }>();
  if (!owner || !repo) return errorResponse(c, 400, 'VALIDATION', 'owner and repo are required');

  const ghHeaders = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'DevSage-Bot',
    ...(c.env.GITHUB_CLIENT_SECRET ? { 'Authorization': `token ${c.env.GITHUB_CLIENT_SECRET}` } : {}),
  };

  try {
    // 1. Repo info
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders });
    if (!repoRes.ok) return errorResponse(c, 404, 'REPO_NOT_FOUND', 'Repository not found on GitHub');
    const repoData = await repoRes.json() as { default_branch: string; language: string | null; stargazers_count: number; description: string | null; fork: boolean; forks_count: number; open_issues_count: number; created_at: string; updated_at: string };

    // 2. Repo tree
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`, { headers: ghHeaders });
    let files: string[] = [];
    if (treeRes.ok) {
      const treeData = await treeRes.json() as { tree: { path: string; type: string }[] };
      const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', '.idea', '.next', 'vendor', 'target'];
      files = treeData.tree
        .filter(f => f.type === 'blob' && !ignoreDirs.some(d => f.path.includes(d)))
        .map(f => f.path);
    }

    // 3. Project type detection
    let projectType = 'Unknown';
    if (files.includes('package.json')) projectType = 'Node.js';
    else if (files.includes('requirements.txt') || files.includes('setup.py') || files.includes('pyproject.toml')) projectType = 'Python';
    else if (files.includes('pom.xml') || files.includes('build.gradle')) projectType = 'Java';
    else if (files.includes('CMakeLists.txt') || files.includes('Makefile')) projectType = 'C/C++';
    else if (files.includes('go.mod')) projectType = 'Go';
    else if (files.includes('Cargo.toml')) projectType = 'Rust';

    // 4. Extension stats
    const extStats: Record<string, number> = {};
    files.forEach(f => {
      const ext = f.split('.').pop() || '';
      extStats[ext] = (extStats[ext] || 0) + 1;
    });
    const topExtensions = Object.entries(extStats).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // 5. Entry files
    const entryFiles = files.filter(f => f.match(/(index|main|app|server)\.(js|ts|py|java|go|rs)$/));

    // 6. Detect key files
    const hasDockerfile = files.some(f => f.toLowerCase().includes('dockerfile'));
    const hasCI = files.some(f => f.includes('.github/workflows') || f.includes('.gitlab-ci') || f.includes('Jenkinsfile'));
    const hasTests = files.some(f => f.includes('test') || f.includes('spec') || f.includes('__tests__'));
    const envFiles = files.filter(f => f.includes('.env'));
    const readmeExists = files.some(f => f.toLowerCase() === 'readme.md');

    // 7. Try to read package.json / requirements.txt for dependencies
    let dependencies: string[] = [];
    let frameworks: string[] = [];
    if (files.includes('package.json')) {
      try {
        const pkgRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, { headers: ghHeaders });
        if (pkgRes.ok) {
          const pkgFile = await pkgRes.json() as { content: string };
          const pkgContent = JSON.parse(atob(pkgFile.content));
          dependencies = Object.keys(pkgContent.dependencies || {}).slice(0, 25);
          if (dependencies.includes('react')) frameworks.push('React');
          if (dependencies.includes('vue')) frameworks.push('Vue');
          if (dependencies.includes('next')) frameworks.push('Next.js');
          if (dependencies.includes('express')) frameworks.push('Express');
          if (dependencies.includes('hono')) frameworks.push('Hono');
          if (dependencies.includes('fastify')) frameworks.push('Fastify');
          if (dependencies.includes('mongoose') || dependencies.includes('mongodb')) frameworks.push('MongoDB');
          if (dependencies.includes('prisma') || dependencies.includes('@prisma/client')) frameworks.push('Prisma');
          if (dependencies.includes('tailwindcss')) frameworks.push('Tailwind CSS');
          if (dependencies.includes('drizzle-orm')) frameworks.push('Drizzle');
          if (dependencies.includes('socket.io')) frameworks.push('Socket.io');
          if (dependencies.includes('svelte') || dependencies.includes('@sveltejs/kit')) frameworks.push('Svelte');
        }
      } catch { /* skip */ }
    }
    if (files.includes('requirements.txt')) {
      try {
        const reqRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/requirements.txt`, { headers: ghHeaders });
        if (reqRes.ok) {
          const reqFile = await reqRes.json() as { content: string };
          const reqContent = atob(reqFile.content);
          dependencies = reqContent.split('\n').filter(Boolean).slice(0, 25);
          if (dependencies.some(d => d.includes('fastapi'))) frameworks.push('FastAPI');
          if (dependencies.some(d => d.includes('django'))) frameworks.push('Django');
          if (dependencies.some(d => d.includes('flask'))) frameworks.push('Flask');
          if (dependencies.some(d => d.includes('pytorch') || d.includes('torch'))) frameworks.push('PyTorch');
          if (dependencies.some(d => d.includes('tensorflow'))) frameworks.push('TensorFlow');
        }
      } catch { /* skip */ }
    }

    return successResponse(c, {
      repository: repo,
      owner,
      description: repoData.description,
      primary_language: repoData.language,
      project_type: projectType,
      detected_frameworks: frameworks,
      total_files: files.length,
      entry_files: entryFiles.slice(0, 10),
      top_extensions: topExtensions,
      dependencies: dependencies,
      environment_files: envFiles,
      has_dockerfile: hasDockerfile,
      has_ci: hasCI,
      has_tests: hasTests,
      has_readme: readmeExists,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      open_issues: repoData.open_issues_count,
      created_at: repoData.created_at,
      updated_at: repoData.updated_at,
    });
  } catch {
    return errorResponse(c, 502, 'ANALYZE_FAILED', 'Failed to analyze repository');
  }
});

// ─── Bot: Gemini AI review ──────────────────────────────────
submissions.post('/github/ai-review', authMiddleware, async (c) => {
  const geminiKey = c.env.GEMINI_API_KEY;
  if (!geminiKey) return errorResponse(c, 503, 'AI_UNAVAILABLE', 'AI review is not configured yet');

  const { analysis } = await c.req.json<{ analysis: Record<string, unknown> }>();
  if (!analysis) return errorResponse(c, 400, 'VALIDATION', 'analysis payload is required');

  const prompt = `You are DevSage Bot, an AI code reviewer for hackathon projects. Analyze this GitHub repository and provide a concise, helpful review.

Repository: ${analysis.owner}/${analysis.repository}
Project Type: ${analysis.project_type}
Primary Language: ${analysis.primary_language || 'Unknown'}
Detected Frameworks: ${(analysis.detected_frameworks as string[])?.join(', ') || 'None'}
Total Files: ${analysis.total_files}
Dependencies: ${(analysis.dependencies as string[])?.slice(0, 15).join(', ') || 'None'}
Has Tests: ${analysis.has_tests ? 'Yes' : 'No'}
Has CI/CD: ${analysis.has_ci ? 'Yes' : 'No'}
Has Dockerfile: ${analysis.has_dockerfile ? 'Yes' : 'No'}
Has README: ${analysis.has_readme ? 'Yes' : 'No'}
Entry Files: ${(analysis.entry_files as string[])?.join(', ') || 'None'}
Stars: ${analysis.stars}, Forks: ${analysis.forks}

Provide your response in this JSON format:
{
  "summary": "2-3 sentence summary of the project",
  "score": <number 1-100>,
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["improvement1", "improvement2", "improvement3"],
  "tech_stack_assessment": "1-2 sentence assessment of the tech stack choices",
  "hackathon_readiness": "1-2 sentence assessment of how ready this is for a hackathon submission"
}

Only respond with the JSON, no markdown formatting.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!geminiRes.ok) {
      return errorResponse(c, 502, 'AI_ERROR', 'Gemini API returned an error');
    }

    const geminiData = await geminiRes.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Try to parse as JSON
    let review: Record<string, unknown>;
    try {
      review = JSON.parse(rawText);
    } catch {
      // If not valid JSON, wrap it
      review = { summary: rawText, score: 0, strengths: [], improvements: [], tech_stack_assessment: '', hackathon_readiness: '' };
    }

    return successResponse(c, { review });
  } catch {
    return errorResponse(c, 502, 'AI_ERROR', 'Failed to connect to Gemini AI');
  }
});

// List submissions for hackathon
submissions.get('/', async (c) => {
  const hackathon = c.get('hackathon')!;
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');
  const teamId = c.req.query('team_id');
  const roundId = c.req.query('round_id');
  const currentOnly = c.req.query('current_only') !== 'false';

  let query = 'SELECT s.*, t.name as team_name FROM submissions s LEFT JOIN teams t ON s.team_id = t.id WHERE s.hackathon_id = ?';
  let countQuery = 'SELECT COUNT(*) as total FROM submissions WHERE hackathon_id = ?';
  const params: unknown[] = [hackathon.id];

  if (currentOnly) {
    query += ' AND s.is_final = 1';
    countQuery += ' AND is_final = 1';
  }

  if (teamId) {
    query += ' AND s.team_id = ?';
    countQuery += ' AND team_id = ?';
    params.push(teamId);
  }

  if (roundId) {
    query += ' AND s.round_id = ?';
    countQuery += ' AND round_id = ?';
    params.push(roundId);
  }

  query += ' ORDER BY s.submitted_at DESC LIMIT ? OFFSET ?';

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(query).bind(...params, limit, offset).all(),
    c.env.DB.prepare(countQuery).bind(...params).first<{ total: number }>(),
  ]);

  return paginatedResponse(c, rows.results || [], count?.total ?? 0, limit, offset);
});

// AI Score leaderboard (MUST be before /:submissionId to avoid route conflict)
submissions.get('/ai-leaderboard', async (c) => {
  const hackathon = c.get('hackathon')!;
  const rows = await c.env.DB.prepare(
    `SELECT s.id, s.team_id, s.title, s.repo_url, s.ai_score, s.submitted_at,
            t.name as team_name
     FROM submissions s
     LEFT JOIN teams t ON s.team_id = t.id
     WHERE s.hackathon_id = ? AND s.is_final = 1 AND s.ai_score IS NOT NULL
     ORDER BY s.ai_score DESC`
  ).bind(hackathon.id).all();

  const entries = (rows.results || []).map((row, idx) => ({
    rank: idx + 1,
    team_id: row.team_id,
    team_name: row.team_name,
    title: row.title,
    repo_url: row.repo_url,
    ai_score: row.ai_score,
    submitted_at: row.submitted_at,
  }));

  return successResponse(c, entries);
});

// Get team's current submission (MUST be before /:submissionId)
submissions.get('/team/:teamId/current', async (c) => {
  const hackathon = c.get('hackathon')!;
  const teamId = c.req.param('teamId');

  const submission = await c.env.DB.prepare(
    'SELECT * FROM submissions WHERE hackathon_id = ? AND team_id = ? AND is_final = 1 ORDER BY submitted_at DESC LIMIT 1'
  ).bind(hackathon.id, teamId).first();

  if (!submission) return errorResponse(c, 404, 'NOT_FOUND', 'No submission found');
  return successResponse(c, submission);
});

// Get specific submission (with parsed analysis & review)
submissions.get('/:submissionId', async (c) => {
  const hackathon = c.get('hackathon')!;
  const submissionId = c.req.param('submissionId');

  const submission = await c.env.DB.prepare(
    `SELECT s.*, t.name as team_name
     FROM submissions s
     LEFT JOIN teams t ON s.team_id = t.id
     WHERE s.id = ? AND s.hackathon_id = ?`
  ).bind(submissionId, hackathon.id).first();

  if (!submission) return errorResponse(c, 404, 'NOT_FOUND', 'Submission not found');

  // Parse JSON fields for the response
  const result: Record<string, unknown> = { ...submission };
  try { if (submission.analysis_json) result.analysis = JSON.parse(submission.analysis_json as string); } catch { /* skip */ }
  try { if (submission.ai_review_json) result.ai_review = JSON.parse(submission.ai_review_json as string); } catch { /* skip */ }

  return successResponse(c, result);
});

// Create or update a submission (authenticated team member)
submissions.post('/', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;

  // Find user's team
  const membership = await c.env.DB.prepare(`
    SELECT t.id as team_id, tm.role
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    WHERE t.hackathon_id = ? AND tm.user_id = ?
  `).bind(hackathon.id, user.id).first<{ team_id: string; role: string }>();

  if (!membership) {
    return errorResponse(c, 403, 'NOT_ON_TEAM', 'You must be on a team to submit');
  }

  const body = await c.req.json<{
    title: string;
    description: string;
    repo_url: string;
    demo_url?: string;
    video_url?: string;
    round_id?: string;
    analysis_json?: string;
    ai_review_json?: string;
    ai_score?: number;
  }>();

  if (!body.title || !body.repo_url) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Title and repo URL are required');
  }

  // Check if there are any initialized rounds — if so, a round_id is required
  // and submissions are only allowed against initialized rounds
  const initializedRounds = await c.env.DB.prepare(
    'SELECT id FROM hackathon_rounds WHERE hackathon_id = ? AND is_initialized = 1'
  ).bind(hackathon.id).all();

  let targetRoundId: string | null = null;

  if (initializedRounds.results && initializedRounds.results.length > 0) {
    // Rounds exist and at least one is initialized — submission must target an initialized round
    if (!body.round_id) {
      // Default to the first initialized round
      targetRoundId = initializedRounds.results[0].id as string;
    } else {
      // Verify the specified round is initialized
      const round = await c.env.DB.prepare(
        'SELECT id, is_initialized FROM hackathon_rounds WHERE id = ? AND hackathon_id = ?'
      ).bind(body.round_id, hackathon.id).first<{ id: string; is_initialized: number }>();

      if (!round) {
        return errorResponse(c, 404, 'ROUND_NOT_FOUND', 'Round not found');
      }
      if (!round.is_initialized) {
        return errorResponse(c, 403, 'ROUND_NOT_INITIALIZED', 'This round has not been initialized yet. Submissions are not open.');
      }
      targetRoundId = body.round_id;
    }
  }

  // Mark any existing final submissions as non-final
  await c.env.DB.prepare(
    'UPDATE submissions SET is_final = 0 WHERE hackathon_id = ? AND team_id = ? AND is_final = 1'
  ).bind(hackathon.id, membership.team_id).run();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Extract owner/repo from repo_url for repo_full_name
  let repoFullName = '';
  try {
    const urlPath = new URL(body.repo_url).pathname.replace(/^\//, '').replace(/\.git$/, '');
    repoFullName = urlPath; // e.g. "Kevin272-dot/The-Vortex-app"
  } catch { repoFullName = body.repo_url; }

  await c.env.DB.prepare(
    `INSERT INTO submissions (id, hackathon_id, team_id, round_id, tag_name, commit_sha, provider, repo_full_name, status, received_at, submitted_at, is_final, title, description, repo_url, demo_url, video_url, slide_url, analysis_json, ai_review_json, ai_score)
     VALUES (?, ?, ?, ?, ?, ?, 'github', ?, 'received', ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, hackathon.id, membership.team_id, targetRoundId || 'none',
    body.title, // tag_name — reuse title
    'manual',   // commit_sha — placeholder for manual submissions
    repoFullName,
    now, // received_at
    now, // submitted_at
    body.title, body.description || '',
    body.repo_url, body.demo_url || '', body.video_url || '', body.slide_url || '',
    body.analysis_json || null,
    body.ai_review_json || null,
    body.ai_score ?? null
  ).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      action: 'submission.created',
      entity_type: 'submission',
      entity_id: id,
      details: { title: body.title },
    })
  );

  const created = await c.env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first();
  return successResponse(c, created, { status: 201 });
});

export default submissions;
