import type { MiddlewareHandler } from 'hono';
import type { AuthAppEnv } from '../types/env.js';

export const requestIdMiddleware: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  await next();
};
