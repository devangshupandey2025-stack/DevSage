import { describe, expect, it } from 'vitest';
import health from '../routes/health.js';

describe('GET /health', () => {
  it('returns 200 with ok:true and timestamp', async () => {
    const res = await health.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; timestamp: string };
    expect(body.ok).toBe(true);
    expect(typeof body.timestamp).toBe('string');
  });
});
