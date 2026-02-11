import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { postCommitStatus } from '../services/github.js';
import type { Env } from '../types/env.js';

describe('GitHub service', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('posts commit status with success state', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));

    const env = {
      GITHUB_CLIENT_SECRET: 'ghs_test_token',
    } as Env;

    await postCommitStatus(env, {
      repoFullName: 'owner/repo',
      sha: 'abc123def456',
      state: 'success',
      description: 'Test passed',
      context: 'devsage/submission',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/owner/repo/statuses/abc123def456');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('token ghs_test_token');
    const body = JSON.parse(options.body);
    expect(body.state).toBe('success');
    expect(body.description).toBe('Test passed');
    expect(body.context).toBe('devsage/submission');
  });

  it('posts commit status with failure state', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));

    const env = {
      GITHUB_CLIENT_SECRET: 'ghs_test_token',
    } as Env;

    await postCommitStatus(env, {
      repoFullName: 'owner/repo',
      sha: 'abc123def456',
      state: 'failure',
      description: 'Submission rejected: already submitted',
      context: 'devsage/submission',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.state).toBe('failure');
    expect(body.description).toBe('Submission rejected: already submitted');
  });

  it('fails gracefully if GitHub API returns error', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }));

    const env = {
      GITHUB_CLIENT_SECRET: 'ghs_test_token',
    } as Env;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await postCommitStatus(env, {
      repoFullName: 'owner/repo',
      sha: 'abc123def456',
      state: 'success',
      description: 'Test',
      context: 'devsage/submission',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('GitHub API returned 404'),
    );

    warnSpy.mockRestore();
  });

  it('fails gracefully if fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    const env = {
      GITHUB_CLIENT_SECRET: 'ghs_test_token',
    } as Env;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await postCommitStatus(env, {
      repoFullName: 'owner/repo',
      sha: 'abc123def456',
      state: 'success',
      description: 'Test',
      context: 'devsage/submission',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('failed to post commit status'),
    );

    warnSpy.mockRestore();
  });

  it('handles AbortError from timeout gracefully', async () => {
    const abortError = new Error('The operation was aborted.');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValue(abortError);

    const env = {
      GITHUB_CLIENT_SECRET: 'ghs_test_token',
    } as Env;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await postCommitStatus(env, {
      repoFullName: 'owner/repo',
      sha: 'abc123def456',
      state: 'success',
      description: 'Test',
      context: 'devsage/submission',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('timeout posting to GitHub'),
    );

    warnSpy.mockRestore();
  });

  it('skips silently if GITHUB_CLIENT_SECRET is not configured', async () => {
    const env = {
      GITHUB_CLIENT_SECRET: '',
    } as Env;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await postCommitStatus(env, {
      repoFullName: 'owner/repo',
      sha: 'abc123def456',
      state: 'success',
      description: 'Test',
      context: 'devsage/submission',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'postCommitStatus: GITHUB_CLIENT_SECRET not configured, skipping',
    );

    warnSpy.mockRestore();
  });

  it('never throws, always completes successfully', async () => {
    fetchMock.mockRejectedValue(new Error('Catastrophic failure'));

    const env = {
      GITHUB_CLIENT_SECRET: 'ghs_test_token',
    } as Env;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      postCommitStatus(env, {
        repoFullName: 'owner/repo',
        sha: 'abc123def456',
        state: 'success',
        description: 'Test',
        context: 'devsage/submission',
      }),
    ).resolves.toBeUndefined();

    warnSpy.mockRestore();
  });
});
