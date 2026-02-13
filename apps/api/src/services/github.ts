import type { Env } from '../types/env.js';
import { SERVICE_TIMEOUT_MS } from '../lib/constants.js';

interface CommitStatusParams {
  repoFullName: string;
  sha: string;
  state: 'success' | 'failure' | 'pending' | 'error';
  description: string;
  context: string;
}

/**
 * Post a commit status to GitHub API.
 * Fail-open: never throws. Logs warning if GitHub is down.
 * Bounded: 10s timeout via AbortController.
 */
export async function postCommitStatus(env: Env, params: CommitStatusParams): Promise<void> {
  // Check if we have a token available
  if (!env.GITHUB_CLIENT_SECRET) {
    console.warn('postCommitStatus: GITHUB_CLIENT_SECRET not configured, skipping');
    return;
  }

  const url = `https://api.github.com/repos/${params.repoFullName}/statuses/${params.sha}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SERVICE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${env.GITHUB_CLIENT_SECRET}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'DevSage',
      },
      body: JSON.stringify({
        state: params.state,
        description: params.description,
        context: params.context,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(
        `postCommitStatus: GitHub API returned ${response.status} for ${params.repoFullName}/${params.sha}`,
      );
      return;
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`postCommitStatus: timeout posting to GitHub for ${params.repoFullName}/${params.sha}`);
    } else {
      console.warn(
        `postCommitStatus: failed to post commit status for ${params.repoFullName}/${params.sha}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
