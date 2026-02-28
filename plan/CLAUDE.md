# Plan Directory — CLAUDE.md

This directory contains the product plan for DevSage. The role-* files define what needs to be built. The guide/ subdirectory contains implementation plans derived from them.

## How to Use This Directory

- `role-*.md` — Product specs organized by user role. Source of truth for requirements.
- `role-*.mermaid` — Visual flow diagrams for each role.
- `guide/backend/` — Backend implementation plan (API, DB, queues, DOs, services).
- `guide/frontend/` — Frontend implementation plan (4 apps: web, platform, judge, admin).

---

## Specialized Agents Available

When working on implementation plans or tasks derived from these plan docs, use the **correct specialized agent** — not the generic Plan or Explore agents. Below is the full registry.

### Backend & API

| Agent | Use For |
|-------|---------|
| `backend-development:backend-architect` | API design, microservices, distributed systems, service boundaries, REST/GraphQL/gRPC |
| `backend-development:tdd-orchestrator` | TDD red-green-refactor, test-driven workflows |
| `backend-development:temporal-python-pro` | Temporal workflows, saga patterns, distributed transactions |
| `backend-development:performance-engineer` | Response times, memory, query efficiency, scalability |
| `backend-development:security-auditor` | Security vulnerabilities, OWASP, auth flaws |
| `backend-development:graphql-architect` | GraphQL federation, caching, real-time systems |
| `backend-development:test-automator` | Unit, integration, E2E test suites |
| `backend-development:event-sourcing-architect` | Event sourcing, CQRS, event stores, projections, sagas |

### Frontend & Mobile

| Agent | Use For |
|-------|---------|
| `frontend-mobile-development:frontend-developer` | React 19, Next.js 15, responsive layouts, state management, accessibility |
| `frontend-mobile-development:mobile-developer` | React Native, Flutter, native mobile, offline sync |
| `multi-platform-apps:frontend-developer` | Multi-app frontend architecture (our 4 SPAs) |
| `multi-platform-apps:mobile-developer` | Cross-platform mobile |
| `multi-platform-apps:ui-ux-designer` | Interface design, wireframes, design systems, user research |
| `multi-platform-apps:backend-architect` | Backend for multi-platform apps |
| `multi-platform-apps:ios-developer` | Native iOS (Swift/SwiftUI) |
| `multi-platform-apps:flutter-expert` | Flutter/Dart multi-platform |

### UI & Design

| Agent | Use For |
|-------|---------|
| `ui-design:ui-designer` | Component creation, layout systems, visual design |
| `ui-design:design-system-architect` | Design tokens, component libraries, theming infrastructure |
| `ui-design:accessibility-expert` | WCAG compliance, screen readers, keyboard navigation |
| `accessibility-compliance:ui-visual-validator` | Visual regression testing, screenshot analysis |

### JavaScript & TypeScript

| Agent | Use For |
|-------|---------|
| `javascript-typescript:typescript-pro` | Advanced types, generics, strict mode, type inference |
| `javascript-typescript:javascript-pro` | ES6+, async patterns, Node.js APIs |

### API Design & Scaffolding

| Agent | Use For |
|-------|---------|
| `api-scaffolding:fastapi-pro` | FastAPI, async Python APIs |
| `api-scaffolding:backend-architect` | API architecture, service boundaries |
| `api-scaffolding:django-pro` | Django development |
| `api-scaffolding:graphql-architect` | GraphQL architecture |

### Database

| Agent | Use For |
|-------|---------|
| `database-design:database-architect` | Schema modeling, technology selection, data architecture |
| `database-design:sql-pro` | SQL optimization, OLTP/OLAP, query tuning |
| `database-cloud-optimization:database-architect` | Data layer design, schema modeling |
| `database-cloud-optimization:database-optimizer` | Query optimization, indexing, N+1, caching, partitioning |
| `database-cloud-optimization:cloud-architect` | Cloud database services |
| `database-cloud-optimization:backend-architect` | Backend for database-heavy systems |
| `database-migrations:database-optimizer` | Migration performance |
| `database-migrations:database-admin` | Cloud DBs, HA, DR, automation |

