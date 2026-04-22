# AIMS v2 — Multi-Standard Audit Information Management Platform

> Greenfield SaaS platform for internal audit teams. Designed to work across GAGAS, IIA GIAS, ISO 19011, SOC 2, COSO, and other audit standards via pluggable "standard packs."

**Status**: Tier 2 active — Vertical Slice A in progress (Engagement → Finding → PDF). Spec tier complete. No production deployment yet.

---

## New to this repo?

Read [CLAUDE.md](CLAUDE.md) first — it's the orientation doc for any new session (human or otherwise). It covers what's canonical, what's stale, where every piece of work lives, and what not to do.

## Active work

See [VERTICAL-SLICE-PLAN.md](VERTICAL-SLICE-PLAN.md). This is the implementation roadmap for Slice A. Six decision points in §10, week-by-week tasks in §4.

## Quick orientation

```
aims-v2-platform/
├── CLAUDE.md                  # Session-onboarding doc (read first)
├── VERTICAL-SLICE-PLAN.md     # Active implementation plan (Slice A)
├── MASTER-PLAN.md             # 36-week product roadmap (partially stale — see CLAUDE.md §3)
├── TECH-STACK.md              # Canonical tech choices
│
├── apps/                      # Application code (Slice A scaffold in progress)
│   ├── web/                   # Next.js 15 frontend
│   ├── api/                   # Fastify hot-path API (tRPC + REST)
│   └── worker/                # NestJS worker tier (SQS consumers, PDF render, audit-log)
│
├── packages/                  # Shared workspace packages
│   ├── prisma-client/         # Tenant-isolated Prisma client
│   ├── encryption/            # Application-Layer Encryption (ALE) via KMS-wrapped DEKs
│   └── validation/            # Shared Zod schemas
│
├── product/                   # Product + UX specs (Phases 1–6, all closed)
├── data-model/                # Standard pack schema + example packs
├── database/                  # PostgreSQL + Prisma design
├── auth/                      # Identity + auth architecture
├── api/                       # tRPC + REST + webhooks design
├── frontend/                  # Frontend architecture + design system
├── devops/                    # AWS + EKS + OpenTelemetry + DR
├── engineering/               # TypeScript + testing + quality gates
├── security/                  # SOC 2 + ISO 27001 + privacy
├── docs/                      # Narrative onboarding (8 docs)
├── audits/                    # Gemini 5-phase analytical audit reports
├── references/adr/            # 7 Architecture Decision Records — canonical
└── phases/                    # ⚠️ Partially stale build roadmap (see CLAUDE.md §3)
```

## Getting started (development)

Prerequisites:
- Node 22+ (use `nvm use` — `.nvmrc` pins it)
- pnpm 9+ (`corepack enable && corepack prepare pnpm@latest --activate`)
- Docker + docker-compose (for Postgres, LocalStack, etc.)

```bash
# Install workspace dependencies
pnpm install

# (Task 1.2 — coming next) Bring up infra
# docker compose -f infra/docker-compose.yml up -d

# Run all apps in parallel dev mode
pnpm dev

# Type-check everything
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format
```

## Architectural anchors

Seven ADRs govern the load-bearing decisions. If you're unsure about a tradeoff, check [`references/adr/`](references/adr/) first.

- ADR-0001 — [ALE replaces pgcrypto](references/adr/0001-ale-replaces-pgcrypto.md)
- ADR-0002 — [Tenant isolation: two-layer](references/adr/0002-tenant-isolation-two-layer.md)
- ADR-0003 — [NestJS scoped to workers](references/adr/0003-nestjs-scoped-to-workers.md) (Fastify on hot path)
- ADR-0004 — [SQS for worker queuing](references/adr/0004-sqs-for-worker-queuing.md)
- ADR-0005 — [Session revocation hybrid](references/adr/0005-session-revocation-hybrid.md)
- ADR-0006 — [Regional silos](references/adr/0006-regional-silos.md)
- ADR-0007 — [Hybrid API versioning](references/adr/0007-hybrid-api-versioning.md)

## License

Proprietary. Owner: Harshad Bhoi. Not open-source.

---

*Last updated: 2026-04-22. Monorepo scaffold per VERTICAL-SLICE-PLAN.md Task 1.1.*
