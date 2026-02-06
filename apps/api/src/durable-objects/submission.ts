import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../types/env.js';

export class SubmissionDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    
    // Initialize SQLite-backed storage
    ctx.blockConcurrencyWhile(async () => {
      // Future: Create tables for submission state, webhooks tracking
    });
  }
}
