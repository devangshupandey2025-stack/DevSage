import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../types/env.js';

export class HackathonLifecycleDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    
    // Initialize SQLite-backed storage
    ctx.blockConcurrencyWhile(async () => {
      // Future: Create tables for hackathon lifecycle state
    });
  }

  async alarm(): Promise<void> {
    // Future: Handle lifecycle transitions (registration -> submission -> judging -> results)
    console.log('HackathonLifecycleDO: alarm triggered');
  }
}
