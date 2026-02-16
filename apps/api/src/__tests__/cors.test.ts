import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('CORS middleware', () => {
  it('OPTIONS preflight returns CORS headers for allowed origin', async () => {
    const res = await SELF.fetch('http://localhost/', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173' },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
  });

  it('allowed origin gets CORS headers on normal request', async () => {
    const res = await SELF.fetch('http://localhost/', {
      headers: { Origin: 'http://localhost:5174' },
    });

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5174');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('disallowed origin does not get Access-Control-Allow-Origin', async () => {
    const res = await SELF.fetch('http://localhost/', {
      headers: { Origin: 'https://evil.com' },
    });

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('credentials are allowed for all three origins', async () => {
    for (const origin of ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175']) {
      const res = await SELF.fetch('http://localhost/', {
        headers: { Origin: origin },
      });
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    }
  });

  it('no CORS headers when no Origin header', async () => {
    const res = await SELF.fetch('http://localhost/');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('OPTIONS with disallowed origin returns 204 but no CORS headers', async () => {
    const res = await SELF.fetch('http://localhost/', {
      method: 'OPTIONS',
      headers: { Origin: 'https://malicious.com' },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
