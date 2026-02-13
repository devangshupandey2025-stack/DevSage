/**
 * Durable Object client helpers.
 *
 * Encapsulates the repeated idFromName → get → fetch-with-timeout
 * pattern that was duplicated across route and queue handlers.
 */

import type { Env } from '../types/env.js';
import { DO_FETCH_TIMEOUT_MS } from './constants.js';
import { readJson } from './utils.js';

/**
 * Get a HackathonStateMachine stub addressed by hackathon ID.
 * Wraps the two-step `idFromName` + `get` pattern.
 */
export function getStateMachineStub(
  env: Pick<Env, 'HACKATHON_SM'>,
  hackathonId: string,
): DurableObjectStub {
  const doId = env.HACKATHON_SM.idFromName(hackathonId);
  return env.HACKATHON_SM.get(doId);
}

// ─── fetchDO ─────────────────────────────────────────────────

interface FetchDOOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
}

export interface FetchDOResult {
  ok: boolean;
  status: number;
  data: unknown;
}

/**
 * Fetch a Durable Object endpoint with automatic timeout and JSON parsing.
 *
 * Returns a structured result instead of throwing on timeout — callers
 * inspect `result.ok` / `result.status` rather than catching AbortError.
 *
 * @param stub   - Durable Object stub from {@link getStateMachineStub}
 * @param path   - Full URL path (use `DO_PATHS` constants)
 * @param options - HTTP method, optional body, optional timeout override
 */
export async function fetchDO(
  stub: DurableObjectStub,
  path: string,
  options: FetchDOOptions = {},
): Promise<FetchDOResult> {
  const { method = 'GET', body, timeoutMs = DO_FETCH_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const init: RequestInit = {
      method,
      signal: controller.signal,
    };

    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }

    const response = await stub.fetch(path, init);
    const data = await readJson(response);

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        status: 504,
        data: { error: 'Durable Object request timed out', code: 'DO_TIMEOUT' },
      };
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
