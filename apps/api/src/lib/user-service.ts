import type { AppEnv } from '../types/env.js';
import type { GitHubOAuthProfile, GoogleOAuthProfile } from './oauth.js';

export interface UserIdentity {
  id: string;
  github_id: number | null;
  github_username: string | null;
}

export async function upsertGitHubUser(
  env: AppEnv['Bindings'],
  profile: GitHubOAuthProfile,
): Promise<UserIdentity> {
  const now = new Date().toISOString();

  const existing = await env.DB.prepare(
    `SELECT id, github_id, github_username
     FROM users
     WHERE github_id = ?
     LIMIT 1`,
  ).bind(profile.githubId).first<UserIdentity>();

  if (existing) {
    await env.DB.prepare(
      `UPDATE users
       SET github_username = ?, name = ?, email = ?, avatar_url = ?, last_login_at = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(
      profile.githubUsername,
      profile.displayName,
      profile.email,
      profile.avatarUrl,
      now,
      now,
      existing.id,
    ).run();

    return {
      id: existing.id,
      github_id: profile.githubId,
      github_username: profile.githubUsername,
    };
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO users
      (id, github_id, github_username, name, email, avatar_url, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    profile.githubId,
    profile.githubUsername,
    profile.displayName,
    profile.email ?? `${profile.githubUsername}@users.noreply.github.com`,
    profile.avatarUrl,
    now,
    now,
    now,
  ).run();

  return {
    id,
    github_id: profile.githubId,
    github_username: profile.githubUsername,
  };
}

export async function linkGoogleToUser(
  env: AppEnv['Bindings'],
  profile: GoogleOAuthProfile,
): Promise<UserIdentity | null> {
  const existing = await env.DB.prepare(
    `SELECT id, github_id, github_username, avatar_url
     FROM users
     WHERE email = ?
     LIMIT 1`,
  ).bind(profile.email).first<{
    id: string;
    github_id: number | null;
    github_username: string | null;
    avatar_url: string | null;
  }>();

  if (!existing) return null;

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE users
     SET google_id = ?, name = ?, avatar_url = ?, last_login_at = ?, updated_at = ?
     WHERE id = ?`,
  ).bind(
    profile.googleId,
    profile.displayName,
    profile.avatarUrl ?? existing.avatar_url,
    now,
    now,
    existing.id,
  ).run();

  return {
    id: existing.id,
    github_id: existing.github_id,
    github_username: existing.github_username,
  };
}

export function callbackUrl(requestUrl: string, provider: 'google' | 'github'): string {
  return new URL(`/auth/callback/${provider}`, requestUrl).toString();
}