### Security

| Agent | Use For |
|-------|---------|
| `security-compliance:security-auditor` | DevSecOps, OWASP, OAuth2/OIDC, GDPR/HIPAA/SOC2 |
| `security-scanning:threat-modeling-expert` | Threat modeling |
| `security-scanning:security-auditor` | Vulnerability assessment, compliance |
| `backend-api-security:backend-architect` | Secure API architecture |
| `backend-api-security:backend-security-coder` | Input validation, auth implementation, API security code |
| `frontend-mobile-security:frontend-security-coder` | XSS prevention, output sanitization, client-side security |
| `frontend-mobile-security:mobile-security-coder` | Mobile security patterns, WebView security |
| `data-validation-suite:backend-security-coder` | Input validation, secure coding |

### Testing

| Agent | Use For |
|-------|---------|
| `unit-testing:test-automator` | Test automation, self-healing tests, CI/CD integration |
| `unit-testing:debugger` | Test failures, unexpected behavior |
| `tdd-workflows:tdd-orchestrator` | TDD governance, red-green-refactor |
| `tdd-workflows:code-reviewer` | Code quality during TDD |
| `performance-testing-review:performance-engineer` | Load testing, benchmarking |
| `performance-testing-review:test-automator` | Performance test automation |
| `codebase-cleanup:test-automator` | Test coverage for cleanup work |

### Code Review & Quality

| Agent | Use For |
|-------|---------|
| `comprehensive-review:code-reviewer` | AI-powered code analysis, security, performance |
| `comprehensive-review:architect-review` | Architecture integrity, scalability, DDD |
| `comprehensive-review:security-auditor` | Security audit during review |
| `code-refactoring:code-reviewer` | Review during refactoring |
| `code-refactoring:legacy-modernizer` | Legacy migration, tech debt, framework updates |
| `git-pr-workflows:code-reviewer` | PR-focused code review |

### Documentation

| Agent | Use For |
|-------|---------|
| `documentation-generation:docs-architect` | Technical documentation from codebases |
| `documentation-generation:tutorial-engineer` | Step-by-step tutorials, onboarding guides |
| `documentation-generation:reference-builder` | API references, configuration guides |
| `documentation-generation:mermaid-expert` | Mermaid diagrams (flowcharts, ERDs, sequences) |
| `documentation-generation:api-documenter` | OpenAPI docs, developer portals |
| `code-documentation:docs-architect` | Architecture guides, technical deep-dives |
| `code-documentation:tutorial-engineer` | Feature tutorials, concept explanations |

### DevOps, CI/CD & Cloud

| Agent | Use For |
|-------|---------|
| `cloud-infrastructure:cloud-architect` | AWS/Azure/GCP, IaC, FinOps, serverless |
| `cloud-infrastructure:kubernetes-architect` | K8s, GitOps, service mesh, EKS/AKS/GKE |
| `cloud-infrastructure:terraform-specialist` | Terraform/OpenTofu, state management, modules |
| `cloud-infrastructure:deployment-engineer` | CI/CD, GitHub Actions, ArgoCD, progressive delivery |
| `cloud-infrastructure:network-engineer` | Cloud networking, zero-trust, CDN, load balancing |
| `cloud-infrastructure:hybrid-cloud-architect` | Multi-cloud, edge computing, workload placement |
| `cloud-infrastructure:service-mesh-expert` | Service mesh patterns |
| `cicd-automation:deployment-engineer` | CI/CD pipelines, deployment automation |
| `cicd-automation:kubernetes-architect` | K8s for CI/CD |
| `cicd-automation:devops-troubleshooter` | Incident response, debugging, log analysis |
| `cicd-automation:terraform-specialist` | IaC automation |
| `cicd-automation:cloud-architect` | Cloud architecture for CI/CD |
| `deployment-strategies:deployment-engineer` | Deployment automation, zero-downtime |
| `deployment-strategies:terraform-specialist` | IaC for deployments |
| `deployment-validation:cloud-architect` | Cloud validation |

### Observability & Performance

