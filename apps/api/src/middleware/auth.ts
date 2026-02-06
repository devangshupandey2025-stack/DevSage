import type { Context, Next } from 'hono';
import type { Env } from '../types/env.js';

/**
 * Auth middleware stub - passes through all requests
 * Future: Verify JWT tokens, extract user from token
 */
export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  // Future: Implement JWT verification
  // const token = c.req.header('Authorization')?.replace('Bearer ', '');
  // const user = await verifyJWT(token, c.env.JWT_SECRET);
  // c.set('user', user);
  
  await next();
}
