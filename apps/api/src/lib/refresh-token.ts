import { eq, and } from 'drizzle-orm';
import { refreshTokens } from '@devsage/db';
import type { DbClient } from '@devsage/db';
import { REFRESH_TOKEN_BYTE_LENGTH, REFRESH_TOKEN_EXPIRY_SECONDS } from './constants.js';

const encoder = new TextEncoder();

async function hashToken(token: string): Promise<string> {
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  let hex = '';
  for (const byte of hashArray) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function generateOpaqueToken(): string {
  const bytes = new Uint8Array(REFRESH_TOKEN_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  let token = '';
  for (const byte of bytes) {
    token += byte.toString(16).padStart(2, '0');
  }
  return token;
}

export interface RefreshTokenResult {
  rawToken: string;
  tokenHash: string;
  familyId: string;
  expiresAt: string;
}

export async function createRefreshToken(
  db: DbClient,
  userId: string,
  familyId?: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<RefreshTokenResult> {
  const rawToken = generateOpaqueToken();
  const tokenHash = await hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000).toISOString();
  const newFamilyId = familyId ?? crypto.randomUUID();

  await db.insert(refreshTokens).values({
    id: crypto.randomUUID(),
    user_id: userId,
    token_hash: tokenHash,
    family_id: newFamilyId,
    expires_at: expiresAt,
    revoked: 0,
    ip_address: ipAddress ?? null,
    user_agent: userAgent?.substring(0, 256) ?? null,
    created_at: now.toISOString(),
  });

  return { rawToken, tokenHash, familyId: newFamilyId, expiresAt };
}

export type RotateResult =
  | { ok: true; userId: string; familyId: string; newToken: RefreshTokenResult }
  | { ok: false; code: 'INVALID_REFRESH_TOKEN' | 'REFRESH_TOKEN_EXPIRED' | 'REFRESH_TOKEN_REUSED' | 'SESSION_REVOKED' };

const GRACE_PERIOD_MS = 5_000;

export async function rotateRefreshToken(
  db: DbClient,
  oldTokenRaw: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<RotateResult> {
  const oldHash = await hashToken(oldTokenRaw);

  const existing = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token_hash, oldHash))
    .get();

  if (!existing) {
    return { ok: false, code: 'INVALID_REFRESH_TOKEN' };
  }

  if (existing.revoked === 1 && !existing.replaced_by) {
    return { ok: false, code: 'SESSION_REVOKED' };
  }

  const now = new Date();

  if (new Date(existing.expires_at) <= now) {
    return { ok: false, code: 'REFRESH_TOKEN_EXPIRED' };
  }

  if (existing.replaced_by) {
    const replacedAt = existing.revoked_at ? new Date(existing.revoked_at).getTime() : 0;
    if (now.getTime() - replacedAt < GRACE_PERIOD_MS) {
      return {
        ok: true,
        userId: existing.user_id,
        familyId: existing.family_id,
        newToken: { rawToken: oldTokenRaw, tokenHash: oldHash, familyId: existing.family_id, expiresAt: existing.expires_at },
      };
    }

    await revokeTokenFamily(db, existing.family_id);
    console.warn('Refresh token reuse detected — revoked entire family', {
      familyId: existing.family_id,
      userId: existing.user_id,
    });
    return { ok: false, code: 'REFRESH_TOKEN_REUSED' };
  }

  const newToken = await createRefreshToken(
    db,
    existing.user_id,
    existing.family_id,
    ipAddress,
    userAgent,
  );

  await db
    .update(refreshTokens)
    .set({
      revoked: 1,
      revoked_at: now.toISOString(),
      replaced_by: newToken.tokenHash,
    })
    .where(eq(refreshTokens.id, existing.id));

  return {
    ok: true,
    userId: existing.user_id,
    familyId: existing.family_id,
    newToken,
  };
}

export async function revokeTokenFamily(db: DbClient, familyId: string): Promise<void> {
  const now = new Date().toISOString();

  await db
    .update(refreshTokens)
    .set({ revoked: 1, revoked_at: now })
    .where(
      and(
        eq(refreshTokens.family_id, familyId),
        eq(refreshTokens.revoked, 0),
      ),
    );
}

export async function revokeAllUserTokens(db: DbClient, userId: string): Promise<void> {
  const now = new Date().toISOString();

  await db
    .update(refreshTokens)
    .set({ revoked: 1, revoked_at: now })
    .where(
      and(
        eq(refreshTokens.user_id, userId),
        eq(refreshTokens.revoked, 0),
      ),
    );
}
