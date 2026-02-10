export type OAuthProvider = 'google' | 'github';

interface OAuthStateRecord {
  provider: OAuthProvider;
  redirectUri: string;
  createdAt: string;
}

interface GoogleTokenResponse {
  access_token: string;
}

interface GoogleUserResponse {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface GitHubTokenResponse {
  access_token: string;
}

interface GitHubUserResponse {
  id: number;
  email: string | null;
  name: string | null;
  login: string;
  avatar_url: string | null;
}

interface GitHubEmailResponse {
  email: string;
  verified: boolean;
  primary: boolean;
}

export interface GitHubOAuthProfile {
  githubId: number;
  githubUsername: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface GoogleOAuthProfile {
  googleId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

const OAUTH_STATE_PREFIX = 'oauth:state:';
const OAUTH_STATE_TTL_SECONDS = 600;

export function generateOAuthState(): string {
  return crypto.randomUUID();
}

export async function storeOAuthState(kv: KVNamespace, state: string, value: OAuthStateRecord): Promise<void> {
  await kv.put(`${OAUTH_STATE_PREFIX}${state}`, JSON.stringify(value), {
    expirationTtl: OAUTH_STATE_TTL_SECONDS,
  });
}

export async function consumeOAuthState(kv: KVNamespace, state: string): Promise<OAuthStateRecord | null> {
  const key = `${OAUTH_STATE_PREFIX}${state}`;
  const rawValue = await kv.get(key);
  if (!rawValue) {
    return null;
  }

  await kv.delete(key);

  try {
    const parsed = JSON.parse(rawValue) as OAuthStateRecord;
    if (!parsed.provider || !parsed.redirectUri || !parsed.createdAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildGoogleAuthorizationUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  return url.toString();
}

export function buildGitHubAuthorizationUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'read:user user:email');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeGoogleCodeForToken(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<string> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error('Google token exchange failed');
  }

  const token = (await response.json()) as GoogleTokenResponse;
  if (!token.access_token) {
    throw new Error('Google token missing access token');
  }

  return token.access_token;
}

export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleOAuthProfile> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Google user info fetch failed');
  }

  const user = (await response.json()) as GoogleUserResponse;
  if (!user.id || !user.email) {
    throw new Error('Google user profile incomplete');
  }

  return {
    googleId: user.id,
    email: user.email,
    displayName: user.name ?? user.email,
    avatarUrl: user.picture ?? null,
  };
}

export async function exchangeGitHubCodeForToken(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<string> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
  });

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'devsage-api',
    },
    body,
  });

  if (!response.ok) {
    throw new Error('GitHub token exchange failed');
  }

  const token = (await response.json()) as GitHubTokenResponse;
  if (!token.access_token) {
    throw new Error('GitHub token missing access token');
  }

  return token.access_token;
}

export async function fetchGitHubUserProfile(accessToken: string): Promise<GitHubOAuthProfile> {
  const baseHeaders = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'devsage-api',
  };

  const userResponse = await fetch('https://api.github.com/user', {
    headers: baseHeaders,
  });
  if (!userResponse.ok) {
    throw new Error('GitHub user fetch failed');
  }

  const user = (await userResponse.json()) as GitHubUserResponse;

  const emailResponse = await fetch('https://api.github.com/user/emails', {
    headers: baseHeaders,
  });
  if (!emailResponse.ok) {
    throw new Error('GitHub email fetch failed');
  }

  const emails = (await emailResponse.json()) as GitHubEmailResponse[];
  const primaryVerified = emails.find((email) => email.primary && email.verified);
  const fallbackVerified = emails.find((email) => email.verified);
  const selectedEmail = user.email ?? primaryVerified?.email ?? fallbackVerified?.email ?? emails[0]?.email ?? null;

  return {
    githubId: user.id,
    githubUsername: user.login,
    displayName: user.name ?? user.login,
    email: selectedEmail,
    avatarUrl: user.avatar_url,
  };
}
