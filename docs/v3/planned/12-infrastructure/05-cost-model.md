# Cost Model

> Cloudflare Workers resource limits and pricing estimates.

## Workers Free Plan Limits

| Resource | Limit |
|----------|-------|
| Requests/day | 100,000 |
| CPU time/request | 10ms |
| Worker size | 1 MB compressed |

## Workers Paid Plan ($5/mo base)

| Resource | Included | Overage |
|----------|----------|---------|
| Requests | 10M/mo | $0.30/M |
| CPU time | 30s/request | — |
| Worker size | 10 MB compressed | — |

## D1

| Resource | Free | Paid |
|----------|------|------|
| Rows read/day | 5M | 25B/mo ($0.001/M) |
| Rows written/day | 100K | 50M/mo ($1.00/M) |
| Storage | 5 GB | 5 GB ($0.75/GB) |

## KV

| Resource | Free | Paid |
|----------|------|------|
| Reads/day | 100K | Unlimited ($0.50/M) |
| Writes/day | 1K | Unlimited ($5.00/M) |
| Storage | 1 GB | $0.50/GB |

## Queues

| Resource | Included | Overage |
|----------|----------|---------|
| Messages/mo | 1M | $0.40/M |
| Operations | Counted per send + ack | — |

## Durable Objects

| Resource | Included | Overage |
|----------|----------|---------|
| Requests | 1M/mo | $0.15/M |
| Duration | 400K GB-s/mo | $12.50/M GB-s |
| SQLite storage | 50 GB | $0.20/GB |

## Estimated Cost at Scale

**1,000 hackathon participants, 10 active hackathons:**

| Resource | Monthly Usage | Cost |
|----------|--------------|------|
| Worker requests | ~2M | included |
| D1 reads | ~10M | included |
| D1 writes | ~500K | included |
| KV reads (rate limits) | ~2M | ~$1 |
| Queue messages | ~50K | included |
| DO requests | ~10K | included |
| **Total** | | **~$6/mo** |

## Implementation Notes

- D1 is the primary cost driver at scale (row writes especially)
- KV writes for rate limiting are fire-and-forget with TTL — self-cleaning
- DO SQLite storage is per-hackathon — inactive DOs hibernate (no duration charge)
- R2 storage (Phase 2) adds $0.015/GB/mo for file uploads
- Monitor via Cloudflare dashboard → Workers → Analytics
