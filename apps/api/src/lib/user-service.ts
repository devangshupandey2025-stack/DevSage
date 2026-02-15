import { eq } from 'drizzle-orm';
import { createDbClient, users, teamMembers } from '@devsage/db';
import type { Env } from '../types/env.js';
import type { GitHubOAuthProfile, GoogleOAuthProfile } from './oauth.js';

export class AccountMergeConflictError extends Error {
  readonly code = 'ACCOUNT_MERGE_CONFLICT' as const;
  readonly status = 409 as const;

  constructor(message: string) {
    super(message);
    this.name = 'AccountMergeConflictError';
  }
}

/** Minimal user identity returned after upsert/link operations. */
export interface UserIdentity {
  id: string;
  github_id: number | null;
  github_username: string | null;
}

/**
 * Upsert a user from a GitHub OAuth profile.
 *
 * - If a user with the same `github_id` exists, update their profile fields.
 * - Otherwise, create a new user row.
 *
 * Returns the minimal identity needed for JWT signing.
 */
export async function upsertGitHubUser(
  env: Env,
  profile: GitHubOAuthProfile,
): Promise<UserIdentity> {
  const db = createDbClient(env.DB);
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.github_id, profile.githubId))
    .get();

  if (existing) {
    await db
      .update(users)
      .set({
        github_username: profile.githubUsername,
        display_name: profile.displayName,
        email: profile.email,
        avatar_url: profile.avatarUrl,
        last_login_at: now,
        updated_at: now,
      })
      .where(eq(users.id, existing.id));

    return {
      id: existing.id,
      github_id: existing.github_id,
      github_username: profile.githubUsername,
    };
  }

  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    github_id: profile.githubId,
    github_username: profile.githubUsername,
    display_name: profile.displayName,
    email: profile.email,
    avatar_url: profile.avatarUrl,
    last_login_at: now,
    created_at: now,
    updated_at: now,
  });

  return {
    id,
    github_id: profile.githubId,
    github_username: profile.githubUsername,
  };
}

/**
 * Link a Google OAuth profile to an existing user matched by email.
 *
 * Returns `null` if no user with that email exists (user must sign in
 * with GitHub first to create their account).
 */
export async function linkGoogleToUser(
  env: Env,
  profile: GoogleOAuthProfile,
): Promise<UserIdentity | null> {
  const db = createDbClient(env.DB);
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, profile.email))
    .get();

  if (!existing) {
    return null;
  }

  if (existing.google_id && existing.google_id !== profile.googleId) {
    const conflictingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.google_id, profile.googleId))
      .get();

    if (conflictingUser) {
      const sharedTeam = await db
        .select({ team_id: teamMembers.team_id })
        .from(teamMembers)
        .where(eq(teamMembers.user_id, conflictingUser.id))
        .get();

      if (sharedTeam) {
        throw new AccountMergeConflictError(
          'Cannot link this Google account — it belongs to another user with active team memberships.',
        );
      }
    }

    throw new AccountMergeConflictError(
      'This account is already linked to a different Google account.',
    );
  }

  await db
    .update(users)
    .set({
      google_id: profile.googleId,
      display_name: profile.displayName,
      avatar_url: profile.avatarUrl ?? existing.avatar_url,
      last_login_at: now,
      updated_at: now,
    })
    .where(eq(users.id, existing.id));

  return {
    id: existing.id,
    github_id: existing.github_id,
    github_username: existing.github_username,
  };
}

/**
 * Build the full OAuth callback URL for a given provider.
 *
 * Uses the incoming request URL as the base so the callback URL
 * always matches the origin the user is hitting (dev vs production).
 */
export function callbackUrl(
  requestUrl: string,
  provider: 'google' | 'github',
): string {
  return new URL(`/auth/callback/${provider}`, requestUrl).toString();
}
