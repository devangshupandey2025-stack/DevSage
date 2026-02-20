import { env } from 'cloudflare:test';
import { describe, expect, it, beforeAll } from 'vitest';
import { Hono } from 'hono';
import authHandler from '../routes/auth-handler.js';

const AUTH_TABLES = [
  `CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expiresAt INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL REFERENCES user(id),
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES user(id),
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt INTEGER,
    refreshTokenExpiresAt INTEGER,
    scope TEXT,
    password TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER,
    updatedAt INTEGER
  )`,
];

const AUTH_ENV = {
  DB: env.DB,
  BETTER_AUTH_SECRET: 'test-ba-secret-min-32-chars-long!!',
  BETTER_AUTH_URL: 'http://localhost',
  GITHUB_CLIENT_ID: 'test-github-client-id',
  GITHUB_CLIENT_SECRET: 'test-github-client-secret',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
};

describe('auth handler', () => {
  beforeAll(async () => {
    for (const sql of AUTH_TABLES) {
      await env.DB.prepare(sql).run();
    }
  });

  it('GET /get-session returns 200 when unauthenticated', async () => {
    const app = new Hono();
    app.route('/api/auth', authHandler);

    const res = await app.request(
      'http://localhost/api/auth/get-session',
      {},
      AUTH_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    // Better Auth returns null body or { session: null } when no session
    if (body !== null) {
      expect(body.session).toBeNull();
    }
  });

  it('auth routes are mounted and do not return 404', async () => {
    const app = new Hono();
    app.route('/api/auth', authHandler);

    const res = await app.request(
      'http://localhost/api/auth/get-session',
      { method: 'GET' },
      AUTH_ENV,
    );

    expect(res.status).not.toBe(404);
  });
});
