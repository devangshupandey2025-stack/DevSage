# Cost Model

> Cloudflare Workers resource limits, free tier compliance for Phase 1, and paid plan estimates at scale.

---

## Phase 1: Free Tier Compliance

Phase 1 runs entirely on the **Workers Free Plan** — $0/month. All free tier limits are **daily** (reset at 00:00 UTC).

### Free Plan Limits vs Phase 1 Estimates

| Service | Metric | Free Limit | Phase 1 Estimate (10 hackathons, 200 participants) | Headroom |
|---------|--------|------------|-----------------------------------------------------|----------|
| **Workers** | Requests/day | 100,000 | ~5,000 | 95% |
| | CPU time/invocation | 10ms | ~2–5ms typical | OK |
| | Worker size | 1 MB compressed | ~200 KB | OK |
| **D1** | Rows read/day | 5,000,000 | ~50,000 | 99% |
| | Rows written/day | 100,000 | ~2,000 | 98% |
| | Storage | 5 GB total | ~50 MB | 99% |
| **KV** | Reads/day | 100,000 | ~5,000 | 95% |
| | Writes/day | **1,000** | ~800 (see note) | **20% — tight** |
| | Deletes/day | 1,000 | ~0 (TTL-based expiry) | OK |
| | Storage | 1 GB | ~1 MB | OK |
| **Queues** | Operations/day | 10,000 | ~500 | 95% |
| | Message retention | 24 hours (fixed) | OK for webhook + notification processing | OK |
| **Durable Objects** | Requests/day | 100,000 | ~1,000 | 99% |
| | Duration/day | 13,000 GB-s | ~100 GB-s | 99% |
| | SQLite reads/day | 5,000,000 | ~5,000 | 99% |
| | SQLite writes/day | 100,000 | ~1,000 | 99% |
| | SQLite storage | 5 GB total | ~10 MB | OK |
| **R2** | Storage | 10 GB/month | 0 (Phase 2 feature) | N/A |
| | Class A ops | 1,000,000/month | 0 | N/A |
| | Class B ops | 10,000,000/month | 0 | N/A |
| **Cron Triggers** | Invocations | Counts against Worker request quota | 24/day (hourly) | Negligible |
| **Analytics Engine** | Data points/day | 100,000 | 0 (Phase 2 feature) | N/A |

### ⚠️ KV Writes — The Tightest Constraint

KV writes are limited to **1,000/day** on the free tier. Rate limiting as currently designed uses a KV write per request (fire-and-forget via `waitUntil`). OAuth state storage also uses KV writes.

**Mitigation for Phase 1 — rate limit auth endpoints only:**

At 200 participants the abuse surface is minimal. Rate limit only `/auth/*` endpoints (highest abuse risk, ~10–50 KV writes/day). Skip rate limiting for all other tiers until moving to the paid plan. OAuth state writes (~10–20/day) fit easily.

```ts
// apps/api/src/middleware/rate-limit.ts
// Phase 1: Only rate limit auth endpoints to stay within KV free tier (1K writes/day)
const PHASE_1_RATE_LIMITED_TIERS: RateLimitTier[] = ['auth'];

// Phase 2+ (paid plan): Enable all tiers
const ALL_RATE_LIMITED_TIERS: RateLimitTier[] = ['auth', 'webhook', 'authenticated', 'anonymous', 'admin'];
```

### Free Tier Exclusions (Phase 2+)

These features are available on free tier but not needed or practical in Phase 1:

| Feature | Reason | When |
|---------|--------|------|
| R2 file uploads | Not needed until supplementary uploads | Phase 2 |
| Analytics Engine | Not needed until dashboards | Phase 2 |
| Full rate limiting (all tiers) | KV writes too constrained at 1K/day | Phase 2 (paid plan) |
| Extended queue retention (4–14 days) | Free = 24hr fixed | Phase 2 |
| Workers Trace Events Logpush | Paid plan only | Phase 2+ |

