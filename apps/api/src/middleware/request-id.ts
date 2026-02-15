import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env.js';

/**
 * Generates a unique X-Request-Id header for every request.
 * Uses the incoming header if already present (e.g. from a load balancer),
 * otherwise generates a new UUID via crypto.randomUUID().
 */
export const requestIdMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const requestId = c.req.header('X-Request-Id') || crypto.randomUUID();
  c.set('requestId' as never, requestId);
  c.header('X-Request-Id', requestId);
  await next();
};
