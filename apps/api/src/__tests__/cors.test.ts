import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('CORS middleware — multi-domain support', () => {
  it('OPTIONS preflight returns 204 with CORS headers for allowed origin', async () => {
    const response = await SELF.fetch('http://localhost/', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173' },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET,POST,PUT,PATCH,DELETE,OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
  });

  it('sets CORS headers for FRONTEND_URL origin (localhost:5173)', async () => {
    const response = await SELF.fetch('http://localhost/', {
      headers: { Origin: 'http://localhost:5173' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('sets CORS headers for PLATFORM_URL origin (localhost:5174)', async () => {
    const response = await SELF.fetch('http://localhost/', {
      headers: { Origin: 'http://localhost:5174' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5174');
  });

  it('sets CORS headers for ADMIN_URL origin (localhost:5175)', async () => {
    const response = await SELF.fetch('http://localhost/', {
      headers: { Origin: 'http://localhost:5175' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5175');
  });

  it('does NOT set CORS headers for unknown origin', async () => {
    const response = await SELF.fetch('http://localhost/', {
      headers: { Origin: 'https://evil.com' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('sets Access-Control-Allow-Credentials to true', async () => {
    const response = await SELF.fetch('http://localhost/', {
      headers: { Origin: 'http://localhost:5173' },
    });

    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('does not set CORS headers when no Origin header is sent', async () => {
    const response = await SELF.fetch('http://localhost/');

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  it('OPTIONS preflight with unknown origin still returns 204 but no CORS headers', async () => {
    const response = await SELF.fetch('http://localhost/', {
      method: 'OPTIONS',
      headers: { Origin: 'https://malicious.com' },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
