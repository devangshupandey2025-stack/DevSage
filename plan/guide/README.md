# DevSage Implementation Guide — Single Source of Truth

> **Purpose:** If you build from this guide alone, the result will be a production-ready, zero-error, fully consistent hackathon management platform.

## Documents

| File | What It Covers |
|------|----------------|
| `01-architecture.md` | System architecture, runtime, bindings, middleware pipeline |
| `02-auth.md` | Authentication, authorization, roles, tokens, OAuth, cookies |
| `03-api-contracts.md` | Every API endpoint — method, path, role, request, response, errors |
| `04-data-models.md` | Every database table, column, index, constraint, relationship |
| `05-state-machines.md` | Hackathon lifecycle, request pipeline, round states, team states |
| `06-async-systems.md` | Queues, cron, Durable Objects, notifications, webhooks |
| `07-frontend-apps.md` | All 4 apps — pages, routing, auth flow, API integration patterns |
| `08-conventions.md` | Code style, naming, error handling, pagination, timestamps, testing |
| `09-end-to-end-flows.md` | Every user journey start-to-finish — exact API calls, state changes, data mutations |

## Reading Order

1. `08-conventions.md` — Read first. Sets the rules everything else follows.
2. `01-architecture.md` — Understand how the system is wired.
3. `02-auth.md` — Auth touches every endpoint.
4. `04-data-models.md` — Know the data before the API.
5. `05-state-machines.md` — Business logic lives here.
6. `03-api-contracts.md` — The API contract reference.
7. `06-async-systems.md` — Background processing.
8. `07-frontend-apps.md` — How frontends consume the API.
9. `09-end-to-end-flows.md` — Complete user journeys tying everything together.
