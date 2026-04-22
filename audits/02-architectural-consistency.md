# Phase 2 Audit Report: Architectural Consistency

This report details the findings from the Phase 2 analytical audit of the AIMS v2 platform's architectural consistency. The focus was on verifying that the four core load-bearing architectural decisions (ADRs) are universally respected across all documentation, product specifications, and structural code.

## 1. API Layer Split (Fastify vs. NestJS)
**Status: ✅ PASSED**
**Canonical Record:** `ADR-0003`

The repository clearly and consistently delineates the two-tier API architecture:
- **Request Path (Hot Path):** Documented consistently as Fastify + tRPC v11 + REST (via OpenAPI 3.1). The rationale—avoiding heavy DI on the hot path for performance and simplicity—is universally cited in `04-architecture-tour.md`, `06-design-decisions.md`, and `07-handbook-for-engineers.md`.
- **Worker Tier:** Consistently allocated to NestJS for background work (document generation, transactional-outbox dispatch, scheduled jobs). The justification for retaining NestJS here (taking advantage of module lifecycle and `@Cron` decorators) is well-understood.
- **Shared Code:** Correctly positioned in the `packages/` directory (`packages/prisma-client/`, `packages/encryption/`) ensuring that the core business and security logic is framework-agnostic and accessible by both tiers.

## 2. Tenant Isolation (Two-Layer Model)
**Status: ✅ PASSED**
**Canonical Record:** `ADR-0002`

The tenant isolation strategy is exceptionally robust and accurately documented:
- **Primary Enforcement (App-Layer):** The Prisma Client Extension living in `packages/prisma-client/` that injects `tenantId` into every WHERE clause is correctly identified as the primary, unit-testable enforcement mechanism.
- **Defence-in-Depth (DB-Layer):** Postgres Row-Level Security (RLS) is accurately scoped as the fallback mechanism.
- **Pooling Reality:** `database/POOLING.md` correctly acknowledges the risks of connection pool multiplexing with `SET LOCAL app.current_tenant`, reinforcing why the Prisma Client Extension is the load-bearing layer.

## 3. Application-Layer Encryption (ALE)
**Status: ✅ PASSED**
**Canonical Record:** `ADR-0001`

The complete purge of `pgcrypto` in favor of ALE is successfully enforced:
- **Codebase Sweep:** All traces of `pgcrypto` usage for field-level encryption have been removed or updated with explicit explanations of why it was rejected (e.g., key leakage via query logs, memory dumps, and `pg_stat_statements`).
- **Implementation Rules:** The mandate to use the helper module in `packages/encryption/` with AWS KMS-wrapped per-tenant Data Encryption Keys (DEKs) is uniformly cited across the engineer handbook, the architecture tour, and the schema definitions.
- **Schema Validation:** `database/schema.prisma` explicitly excludes `pgcrypto` in its extensions block.

## 4. Negative Architecture Constraints
**Status: ✅ PASSED**
**Reference:** `06-design-decisions.md` §7.1 and §7.2

The platform's explicit "No" decisions are holding strong, preventing scope creep:
- **No UI Workflow Designer:** Consistently stated that workflows are declared via standard packs (`workflows` array), not visually dragged-and-dropped. The rationale (avoiding the "implementation tar pit" of bespoke workflow engines) is clear.
- **No "AI Auditor":** The platform explicitly disavows automated evidence evaluation or control-effectiveness rulings, properly deferring judgment to the human auditor to maintain professional compliance standards.
- **No Bespoke BI Tools:** Analytics are deliberately scoped to star-schema warehouse exports rather than in-product dashboard authorship.

> [!TIP]
> **Conclusion:** The architectural narrative is watertight. The recent structural pivots (ADRs 0001-0004) have been meticulously cascaded throughout the entire documentation tree. The project is highly consistent and structurally sound.

---
*Proceeding to Phase 3: Data Plane & Schema Viability.*
