# Workspace & Billing

Priority: Deletion + ownership transfer = **PHASE 3**. Stripe billing = **PHASE 4**.

## Source Docs
- `role-workspace-managers.md` — Owner billing, workspace setup, admin invites
- `role-devsage-team.md` — Workspace provisioning

## Current State

**Working**:
- Workspace CRUD
- Member management (invite, accept, remove, update role)
- Workspace invites (create, accept)
- Role hierarchy: owner > admin > member

**Missing**:
- Workspace deletion (GAP-010)
- Ownership transfer (GAP-011)
- Owner max-2 enforcement
- Billing & subscription (GAP-001) — completely absent

## Implementation Plan

### 1. Owner Max-2 Enforcement

**From `role-workspace-managers.md`**: "Owner: max 2 per workspace."

Add validation in workspace member invite and role update:
```typescript
async function enforceOwnerMax(env: AppEnv['Bindings'], workspaceId: string): Promise<void> {
  const count = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM workspace_members WHERE workspace_id = ? AND role = 'owner'"
  ).bind(workspaceId).first();
  if (count && count.count >= 2) {
    throw new AppError('MAX_OWNERS_REACHED', 'A workspace can have at most 2 owners', 409);
  }
}
```

Check in:
- `POST /api/v1/workspaces/:id/members/invite` when role = 'owner'
- `PATCH /api/v1/workspaces/:id/members/:id` when updating role to 'owner'

### 2. Workspace Deletion — GAP-010

**From `role-workspace-managers.md`**: Only owner can delete workspace.

Soft delete (already has `deleted_at` column from migration 0003):

```typescript
// In WorkspaceService (use service layer pattern)
async deleteWorkspace(env, workspaceId: string, userId: string): Promise<void> {
  // Check no active hackathons
  const active = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM hackathons WHERE workspace_id = ? AND status NOT IN ('completed', 'archived')"
  ).bind(workspaceId).first();

  if (active.count > 0) {
    throw new AppError('WORKSPACE_HAS_ACTIVE_HACKATHONS', 'Archive all hackathons before deleting', 409);
  }

  await env.DB.prepare(
    "UPDATE workspaces SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
  ).bind(workspaceId).run();

  await insertAuditEvent(env, { entityType: 'workspace', entityId: workspaceId, eventType: 'delete', actorId: userId });
}
```

Middleware: Add soft-delete check to workspace loading middleware — return 404 for deleted workspaces.

### 3. Ownership Transfer — GAP-011

**From `role-workspace-managers.md`**: Owner can transfer ownership to an existing admin.

```typescript
// In WorkspaceService
async transferOwnership(env, workspaceId: string, newOwnerId: string, currentUserId: string): Promise<void> {
  // 1. Verify newOwnerId is a current admin member
  const target = await env.DB.prepare(
    "SELECT id, role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
  ).bind(workspaceId, newOwnerId).first();

  if (!target || target.role !== 'admin') {
    throw new AppError('INVALID_TRANSFER_TARGET', 'Can only transfer ownership to an admin', 400);
  }

  // 2. Swap roles in a batch
  await env.DB.batch([
    env.DB.prepare("UPDATE workspace_members SET role = 'admin' WHERE workspace_id = ? AND user_id = ?")
      .bind(workspaceId, currentUserId),
    env.DB.prepare("UPDATE workspace_members SET role = 'owner' WHERE workspace_id = ? AND user_id = ?")
      .bind(workspaceId, newOwnerId),
  ]);

  // 3. Audit + notify
  await insertAuditEvent(env, {
    entityType: 'workspace', entityId: workspaceId, eventType: 'update',
    actorId: currentUserId, changes: { ownership: { from: currentUserId, to: newOwnerId } },
  });
}
```

### 4. Billing & Subscription — GAP-001

**From `role-workspace-managers.md`**: Owner sets billing plan during workspace setup.

This is the largest gap. Implement in phases:

#### Phase A: Stripe Integration Setup
1. Add Stripe bindings to `apps/api/wrangler.jsonc`:
   - `STRIPE_SECRET_KEY` (secret)
   - `STRIPE_WEBHOOK_SECRET` (secret)
   - `STRIPE_PUBLISHABLE_KEY` (env var, exposed to frontend)
2. Update `src/types/env.ts` with new binding types
3. Create `src/services/stripe-service.ts` (use service layer pattern):
   - `createCustomer(workspaceId, email)`
   - `createCheckoutSession(customerId, priceId, returnUrl)`
   - `createSubscription(customerId, priceId)`
   - `cancelSubscription(subscriptionId)`
   - `createPortalSession(customerId)` — for self-service billing

#### Phase B: Database Schema
```sql
CREATE TABLE billing_customers (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(workspace_id)
);

CREATE TABLE billing_subscriptions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',  -- free, pro, enterprise
  status TEXT NOT NULL DEFAULT 'active',  -- active, past_due, canceled
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_billing_subscriptions_workspace ON billing_subscriptions(workspace_id);
```

#### Phase C: API Endpoints
```
POST   /api/v1/workspaces/:id/billing/setup       — Create Stripe customer + checkout session
GET    /api/v1/workspaces/:id/billing              — Current plan, usage, next billing date
POST   /api/v1/workspaces/:id/billing/portal       — Stripe customer portal URL
POST   /webhooks/stripe                            — Stripe webhook handler
```

#### Phase D: Plan Enforcement
- Free plan: 1 active hackathon, 50 participants max
- Pro plan: 5 active hackathons, 500 participants
- Enterprise: unlimited
- Check limits in `hackathons.ts` create endpoint and `teams.ts` join endpoint
- Middleware: `requirePlan('pro')` for premium features

#### Phase E: Stripe Webhook Handler

**Important**: Verify Stripe webhook signatures using `crypto.subtle` (no external lib). Use constant-time comparison.

```typescript
async function verifyStripeSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const [timestamp, sig] = parseStripeSignature(signature);
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey('raw', encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = await crypto.subtle.sign('HMAC', key, encode(signedPayload));
  return timingSafeEqual(new Uint8Array(expected), hexToBytes(sig));
}
```

**Idempotency**: Use Stripe event `id` as idempotency key (insert into `notification_idempotency` table before processing).

Handle events:
- `checkout.session.completed` → activate subscription
- `invoice.paid` → extend subscription
- `invoice.payment_failed` → mark past_due, notify owner
- `customer.subscription.deleted` → downgrade to free

## Tests to Add

- [ ] Owner max-2 enforcement blocks 3rd owner
- [ ] Workspace deletion blocked with active hackathons
- [ ] Workspace deletion soft-deletes correctly
- [ ] Deleted workspace returns 404
- [ ] Ownership transfer validates target is admin
- [ ] Ownership transfer swaps roles correctly
- [ ] Stripe webhook signature verification
- [ ] Stripe webhook idempotency (duplicate event ignored)
- [ ] Plan limits enforced on hackathon creation