| Agent | Use For |
|-------|---------|
| `observability-monitoring:observability-engineer` | Monitoring, logging, tracing, SLI/SLO |
| `observability-monitoring:performance-engineer` | OpenTelemetry, distributed tracing, Core Web Vitals |
| `observability-monitoring:database-optimizer` | DB monitoring |
| `observability-monitoring:network-engineer` | Network monitoring |
| `application-performance:observability-engineer` | Observability strategies |
| `application-performance:performance-engineer` | App optimization, caching, load testing |
| `application-performance:frontend-developer` | Frontend performance, Core Web Vitals |

### Debugging & Error Handling

| Agent | Use For |
|-------|---------|
| `debugging-toolkit:debugger` | Errors, test failures, unexpected behavior |
| `debugging-toolkit:dx-optimizer` | Developer experience, tooling, workflows |
| `error-debugging:error-detective` | Error patterns, stack traces, log correlation |
| `error-debugging:debugger` | Root cause analysis |
| `error-diagnostics:error-detective` | Error patterns, anomalies |
| `error-diagnostics:debugger` | Debugging |
| `distributed-debugging:error-detective` | Cross-system error correlation |
| `distributed-debugging:devops-troubleshooter` | Production debugging, incident response |

### Incident Response

| Agent | Use For |
|-------|---------|
| `incident-response:incident-responder` | Production incidents, SRE practices |
| `incident-response:error-detective` | Error analysis for incidents |
| `incident-response:code-reviewer` | Logic flaws, fix recommendations |
| `incident-response:devops-troubleshooter` | Rapid incident resolution |
| `incident-response:debugger` | Root cause via code path tracing, git bisect |
| `incident-response:test-automator` | Regression tests after incidents |

### Agent Teams (Parallel Work)

| Agent | Use For |
|-------|---------|
| `agent-teams:team-lead` | Decompose work, coordinate parallel agents |
| `agent-teams:team-implementer` | Parallel feature building with file ownership |
| `agent-teams:team-reviewer` | Multi-dimensional parallel code review |
| `agent-teams:team-debugger` | Hypothesis-driven parallel debugging |

### Architecture Documentation (C4)

| Agent | Use For |
|-------|---------|
| `c4-architecture:c4-code` | Code-level documentation (function signatures, dependencies) |
| `c4-architecture:c4-component` | Component-level architecture |
| `c4-architecture:c4-container` | Container-level deployment architecture |
| `c4-architecture:c4-context` | System context diagrams, personas, features |

### AI / LLM Development

| Agent | Use For |
|-------|---------|
| `llm-application-dev:ai-engineer` | LLM apps, RAG systems, agent orchestration |
| `llm-application-dev:prompt-engineer` | Prompt optimization, chain-of-thought |
| `llm-application-dev:vector-database-engineer` | Vector search, embeddings, semantic retrieval |
| `context-management:context-manager` | Context engineering, knowledge graphs, memory systems |
| `agent-orchestration:context-manager` | Multi-agent context orchestration |

### Data Engineering & ML

| Agent | Use For |
|-------|---------|
| `data-engineering:data-engineer` | Data pipelines, Spark, dbt, Airflow |
| `data-engineering:backend-architect` | Backend for data systems |
| `machine-learning-ops:data-scientist` | Analytics, ML, statistical modeling |
| `machine-learning-ops:mlops-engineer` | ML pipelines, experiment tracking |
| `machine-learning-ops:ml-engineer` | Model serving, feature engineering |

### Language-Specific

