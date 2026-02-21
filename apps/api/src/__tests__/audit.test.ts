import { SELF } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { insertAuditEvent } from '../lib/audit.js';
import {
  ensureSchema, resetDb, env,
  insertUser, insertWorkspace, insertHackathon,
} from './helpers.js';

describe('audit event — insertAuditEvent', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); });

  it('inserts an audit event successfully', async () => {
    const id = await insertAuditEvent(env.DB, {
      actor_type: 'user',
      action: 'hackathon.created',
      entity_type: 'hackathon',
      entity_id: 'hack-1',
    });

    expect(id).toBeTruthy();

    const row = await env.DB.prepare('SELECT * FROM audit_events WHERE id = ?')
      .bind(id).first();
    expect(row).toBeTruthy();
    expect(row!.action).toBe('hackathon.created');
    expect(row!.actor_type).toBe('user');
    expect(row!.entity_type).toBe('hackathon');
    expect(row!.hash).toBeTruthy();
    expect(row!.sequence).toBe(1);
  });

  it('creates hash chain — second event references first', async () => {
    const id1 = await insertAuditEvent(env.DB, {
      actor_type: 'system',
      action: 'test.first',
      entity_type: 'hackathon',
      entity_id: 'hack-chain',
    });

    const id2 = await insertAuditEvent(env.DB, {
      actor_type: 'system',
      action: 'test.second',
      entity_type: 'hackathon',
      entity_id: 'hack-chain',
    });

    const first = await env.DB.prepare('SELECT hash, prev_hash FROM audit_events WHERE id = ?')
      .bind(id1).first<{ hash: string; prev_hash: string | null }>();
    const second = await env.DB.prepare('SELECT hash, prev_hash FROM audit_events WHERE id = ?')
      .bind(id2).first<{ hash: string; prev_hash: string | null }>();

    expect(first!.prev_hash).toBeNull();
    expect(second!.prev_hash).toBe(first!.hash);
    expect(second!.hash).not.toBe(first!.hash);
  });

  it('increments sequence numbers', async () => {
    await insertAuditEvent(env.DB, {
      actor_type: 'cron', action: 'seq.1',
      entity_type: 'test', entity_id: 't-1',
    });
    await insertAuditEvent(env.DB, {
      actor_type: 'cron', action: 'seq.2',
      entity_type: 'test', entity_id: 't-2',
    });
    await insertAuditEvent(env.DB, {
      actor_type: 'cron', action: 'seq.3',
      entity_type: 'test', entity_id: 't-3',
    });

    const rows = await env.DB.prepare(
      'SELECT sequence FROM audit_events ORDER BY sequence ASC'
    ).all<{ sequence: number }>();

    expect(rows.results.map(r => r.sequence)).toEqual([1, 2, 3]);
  });

  it('stores all optional fields', async () => {
    // Insert a hackathon for FK reference
    await insertUser('user-full', 'full@test.com', 'Full User');
    await insertWorkspace('ws-full', 'ws-full', 'user-full');
    await insertHackathon({ id: 'hack-full', workspaceId: 'ws-full', slug: 'hack-full', createdBy: 'user-full' });

    const id = await insertAuditEvent(env.DB, {
      hackathon_id: 'hack-full',
      actor_id: 'user-full',
      actor_type: 'user',
      actor_ip: '192.168.1.1',
      actor_user_agent: 'TestAgent/1.0',
      action: 'team.created',
      entity_type: 'team',
      entity_id: 'team-full',
      details: { name: 'Alpha Team', size: 3 },
      changes: { name: { from: null, to: 'Alpha Team' } },
    });

    const row = await env.DB.prepare('SELECT * FROM audit_events WHERE id = ?')
      .bind(id).first();

    expect(row!.hackathon_id).toBe('hack-full');
    expect(row!.actor_id).toBe('user-full');
    expect(row!.actor_ip).toBe('192.168.1.1');
    expect(row!.actor_user_agent).toBe('TestAgent/1.0');
    expect(JSON.parse(row!.details as string)).toEqual({ name: 'Alpha Team', size: 3 });
    expect(JSON.parse(row!.changes as string)).toEqual({ name: { from: null, to: 'Alpha Team' } });
  });

  it('inserts with minimal fields (no optionals)', async () => {
    const id = await insertAuditEvent(env.DB, {
      actor_type: 'bot',
      action: 'webhook.processed',
      entity_type: 'webhook',
      entity_id: 'wh-1',
    });

    const row = await env.DB.prepare('SELECT * FROM audit_events WHERE id = ?')
      .bind(id).first();

    expect(row!.hackathon_id).toBeNull();
    expect(row!.actor_id).toBeNull();
    expect(row!.actor_ip).toBeNull();
    expect(row!.actor_user_agent).toBeNull();
    expect(row!.changes).toBeNull();
    expect(JSON.parse(row!.details as string)).toEqual({});
  });

  it('hash is a valid 64-char hex string', async () => {
    const id = await insertAuditEvent(env.DB, {
      actor_type: 'system',
      action: 'hash.check',
      entity_type: 'test',
      entity_id: 'hc-1',
    });

    const row = await env.DB.prepare('SELECT hash FROM audit_events WHERE id = ?')
      .bind(id).first<{ hash: string }>();

    expect(row!.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
