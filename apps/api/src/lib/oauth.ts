export function getGitHubAuthUrl(clientId: string, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export function getGoogleAuthUrl(clientId: string, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGitHubCode(
  code: string, clientId: string, clientSecret: string
): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(data.error || 'GitHub token exchange failed');
  return data.access_token;
}

export async function getGitHubUserInfo(accessToken: string): Promise<{
  email: string; name: string; avatar_url: string | null;
  github_id: number; github_username: string;
}> {
  const [userRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'DevSage' },
    }),
    fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'DevSage' },
    }),
  ]);

  const user = await userRes.json() as { id: number; login: string; name: string | null; avatar_url: string };
  const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;

  const primaryEmail = emails.find(e => e.primary && e.verified)?.email
    || emails.find(e => e.verified)?.email
    || emails[0]?.email;

  if (!primaryEmail) throw new Error('No verified email found on GitHub account');

  return {
    email: primaryEmail,
    name: user.name || user.login,
    avatar_url: user.avatar_url || null,
    github_id: user.id,
    github_username: user.login,
  };
}

export async function exchangeGoogleCode(
  code: string, clientId: string, clientSecret: string, redirectUri: string
): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(data.error || 'Google token exchange failed');
  return data.access_token;
}

export async function getGoogleUserInfo(accessToken: string): Promise<{
  email: string; name: string; avatar_url: string | null; google_id: string;
}> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json() as {
    id: string; email: string; name: string; picture?: string;
  };
  return {
    email: data.email,
    name: data.name,
    avatar_url: data.picture || null,
    google_id: data.id,
  };
}
