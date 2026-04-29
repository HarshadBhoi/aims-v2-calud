# Phase 1 — Foundation

> **⚠ Reconciliation 2026-04-28**: PARTIALLY SUPERSEDED. This 36-week roadmap predates the Tier 1 design work and the 7+ ADRs. Per-task headers carry their own status banners. Slice A's W1+W2 substrate is shipped (monorepo, schema, RLS, ALE, audit log hash chain, auth, tRPC API, Next.js shell). For the canonical "what we built" view see [VERTICAL-SLICE-PLAN.md](../../VERTICAL-SLICE-PLAN.md) and [CLAUDE.md §5](../../CLAUDE.md).

> **Goal**: Set up the project, database, auth, and base UI shell.
> Everything built here is standard-agnostic — it's the platform foundation.

**Duration**: Weeks 1-4
**Dependencies**: None (starting point)
**Unlocks**: Phase 2 (Core Engine)

---

## Deliverables

| # | Task | Status | Detail |
|---|------|--------|--------|
| 1.1 | Project Setup & Monorepo | Pending | [Detail](1.1-project-setup.md) |
| 1.2 | Database Schema & ORM | Pending | [Detail](1.2-database-schema.md) |
| 1.3 | Authentication & Authorization | Pending | [Detail](1.3-auth-system.md) |
| 1.4 | UI Shell & Design System | Pending | [Detail](1.4-ui-shell.md) |
| 1.5 | Multi-Tenancy Architecture | Pending | [Detail](1.5-multi-tenancy.md) |
| 1.6 | File Storage Service | Pending | [Detail](1.6-file-storage.md) |

---

## Definition of Done

- [ ] Monorepo builds and runs with `pnpm dev`
- [ ] PostgreSQL database with migrations running
- [ ] User can register, login, logout (email + password)
- [ ] RBAC middleware protecting API routes
- [ ] UI shell renders: sidebar nav, top bar, main content area
- [ ] Design system: buttons, inputs, cards, tables, modals working
- [ ] File upload/download working to S3-compatible storage
- [ ] Multi-tenant data isolation verified (Tenant A cannot see Tenant B data)
- [ ] Docker Compose runs the full stack locally
- [ ] CI pipeline runs lint + type-check + tests on every PR