---

## Workers Paid Plan ($5/mo base)

For Phase 2+ when usage outgrows free tier limits.

| Resource | Included | Overage |
|----------|----------|---------|
| Requests | 10M/month | $0.30/M |
| CPU time | 30M CPU-ms/month | $0.02/M CPU-ms |
| Worker size | 10 MB compressed | — |

## D1

| Resource | Free | Paid |
|----------|------|------|
| Rows read | 5M/day | 25B/month ($0.001/M) |
| Rows written | 100K/day | 50M/month ($1.00/M) |
| Storage | 5 GB | 5 GB included ($0.75/GB-month) |

## KV

| Resource | Free | Paid |
|----------|------|------|
| Reads | 100K/day | 10M/month ($0.50/M) |
| Writes | 1K/day | 1M/month ($5.00/M) |
| Deletes | 1K/day | 1M/month ($5.00/M) |
| Lists | 1K/day | 1M/month ($5.00/M) |
| Storage | 1 GB | 1 GB included ($0.50/GB-month) |

## Queues

| Resource | Free | Paid |
|----------|------|------|
| Operations | 10K/day | 1M/month ($0.40/M operations) |
| Message retention | 24hr (fixed) | 4 days default, up to 14 days |
| Max message size | 128 KB | 128 KB |

**Note:** Each message counts as 2+ operations (send + ack). Free tier of 10K ops/day ≈ 5K messages/day.

## Durable Objects (SQLite-backed)

| Resource | Free | Paid |
|----------|------|------|
| Requests | 100K/day | 1M/month ($0.15/M) |
| Duration | 13K GB-s/day | 400K GB-s/month ($12.50/M GB-s) |
| SQLite rows read | 5M/day | 25B/month ($0.001/M) |
| SQLite rows written | 100K/day | 50M/month ($1.00/M) |
| SQLite storage | 5 GB | 5 GB included ($0.20/GB-month) |

**Note:** Only SQLite-backed DOs are available on the free plan. KV-backed DO storage requires the paid plan. DevSage uses SQLite-backed DOs exclusively (declared via `new_sqlite_classes` in wrangler.jsonc).

## R2

| Resource | Free | Paid |
|----------|------|------|
| Storage | 10 GB/month | $0.015/GB-month |
| Class A operations | 1M/month | $4.50/M |
| Class B operations | 10M/month | $0.36/M |
| Egress | **Free (unlimited)** | **Free (unlimited)** |

---

## Estimated Cost at Scale (Paid Plan)

**1,000 hackathon participants, 10 active hackathons:**

| Resource | Monthly Usage | Cost |
|----------|--------------|------|
| Workers base fee | — | $5.00 |
| Worker requests | ~2M | included |
| D1 reads | ~10M | included |
| D1 writes | ~500K | included |
| KV reads | ~2M | ~$1.00 |
| KV writes | ~100K | included |
| Queue operations | ~50K | included |
| DO requests | ~10K | included |
| R2 storage | ~5 GB | included |
| **Total** | | **~$6/mo** |

---

## Monitoring

- **Cloudflare Dashboard → Workers → Analytics** — request volume, CPU time, errors
- **D1 → Metrics** — rows read/written per day, storage
- **KV → Analytics** — read/write counts (set alert before hitting 1K writes/day on free tier)
- Set up **usage alerts** in Cloudflare dashboard before hitting free tier limits

## Implementation Notes

- Free tier limits reset **daily at 00:00 UTC**, not monthly
- D1 is the primary cost driver at scale (row writes especially)
- KV writes for rate limiting are the primary constraint on free tier — see mitigation above
- DO SQLite storage is per-hackathon — inactive DOs hibernate (no duration charge)
- R2 storage (Phase 2) adds $0.015/GB/mo for file uploads
- Queue operations count both send and ack — a single message = 2 operations minimum
- Cron invocations count against Worker request quota (24/day = negligible)
