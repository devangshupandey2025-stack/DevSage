import type { Env } from '../types/env.js';
import { SERVICE_TIMEOUT_MS } from '../lib/constants.js';

interface CommitStatusParams {
  repoFullName: string;
  sha: string;
  state: 'success' | 'failure' | 'pending' | 'error';
  description: string;
  context: string;
}

interface InstallationTokenResult {
  token: string;
  expiresAt: string;
}

// secretlint-disable
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
    .replace(/-----END RSA PRIVATE KEY-----/, '')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  // secretlint-enable
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function createAppJWT(appId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iat: now - 60, exp: now + 600, iss: appId };

  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const keyData = pemToArrayBuffer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${signingInput}.${sigB64}`;
}

async function getInstallationToken(
  env: Env,
  installationId: string,
): Promise<InstallationTokenResult | null> {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    console.warn('getInstallationToken: GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY not configured');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SERVICE_TIMEOUT_MS);

  try {
    const jwt = await createAppJWT(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);

    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'DevSage',
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      console.warn(`getInstallationToken: GitHub returned ${response.status} for installation ${installationId}`);
      return null;
    }

    const data = (await response.json()) as { token: string; expires_at: string };
    return { token: data.token, expiresAt: data.expires_at };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`getInstallationToken: timeout for installation ${installationId}`);
    } else {
      console.warn(`getInstallationToken: failed for installation ${installationId}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function postCommitStatus(env: Env, params: CommitStatusParams & { installationId?: string }): Promise<void> {
  let authToken: string | null = null;

  if (params.installationId) {
    const result = await getInstallationToken(env, params.installationId);
    if (result) authToken = result.token;
  }

  if (!authToken && env.GITHUB_CLIENT_SECRET) {
    authToken = env.GITHUB_CLIENT_SECRET;
  }

  if (!authToken) {
    console.warn('postCommitStatus: no GitHub auth available, skipping');
    return;
  }

  const url = `https://api.github.com/repos/${params.repoFullName}/statuses/${params.sha}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SERVICE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `token ${authToken}`,
        Accept: 'application/vnd.github.v3+json',
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

export { getInstallationToken, createAppJWT };