| Agent | Use For |
|-------|---------|
| `python-development:python-pro` | Python 3.12+, async, performance |
| `python-development:fastapi-pro` | FastAPI, SQLAlchemy 2.0, Pydantic V2 |
| `python-development:django-pro` | Django 5.x, DRF, Celery |
| `systems-programming:rust-pro` | Rust, systems programming |
| `systems-programming:golang-pro` | Go microservices, concurrency |
| `systems-programming:cpp-pro` | C++, templates, RAII |
| `systems-programming:c-pro` | C, memory management, embedded |
| `jvm-languages:java-pro` | Java 21+, Spring Boot 3.x |
| `jvm-languages:scala-pro` | Scala, Akka, ZIO, Spark |
| `jvm-languages:csharp-pro` | C#, .NET, async/await |
| `functional-programming:elixir-pro` | Elixir, OTP, Phoenix LiveView |
| `functional-programming:haskell-pro` | Haskell, advanced type systems |
| `web-scripting:ruby-pro` | Ruby, Rails, metaprogramming |
| `web-scripting:php-pro` | PHP, SPL, modern OOP |
| `shell-scripting:bash-pro` | Bash scripting, CI/CD automation |
| `shell-scripting:posix-shell-pro` | POSIX sh, maximum portability |
| `dotnet-contribution:dotnet-architect` | .NET architecture, ASP.NET Core, EF |
| `julia-development:julia-pro` | Julia, scientific computing |

### Business & Content

| Agent | Use For |
|-------|---------|
| `business-analytics:business-analyst` | KPI frameworks, analytics, data-driven insights |
| `startup-business-analyst:startup-analyst` | Market sizing, financial modeling, competitive analysis |
| `content-marketing:content-marketer` | Content strategy, SEO, distribution |
| `content-marketing:search-specialist` | Web research, competitive analysis |
| `customer-sales-automation:sales-automator` | Cold emails, proposals, pricing pages |
| `customer-sales-automation:customer-support` | Conversational AI, support automation |
| `quantitative-trading:quant-analyst` | Financial models, backtesting, risk metrics |
| `quantitative-trading:risk-manager` | Portfolio risk, position limits, hedging |

### Payments

| Agent | Use For |
|-------|---------|
| `payment-processing:payment-integration` | Stripe, PayPal, checkout, subscriptions, PCI |

### Legal & HR

| Agent | Use For |
|-------|---------|
| `hr-legal-compliance:legal-advisor` | Privacy policies, ToS, GDPR compliance texts |
| `hr-legal-compliance:hr-pro` | Hiring, onboarding, PTO, performance, policies |

### Reverse Engineering & Security Research

| Agent | Use For |
|-------|---------|
| `reverse-engineering:reverse-engineer` | Binary analysis, disassembly, decompilation |
| `reverse-engineering:malware-analyst` | Malware research, threat intelligence |
| `reverse-engineering:firmware-analyst` | Firmware extraction, IoT security |

### Embedded Systems

| Agent | Use For |
|-------|---------|
| `arm-cortex-microcontrollers:arm-cortex-expert` | ARM Cortex-M firmware, drivers, DMA, interrupts |

### Game Development

| Agent | Use For |
|-------|---------|
| `game-development:unity-developer` | Unity 6, C#, URP/HDRP, cross-platform |
| `game-development:minecraft-bukkit-pro` | Bukkit/Spigot/Paper plugins |

### Generic (use only when no specialized agent fits)

| Agent | Use For |
|-------|---------|
| `general-purpose` | Multi-step research, code search, complex tasks |
| `Explore` | Codebase exploration, file/keyword search (quick/medium/very thorough) |
| `Plan` | **Generic** implementation planning — prefer specialized architects instead |

---

## Agent Selection Rules

1. **Never use `Plan` when a specialized architect exists.** For backend plans use `backend-development:backend-architect`. For frontend plans use `multi-platform-apps:frontend-developer` or `frontend-mobile-development:frontend-developer`.
2. **Use `Explore` only for codebase search/discovery**, not for requirements analysis or planning.
3. **Use `agent-teams:team-lead`** when work can be decomposed into parallel tracks with file ownership boundaries.
4. **For DevSage specifically:**
   - Backend API work → `backend-development:backend-architect`
   - Frontend (any of the 4 apps) → `multi-platform-apps:frontend-developer`
   - Database schema → `database-design:database-architect`
   - Security review → `security-compliance:security-auditor`
   - TypeScript types → `javascript-typescript:typescript-pro`
   - Test writing → `backend-development:test-automator` or `unit-testing:test-automator`
   - Cloudflare Workers specifics → load the `workers-best-practices` skill
   - Hono routes → load the `hono-cloudflare` skill
   - Durable Objects → load the `durable-objects` skill
