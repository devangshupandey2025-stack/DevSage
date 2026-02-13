import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendEmail } from '../services/smtp.js';
import type { Env } from '../types/env.js';

describe('sendEmail', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let env: Env;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    env = {
      DB: {} as any,
      KV: {} as any,
      HACKATHON_SM: {} as any,
      WEBHOOK_QUEUE: {} as any,
      NOTIFICATION_QUEUE: {} as any,
      JWT_SECRET: 'test-secret',
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      GITHUB_CLIENT_ID: 'github-id',
      GITHUB_CLIENT_SECRET: 'github-secret',
      GITHUB_WEBHOOK_SECRET: 'webhook-secret',
      FRONTEND_URL: 'http://localhost:3000',
      PLATFORM_URL: 'http://localhost:5174',
      ADMIN_URL: 'http://localhost:5175',
      SMTP_URL: 'https://smtp.example.com/send',
      SMTP_USERNAME: 'user@example.com',
      SMTP_PASSWORD: 'password123',
      SMTP_EMAIL_ADDR: 'noreply@devsage.org',
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully send an email with valid config and parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
    });

    const result = await sendEmail(env, {
      to: 'user@example.com',
      subject: 'Test Subject',
      body: 'Test email body',
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledOnce();

    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe(env.SMTP_URL);
    expect(call[1].method).toBe('POST');
    expect(call[1].headers['Content-Type']).toBe('application/json');
  });

  it('should return error when SMTP_URL is not configured', async () => {
    env.SMTP_URL = '';

    const result = await sendEmail(env, {
      to: 'user@example.com',
      subject: 'Test',
      body: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMTP not configured');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return error when SMTP_USERNAME is missing', async () => {
    env.SMTP_USERNAME = '';

    const result = await sendEmail(env, {
      to: 'user@example.com',
      subject: 'Test',
      body: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMTP credentials not configured');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return error when SMTP_PASSWORD is missing', async () => {
    env.SMTP_PASSWORD = '';

    const result = await sendEmail(env, {
      to: 'user@example.com',
      subject: 'Test',
      body: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMTP credentials not configured');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return error when SMTP_EMAIL_ADDR is missing', async () => {
    env.SMTP_EMAIL_ADDR = '';

    const result = await sendEmail(env, {
      to: 'user@example.com',
      subject: 'Test',
      body: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMTP credentials not configured');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return error when recipient email is missing', async () => {
    const result = await sendEmail(env, {
      to: '',
      subject: 'Test',
      body: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing required email parameters');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return error when subject is missing', async () => {
    const result = await sendEmail(env, {
      to: 'user@example.com',
      subject: '',
      body: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing required email parameters');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return error when body is missing', async () => {
    const result = await sendEmail(env, {
      to: 'user@example.com',
      subject: 'Test',
      body: '',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing required email parameters');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return error when SMTP API returns non-OK status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const result = await sendEmail(env, {
      to: 'user@example.com',
      subject: 'Test',
      body: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should handle timeout and return error', async () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((_, reject) => {
        const error = new Error('Aborted');
        (error as any).name = 'AbortError';
        reject(error);
      }),
    );

    const result = await sendEmail(env, {
      to: 'user@example.com',
      subject: 'Test',
      body: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Request timeout');
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await sendEmail(env, {
      to: 'user@example.com',
      subject: 'Test',
      body: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });

  it('should send Basic Auth header with credentials', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    await sendEmail(env, {
      to: 'user@example.com',
      subject: 'Test',
      body: 'Test body',
    });

    const call = mockFetch.mock.calls[0];
    expect(call[1].headers.Authorization).toMatch(/^Basic /);
  });

  it('should send email body as plain text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    await sendEmail(env, {
      to: 'user@example.com',
      subject: 'Test Subject',
      body: 'Plain text body content',
    });

    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.text).toBe('Plain text body content');
    expect(body.html).toBeUndefined();
  });

  it('should use SMTP_EMAIL_ADDR as from address', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    await sendEmail(env, {
      to: 'recipient@example.com',
      subject: 'Test',
      body: 'Test',
    });

    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.from).toBe(env.SMTP_EMAIL_ADDR);
  });
});
